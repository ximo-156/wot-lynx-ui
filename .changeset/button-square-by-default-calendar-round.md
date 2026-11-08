---
"wot-lynx-ui": minor
---

按钮默认形状恢复官方方圆角，日历仍保持圆形选中态。

- Button 未显式传入 `round`、全局也未配置时**不再**默认胶囊：普通按钮保持
  `--wot-button-radius-main` 的方圆角，`round` 才是胶囊；图标按钮的**正圆**
  仍由 `round`（如 wd-fab）开启，`block` 只改宽度、不改形状。全局默认
  `button.round` 同步改为 `false`。
- Calendar / CalendarView 的日期、月份及范围端点默认圆形高亮；多选日期保留独立圆形，范围选择保留浅色连接带。
- 日期的完整点击区域不缩小；带上下辅助信息时使用更小的圆形，并单独设置圆外文字颜色。
- 新增 `calendarViewDaySize` / `calendarViewDaySizeWithInfo` 尺寸令牌，现有 `calendarViewBorderRadiusActive` 仍可覆盖高亮圆角。
