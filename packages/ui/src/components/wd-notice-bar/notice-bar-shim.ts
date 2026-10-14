/**
 * uni-app 页面生命周期兼容（Lynx 无 onHide/onShow，降级为 no-op）
 */
export function onHide(_cb?: () => void): void {}
export function onShow(_cb?: () => void): void {}
