---
"wot-lynx-ui": patch
---

修复上传相机卡片在手机端错误唤起输入法的问题。

- 移除不受 Lynx 原生支持的透明 file input 与 tap 拦截；唤起项只保留原生 view 外观，点击恢复 Upload 的 beforeChoose、chooseMedia、beforeUpload 和入列链路。
- 宿主能力读取支持模块注入的 NativeModules / lynx SDK，避免已注册选图模块因 globalThis 缺失被漏掉；选择方法保留宿主 this 上下文。
- 兼容 files / tempFiles 与常见路径、文件名字段。缺失相册能力、取消和权限错误有明确反馈，不再伪称系统内置 file input 支持或模拟选图成功。
- Demo 上传仍是演示桩；真正打开手机相册/拍照需要宿主实现并注册 chooseMedia，Web 文件选择也需要实际宿主适配。
