#import <Foundation/Foundation.h>
#import <Lynx/LynxModule.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * iOS 14+ native module. Register this CLASS in LynxConfig before prepareConfig.
 * JS: NativeModules.WotMediaPicker.chooseMedia(serializableOptions, callback)
 * The exported callback is the second argument, not a function inside options.
 */
@interface WotMediaPicker : NSObject <LynxModule>

+ (NSString *)name;
+ (NSDictionary<NSString *, NSString *> *)methodLookup;
- (void)chooseMedia:(NSDictionary *)options callback:(void (^)(NSDictionary *result))callback;

@end

NS_ASSUME_NONNULL_END
