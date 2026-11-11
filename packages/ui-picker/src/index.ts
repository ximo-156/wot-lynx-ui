/*
 * ⚠️ 本文件由 scripts/gen-index.mjs 自动生成，请勿手动编辑。
 *
 * @wot-lynx/ui-picker（domain/picker）的清单单一来源：src/domain/ 下的目录（含 <dir>.vue 与 types.ts）。
 * 新增 / 删除组件后运行：pnpm gen:index
 */

import Calendar from './wd-calendar/wd-calendar.vue'
import CalendarView from './wd-calendar-view/wd-calendar-view.vue'
import DatetimePicker from './wd-datetime-picker/wd-datetime-picker.vue'
import DatetimePickerView from './wd-datetime-picker-view/wd-datetime-picker-view.vue'
import Picker from './wd-picker/wd-picker.vue'
import PickerView from './wd-picker-view/wd-picker-view.vue'

export {
  Calendar,
  CalendarView,
  DatetimePicker,
  DatetimePickerView,
  Picker,
  PickerView,
}

export type { CalendarProps } from './wd-calendar/types'
export type { CalendarViewProps } from './wd-calendar-view/types'
export type { DatetimePickerProps } from './wd-datetime-picker/types'
export type { DatetimePickerViewProps } from './wd-datetime-picker-view/types'
export type { PickerProps } from './wd-picker/types'
export type { PickerViewProps } from './wd-picker-view/types'

/** @wot-lynx/ui-picker（domain/picker）清单（供 createApp().use(wotLynxUI) 全局注册使用） */
export const allPicker = [
  Calendar,
  CalendarView,
  DatetimePicker,
  DatetimePickerView,
  Picker,
  PickerView,
]
