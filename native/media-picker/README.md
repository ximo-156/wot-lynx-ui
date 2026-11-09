# LynxExplorer 原生相册 / 拍照接入

这里提供 **Android 和 iOS 的真实原生模块源码**，不是 `input type="file"`，不是模拟相册，也不是仅有 TypeScript 声明。模块注册名统一为 **`WotMediaPicker`**。

> **必须重新编译并安装带该模块的 LynxExplorer。** 当前工作区只有组件库与 JS Demo，没有 Explorer 的 Android/Xcode 工程；本机没有 Android SDK/adb/Xcode。已经安装的官方 Explorer 不能通过更新一个 JS bundle 自动获得新的原生代码。本目录不能被当成已经构建、签名或安装成功的 APK/IPA。

## 已连接的前端链路

前端的 [Native Module 适配](<../../packages/ui/src/common/nativeMediaPicker.ts>) 和 [宿主入口](<../../packages/ui/src/common/host.ts>) 已连接：

```text
Upload 相机卡片 tap
  → beforeChoose
  → host.chooseMedia({ count, sourceType, success, fail, ... })
  → NativeModules.WotMediaPicker.chooseMedia(纯数据 options, 单独 callback)
  → 系统相册或拍照
  → 复制选中文件到应用真实缓存目录
  → callback({ success, tempFiles / errMsg })
  → beforeUpload / 大小与数量校验
  → 上传列表和原生图片预览
```

不需要给 Upload 另加一个隐藏输入框。注册原生模块后，前端会自动发现它并补充缺失的 `chooseMedia`；显式 `configureHost()` 与已有 WotLynxUI/WotLynxUIHost 的选图实现仍优先，其他宿主方法及其 `this` 保持不变。

原生方法使用 **两个参数**。选项只允许 JSON 可序列化的数据，不能把 JS 函数放入 Android ReadableMap 或 iOS NSDictionary：

```ts
NativeModules.WotMediaPicker.chooseMedia(
  {
    count: 3,
    multiple: true,
    mediaType: ['image'],
    sourceType: ['album', 'camera'],
    camera: 'back',
    sizeType: ['original'],
    compressed: false,
    maxDuration: 60
  },
  result => {
    // 适配层已负责把结果转给原 Upload 的 success/fail。
  }
)
```

前端把数量归一到 1–50（未设数量时默认 9），按 count 推导 multiple。相册支持图片、视频和混合选择；相机目前是 **真实静态照片**，不冒称已实现视频录制或压缩。`sizeType`、`compressed`、`maxDuration` 保留现有宿主选项，但本原生套件不执行媒体压缩、不录制视频，也不强制相册视频时长；需要这些功能时另加真实原生处理。

## Android：加入 Explorer 并安装 APK

完整源码、Manifest、FileProvider 资源、Gradle 与检查步骤见 [Android 接入说明](<android/README.md>)。

1. 使用说明中核对过的 Explorer 源码工程，保留它原来的 Lynx SDK/Gradle 配置。
2. 在 Explorer 的 settings.gradle 添加 `:wot_media_picker`，projectDir 指向本目录的 Android 子目录；在 app 的 dependencies 添加 `implementation project(':wot_media_picker')`。
3. 在 Explorer 的 LynxModuleAdapter 初始化中导入模块类并注册：

```java
import com.wotlynx.mediapicker.WotMediaPickerModule;

LynxEnv.inst().registerModule("WotMediaPicker", WotMediaPickerModule.class);
```

4. 检查合并后的 Manifest 包含本库的私有 Activity、FileProvider 和 camera 权限。相册不申请广泛存储权限，Android 13+ 使用系统 Photo Picker，旧版或不可用时使用系统 OpenDocument。
5. 编译 Explorer APK、签名并安装到 Android 手机；随后加载项目的 Lynx bundle。只重建本 JS Demo 不会产生可安装的 Android 宿主。

## iOS：加入 Explorer 并安装 App

完整源码、plist 与 Xcode 操作见 [iOS 接入说明](<ios/README.md>)。

1. 用 macOS/Xcode 打开 Explorer iOS 工程，加入 [头文件](<ios/WotMediaPicker.h>) 与 [实现](<ios/WotMediaPicker.m>)，确认目标成员、Compile Sources 和 ARC。
2. 链接说明中的 PhotosUI、UniformTypeIdentifiers、AVFoundation 等系统框架，deployment target 至少 iOS 14。
3. 在 Explorer 的 LynxInitProcessor 中导入头文件，在 `setupLynxEnv` 里、`[env prepareConfig:globalConfig]` **之前**注册：

```objective-c
#import "WotMediaPicker.h"

[globalConfig registerModule:WotMediaPicker.class];
```

4. 将 [camera plist 片段](<ios/Info.plist.fragment.xml>) 合并到 App 的实际 Info.plist。PHPicker 不要求广泛相册授权，拍照需要 camera usage description 和用户授权。
5. 配置开发者签名，构建并安装这份带模块的 Explorer 到 iPhone/iPad，然后加载 Lynx bundle。

## 回传、取消和错误

成功结果中的 `tempFilePath` 是真实本地缓存文件，`size` 来自实际文件长度；视频的 duration 为秒，缩略图只在真实生成成功时提供：

```json
{
  "success": true,
  "tempFiles": [
    {
      "fileType": "image",
      "tempFilePath": "/application/cache/real-photo.jpg",
      "name": "photo.jpg",
      "size": 128000
    }
  ]
}
```

上面的路径只是说明结构，原生实现会回传实际生成的 UUID 缓存路径，不会回传这个示例值。取消回传 `success:false` 和 `chooseMedia:fail cancel`；权限拒绝、硬件不可用、无展示 Activity/controller、读写失败、导入失败/超时和并发请求都有明确错误。

前端不对用户停留在系统选择器里设置几秒钟的超时。Android 原生有较长的废弃请求清理期限；iOS 仅对选择后的文件导入设置 watchdog。成功缓存需要保留到预览/上传结束，随后由宿主采用自身缓存清理策略。

## 验证层级

- 已提供：真实原生实现、平台注册代码、前端二参数桥接和已有 Upload 入列链路。
- 可在本机执行：前端回归、类型检查、平台源码/资源静态检查、JS 双端构建。
- **未验证**：Android Gradle/Java 编译与 Manifest merger、Xcode Objective-C 编译/链接、APK/IPA 签名与安装、手机实际相册/拍照/权限/lifecycle 行为。

可从仓库根执行以下 **静态检查**（不是原生编译）：

```text
python native/media-picker/android/tools/validate_kit.py
python native/media-picker/ios/check-kit.py
```

Native Module 的类型映射和注册依据见 [官方 Lynx 文档](https://lynxjs.org/guide/use-native-modules.md)。平台说明中记录了核对的实际 Explorer 注册路径与源码版本，不建议猜测或升级宿主 SDK。
