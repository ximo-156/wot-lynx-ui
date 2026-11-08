#import "WotMediaPicker.h"

#import <AVFoundation/AVFoundation.h>
#import <PhotosUI/PhotosUI.h>
#import <UIKit/UIKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <math.h>

#if __IPHONE_OS_VERSION_MAX_ALLOWED < 140000
#error WotMediaPicker requires an iOS 14 or newer Apple SDK.
#endif

static const NSUInteger WMPMaximumSelectionCount = 50;
static const NSTimeInterval WMPImportTimeout = 60.0;
static void *WMPWorkQueueKey = &WMPWorkQueueKey;

static NSDictionary *WMPFailure(NSString *code, NSString *message) {
  return @{ @"success" : @NO, @"code" : code, @"errMsg" : message };
}

static NSError *WMPError(NSInteger code, NSString *message) {
  return [NSError errorWithDomain:@"WotMediaPicker" code:code
                        userInfo:@{ NSLocalizedDescriptionKey : message }];
}

@class WMPRequest;

/** One picker for the app, including calls made by different Lynx module instances. */
@interface WMPCoordinator : NSObject
@property(nonatomic, strong, nullable) WMPRequest *activeRequest;
+ (instancetype)shared;
- (void)begin:(NSDictionary *)options callback:(void (^)(NSDictionary *))callback;
- (void)releaseRequest:(WMPRequest *)request;
@end

@interface WMPRequest : NSObject <PHPickerViewControllerDelegate,
                                  UIImagePickerControllerDelegate,
                                  UINavigationControllerDelegate,
                                  UIAdaptivePresentationControllerDelegate>
@property(nonatomic, weak) WMPCoordinator *coordinator;
@property(nonatomic, copy, nullable) void (^callback)(NSDictionary *);
@property(nonatomic, weak, nullable) UIViewController *presenter;
@property(nonatomic, weak, nullable) UIWindow *window;
@property(nonatomic, strong, nullable) UIViewController *controller;
@property(nonatomic, strong, nullable) id sceneObserver;
@property(nonatomic, strong) dispatch_queue_t workQueue;
@property(nonatomic, strong, nullable) NSURL *cacheDirectory;
@property(nonatomic, strong, nullable) NSDictionary *pendingResult;
@property(nonatomic, assign) NSUInteger count;
@property(nonatomic, assign) BOOL allowImages;
@property(nonatomic, assign) BOOL allowVideos;
@property(nonatomic, assign) BOOL allowAlbum;
@property(nonatomic, assign) BOOL allowCamera;
@property(nonatomic, assign) UIImagePickerControllerCameraDevice cameraDevice;
@property(nonatomic, assign) BOOL dismissing;
@property(nonatomic, assign) BOOL importing;
@property(atomic, assign) BOOL finished;
- (nullable NSDictionary *)configure:(NSDictionary *)options;
- (void)start;
- (void)deliver:(NSDictionary *)result;
- (void)finishNow:(NSDictionary *)result;
- (void)presentSourceChoice;
- (void)presentAlbum;
- (void)authorizeCamera;
- (void)presentCamera;
- (void)dismissControllerThen:(dispatch_block_t)completion;
@end

@implementation WMPCoordinator

+ (instancetype)shared {
  static WMPCoordinator *coordinator;
  static dispatch_once_t once;
  dispatch_once(&once, ^{ coordinator = [WMPCoordinator new]; });
  return coordinator;
}

- (void)begin:(NSDictionary *)options callback:(void (^)(NSDictionary *))callback {
  NSAssert(NSThread.isMainThread, @"Picker coordination must be on the main queue");
  if (self.activeRequest) {
    callback(WMPFailure(@"BUSY", @"A media picker request is already active"));
    return;
  }
  WMPRequest *request = [WMPRequest new];
  NSDictionary *failure = [request configure:options];
  if (failure) {
    callback(failure);
    return;
  }
  request.coordinator = self;
  request.callback = callback;
  self.activeRequest = request;
  [request start];
}

- (void)releaseRequest:(WMPRequest *)request {
  NSAssert(NSThread.isMainThread, @"Picker release must be on the main queue");
  if (self.activeRequest == request) self.activeRequest = nil;
}

@end

@implementation WMPRequest

- (instancetype)init {
  self = [super init];
  if (self) {
    _workQueue = dispatch_queue_create("ui.wot.media-picker.files", DISPATCH_QUEUE_CONCURRENT);
    dispatch_queue_set_specific(_workQueue, WMPWorkQueueKey, (__bridge void *)self, NULL);
  }
  return self;
}

- (void)dealloc {
  if (_sceneObserver) [NSNotificationCenter.defaultCenter removeObserver:_sceneObserver];
}

- (NSDictionary *)configure:(NSDictionary *)options {
  if (![options isKindOfClass:NSDictionary.class]) {
    return WMPFailure(@"INVALID_OPTIONS", @"chooseMedia options must be an object");
  }
  id rawCount = options[@"count"];
  double requestedCount = rawCount ? ([rawCount isKindOfClass:NSNumber.class] ? [rawCount doubleValue] : NAN) : 1;
  if (!isfinite(requestedCount) || requestedCount < 1 || floor(requestedCount) != requestedCount ||
      requestedCount > WMPMaximumSelectionCount) {
    return WMPFailure(@"INVALID_OPTIONS", @"count must be an integer between 1 and 50");
  }
  id rawMultiple = options[@"multiple"];
  if (rawMultiple && ![rawMultiple isKindOfClass:NSNumber.class]) {
    return WMPFailure(@"INVALID_OPTIONS", @"multiple must be a boolean");
  }
  self.count = rawMultiple && ![rawMultiple boolValue] ? 1 : (NSUInteger)requestedCount;

  id rawMedia = options[@"mediaType"] ?: @[ @"image" ];
  if (![rawMedia isKindOfClass:NSArray.class] || ![rawMedia count]) {
    return WMPFailure(@"INVALID_OPTIONS", @"mediaType must contain image and/or video");
  }
  for (id type in rawMedia) {
    if ([type isEqual:@"image"]) self.allowImages = YES;
    else if ([type isEqual:@"video"]) self.allowVideos = YES;
    else return WMPFailure(@"UNSUPPORTED_MEDIA", @"Only image and video media types are supported");
  }

  id rawSources = options[@"sourceType"] ?: @[ @"album" ];
  if (![rawSources isKindOfClass:NSArray.class] || ![rawSources count]) {
    return WMPFailure(@"INVALID_OPTIONS", @"sourceType must contain album and/or camera");
  }
  for (id source in rawSources) {
    if ([source isEqual:@"album"]) self.allowAlbum = YES;
    else if ([source isEqual:@"camera"]) self.allowCamera = YES;
    else return WMPFailure(@"INVALID_OPTIONS", @"sourceType supports only album and camera");
  }
  if (self.allowCamera && !self.allowImages && !self.allowAlbum) {
    return WMPFailure(@"UNSUPPORTED_MEDIA", @"Camera source captures still photos, not video");
  }
  // Do not offer a still-photo camera for an album video-only request.
  if (!self.allowImages) self.allowCamera = NO;

  id camera = options[@"camera"] ?: @"back";
  if (![camera isEqual:@"front"] && ![camera isEqual:@"back"]) {
    return WMPFailure(@"INVALID_OPTIONS", @"camera must be front or back");
  }
  self.cameraDevice = [camera isEqual:@"front"] ? UIImagePickerControllerCameraDeviceFront
                                               : UIImagePickerControllerCameraDeviceRear;
  return nil;
}

+ (UIWindow *)foregroundWindow {
  // No deprecated keyWindow API and no arbitrary background scene.
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (scene.activationState != UISceneActivationStateForegroundActive ||
        ![scene isKindOfClass:UIWindowScene.class]) continue;
    UIWindowScene *windowScene = (UIWindowScene *)scene;
    for (UIWindow *window in windowScene.windows) {
      if (window.isKeyWindow && !window.hidden && window.rootViewController) return window;
    }
    for (UIWindow *window in windowScene.windows) {
      if (!window.hidden && window.windowLevel == UIWindowLevelNormal && window.rootViewController) return window;
    }
  }
  if (UIApplication.sharedApplication.connectedScenes.count == 0 &&
      UIApplication.sharedApplication.applicationState == UIApplicationStateActive) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    for (UIWindow *window in UIApplication.sharedApplication.windows) {
      if (window.isKeyWindow && !window.hidden && window.rootViewController) return window;
    }
    for (UIWindow *window in UIApplication.sharedApplication.windows) {
      if (!window.hidden && window.windowLevel == UIWindowLevelNormal && window.rootViewController) return window;
    }
#pragma clang diagnostic pop
  }
  return nil;
}

+ (UIViewController *)topController:(UIViewController *)root {
  UIViewController *current = root;
  while (current) {
    UIViewController *next = nil;
    if (current.presentedViewController && !current.presentedViewController.isBeingDismissed) {
      next = current.presentedViewController;
    } else if ([current isKindOfClass:UINavigationController.class]) {
      next = ((UINavigationController *)current).visibleViewController;
    } else if ([current isKindOfClass:UITabBarController.class]) {
      next = ((UITabBarController *)current).selectedViewController;
    } else if ([current isKindOfClass:UISplitViewController.class]) {
      for (UIViewController *child in ((UISplitViewController *)current).viewControllers.reverseObjectEnumerator) {
        if (child.isViewLoaded && child.view.window) { next = child; break; }
      }
    }
    if (!next || next == current) break;
    current = next;
  }
  return current;
}

- (BOOL)canPresent {
  UIViewController *presenter = self.presenter;
  return !self.finished && presenter && presenter.isViewLoaded && presenter.view.window &&
         !presenter.isBeingDismissed && !presenter.isBeingPresented && !presenter.presentedViewController;
}

- (void)start {
  UIWindow *window = [WMPRequest foregroundWindow];
  UIViewController *presenter = [WMPRequest topController:window.rootViewController];
  self.window = window;
  self.presenter = presenter;
  if (![self canPresent]) {
    [self deliver:WMPFailure(@"NO_PRESENTATION_CONTEXT", @"No active iOS view controller can present the picker")];
    return;
  }
  __weak WMPRequest *weakSelf = self;
  self.sceneObserver = [NSNotificationCenter.defaultCenter
      addObserverForName:UISceneDidDisconnectNotification object:window.windowScene queue:NSOperationQueue.mainQueue
      usingBlock:^(NSNotification *notification) {
        WMPRequest *request = weakSelf;
        if (request && !request.finished) {
          [request deliver:WMPFailure(@"SCENE_DISCONNECTED", @"The picker scene was disconnected")];
        }
      }];
  if (self.allowAlbum && self.allowCamera) [self presentSourceChoice];
  else if (self.allowCamera) [self authorizeCamera];
  else [self presentAlbum];
}

- (void)presentController:(UIViewController *)controller {
  if (![self canPresent]) {
    [self deliver:WMPFailure(@"NO_PRESENTATION_CONTEXT", @"The picker presentation context is no longer available")];
    return;
  }
  self.controller = controller;
  __weak WMPRequest *weakSelf = self;
  [self.presenter presentViewController:controller animated:YES completion:^{
    WMPRequest *request = weakSelf;
    if (request && !request.finished && request.controller == controller) {
      controller.presentationController.delegate = request;
    }
  }];
  controller.presentationController.delegate = self;
}

- (void)dismissControllerThen:(dispatch_block_t)completion {
  UIViewController *controller = self.controller;
  if (!controller || !controller.presentingViewController) {
    self.controller = nil;
    completion();
    return;
  }
  self.dismissing = YES;
  __weak WMPRequest *weakSelf = self;
  void (^closed)(void) = ^{
    WMPRequest *request = weakSelf;
    if (!request) return;
    if (request.controller == controller) request.controller = nil;
    request.dismissing = NO;
    completion();
    if (!request.finished && request.pendingResult) [request finishNow:request.pendingResult];
  };
  if (controller.isBeingDismissed && controller.transitionCoordinator) {
    [controller.transitionCoordinator animateAlongsideTransition:nil
                                                    completion:^(id<UIViewControllerTransitionCoordinatorContext> context) { closed(); }];
  } else {
    [controller dismissViewControllerAnimated:YES completion:closed];
  }
}

- (void)presentSourceChoice {
  UIAlertController *sheet = [UIAlertController alertControllerWithTitle:@"选择图片来源" message:nil
                                                         preferredStyle:UIAlertControllerStyleActionSheet];
  __weak WMPRequest *weakSelf = self;
  [sheet addAction:[UIAlertAction actionWithTitle:@"相册" style:UIAlertActionStyleDefault handler:^(UIAlertAction *action) {
    WMPRequest *request = weakSelf;
    [request dismissControllerThen:^{ if (!request.finished) [request presentAlbum]; }];
  }]];
  [sheet addAction:[UIAlertAction actionWithTitle:@"拍照" style:UIAlertActionStyleDefault handler:^(UIAlertAction *action) {
    WMPRequest *request = weakSelf;
    [request dismissControllerThen:^{ if (!request.finished) [request authorizeCamera]; }];
  }]];
  [sheet addAction:[UIAlertAction actionWithTitle:@"取消" style:UIAlertActionStyleCancel handler:^(UIAlertAction *action) {
    [weakSelf deliver:WMPFailure(@"CANCELLED", @"chooseMedia:fail cancel")];
  }]];
  // Action sheets require a popover anchor on iPad.
  UIPopoverPresentationController *popover = sheet.popoverPresentationController;
  popover.sourceView = self.presenter.view;
  CGRect bounds = self.presenter.view.bounds;
  popover.sourceRect = CGRectMake(CGRectGetMidX(bounds), CGRectGetMidY(bounds), 1, 1);
  popover.permittedArrowDirections = 0;
  [self presentController:sheet];
}

- (void)presentAlbum {
  if (self.finished) return;
  PHPickerConfiguration *configuration = [[PHPickerConfiguration alloc] init];
  configuration.selectionLimit = self.count;
  configuration.preferredAssetRepresentationMode = PHPickerConfigurationAssetRepresentationModeCompatible;
  if (self.allowImages && self.allowVideos) {
    configuration.filter = [PHPickerFilter anyFilterMatchingSubfilters:@[ PHPickerFilter.imagesFilter, PHPickerFilter.videosFilter ]];
  } else {
    configuration.filter = self.allowVideos ? PHPickerFilter.videosFilter : PHPickerFilter.imagesFilter;
  }
  if (@available(iOS 15.0, *)) configuration.selection = PHPickerConfigurationSelectionOrdered;
  PHPickerViewController *picker = [[PHPickerViewController alloc] initWithConfiguration:configuration];
  picker.delegate = self;
  picker.modalPresentationStyle = UIModalPresentationPageSheet;
  // PHPicker grants access only to the selected item providers. Do NOT request
  // PHPhotoLibrary authorization or broad read/write permission here.
  [self presentController:picker];
}

- (void)authorizeCamera {
  if (self.finished) return;
  if (![UIImagePickerController isSourceTypeAvailable:UIImagePickerControllerSourceTypeCamera] ||
      ![UIImagePickerController isCameraDeviceAvailable:self.cameraDevice]) {
    [self deliver:WMPFailure(@"CAMERA_UNAVAILABLE", @"The requested camera is unavailable on this device")];
    return;
  }
  id usage = [NSBundle.mainBundle objectForInfoDictionaryKey:@"NSCameraUsageDescription"];
  if (![usage isKindOfClass:NSString.class] || ![usage length]) {
    [self deliver:WMPFailure(@"MISSING_CAMERA_USAGE_DESCRIPTION", @"NSCameraUsageDescription must be set in the Explorer app Info.plist")];
    return;
  }
  AVAuthorizationStatus status = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeVideo];
  if (status == AVAuthorizationStatusAuthorized) {
    [self presentCamera];
  } else if (status == AVAuthorizationStatusNotDetermined) {
    __weak WMPRequest *weakSelf = self;
    [AVCaptureDevice requestAccessForMediaType:AVMediaTypeVideo completionHandler:^(BOOL granted) {
      dispatch_async(dispatch_get_main_queue(), ^{
        WMPRequest *request = weakSelf;
        if (!request || request.finished) return;
        if (granted) [request presentCamera];
        else [request deliver:WMPFailure(@"PERMISSION_DENIED", @"Camera access was denied")];
      });
    }];
  } else {
    [self deliver:WMPFailure(@"PERMISSION_DENIED", status == AVAuthorizationStatusRestricted
        ? @"Camera access is restricted on this device" : @"Camera access was denied; enable it in Settings")];
  }
}

- (void)presentCamera {
  if (self.finished) return;
  UIImagePickerController *picker = [UIImagePickerController new];
  picker.sourceType = UIImagePickerControllerSourceTypeCamera;
  picker.cameraDevice = self.cameraDevice;
  picker.mediaTypes = @[ UTTypeImage.identifier ];
  picker.cameraCaptureMode = UIImagePickerControllerCameraCaptureModePhoto;
  picker.allowsEditing = NO;
  picker.delegate = self;
  picker.modalPresentationStyle = UIModalPresentationFullScreen;
  [self presentController:picker];
}

- (void)presentationControllerDidDismiss:(UIPresentationController *)presentationController {
  if (!self.finished && !self.dismissing && !self.importing &&
      presentationController.presentedViewController == self.controller) {
    self.controller = nil;
    [self deliver:WMPFailure(@"CANCELLED", @"chooseMedia:fail cancel")];
  }
}

- (void)finishNow:(NSDictionary *)result {
  NSAssert(NSThread.isMainThread, @"Picker completion must be on the main queue");
  if (self.finished) return;
  self.finished = YES;
  self.importing = NO;
  if (self.sceneObserver) {
    [NSNotificationCenter.defaultCenter removeObserver:self.sceneObserver];
    self.sceneObserver = nil;
  }
  void (^callback)(NSDictionary *) = self.callback;
  self.callback = nil;
  [self.coordinator releaseRequest:self];
  // Release the global reservation and clear the callback BEFORE calling JS.
  // JS can synchronously request another picker; this request completes once.
  if (callback) callback(result);
}

- (void)deliver:(NSDictionary *)result {
  NSAssert(NSThread.isMainThread, @"Picker delivery must be on the main queue");
  if (self.finished || self.pendingResult) return;
  self.pendingResult = result;
  [self dismissControllerThen:^{ [self finishNow:result]; }];
}

- (void)beginImport {
  self.importing = YES;
  __weak WMPRequest *weakSelf = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(WMPImportTimeout * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    WMPRequest *request = weakSelf;
    if (request && !request.finished && request.importing) {
      [request deliver:WMPFailure(@"IMPORT_TIMEOUT", @"Selected media could not be imported within 60 seconds")];
    }
  });
}

- (BOOL)prepareCache:(NSError **)error {
  if (self.cacheDirectory) return YES;
  NSURL *base = [NSFileManager.defaultManager URLsForDirectory:NSCachesDirectory inDomains:NSUserDomainMask].firstObject;
  if (!base) {
    if (error) *error = WMPError(1, @"The application cache directory is unavailable");
    return NO;
  }
  NSURL *directory = [[base URLByAppendingPathComponent:@"WotMediaPicker" isDirectory:YES]
      URLByAppendingPathComponent:NSUUID.UUID.UUIDString isDirectory:YES];
  if (![NSFileManager.defaultManager createDirectoryAtURL:directory withIntermediateDirectories:YES
      attributes:@{ NSFileProtectionKey : NSFileProtectionCompleteUntilFirstUserAuthentication } error:error]) return NO;
  self.cacheDirectory = directory;
  return YES;
}

- (NSString *)safeExtension:(NSString *)extension fallback:(NSString *)fallback {
  NSString *lower = extension.lowercaseString;
  NSCharacterSet *invalid = [NSCharacterSet.alphanumericCharacterSet invertedSet];
  if (!lower.length || lower.length > 12 || [lower rangeOfCharacterFromSet:invalid].location != NSNotFound) return fallback;
  return lower;
}

- (void)withinProviderLifetime:(dispatch_block_t)work {
  // NSItemProvider may invoke its handler on an unspecified queue. The copy
  // must finish BEFORE that handler returns. Do not dispatch_async a temp URL.
  if (dispatch_get_specific(WMPWorkQueueKey) == (__bridge void *)self) work();
  else dispatch_sync(self.workQueue, work);
}

- (NSURL *)copyProviderFile:(NSURL *)source typeIdentifier:(NSString *)typeIdentifier error:(NSError **)error {
  if (!source.isFileURL) {
    if (error) *error = WMPError(2, @"The selected provider did not return a local file URL");
    return nil;
  }
  // Cache creation and filename allocation are serialized only briefly; actual
  // copies remain on the concurrent I/O queue, never the UIKit main queue.
  @synchronized(self) { if (![self prepareCache:error]) return nil; }
  NSString *preferred = [UTType typeWithIdentifier:typeIdentifier].preferredFilenameExtension ?: @"bin";
  NSString *extension = [self safeExtension:source.pathExtension fallback:preferred];
  NSURL *destination = [self.cacheDirectory URLByAppendingPathComponent:
      [NSUUID.UUID.UUIDString stringByAppendingPathExtension:extension]];
  BOOL accessed = [source startAccessingSecurityScopedResource];
  BOOL copied = [NSFileManager.defaultManager copyItemAtURL:source toURL:destination error:error];
  if (accessed) [source stopAccessingSecurityScopedResource];
  return copied ? destination : nil;
}

- (NSString *)displayName:(NSString *)suggested fileURL:(NSURL *)url {
  NSString *name = [suggested isKindOfClass:NSString.class] ? suggested.lastPathComponent : @"";
  if (!name.length) name = url.lastPathComponent;
  // Compatible representations can transcode HEIC to JPEG. Describe the real
  // cached representation, not the original incompatible filename extension.
  if (url.pathExtension.length) name = [name.stringByDeletingPathExtension stringByAppendingPathExtension:url.pathExtension];
  return name;
}

- (NSDictionary *)metadata:(NSURL *)url type:(NSString *)type suggestedName:(NSString *)name error:(NSError **)error {
  NSDictionary *attributes = [NSFileManager.defaultManager attributesOfItemAtPath:url.path error:error];
  NSNumber *size = attributes[NSFileSize];
  if (!size || size.unsignedLongLongValue == 0) {
    if (error && !*error) *error = WMPError(3, @"The cached media file is empty or unreadable");
    return nil;
  }
  NSMutableDictionary *file = [@{ @"fileType" : type, @"tempFilePath" : url.path,
      @"name" : [self displayName:name fileURL:url], @"size" : size } mutableCopy];
  if ([type isEqual:@"video"]) {
    AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url options:nil];
    NSTimeInterval duration = CMTimeGetSeconds(asset.duration);
    if (isfinite(duration) && duration >= 0) file[@"duration"] = @(duration);
    AVAssetImageGenerator *generator = [[AVAssetImageGenerator alloc] initWithAsset:asset];
    generator.appliesPreferredTrackTransform = YES;
    generator.maximumSize = CGSizeMake(640, 640);
    NSError *thumbnailError = nil;
    CGImageRef image = [generator copyCGImageAtTime:kCMTimeZero actualTime:NULL error:&thumbnailError];
    if (image) {
      NSData *jpeg = UIImageJPEGRepresentation([UIImage imageWithCGImage:image], 0.82);
      CGImageRelease(image);
      NSURL *thumbnail = [self.cacheDirectory URLByAppendingPathComponent:
          [NSString stringWithFormat:@"thumb-%@.jpg", NSUUID.UUID.UUIDString]];
      if (jpeg.length && [jpeg writeToURL:thumbnail options:NSDataWritingAtomic error:&thumbnailError]) {
        file[@"thumbTempFilePath"] = thumbnail.path;
      }
    }
    // A thumbnail is optional; an unreadable thumbnail does not fake one or
    // reject an otherwise valid copied video.
  }
  return file;
}

- (NSDictionary *)writeImage:(UIImage *)image suggestedName:(NSString *)name error:(NSError **)error {
  @synchronized(self) { if (![self prepareCache:error]) return nil; }
  CGSize pixels = CGSizeMake(image.size.width * image.scale, image.size.height * image.scale);
  if (pixels.width <= 0 || pixels.height <= 0) {
    if (error) *error = WMPError(4, @"The camera returned an empty image");
    return nil;
  }
  UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
  format.scale = 1;
  UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:pixels format:format];
  UIImage *upright = [renderer imageWithActions:^(UIGraphicsImageRendererContext *context) {
    [image drawInRect:CGRectMake(0, 0, pixels.width, pixels.height)];
  }];
  NSData *jpeg = UIImageJPEGRepresentation(upright, 0.92);
  if (!jpeg.length) {
    if (error) *error = WMPError(5, @"The captured image could not be encoded as JPEG");
    return nil;
  }
  NSURL *url = [self.cacheDirectory URLByAppendingPathComponent:
      [NSUUID.UUID.UUIDString stringByAppendingPathExtension:@"jpg"]];
  if (![jpeg writeToURL:url options:NSDataWritingAtomic error:error]) return nil;
  return [self metadata:url type:@"image" suggestedName:name error:error];
}

- (void)loadImageObject:(NSItemProvider *)provider completion:(void (^)(NSDictionary *, NSError *))completion {
  [provider loadObjectOfClass:UIImage.class completionHandler:^(id<NSItemProviderReading> object, NSError *loadError) {
    // UIImage is retained by this block; unlike a provider file URL it can be
    // safely handed to the off-main encoding queue after this handler returns.
    dispatch_async(self.workQueue, ^{
      if (self.finished) { completion(nil, WMPError(6, @"The request was cancelled")); return; }
      if (![object isKindOfClass:UIImage.class]) {
        completion(nil, loadError ?: WMPError(7, @"The selected image representation is unavailable"));
        return;
      }
      NSError *error = nil;
      NSDictionary *file = [self writeImage:(UIImage *)object suggestedName:provider.suggestedName error:&error];
      completion(file, error);
    });
  }];
}

- (void)importProvider:(NSItemProvider *)provider completion:(void (^)(NSDictionary *, NSError *))completion {
  NSString *identifier = nil;
  NSString *fileType = nil;
  for (NSString *registered in provider.registeredTypeIdentifiers) {
    UTType *type = [UTType typeWithIdentifier:registered];
    if (self.allowImages && [type conformsToType:UTTypeImage]) { identifier = registered; fileType = @"image"; break; }
    if (self.allowVideos && [type conformsToType:UTTypeMovie]) { identifier = registered; fileType = @"video"; break; }
  }
  if (!identifier && self.allowImages && [provider hasItemConformingToTypeIdentifier:UTTypeImage.identifier]) {
    identifier = UTTypeImage.identifier; fileType = @"image";
  }
  if (!identifier && self.allowVideos && [provider hasItemConformingToTypeIdentifier:UTTypeMovie.identifier]) {
    identifier = UTTypeMovie.identifier; fileType = @"video";
  }
  if (!identifier) {
    if (self.allowImages && [provider canLoadObjectOfClass:UIImage.class]) [self loadImageObject:provider completion:completion];
    else completion(nil, WMPError(8, @"The selected media type is not supported"));
    return;
  }
  NSString *selectedType = fileType;
  NSString *selectedIdentifier = identifier;
  [provider loadFileRepresentationForTypeIdentifier:identifier completionHandler:^(NSURL *temporaryURL, NSError *loadError) {
    if (!temporaryURL && [selectedType isEqual:@"image"] && [provider canLoadObjectOfClass:UIImage.class]) {
      [self loadImageObject:provider completion:completion];
      return;
    }
    __block NSURL *cachedURL = nil;
    __block NSError *copyError = loadError;
    // This synchronous section is intentional and required by NSItemProvider:
    // its temporary representation may disappear as soon as this handler exits.
    [self withinProviderLifetime:^{
      if (self.finished) { copyError = WMPError(6, @"The request was cancelled"); return; }
      if (temporaryURL) cachedURL = [self copyProviderFile:temporaryURL typeIdentifier:selectedIdentifier error:&copyError];
    }];
    dispatch_async(self.workQueue, ^{
      if (!cachedURL || self.finished) {
        completion(nil, copyError ?: WMPError(9, @"The selected media file could not be copied to cache"));
        return;
      }
      NSError *error = nil;
      NSDictionary *file = [self metadata:cachedURL type:selectedType suggestedName:provider.suggestedName error:&error];
      completion(file, error);
    });
  }];
}

- (void)removeFailedCache {
  NSURL *directory = self.cacheDirectory;
  if (directory) [NSFileManager.defaultManager removeItemAtURL:directory error:nil];
}

- (void)picker:(PHPickerViewController *)picker didFinishPicking:(NSArray<PHPickerResult *> *)results {
  if (self.finished || self.importing || picker != self.controller) return;
  if (!results.count) { [self deliver:WMPFailure(@"CANCELLED", @"chooseMedia:fail cancel")]; return; }
  if (results.count > self.count) { [self deliver:WMPFailure(@"INVALID_RESULT", @"The picker exceeded the requested count")]; return; }
  [self beginImport];
  [self dismissControllerThen:^{}];
  dispatch_group_t group = dispatch_group_create();
  NSMutableArray *files = [NSMutableArray arrayWithCapacity:results.count];
  NSMutableArray *errors = [NSMutableArray arrayWithCapacity:results.count];
  for (NSUInteger index = 0; index < results.count; index++) { [files addObject:NSNull.null]; [errors addObject:NSNull.null]; }
  [results enumerateObjectsUsingBlock:^(PHPickerResult *result, NSUInteger index, BOOL *stop) {
    dispatch_group_enter(group);
    dispatch_async(self.workQueue, ^{
      if (self.finished) { dispatch_group_leave(group); return; }
      [self importProvider:result.itemProvider completion:^(NSDictionary *file, NSError *error) {
        @synchronized(files) {
          if (file) files[index] = file;
          else errors[index] = error ?: WMPError(10, @"Selected media import failed");
        }
        dispatch_group_leave(group);
      }];
    });
  }];
  dispatch_group_notify(group, self.workQueue, ^{
    if (self.finished) { [self removeFailedCache]; return; }
    NSError *failure = nil;
    for (id error in errors) { if ([error isKindOfClass:NSError.class]) { failure = error; break; } }
    if (failure) [self removeFailedCache];
    NSDictionary *payload = failure ? WMPFailure(@"IMPORT_FAILED", failure.localizedDescription)
                                   : @{ @"success" : @YES, @"tempFiles" : [files copy] };
    dispatch_async(dispatch_get_main_queue(), ^{
      if (self.finished) return;
      // Do not complete until dismissal has finished; a callback may request
      // a new picker immediately and must not race the old presentation.
      if (self.dismissing) {
        self.pendingResult = payload;
      } else {
        [self deliver:payload];
      }
    });
  });
}

- (void)imagePickerControllerDidCancel:(UIImagePickerController *)picker {
  if (picker == self.controller && !self.importing) [self deliver:WMPFailure(@"CANCELLED", @"chooseMedia:fail cancel")];
}

- (void)imagePickerController:(UIImagePickerController *)picker didFinishPickingMediaWithInfo:(NSDictionary<UIImagePickerControllerInfoKey, id> *)info {
  if (self.finished || self.importing || picker != self.controller) return;
  UIImage *image = info[UIImagePickerControllerOriginalImage];
  if (![image isKindOfClass:UIImage.class]) {
    [self deliver:WMPFailure(@"INVALID_RESULT", @"The camera did not return a still image")];
    return;
  }
  [self beginImport];
  [self dismissControllerThen:^{}];
  dispatch_async(self.workQueue, ^{
    NSError *error = nil;
    NSDictionary *file = self.finished ? nil : [self writeImage:image suggestedName:@"camera.jpg" error:&error];
    if (!file || self.finished) [self removeFailedCache];
    NSDictionary *payload = file ? @{ @"success" : @YES, @"tempFiles" : @[ file ] }
                                : WMPFailure(@"IMPORT_FAILED", error.localizedDescription ?: @"The captured image could not be saved");
    dispatch_async(dispatch_get_main_queue(), ^{
      if (self.finished) return;
      if (self.dismissing) self.pendingResult = payload;
      else [self deliver:payload];
    });
  });
}

@end

@implementation WotMediaPicker

+ (NSString *)name { return @"WotMediaPicker"; }

+ (NSDictionary<NSString *, NSString *> *)methodLookup {
  return @{ @"chooseMedia" : NSStringFromSelector(@selector(chooseMedia:callback:)) };
}

- (void)chooseMedia:(NSDictionary *)options callback:(void (^)(NSDictionary *))callback {
  if (!callback) return;
  NSDictionary *snapshot = [options isKindOfClass:NSDictionary.class] ? [options copy] : options;
  void (^reply)(NSDictionary *) = [callback copy];
  dispatch_async(dispatch_get_main_queue(), ^{ [[WMPCoordinator shared] begin:snapshot callback:reply]; });
}

@end
