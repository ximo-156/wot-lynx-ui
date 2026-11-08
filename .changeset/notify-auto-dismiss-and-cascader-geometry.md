---
"wot-lynx-ui": patch
---

修复真机反馈的三处显示问题：通知不消失、级联选择器弹层塌高、指示线贴左。

- Notify：自动关闭计时改由「可见 / 时长」watcher 统一驱动（`immediate` 覆盖挂载即
  `visible: true` 的受控用法）。此前只有命令式 `showNotify()` 会计时，
  `v-model:visible` 打开的消息永远不会消失。关闭 / 重开 / 改时长都会重置计时，
  `duration` 为 0 时保持常驻。
- Cascader / Tabs：选项列表高度改用像素落值（`var(--wot-cascader-list-height, 336px)`），
  不再依赖 `calc(336 * var(--wot-n-1))`——真机 CSS 引擎对「var 参与 calc 乘法」
  求值失败时 height 整体失效，弹层会塌到内容高度、列表被裁掉。
- Tabs：导航区 `flex-shrink: 0`（定高元素不再被压缩），内容区 `flex: 1; min-height: 0`
  吃掉剩余空间；指示线在布局未就绪（`boundingClientRect` 回 0 宽）时保持隐藏并按帧
  重试，不再把线钉在导航区最左边。移除用百分比定位的内部兜底线。
