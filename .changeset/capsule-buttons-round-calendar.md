---
"wot-lynx-ui": minor
---

默认采用胶囊按钮与圆形日历选中态。

- Button 未显式传入 `round` 时默认呈胶囊形，仍支持组件和全局配置的 `round: false`。
- Calendar / CalendarView 的日期、月份及范围端点默认圆形高亮；多选日期保留独立圆形，范围选择保留浅色连接带。
- 日期的完整点击区域不缩小；带上下辅助信息时使用更小的圆形，并单独设置圆外文字颜色。
- 新增 `calendarViewDaySize` / `calendarViewDaySizeWithInfo` 尺寸令牌，现有 `calendarViewBorderRadiusActive` 仍可覆盖高亮圆角。
