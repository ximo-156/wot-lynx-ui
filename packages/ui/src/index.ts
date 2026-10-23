/*
 * wot-lynx-ui — 基于 Vue Lynx 的 wot-ui API 兼容组件库（重写版）
 *
 * 使用方式：
 *   1. 引入主题：import 'wot-lynx-ui/theme'（提供 --wot-* 设计令牌）；
 *   2. 按需引入组件，或通过 createApp().use(wotLynxUI) 全局注册。
 *
 * 组件清单**不在此文件维护**：它由 scripts/gen-index.mjs 从两处目录结构生成：
 *   - src/primitives/  L3.5 基础件（icon / popup / button …）
 *   - src/components/  L4 业务组件（calendar / tabs / form …）
 * 新增组件后运行 `pnpm gen:index`。分层依据见 docs/adr/012-primitives-layer.md。
 *
 * 本文件只负责：两份 barrel 的转出、非组件导出、以及全局注册插件。
 */
import type { App, Plugin } from 'vue-lynx'
import { allPrimitives } from './primitives'
import { allComponents } from './components'
import { configureUniAdapter, hasUniAdapter, uni } from './common/uni'

// ---------------------------------------------------------------------------
// 组件（barrel 为生成物，勿手工维护清单）
// ---------------------------------------------------------------------------
export * from './primitives'
export * from './components'

// ---------------------------------------------------------------------------
// uni-app 兼容层：宿主可注入路由 / 媒体选择 / Toast 等能力
// ---------------------------------------------------------------------------
export { configureUniAdapter, hasUniAdapter, uni }

// ---------------------------------------------------------------------------
// 平台能力（ADR-005 / ADR-015）：能力判定统一走 getPlatform().capabilities
// ---------------------------------------------------------------------------
export { getPlatform, configurePlatform, mockPlatform } from './common/platform'
export type { PlatformAdapter, PlatformCapabilities, PlatformName } from './common/platform'

// ---------------------------------------------------------------------------
// 命令式 API（弹层系）
// ---------------------------------------------------------------------------
export { useNotify, setNotifyDefaultOptions, resetNotifyDefaultOptions } from './components/wd-notify'
export { useDialog } from './components/wd-dialog'
export type { Dialog as DialogApi, DialogOptions, DialogResult } from './components/wd-dialog/types'
export { useImagePreview } from './components/wd-image-preview'
export type { ImagePreviewOptions } from './components/wd-image-preview/types'
export { useVideoPreview } from './components/wd-video-preview'
export type { VideoPreviewOptions } from './components/wd-video-preview/types'
export { useToast, getToastOptionKey, toastIcon } from './components/wd-toast'
export type { Toast as ToastApi, ToastOptions } from './components/wd-toast/types'

// ---------------------------------------------------------------------------
// 内置图标注册表：扩展一套图标（另一个 iconfont 导出或手写 path）后经
// registerIconSet 注册，即可通过 `<wd-icon name="xxx" />` / `name="key:xxx"` 使用
// ---------------------------------------------------------------------------
export { registerIconSet, resolveIcon, hasIcon, listIcons, listIconSets } from './icons/registry'
export type { IconPaths, IconSet, ResolvedIcon } from './icons/types'

// ---------------------------------------------------------------------------
// 全局配置契约
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// 组合式函数
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------
export * from './common/util'
export * from './common/props'
export * from './common/formatDate'
export * from './common/style'
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
 * 组件清单来自两份生成物（单一来源）：基础件在前、业务组件在后。
 * 基础件不依赖业务组件，注册顺序不影响解析，但保持层序便于调试。
 */
export const wotLynxUI: Plugin = {
  install(app: App) {
    installGlobalErrorGuard(app)

    const registry = [...allPrimitives, ...allComponents]
    registry.forEach((component) => {
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
