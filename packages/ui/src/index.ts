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
 * 全局注册全部组件的 Vue 插件。
 *
 * 组件清单随重写进度增长（见 CONVENTIONS.md 的重写计划）。
 */
export const wotLynxUI: Plugin = {
  install(app: App) {
    installGlobalErrorGuard(app)
  }
}

export default wotLynxUI
