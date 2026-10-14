/*
 * wot-lynx-ui — 基于 Vue Lynx 的 wot-ui 适配组件库
 *
 * 使用方式：
 *   1. 引入主题：import 'wot-lynx-ui/theme'（提供 --wot-* 主题变量）；
 *   2. 按需引入组件，或通过 createApp().use(wotLynxUI) 全局注册。
 */
import type { App, Plugin } from 'vue-lynx'

// 组件
import ActionSheet from './components/wd-action-sheet/wd-action-sheet.vue'
import Avatar from './components/wd-avatar/wd-avatar.vue'
import AvatarGroup from './components/wd-avatar-group/wd-avatar-group.vue'
import Backtop from './components/wd-backtop/wd-backtop.vue'
import Badge from './components/wd-badge/wd-badge.vue'
import BarCode from './components/wd-bar-code/wd-bar-code.vue'
import Button from './components/wd-button/wd-button.vue'
import Calendar from './components/wd-calendar/wd-calendar.vue'
import CalendarView from './components/wd-calendar-view/wd-calendar-view.vue'
import Card from './components/wd-card/wd-card.vue'
import Cascader from './components/wd-cascader/wd-cascader.vue'
import Cell from './components/wd-cell/wd-cell.vue'
import CellGroup from './components/wd-cell-group/wd-cell-group.vue'
import Checkbox from './components/wd-checkbox/wd-checkbox.vue'
import CheckboxGroup from './components/wd-checkbox-group/wd-checkbox-group.vue'
import Circle from './components/wd-circle/wd-circle.vue'
import Col from './components/wd-col/wd-col.vue'
import Collapse from './components/wd-collapse/wd-collapse.vue'
import CollapseItem from './components/wd-collapse-item/wd-collapse-item.vue'
import ConfigProvider from './components/wd-config-provider/wd-config-provider.vue'
import CountDown from './components/wd-count-down/wd-count-down.vue'
import CountTo from './components/wd-count-to/wd-count-to.vue'
import Curtain from './components/wd-curtain/wd-curtain.vue'
import DatetimePicker from './components/wd-datetime-picker/wd-datetime-picker.vue'
import DatetimePickerView from './components/wd-datetime-picker-view/wd-datetime-picker-view.vue'
import Dialog from './components/wd-dialog/wd-dialog.vue'
import Divider from './components/wd-divider/wd-divider.vue'
import DropMenu from './components/wd-drop-menu/wd-drop-menu.vue'
import DropMenuItem from './components/wd-drop-menu-item/wd-drop-menu-item.vue'
import Empty from './components/wd-empty/wd-empty.vue'
import Fab from './components/wd-fab/wd-fab.vue'
import FloatingPanel from './components/wd-floating-panel/wd-floating-panel.vue'
import Form from './components/wd-form/wd-form.vue'
import FormItem from './components/wd-form-item/wd-form-item.vue'
import Gap from './components/wd-gap/wd-gap.vue'
import Grid from './components/wd-grid/wd-grid.vue'
import GridItem from './components/wd-grid-item/wd-grid-item.vue'
import Icon from './components/wd-icon/wd-icon.vue'
import ImagePreview from './components/wd-image-preview/wd-image-preview.vue'
import Img from './components/wd-img/wd-img.vue'
import ImgCropper from './components/wd-img-cropper/wd-img-cropper.vue'
import IndexAnchor from './components/wd-index-anchor/wd-index-anchor.vue'
import IndexBar from './components/wd-index-bar/wd-index-bar.vue'
import Input from './components/wd-input/wd-input.vue'
import InputNumber from './components/wd-input-number/wd-input-number.vue'
import Keyboard from './components/wd-keyboard/wd-keyboard.vue'
import Loading from './components/wd-loading/wd-loading.vue'
import Loadmore from './components/wd-loadmore/wd-loadmore.vue'
import Navbar from './components/wd-navbar/wd-navbar.vue'
import NavbarCapsule from './components/wd-navbar-capsule/wd-navbar-capsule.vue'
import NoticeBar from './components/wd-notice-bar/wd-notice-bar.vue'
import Notify from './components/wd-notify/wd-notify.vue'
import Overlay from './components/wd-overlay/wd-overlay.vue'
import Pagination from './components/wd-pagination/wd-pagination.vue'
import PasswordInput from './components/wd-password-input/wd-password-input.vue'
import Picker from './components/wd-picker/wd-picker.vue'
import PickerView from './components/wd-picker-view/wd-picker-view.vue'
import Popover from './components/wd-popover/wd-popover.vue'
import Popup from './components/wd-popup/wd-popup.vue'
import Progress from './components/wd-progress/wd-progress.vue'
import QrCode from './components/wd-qr-code/wd-qr-code.vue'
import Radio from './components/wd-radio/wd-radio.vue'
import RadioGroup from './components/wd-radio-group/wd-radio-group.vue'
import Rate from './components/wd-rate/wd-rate.vue'
import Resize from './components/wd-resize/wd-resize.vue'
import RootPortal from './components/wd-root-portal/wd-root-portal.vue'
import Row from './components/wd-row/wd-row.vue'
import Search from './components/wd-search/wd-search.vue'
import Segmented from './components/wd-segmented/wd-segmented.vue'
import SelectPicker from './components/wd-select-picker/wd-select-picker.vue'
import Sidebar from './components/wd-sidebar/wd-sidebar.vue'
import SidebarItem from './components/wd-sidebar-item/wd-sidebar-item.vue'
import Signature from './components/wd-signature/wd-signature.vue'
import Skeleton from './components/wd-skeleton/wd-skeleton.vue'
import SlideVerify from './components/wd-slide-verify/wd-slide-verify.vue'
import Slider from './components/wd-slider/wd-slider.vue'
import SortButton from './components/wd-sort-button/wd-sort-button.vue'
import Step from './components/wd-step/wd-step.vue'
import Steps from './components/wd-steps/wd-steps.vue'
import Sticky from './components/wd-sticky/wd-sticky.vue'
import StickyBox from './components/wd-sticky-box/wd-sticky-box.vue'
import SwipeAction from './components/wd-swipe-action/wd-swipe-action.vue'
import Swiper from './components/wd-swiper/wd-swiper.vue'
import SwiperNav from './components/wd-swiper-nav/wd-swiper-nav.vue'
import Switch from './components/wd-switch/wd-switch.vue'
import Tab from './components/wd-tab/wd-tab.vue'
import Tabbar from './components/wd-tabbar/wd-tabbar.vue'
import TabbarItem from './components/wd-tabbar-item/wd-tabbar-item.vue'
import Table from './components/wd-table/wd-table.vue'
import TableColumn from './components/wd-table-column/wd-table-column.vue'
import Tabs from './components/wd-tabs/wd-tabs.vue'
import Tag from './components/wd-tag/wd-tag.vue'
import Text from './components/wd-text/wd-text.vue'
import Textarea from './components/wd-textarea/wd-textarea.vue'
import Toast from './components/wd-toast/wd-toast.vue'
import Tooltip from './components/wd-tooltip/wd-tooltip.vue'
import Tour from './components/wd-tour/wd-tour.vue'
import Transition from './components/wd-transition/wd-transition.vue'
import Upload from './components/wd-upload/wd-upload.vue'
import VideoPreview from './components/wd-video-preview/wd-video-preview.vue'
import Watermark from './components/wd-watermark/wd-watermark.vue'
import { configureUniAdapter, hasUniAdapter, uni } from './common/uni'

export {
  // uni-app 兼容层：宿主可注入路由 / 媒体选择 / Toast 等能力
  configureUniAdapter,
  hasUniAdapter,
  uni,
  ActionSheet,
  Avatar,
  AvatarGroup,
  Backtop,
  Badge,
  BarCode,
  Button,
  Calendar,
  CalendarView,
  Card,
  Cascader,
  Cell,
  CellGroup,
  Checkbox,
  CheckboxGroup,
  Circle,
  Col,
  Collapse,
  CollapseItem,
  ConfigProvider,
  CountDown,
  CountTo,
  Curtain,
  DatetimePicker,
  DatetimePickerView,
  Dialog,
  Divider,
  DropMenu,
  DropMenuItem,
  Empty,
  Fab,
  FloatingPanel,
  Form,
  FormItem,
  Gap,
  Grid,
  GridItem,
  Icon,
  ImagePreview,
  Img,
  ImgCropper,
  IndexAnchor,
  IndexBar,
  Input,
  InputNumber,
  Keyboard,
  Loading,
  Loadmore,
  Navbar,
  NavbarCapsule,
  NoticeBar,
  Notify,
  Overlay,
  Pagination,
  PasswordInput,
  Picker,
  PickerView,
  Popover,
  Popup,
  Progress,
  QrCode,
  Radio,
  RadioGroup,
  Rate,
  Resize,
  RootPortal,
  Row,
  Search,
  Segmented,
  SelectPicker,
  Sidebar,
  SidebarItem,
  Signature,
  Skeleton,
  SlideVerify,
  Slider,
  SortButton,
  Step,
  Steps,
  Sticky,
  StickyBox,
  SwipeAction,
  Swiper,
  SwiperNav,
  Switch,
  Tab,
  Tabbar,
  TabbarItem,
  Table,
  TableColumn,
  Tabs,
  Tag,
  Text,
  Textarea,
  Toast,
  Tooltip,
  Tour,
  Transition,
  Upload,
  VideoPreview,
  Watermark
}

// 类型导出
export type { ActionSheetProps } from './components/wd-action-sheet/types'
export type { AvatarProps } from './components/wd-avatar/types'
export type { AvatarGroupProps } from './components/wd-avatar-group/types'
export type { BacktopProps } from './components/wd-backtop/types'
export type { BadgeProps } from './components/wd-badge/types'
export type { BarCodeProps } from './components/wd-bar-code/types'
export type { ButtonProps } from './components/wd-button/types'
export type { CalendarProps } from './components/wd-calendar/types'
export type { CalendarViewProps } from './components/wd-calendar-view/types'
export type { CardProps } from './components/wd-card/types'
export type { CascaderProps } from './components/wd-cascader/types'
export type { CellProps } from './components/wd-cell/types'
export type { CellGroupProps } from './components/wd-cell-group/types'
export type { CheckboxProps } from './components/wd-checkbox/types'
export type { CheckboxGroupProps } from './components/wd-checkbox-group/types'
export type { CircleProps } from './components/wd-circle/types'
export type { ColProps } from './components/wd-col/types'
export type { CollapseProps } from './components/wd-collapse/types'
export type { CollapseItemProps } from './components/wd-collapse-item/types'
export type { ConfigProviderProps } from './components/wd-config-provider/types'
export type { CountDownProps } from './components/wd-count-down/types'
export type { CountToProps } from './components/wd-count-to/types'
export type { CurtainProps } from './components/wd-curtain/types'
export type { DatetimePickerProps } from './components/wd-datetime-picker/types'
export type { DatetimePickerViewProps } from './components/wd-datetime-picker-view/types'
export type { DividerProps } from './components/wd-divider/types'
export type { DropMenuProps } from './components/wd-drop-menu/types'
export type { DropMenuItemProps } from './components/wd-drop-menu-item/types'
export type { EmptyProps } from './components/wd-empty/types'
export type { FabProps } from './components/wd-fab/types'
export type { FormProps } from './components/wd-form/types'
export type { FormItemProps } from './components/wd-form-item/types'
export type { GapProps } from './components/wd-gap/types'
export type { GridProps } from './components/wd-grid/types'
export type { GridItemProps } from './components/wd-grid-item/types'
export type { IconProps } from './components/wd-icon/types'
export type { ImagePreviewProps } from './components/wd-image-preview/types'
export type { ImgProps } from './components/wd-img/types'
export type { ImgCropperProps } from './components/wd-img-cropper/types'
export type { InputProps } from './components/wd-input/types'
export type { InputNumberProps } from './components/wd-input-number/types'
export type { KeyboardProps } from './components/wd-keyboard/types'
export type { LoadingProps } from './components/wd-loading/types'
export type { NavbarProps } from './components/wd-navbar/types'
export type { NavbarCapsuleProps } from './components/wd-navbar-capsule/types'
export type { NoticeBarProps } from './components/wd-notice-bar/types'
export type { NotifyProps } from './components/wd-notify/types'
export type { PickerProps } from './components/wd-picker/types'
export type { PickerViewProps } from './components/wd-picker-view/types'
export type { PopoverProps } from './components/wd-popover/types'
export type { ProgressProps } from './components/wd-progress/types'
export type { QrCodeProps } from './components/wd-qr-code/types'
export type { RadioProps } from './components/wd-radio-group/types'
export type { RowProps } from './components/wd-row/types'
export type { SegmentedProps } from './components/wd-segmented/types'
export type { SelectPickerProps } from './components/wd-select-picker/types'
export type { SidebarProps } from './components/wd-sidebar/types'
export type { SidebarItemProps } from './components/wd-sidebar-item/types'
export type { SignatureProps } from './components/wd-signature/types'
export type { SkeletonProps } from './components/wd-skeleton/types'
export type { SlideVerifyProps } from './components/wd-slide-verify/types'
export type { SliderProps } from './components/wd-slider/types'
export type { SortButtonProps } from './components/wd-sort-button/types'
export type { StepProps } from './components/wd-step/types'
export type { StepsProps } from './components/wd-steps/types'
export type { SwipeActionProps } from './components/wd-swipe-action/types'
export type { SwiperIndicatorProps, SwiperProps } from './components/wd-swiper/types'
export type { SwiperNavProps } from './components/wd-swiper-nav/types'
export type { SwitchProps } from './components/wd-switch/types'
export type { TabProps } from './components/wd-tab/types'
export type { TabbarProps } from './components/wd-tabbar/types'
export type { TabbarItemProps } from './components/wd-tabbar-item/types'
export type { TableProps } from './components/wd-table/types'
export type { TableColumnProps } from './components/wd-table-column/types'
export type { TabsProps } from './components/wd-tabs/types'
export type { TagProps } from './components/wd-tag/types'
export type { TextProps } from './components/wd-text/types'
export type { TextareaProps } from './components/wd-textarea/types'
export type { ToastProps } from './components/wd-toast/types'
export type { TooltipProps } from './components/wd-tooltip/types'
export type { TourProps } from './components/wd-tour/types'
export type { TransitionProps } from './components/wd-transition/types'
export type { UploadProps } from './components/wd-upload/types'
export type { VideoPreviewProps } from './components/wd-video-preview/types'
export type { WatermarkProps } from './components/wd-watermark/types'

// 组合式函数
export { useParent } from './composables/useParent'
export { useChildren, flattenVNodes, sortChildren } from './composables/useChildren'
export { useQueue } from './composables/useQueue'
export { useTouch } from './composables/useTouch'
export { useRaf } from './composables/useRaf'
export { useCountDown } from './composables/useCountDown'
export { useTranslate } from './composables/useTranslate'
export { useCell } from './composables/useCell'
export { useConfigProvider } from './composables/useConfigProvider'
export { useGlobalConfig } from './composables/useGlobalConfig'
export { useFormDisabled } from './composables/useFormDisabled'
export { useLockScroll } from './composables/useLockScroll'
export { useDeviceInfo } from './composables/useDeviceInfo'
export { usePopover } from './composables/usePopover'
export { Locale, useCurrentLang } from './locale'

// 工具函数
export * from './common/util'
export * from './common/props'
export * from './common/formatDate'
export { callInterceptor } from './common/interceptor'
export { AbortablePromise } from './common/AbortablePromise'

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
 * 全局异常兜底（最后一道防线）。
 *
 * 背景：Lynx 后台线程里 Vue 未配置 errorHandler 时，组件生命周期 / watch /
 * 渲染中抛出的未捕获异常会被 logError 重新抛出，最终变成未捕获错误，
 * 被 Sentry 上报为 USER_RUNTIME_ERROR 并**崩掉整张卡片**（白屏）。
 *
 * 策略：安装一个 errorHandler，把组件异常降级为 console.error，保证页面可用；
 * 若宿主应用已经配置了自己的 errorHandler，则链式调用，不覆盖宿主行为。
 *
 * 注意：errorHandler 只捕获 Vue 组件树内的同步异常；未处理的 Promise 拒绝
 * 需要各调用点自行兜底（见 common/util.ts 的 getRect 约定：永不 reject）。
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
 * 全局注册全部组件的 Vue 插件
 */
export const wotLynxUI: Plugin = {
  install(app: App) {
    installGlobalErrorGuard(app)

    const components = [
      ActionSheet,
      Avatar,
      AvatarGroup,
      Backtop,
      Badge,
      BarCode,
      Button,
      Calendar,
      CalendarView,
      Card,
      Cascader,
      Cell,
      CellGroup,
      Checkbox,
      CheckboxGroup,
      Circle,
      Col,
      Collapse,
      CollapseItem,
      ConfigProvider,
      CountDown,
      CountTo,
      Curtain,
      DatetimePicker,
      DatetimePickerView,
      Dialog,
      Divider,
      DropMenu,
      DropMenuItem,
      Empty,
      Fab,
      FloatingPanel,
      Form,
      FormItem,
      Gap,
      Grid,
      GridItem,
      Icon,
      ImagePreview,
      Img,
      ImgCropper,
      IndexAnchor,
      IndexBar,
      Input,
      InputNumber,
      Keyboard,
      Loading,
      Loadmore,
      Navbar,
      NavbarCapsule,
      NoticeBar,
      Notify,
      Overlay,
      Pagination,
      PasswordInput,
      Picker,
      PickerView,
      Popover,
      Popup,
      Progress,
      QrCode,
      Radio,
      RadioGroup,
      Rate,
      Resize,
      RootPortal,
      Row,
      Search,
      Segmented,
      SelectPicker,
      Sidebar,
      SidebarItem,
      Signature,
      Skeleton,
      SlideVerify,
      Slider,
      SortButton,
      Step,
      Steps,
      Sticky,
      StickyBox,
      SwipeAction,
      Swiper,
      SwiperNav,
      Switch,
      Tab,
      Tabbar,
      TabbarItem,
      Table,
      TableColumn,
      Tabs,
      Tag,
      Text,
      Textarea,
      Toast,
      Tooltip,
      Tour,
      Transition,
      Upload,
      VideoPreview,
      Watermark,
    ]
    components.forEach((component) => {
      // <script setup> 组件运行时没有 name 属性，只有编译器按文件名注入的
      // __name（如 'wd-button'）；两者都取不到时退回 'WdComponent'。
      const rawName =
        component.name || (component as { __name?: string }).__name || 'WdComponent'
      // Vue 的 resolveComponent 只按「注册名 / camelize(name) / capitalize(name)」
      // 匹配，PascalCase 标签 <WdButton> 无法命中 kebab-case 注册名 'wd-button'，
      // 因此同时注册两种写法，保证全局注册后 <WdButton> 与经插件改写的
      // <wd-button> 都能解析到组件（否则会退化为原生元素，真机上报
      // 603 "Can't find ui tag" 且页面空白）。
      app.component(rawName, component)
      const pascalName = toPascalCase(rawName)
      if (pascalName !== rawName) {
        app.component(pascalName, component)
      }
    })
  }
}

export default wotLynxUI
