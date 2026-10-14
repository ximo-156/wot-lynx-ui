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

// 命令式 API
export { useToast, getToastOptionKey, toastIcon } from './components/wd-toast'
export type { Toast as ToastApi, ToastOptions } from './components/wd-toast/types'

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
      Checkbox, CheckboxGroup, Form, FormItem, Input, InputNumber, Radio, RadioGroup, Rate, Search, Segmented, Slider, Switch, Textarea, Toast
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
