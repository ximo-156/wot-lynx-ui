---
'wot-lynx-ui': patch
---

修复真机上确认弹窗按钮行溢出、「确定」按钮被裁成一条色带的问题：`wd-button` 基础样式带 `flex-shrink: 0`（CONVENTIONS §19 附注：防止按钮在行内被按比例压缩），而 `wd-dialog` 的取消/确认按钮走 `is-block`（`width: 100%`）——两个 100% 按钮放进 flex 行后谁都不缩，「取消」独占整行宽度，「确定」被挤到弹窗右侧、被 `__container` 的 `overflow: hidden` 裁掉。Web 端 wot-ui 的按钮无 `flex-shrink: 0`，两个 100% 按钮默认各缩一半，因此只有真机翻车。横向按钮行（`.wd-dialog__actions.wd-dialog__flex:not(.wd-dialog__actions--vertical)`）内的按钮显式 `flex: 1` 等分宽度；纵向（`--vertical`）与单按钮（`--block`）为 column 容器、高度按内容结算，不参与（`flex-basis: 0` 会把按钮高度算没，wd-password-input 2026-11-01 同源缺陷）。
