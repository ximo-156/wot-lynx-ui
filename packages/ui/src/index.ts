/*
 * wot-lynx-ui — 基于 Vue Lynx 的 wot-ui API 兼容组件库（重写版）
 *
 * 使用方式：
 *   1. 引入主题：import 'wot-lynx-ui/theme'（提供 --wd-* 设计令牌）；
 *   2. 按需引入组件，或通过 createApp().use(wotLynxUI) 全局注册。
 *
 * 注意：组件导出随重写进度逐层补充，见 CONVENTIONS.md 的重写计划。
 */
import type { App, Plugin } from 'vue-lynx'
import { configureUniAdapter, hasUniAdapter, uni } from './common/uni'

// uni-app 兼容层：宿主可注入路由 / 媒体选择 / Toast 等能力
export { configureUniAdapter, hasUniAdapter, uni }

// 组件（Tier 1：基础）
import Button from './components/wd-button/wd-button.vue'
import Cell from './components/wd-cell/wd-cell.vue'
import CellGroup from './components/wd-cell-group/wd-cell-group.vue'
import ConfigProvider from './components/wd-config-provider/wd-config-provider.vue'
import Divider from './components/wd-divider/wd-divider.vue'
import Gap from './components/wd-gap/wd-gap.vue'
import Icon from './components/wd-icon/wd-icon.vue'
import Loading from './components/wd-loading/wd-loading.vue'
import Overlay from './components/wd-overlay/wd-overlay.vue'
import RootPortal from './components/wd-root-portal/wd-root-portal.vue'
import Text from './components/wd-text/wd-text.vue'
import Transition from './components/wd-transition/wd-transition.vue'
// Tier 2：表单体系
import Checkbox from './components/wd-checkbox/wd-checkbox.vue'
import CheckboxGroup from './components/wd-checkbox-group/wd-checkbox-group.vue'
import Form from './components/wd-form/wd-form.vue'
import FormItem from './components/wd-form-item/wd-form-item.vue'
import Input from './components/wd-input/wd-input.vue'
import InputNumber from './components/wd-input-number/wd-input-number.vue'
import Radio from './components/wd-radio/wd-radio.vue'
import RadioGroup from './components/wd-radio-group/wd-radio-group.vue'
import Rate from './components/wd-rate/wd-rate.vue'
import Search from './components/wd-search/wd-search.vue'
import Segmented from './components/wd-segmented/wd-segmented.vue'
import Slider from './components/wd-slider/wd-slider.vue'
import Switch from './components/wd-switch/wd-switch.vue'
import Textarea from './components/wd-textarea/wd-textarea.vue'
import Toast from './components/wd-toast/wd-toast.vue'

export {
  Button,
  Cell,
  CellGroup,
  ConfigProvider,
  Divider,
  Gap,
  Icon,
  Loading,
  Overlay,
  RootPortal,
  Text,
  Transition,
  Checkbox,
  CheckboxGroup,
  Form,
  FormItem,
  Input,
  InputNumber,
  Radio,
  RadioGroup,
  Rate,
  Search,
  Segmented,
  Slider,
  Switch,
  Textarea,
  Toast
}

// Tier 3d：弹层反馈 / 图形 / 列表导航
import ActionSheet from './components/wd-action-sheet/wd-action-sheet.vue'
import Circle from './components/wd-circle/wd-circle.vue'
import Collapse from './components/wd-collapse/wd-collapse.vue'
import CollapseItem from './components/wd-collapse-item/wd-collapse-item.vue'
import Curtain from './components/wd-curtain/wd-curtain.vue'
import Dialog from './components/wd-dialog/wd-dialog.vue'
import DropMenu from './components/wd-drop-menu/wd-drop-menu.vue'
import DropMenuItem from './components/wd-drop-menu-item/wd-drop-menu-item.vue'
import Fab from './components/wd-fab/wd-fab.vue'
import FloatingPanel from './components/wd-floating-panel/wd-floating-panel.vue'
import ImagePreview from './components/wd-image-preview/wd-image-preview.vue'
import Loadmore from './components/wd-loadmore/wd-loadmore.vue'
import NavbarCapsule from './components/wd-navbar-capsule/wd-navbar-capsule.vue'
import Notify from './components/wd-notify/wd-notify.vue'
import Popover from './components/wd-popover/wd-popover.vue'
import SortButton from './components/wd-sort-button/wd-sort-button.vue'
import Step from './components/wd-step/wd-step.vue'
import Steps from './components/wd-steps/wd-steps.vue'
import SwipeAction from './components/wd-swipe-action/wd-swipe-action.vue'
import Swiper from './components/wd-swiper/wd-swiper.vue'
import SwiperNav from './components/wd-swiper-nav/wd-swiper-nav.vue'
import Tabbar from './components/wd-tabbar/wd-tabbar.vue'
import TabbarItem from './components/wd-tabbar-item/wd-tabbar-item.vue'
import Table from './components/wd-table/wd-table.vue'
import Tooltip from './components/wd-tooltip/wd-tooltip.vue'
import Tour from './components/wd-tour/wd-tour.vue'
import VideoPreview from './components/wd-video-preview/wd-video-preview.vue'
import Watermark from './components/wd-watermark/wd-watermark.vue'

export {
  ActionSheet, Circle, Collapse, CollapseItem, Curtain, Dialog, DropMenu, DropMenuItem, Fab,
  FloatingPanel, ImagePreview, Loadmore, NavbarCapsule, Notify, Popover, SortButton, Step, Steps,
  SwipeAction, Swiper, SwiperNav, Tabbar, TabbarItem, Table, Tooltip, Tour, VideoPreview, Watermark
}

export type { ActionSheetProps } from './components/wd-action-sheet/types'
export type { CircleProps } from './components/wd-circle/types'
export type { CollapseProps } from './components/wd-collapse/types'
export type { CollapseItemProps } from './components/wd-collapse-item/types'
export type { CurtainProps } from './components/wd-curtain/types'
export type { DialogProps } from './components/wd-dialog/types'
export type { DropMenuProps } from './components/wd-drop-menu/types'
export type { DropMenuItemProps } from './components/wd-drop-menu-item/types'
export type { FabProps } from './components/wd-fab/types'
export type { FloatingPanelProps } from './components/wd-floating-panel/types'
export type { ImagePreviewProps } from './components/wd-image-preview/types'
export type { LoadmoreProps } from './components/wd-loadmore/types'
export type { NavbarCapsuleProps } from './components/wd-navbar-capsule/types'
export type { NotifyProps } from './components/wd-notify/types'
export type { PopoverProps } from './components/wd-popover/types'
export type { SortButtonProps } from './components/wd-sort-button/types'
export type { StepProps } from './components/wd-step/types'
export type { StepsProps } from './components/wd-steps/types'
export type { SwipeActionProps } from './components/wd-swipe-action/types'
export type { SwiperProps } from './components/wd-swiper/types'
export type { SwiperNavProps } from './components/wd-swiper-nav/types'
export type { TabbarProps } from './components/wd-tabbar/types'
export type { TabbarItemProps } from './components/wd-tabbar-item/types'
export type { TableProps } from './components/wd-table/types'
export type { TooltipProps } from './components/wd-tooltip/types'
export type { TourProps } from './components/wd-tour/types'
export type { VideoPreviewProps } from './components/wd-video-preview/types'
export type { WatermarkProps } from './components/wd-watermark/types'

// 命令式 API（弹层系）
export { useNotify, setNotifyDefaultOptions, resetNotifyDefaultOptions } from './components/wd-notify'
export { useDialog } from './components/wd-dialog'
export type { Dialog as DialogApi, DialogOptions, DialogResult } from './components/wd-dialog/types'
export { useImagePreview } from './components/wd-image-preview'
export type { ImagePreviewOptions } from './components/wd-image-preview/types'
export { useVideoPreview } from './components/wd-video-preview'
export type { VideoPreviewOptions } from './components/wd-video-preview/types'

// Tier 4：图形码 / 内部
import BarCode from './components/wd-bar-code/wd-bar-code.vue'
import QrCode from './components/wd-qr-code/wd-qr-code.vue'
import TableColumn from './components/wd-table-column/wd-table-column.vue'

export { BarCode, QrCode, TableColumn }
export type { BarCodeProps } from './components/wd-bar-code/types'
export type { QrCodeProps } from './components/wd-qr-code/types'
export type { TableColumnProps } from './components/wd-table-column/types'

// Tier 3a：展示反馈
import Avatar from './components/wd-avatar/wd-avatar.vue'
import AvatarGroup from './components/wd-avatar-group/wd-avatar-group.vue'
import Badge from './components/wd-badge/wd-badge.vue'
import Card from './components/wd-card/wd-card.vue'
import CountDown from './components/wd-count-down/wd-count-down.vue'
import CountTo from './components/wd-count-to/wd-count-to.vue'
import Empty from './components/wd-empty/wd-empty.vue'
import Img from './components/wd-img/wd-img.vue'
import NoticeBar from './components/wd-notice-bar/wd-notice-bar.vue'
import Progress from './components/wd-progress/wd-progress.vue'
import Skeleton from './components/wd-skeleton/wd-skeleton.vue'
import Tag from './components/wd-tag/wd-tag.vue'
// Tier 3b：布局
import Col from './components/wd-col/wd-col.vue'
import Grid from './components/wd-grid/wd-grid.vue'
import GridItem from './components/wd-grid-item/wd-grid-item.vue'
import Resize from './components/wd-resize/wd-resize.vue'
import Row from './components/wd-row/wd-row.vue'
import Sticky from './components/wd-sticky/wd-sticky.vue'
import StickyBox from './components/wd-sticky-box/wd-sticky-box.vue'
// Tier 3c：导航
import Backtop from './components/wd-backtop/wd-backtop.vue'
import IndexAnchor from './components/wd-index-anchor/wd-index-anchor.vue'
import IndexBar from './components/wd-index-bar/wd-index-bar.vue'
import Navbar from './components/wd-navbar/wd-navbar.vue'
import Pagination from './components/wd-pagination/wd-pagination.vue'
import Sidebar from './components/wd-sidebar/wd-sidebar.vue'
import SidebarItem from './components/wd-sidebar-item/wd-sidebar-item.vue'
import Tab from './components/wd-tab/wd-tab.vue'
import Tabs from './components/wd-tabs/wd-tabs.vue'

export {
  Avatar, AvatarGroup, Badge, Card, CountDown, CountTo, Empty, Img, NoticeBar, Progress, Skeleton, Tag,
  Col, Grid, GridItem, Resize, Row, Sticky, StickyBox,
  Backtop, IndexAnchor, IndexBar, Navbar, Pagination, Sidebar, SidebarItem, Tab, Tabs
}

export type { AvatarProps } from './components/wd-avatar/types'
export type { AvatarGroupProps } from './components/wd-avatar-group/types'
export type { BadgeProps } from './components/wd-badge/types'
export type { CardProps } from './components/wd-card/types'
export type { CountDownProps } from './components/wd-count-down/types'
export type { CountToProps } from './components/wd-count-to/types'
export type { EmptyProps } from './components/wd-empty/types'
export type { ImgProps } from './components/wd-img/types'
export type { NoticeBarProps } from './components/wd-notice-bar/types'
export type { ProgressProps } from './components/wd-progress/types'
export type { SkeletonProps } from './components/wd-skeleton/types'
export type { TagProps } from './components/wd-tag/types'
export type { ColProps } from './components/wd-col/types'
export type { GridProps } from './components/wd-grid/types'
export type { GridItemProps } from './components/wd-grid-item/types'
export type { ResizeProps } from './components/wd-resize/types'
export type { RowProps } from './components/wd-row/types'
export type { StickyProps } from './components/wd-sticky/types'
export type { StickyBoxProps } from './components/wd-sticky-box/types'
export type { BacktopProps } from './components/wd-backtop/types'
export type { IndexAnchorProps } from './components/wd-index-anchor/types'
export type { IndexBarProps } from './components/wd-index-bar/types'
export type { NavbarProps } from './components/wd-navbar/types'
export type { PaginationProps } from './components/wd-pagination/types'
export type { SidebarProps } from './components/wd-sidebar/types'
export type { SidebarItemProps } from './components/wd-sidebar-item/types'
export type { TabProps } from './components/wd-tab/types'
export type { TabsProps } from './components/wd-tabs/types'

// Tier 2b：选择器 / 键盘 / 日历 / 上传
import Calendar from './components/wd-calendar/wd-calendar.vue'
import CalendarView from './components/wd-calendar-view/wd-calendar-view.vue'
import Cascader from './components/wd-cascader/wd-cascader.vue'
import DatetimePicker from './components/wd-datetime-picker/wd-datetime-picker.vue'
import DatetimePickerView from './components/wd-datetime-picker-view/wd-datetime-picker-view.vue'
import ImgCropper from './components/wd-img-cropper/wd-img-cropper.vue'
import Keyboard from './components/wd-keyboard/wd-keyboard.vue'
import PasswordInput from './components/wd-password-input/wd-password-input.vue'
import Picker from './components/wd-picker/wd-picker.vue'
import PickerView from './components/wd-picker-view/wd-picker-view.vue'
import Popup from './components/wd-popup/wd-popup.vue'
import SelectPicker from './components/wd-select-picker/wd-select-picker.vue'
import Signature from './components/wd-signature/wd-signature.vue'
import SlideVerify from './components/wd-slide-verify/wd-slide-verify.vue'
import Upload from './components/wd-upload/wd-upload.vue'

export {
  Calendar, CalendarView, Cascader, DatetimePicker, DatetimePickerView, ImgCropper, Keyboard,
  PasswordInput, Picker, PickerView, Popup, SelectPicker, Signature, SlideVerify, Upload
}

export type { CalendarProps } from './components/wd-calendar/types'
export type { CalendarViewProps } from './components/wd-calendar-view/types'
export type { CascaderProps } from './components/wd-cascader/types'
export type { DatetimePickerProps } from './components/wd-datetime-picker/types'
export type { DatetimePickerViewProps } from './components/wd-datetime-picker-view/types'
export type { ImgCropperProps } from './components/wd-img-cropper/types'
export type { KeyboardProps } from './components/wd-keyboard/types'
export type { PasswordInputProps } from './components/wd-password-input/types'
export type { PickerProps } from './components/wd-picker/types'
export type { PickerViewProps } from './components/wd-picker-view/types'
export type { PopupProps } from './components/wd-popup/types'
export type { SelectPickerProps } from './components/wd-select-picker/types'
export type { SignatureProps } from './components/wd-signature/types'
export type { SlideVerifyProps } from './components/wd-slide-verify/types'
export type { UploadProps } from './components/wd-upload/types'

// 命令式 API
export { useToast, getToastOptionKey, toastIcon } from './components/wd-toast'
export type { Toast as ToastApi, ToastOptions } from './components/wd-toast/types'

// 内置图标注册表：扩展一套图标（另一个 iconfont 导出或手写 path）后经
// registerIconSet 注册，即可通过 `<wd-icon name="xxx" />` / `name="key:xxx"` 使用
export { registerIconSet, resolveIcon, hasIcon, listIcons, listIconSets } from './icons/registry'
export type { IconPaths, IconSet, ResolvedIcon } from './icons/types'

export type { ButtonProps } from './components/wd-button/types'
export type { CellProps } from './components/wd-cell/types'
export type { CellGroupProps } from './components/wd-cell-group/types'
export type { ConfigProviderProps } from './components/wd-config-provider/types'
export type { DividerProps } from './components/wd-divider/types'
export type { GapProps } from './components/wd-gap/types'
export type { IconProps } from './components/wd-icon/types'
export type { LoadingProps } from './components/wd-loading/types'
export type { OverlayProps } from './components/wd-overlay/types'
export type { RootPortalProps } from './components/wd-root-portal/types'
export type { TextProps } from './components/wd-text/types'
export type { TransitionProps } from './components/wd-transition/types'
export type { CheckboxProps } from './components/wd-checkbox/types'
export type { CheckboxGroupProps } from './components/wd-checkbox-group/types'
export type { FormProps } from './components/wd-form/types'
export type { FormItemProps } from './components/wd-form-item/types'
export type { InputProps } from './components/wd-input/types'
export type { InputNumberProps } from './components/wd-input-number/types'
export type { RadioProps } from './components/wd-radio/types'
export type { RadioGroupProps } from './components/wd-radio-group/types'
export type { RateProps } from './components/wd-rate/types'
export type { SearchProps } from './components/wd-search/types'
export type { SegmentedProps } from './components/wd-segmented/types'
export type { SliderProps } from './components/wd-slider/types'
export type { SwitchProps } from './components/wd-switch/types'
export type { TextareaProps } from './components/wd-textarea/types'
export type { ToastProps } from './components/wd-toast/types'

// 全局配置契约
export {
  CONFIG_PROVIDER_KEY,
  DEFAULT_GLOBAL_CONFIG,
  mergeConfig
} from './composables/global-config'
export type {
  ButtonConfig,
  ButtonSize,
  ButtonType,
  ButtonVariant,
  ConfigProviderInput,
  ConfigProviderProvide,
  ConfigProviderThemeVars,
  GlobalConfig,
  TagConfig,
  TagSize,
  TagVariant
} from './composables/global-config'

// 组合式函数
export { useParent } from './composables/useParent'
export { useChildren, flattenVNodes, sortChildren } from './composables/useChildren'
export { useQueue } from './composables/useQueue'
export { useTouch } from './composables/useTouch'
export { useRaf } from './composables/useRaf'
export { useCountDown } from './composables/useCountDown'
export { useTranslate } from './composables/useTranslate'
export { useCell, CELL_GROUP_KEY } from './composables/useCell'
export type { CellGroupProvide, CellLayout, CellSize, CellValueAlign } from './composables/useCell'
export { useConfigProvider, mapThemeVarsToCSSVars } from './composables/useConfigProvider'
export { useGlobalConfig } from './composables/useGlobalConfig'
export { useFormDisabled, FORM_KEY, FORM_ITEM_DISABLED_KEY } from './composables/useFormDisabled'
export type { FormItemDisabledProvide, FormProvide } from './composables/useFormDisabled'
export { useLockScroll } from './composables/useLockScroll'
export { useDeviceInfo } from './composables/useDeviceInfo'
export { usePopover } from './composables/usePopover'
export { useRadioGroup, RADIO_GROUP_KEY } from './composables/useRadioGroup'
export type { RadioDirection, RadioGroupProvide, RadioPlacement, RadioType } from './composables/useRadioGroup'
export { useCheckboxGroup, CHECKBOX_GROUP_KEY } from './composables/useCheckboxGroup'
export type { CheckboxDirection, CheckboxGroupProvide, CheckboxPlacement, CheckboxType } from './composables/useCheckboxGroup'
export { useSelection, formatColumnsData } from './composables/useSelection'
export { FORM_ITEM_VALIDATE_KEY } from './composables/useFormItemValidate'
export type { FormItemValidateProvide, FormValidateEvent } from './composables/useFormItemValidate'
export { useUpload, UPLOAD_STATUS } from './composables/useUpload'
export type {
  ChooseFile,
  ChooseFileOption,
  UploadFileItem,
  UploadMethod,
  UploadStatusType,
  UploadSuccessStatus
} from './composables/useUpload'
export { Locale, useCurrentLang } from './locale'

// 工具函数
export * from './common/util'
export * from './common/props'
export * from './common/formatDate'
export { callInterceptor } from './common/interceptor'
export { AbortablePromise } from './common/AbortablePromise'

/**
 * 全局异常兜底（最后一道防线）。
 *
 * 背景：Lynx 后台线程里 Vue 未配置 errorHandler 时，组件生命周期 / watch /
 * 渲染中抛出的未捕获异常会被 logError 重新抛出，最终变成未捕获错误，
 * 被 Sentry 上报为 USER_RUNTIME_ERROR 并**崩掉整张卡片**（白屏）。
 *
 * 策略：安装一个 errorHandler，把组件异常降级为 console.error，保证页面可用；
 * 若宿主应用已经配置了自己的 errorHandler，则链式调用，不覆盖宿主行为。
 */
function installGlobalErrorGuard(app: App): void {
  // 防御：宿主 / 测试环境可能传入不带 config 的 app-like 对象
  if (!app.config) {
    ;(app as { config?: App['config'] }).config = {} as App['config']
  }
  const config = app.config as App['config'] & {
    errorHandler?: (err: unknown, instance: unknown, info: string) => void
  }
  const previousHandler = config.errorHandler

  config.errorHandler = (err: unknown, instance: unknown, info: string) => {
    console.error(`[wot-lynx-ui] 组件异常已兜底（${info}），页面保持可用：`, err)
    if (typeof previousHandler === 'function') {
      previousHandler(err, instance, info)
    }
  }
}

/**
 * kebab-case → PascalCase（wd-button → WdButton）。
 */
function toPascalCase(name: string): string {
  return name
    .split('-')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('')
}

/**
 * 全局注册全部组件的 Vue 插件。
 *
 * 组件清单随重写进度增长（见 CONVENTIONS.md 的重写计划）。
 */
export const wotLynxUI: Plugin = {
  install(app: App) {
    installGlobalErrorGuard(app)

    const components = [
      Button, Cell, CellGroup, ConfigProvider, Divider, Gap, Icon, Loading, Overlay, RootPortal, Text, Transition,
      Checkbox, CheckboxGroup, Form, FormItem, Input, InputNumber, Radio, RadioGroup, Rate, Search, Segmented, Slider, Switch, Textarea, Toast,
      Calendar, CalendarView, Cascader, DatetimePicker, DatetimePickerView, ImgCropper, Keyboard,
      PasswordInput, Picker, PickerView, Popup, SelectPicker, Signature, SlideVerify, Upload,
      Avatar, AvatarGroup, Badge, Card, CountDown, CountTo, Empty, Img, NoticeBar, Progress, Skeleton, Tag,
      Col, Grid, GridItem, Resize, Row, Sticky, StickyBox,
      Backtop, IndexAnchor, IndexBar, Navbar, Pagination, Sidebar, SidebarItem, Tab, Tabs,
      ActionSheet, Circle, Collapse, CollapseItem, Curtain, Dialog, DropMenu, DropMenuItem, Fab,
      FloatingPanel, ImagePreview, Loadmore, NavbarCapsule, Notify, Popover, SortButton, Step, Steps,
      SwipeAction, Swiper, SwiperNav, Tabbar, TabbarItem, Table, Tooltip, Tour, VideoPreview, Watermark,
      BarCode, QrCode, TableColumn
    ]
    components.forEach((component) => {
      const rawName = component.name || (component as { __name?: string }).__name || 'WdComponent'
      app.component(rawName, component)
      const pascalName = toPascalCase(rawName)
      if (pascalName !== rawName) {
        app.component(pascalName, component)
      }
    })
  }
}

export default wotLynxUI
