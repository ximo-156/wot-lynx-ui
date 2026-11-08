# WotMediaPicker — real iOS Lynx Explorer integration kit

This folder supplies **native Objective-C code**, not a browser file input and not a simulated picker. The native module is named **`WotMediaPicker`**. It must be compiled into **your own source-built Lynx Explorer iOS app** and registered there. Copying this folder into a JavaScript project, installing the public Explorer binary, or rebuilding a Lynx bundle **does not add the module to the installed app**.

The code has **not been compiled with Xcode or installed on an iPhone/iPad** in this Windows workspace. Those steps and device checks remain required.

## Files and requirements

- [WotMediaPicker.h](<WotMediaPicker.h>) — real `NSObject<LynxModule>` interface and two-argument callback method.
- [WotMediaPicker.m](<WotMediaPicker.m>) — PHPicker album, still-photo camera, native authorization, real cache copies and callback lifecycle.
- [Info.plist.fragment.xml](<Info.plist.fragment.xml>) — camera usage-description entries to merge into the **Explorer app target** Info.plist, not to replace that plist.
- [check-kit.py](<check-kit.py>) — portable source/contract and plist checks; **not** an Objective-C compiler or a device test.

Requirements:

1. macOS and Xcode with **iOS 14+ SDK**; use an **iOS deployment target of at least 14.0** for the integrating Explorer target.
2. A source-built Lynx Explorer with its existing Lynx framework exposing `LynxModule.h`, `LynxConfig`, and `registerModule:`. This follows the actual [Lynx Native Modules API](https://lynxjs.org/guide/use-native-modules.md); it does not introduce a Swift bridge or a replacement module system.
3. Link the Apple system frameworks **PhotosUI, UniformTypeIdentifiers, AVFoundation, UIKit, Foundation, CoreGraphics, and CoreMedia** in the app target. UIKit/Foundation/CoreGraphics/CoreMedia may already be linked by Explorer; do not remove its existing libraries.
4. A real iOS device for the camera. Simulator album testing is useful, but a simulator cannot validate real camera hardware/permissions.

There is no podspec here: the Explorer host already owns the Lynx SDK dependency/version. Adding a new arbitrary Lynx pod version to this kit would risk mismatching the host. Integrate the two Objective-C source files directly into the existing app target.

## Exact Explorer registration

The official integration entry is:

```text
explorer/darwin/ios/lynx_explorer/LynxExplorer/LynxInitProcessor.m
```

The [Explorer source API](https://api.github.com/repos/lynx-family/lynx/contents/explorer/darwin/ios/lynx_explorer/LynxExplorer/LynxInitProcessor.m?ref=develop) was inspected: `setupLynxEnv` creates `LynxConfig *globalConfig`, registers the existing Explorer modules, and then calls `[env prepareConfig:globalConfig]`. Register the new class **before that prepareConfig call**, not after the engine has been initialized.

1. Obtain and open a source checkout following [Build Lynx Explorer for iOS](https://github.com/lynx-family/lynx/tree/develop/explorer/darwin/ios).
2. In Xcode, add [WotMediaPicker.h](<WotMediaPicker.h>) and [WotMediaPicker.m](<WotMediaPicker.m>) to the Explorer `modules` group. Enable **Copy items if needed** and **LynxExplorer target membership**. Verify the `.m` is in the target's **Build Phases → Compile Sources**. Enable ARC for this source/target.
3. In the external Explorer entry above, add the import:

```objective-c
#import "WotMediaPicker.h"
```

4. In its existing `- (void)setupLynxEnv`, retain all existing setup/registrations and add:

```objective-c
[globalConfig registerModule:WotMediaPicker.class];
```

The surrounding ordering must remain:

```objective-c
// globalConfig is the existing LynxConfig created by Explorer.
[globalConfig registerModule:ExplorerModule.class];
[globalConfig registerModule:ExplorerLynxTestModule.class];
[globalConfig registerModule:WotMediaPicker.class];
[env prepareConfig:globalConfig];
```

5. Merge the camera key from [the plist fragment](<Info.plist.fragment.xml>) into the app target's actual Info.plist, set up app signing, build, and install **that rebuilt Explorer app** on the device. None of these external host files were edited by this kit.
6. Load the Lynx bundle using the frontend facade being supplied by the parent integration. That facade must call the native module with **two arguments** and translate the result into the frontend's success/fail callbacks.

## Native method and result contract

Actual exported Objective-C API:

```objective-c
+ (NSString *)name; // returns @"WotMediaPicker"
+ (NSDictionary<NSString *, NSString *> *)methodLookup;
- (void)chooseMedia:(NSDictionary *)options
          callback:(void (^)(NSDictionary *result))callback;
```

`methodLookup` maps `chooseMedia` to `chooseMedia:callback:` using `NSStringFromSelector`. A JavaScript function is mapped to an Objective-C callback block by Lynx; **do not put `success` or `fail` functions inside the first options dictionary**.

Direct bridge usage (the parent facade owns production frontend integration):

```typescript
NativeModules.WotMediaPicker.chooseMedia(
  {
    mediaType: ['image', 'video'],
    sourceType: ['album'],
    count: 3,
    multiple: true,
    camera: 'back'
  },
  result => {
    console.log(result);
  }
);
```

Options:

| Option | Actual behavior |
| --- | --- |
| `mediaType` | Nonempty array of `image` and/or `video`; default `['image']`. PHPicker filters to the requested types. |
| `sourceType` | Nonempty array of `album` and/or `camera`; default `['album']`. Both sources show an iPad-safe system action sheet when images are allowed. |
| `count` | Integer **1–50**, default **1**. Invalid values produce `INVALID_OPTIONS`; `0` is not unlimited. The frontend facade must send a bounded positive count. |
| `multiple` | Optional boolean. `false` forces album count to one; otherwise the requested count is used. |
| `camera` | `front` or `back`, default `back`. The requested hardware is checked before camera authorization/presentation. |

Camera capture is deliberately **still-photo only** and returns one image. A camera-only video request fails with `UNSUPPORTED_MEDIA`; a video-only request with both sources goes to the filtered album. The kit does not claim to capture video, compress videos, enforce video recording duration, or save captured images back into the user's photo library.

Successful callback:

- `success: true`
- `tempFiles`: ordered array of actual cached files.
- Each file contains `fileType: 'image' | 'video'`, **absolute real local `tempFilePath`**, `name`, and `size` in **actual bytes** from `NSFileManager`.
- Videos include `duration` in **seconds** when AVFoundation can read a finite duration. `thumbTempFilePath` is present **only if** a real JPEG thumbnail was generated and written successfully. No fake thumbnail/path is returned.

Failure callback:

- `success: false`
- `errMsg`: descriptive string.
- `code`: `INVALID_OPTIONS`, `UNSUPPORTED_MEDIA`, `BUSY`, `NO_PRESENTATION_CONTEXT`, `SCENE_DISCONNECTED`, `CAMERA_UNAVAILABLE`, `MISSING_CAMERA_USAGE_DESCRIPTION`, `PERMISSION_DENIED`, `CANCELLED`, `INVALID_RESULT`, `IMPORT_FAILED`, or `IMPORT_TIMEOUT`.
- User cancellation includes `errMsg: 'chooseMedia:fail cancel'`, allowing the frontend facade to distinguish cancellation from a system failure.

## Privacy, files, and ownership

- **PHPicker does not request broad album access.** The code does not call `PHPhotoLibrary` authorization. It receives access only to the item providers the user selects. No `NSPhotoLibraryUsageDescription` / `NSPhotoLibraryAddUsageDescription` is needed by this implementation.
- Camera still photos use `AVCaptureDevice` video-camera authorization and require **`NSCameraUsageDescription`**. Denied/restricted/unavailable camera paths return a failure, not another input control. No microphone permission is requested because camera video capture is not implemented.
- Compatible item representations are requested. `loadFileRepresentationForTypeIdentifier` temporary URLs are **copied synchronously within that completion-handler lifetime**; the temporary URL is never dispatched to an asynchronous queue and used after it expires. Work is executed on an off-main file queue. If the provider invokes its completion on main, a synchronous hop keeps the provider lifetime valid while file I/O itself remains off-main.
- Provider-only `UIImage` representations and captured photos are really encoded as upright JPEG files off-main. This is a real fallback representation, not a mocked file path.
- Files live in a unique per-request directory below the app's **Library/Caches/WotMediaPicker**. Names used for cache storage are UUID-based; suggested names cannot escape that directory. Upload/copy successful files promptly: iOS may later evict caches. The kit does not delete successful files automatically while the frontend still uses them.
- Async album results are collected into their **original PHPicker indexes**. iOS 15+ enables numbered ordered selection; on iOS 14 the kit preserves the picker-provided result array order, regardless of asynchronous completion order.
- One process-wide coordinator strongly retains the active request, controllers, and copied callback until completion. Delegate/presenter/coordinator back references are weak where needed. A second picker request returns `BUSY`, including calls through another Lynx module instance.
- Cancellation, denied authorization, result imports, dismissal completion, and scene disconnect converge on one terminal callback. The global reservation and callback are cleared before invoking JavaScript, and a finishing import waits for an in-flight picker dismissal.
- There is **no timeout while the user is choosing** in a system picker. A 60-second watchdog begins only after media was chosen, to bound an iCloud/item-provider import that stops returning. The frontend should not impose a short fixed timeout while the system UI is open.
- A batch with an import error fails rather than returning a silent partial selection. Failed/aborted imported cache directories are cleaned when their background processing finishes.

## Verification and remaining device work

From the JavaScript repository root, a portable structural check can run without Xcode:

```text
python native/media-picker/ios/check-kit.py
```

This checks UTF-8/trailing whitespace, source delimiter balance, exported module/selector contract, the actual PHPicker/camera/file-copy APIs, and the privacy plist. It **does not** prove UIKit presentation, Objective-C type checking/linking, native callback marshalling, camera behavior, or Explorer installation.

Required macOS/device checks after integration:

1. Compile with the host's actual Lynx framework and iOS 14+ deployment setting; check the new source is linked into the app target.
2. Verify `NativeModules.WotMediaPicker.chooseMedia` exists in the **rebuilt installed Explorer**, not only in TypeScript.
3. Album: image-only, video-only, mixed type; one/multiple count; cancel; local and iCloud-backed assets; picker-provided order retained despite different import durations.
4. Camera: first permission grant, denial, restricted access, Settings re-enable, front/back availability, capture, cancel, and upright JPEG output.
5. Rapid double requests return one `BUSY` response without presenting two controllers. A callback that starts another picker must not race dismissal of the old controller.
6. iPad source action sheet / album swipe-dismiss, app scene disconnect, cache write failure, provider import failure/timeout, and callback uniqueness.
7. Confirm every reported path exists in the app sandbox and `size` matches the actual file length; decode/play files and any reported thumbnails before uploading.

**Status:** native source and integration instructions supplied. Native compilation, registration into an external Explorer build, installation, and iOS device verification are **unverified** on this Windows host.
