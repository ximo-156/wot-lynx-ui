# Android WotMediaPicker integration kit

This is **real Android source**, not a JS simulation. It must be compiled into a **custom LynxExplorer APK**. It does not modify or update the currently installed stock Explorer. No Android SDK, Gradle, `java`/`javac`, or `adb` was available in the authoring session: Android compilation, manifest merger, emulator/device behavior and APK installation are **not verified**.

## Exact Explorer integration

Reference checkout inspected: Lynx commit [`becedd358ec169d3f155261818754d5cd5de224a`](https://github.com/lynx-family/lynx/commit/becedd358ec169d3f155261818754d5cd5de224a). Its Explorer uses root compile SDK 33 / AGP 4.1.0, app min SDK 24 / target 32 / Java 8, `androidx.core:core:1.6.0`, and `implementation project(':LynxAndroid')`. The actual `lynx` flavors used by Explorer are `asan` / `noasan`; this library matches them. No SDK/AGP version is guessed or independently upgraded.

1. In the custom Explorer checkout's `explorer/android/settings.gradle`, include this library (substitute your **actual absolute path**):
   ```groovy
   include ':wot_media_picker'
   project(':wot_media_picker').projectDir = file('/absolute/path/to/wot-lynx-ui/native/media-picker/android')
   ```
2. In `explorer/android/lynx_explorer/build.gradle`, add to `dependencies`:
   ```groovy
   implementation project(':wot_media_picker')
   ```
3. In **`explorer/android/lynx_explorer/src/main/java/com/lynx/explorer/modules/LynxModuleAdapter.java`**, import:
   ```java
   import com.wotlynx.mediapicker.WotMediaPickerModule;
   ```
   In its existing initialization method, beside the existing `ExplorerModule` registration, add exactly:
   ```java
   LynxEnv.inst().registerModule("WotMediaPicker", WotMediaPickerModule.class);
   ```
   Register the class, not an application-context singleton; the module requires the SDK-provided page/Activity context. Do **not** patch Explorer's `onActivityResult` or permissions callbacks.
4. From `explorer/android`, after satisfying the upstream Explorer native/toolchain prerequisites, build:
   ```sh
   ./gradlew :wot_media_picker:assembleNoasanDebug :lynx_explorer:assembleWithoutSparklingNoasanDebug
   ```
   Inspect the merged manifest, then install/run the newly built APK with Android Studio or your already installed `adb`. Use Gradle's actual APK output path. APK/native code changes require rebuilding/reinstalling; a Lynx bundle refresh alone cannot install this module.

For a different host, use its exact compile SDK (at least 33) and existing Lynx dependency. The fallback property `wotMediaPickerLynxCoordinate` accepts the **exact Maven coordinate already used by that host**, not a made-up version. Match that host's flavor setup instead of silently upgrading its toolchain.

## Native/JS contract

```ts
NativeModules.WotMediaPicker.chooseMedia(
  { count: 3, multiple: true, mediaType: ['image', 'video'], sourceType: ['album', 'camera'] },
  result => { /* adapt result to host.chooseMedia success/fail in the frontend facade */ }
)
```

- Signature: `@LynxMethod public void chooseMedia(ReadableMap options, Callback callback)`.
- `options` must contain only serializable values. The callback is a **separate top-level argument**; never put JS `success`/`fail` functions inside `options`.
- `count`: integer 1–50, default 1; `multiple:false` forces 1. `mediaType`: nonempty image/video array, default image. `sourceType`: nonempty album/camera array, default album.
- Album: Android 13+ system `ACTION_PICK_IMAGES`; fallback `ACTION_OPEN_DOCUMENT` on older Android or when Photo Picker is unavailable. Older document UIs cannot enforce a visible count limit; only the first `count` unique returned URIs are copied.
- Camera: **real still-photo** `ACTION_IMAGE_CAPTURE` with full-resolution `EXTRA_OUTPUT`, private FileProvider URI, explicit read/write URI grants and runtime camera permission. It returns one photo per capture. Video-only camera selection is unsupported; videos can be selected from the album. No bitmap thumbnail is substituted for a full photo.
- Success: `{success:true,tempFiles:[{fileType:'image'|'video',tempFilePath:'/data/.../cache/wot-media-picker/picked/...',name,size,thumbTempFilePath?,duration?}]}`. `size` is actual copied file bytes; `duration` is **seconds**. Video thumbnail is a real optional cached JPEG.
- Failure: `{success:false,errMsg:'chooseMedia:fail ...',code:'ERR_...'}`; cancellation is `ERR_CANCELLED` / `chooseMedia:fail cancel`. No picker, URI permission, denied camera permission, empty/corrupt media, I/O errors, busy request and a 15-minute abandoned-request deadline all produce errors, not fake success.

## Lifecycle, privacy and cache

UI/permissions/intents run on the main thread. URI queries, content copying, bitmap bounds, video metadata/thumbnail encoding and file cleanup run on background executors. A private proxy Activity owns Android results; an in-process request object (not the Activity) owns the callback/phase. Rotation does not relaunch a pending picker or camera. One atomic terminal outcome guards every result/cancel/timeout/destroy path; callback references, UI weak refs, timers and owner lifecycle watchers are released. `LynxModule.destroy()` abandons old-runtime callbacks and closes the UI/copy task.

Process death cannot preserve an old JS function. A restored proxy without its request finishes, cleans its temporary token directories, and does not fake a callback or relaunch capture; the new page must retry. Gallery grants are used only while importing selected files. No broad storage permission, `_data` lookup, fakepath, HTTP download, or persistent storage grant is used. FileProvider exposes only this kit's camera staging directory, not selected media or the whole cache.

Success copies remain in private cache so preview/upload can use real local paths. Keep them until preview/upload finishes; the host can apply its cache retention policy afterward, and Android can evict cache. The module removes failed/cancelled files and staging files; stale camera staging is pruned on subsequent requests. Originals (including supported HEIC images) are copied, not falsely renamed/transcoded into JPEG. The frontend should honor `fileType`, not rely only on a file extension, and convert a real path to `file://` for preview only if its image loader requires that URI form.

## Checks and required device tests

Run `python tools/validate_kit.py` for XML/resource/API-shape and Java lexical structural checks. This is **not** Android compilation or runtime validation. Then compile with the real host SDK and test: image/video/mixed and multi-count; cancel/back; permission denied and revoked; missing camera/document picker; camera full bytes; rotation during chooser/permission/copy; navigate away/destroy the LynxView; process death/relaunch; low storage, provider I/O failures and real preview/upload of returned files. Never claim the installed Explorer updated until the custom APK is built, installed and exercised.

Sources: [official Lynx native modules](https://lynxjs.org/guide/use-native-modules.md), [LynxModule](https://github.com/lynx-family/lynx/blob/becedd358ec169d3f155261818754d5cd5de224a/platform/android/lynx_android/src/main/java/com/lynx/jsbridge/LynxModule.java), [Callback](https://github.com/lynx-family/lynx/blob/becedd358ec169d3f155261818754d5cd5de224a/platform/android/lynx_android/src/main/java/com/lynx/react/bridge/Callback.java), [ReadableMap](https://github.com/lynx-family/lynx/blob/becedd358ec169d3f155261818754d5cd5de224a/platform/android/lynx_android/src/main/java/com/lynx/react/bridge/ReadableMap.java), [Explorer adapter](https://github.com/lynx-family/lynx/blob/becedd358ec169d3f155261818754d5cd5de224a/explorer/android/lynx_explorer/src/main/java/com/lynx/explorer/modules/LynxModuleAdapter.java), [Explorer app dependencies](https://github.com/lynx-family/lynx/blob/becedd358ec169d3f155261818754d5cd5de224a/explorer/android/lynx_explorer/build.gradle), [system Photo Picker](https://developer.android.com/training/data-storage/shared/photopicker), [MediaStore camera contract](https://developer.android.com/reference/android/provider/MediaStore#ACTION_IMAGE_CAPTURE), [FileProvider](https://developer.android.com/reference/androidx/core/content/FileProvider).
