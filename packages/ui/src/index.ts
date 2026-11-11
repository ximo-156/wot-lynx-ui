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
import { allPrimitives } from '@wot-lynx/primitives'
import { allLayout } from '@wot-lynx/ui-layout'
import { allDisplay } from '@wot-lynx/ui-display'
import { allNav } from '@wot-lynx/ui-nav'
import { allForm } from '@wot-lynx/ui-form'
import { allFeedback } from '@wot-lynx/ui-feedback'
import { allPicker } from '@wot-lynx/ui-picker'
import { allComponents } from './components'

// ---------------------------------------------------------------------------
// 组件（barrel 为生成物，勿手工维护清单）
// ---------------------------------------------------------------------------
export * from '@wot-lynx/primitives'
export * from './components'

// ---------------------------------------------------------------------------
// 宿主能力桥（ADR-022）：Lynx 原生扩展点（Native Module / JS Module）。
// 本库不再提供 uni-app 兼容层；宿主专属能力按 WotLynxHost 契约注册。
// ---------------------------------------------------------------------------
export { configureHost, getHost, hasHostCapability } from '@wot-lynx/core/common/host'
export type { HostRect, HostUploadTask, WotLynxHost } from '@wot-lynx/core/common/host'

// ---------------------------------------------------------------------------
// 平台能力（ADR-005 / ADR-015）：能力判定统一走 getPlatform().capabilities
// ---------------------------------------------------------------------------
export { getPlatform, configurePlatform, mockPlatform } from '@wot-lynx/core/common/platform'
export type { PlatformAdapter, PlatformCapabilities, PlatformName } from '@wot-lynx/core/common/platform'

// ---------------------------------------------------------------------------
// 命令式 API（弹层系）
// ---------------------------------------------------------------------------
export { useNotify, setNotifyDefaultOptions, resetNotifyDefaultOptions } from '@wot-lynx/ui-feedback/wd-notify'
export { useDialog } from '@wot-lynx/ui-feedback/wd-dialog'
export type { Dialog as DialogApi, DialogOptions, DialogResult } from '@wot-lynx/ui-feedback/wd-dialog/types'
export { useImagePreview } from '@wot-lynx/ui-display/wd-image-preview'
export type { ImagePreviewOptions } from '@wot-lynx/ui-display/wd-image-preview/types'
export { useVideoPreview } from '@wot-lynx/ui-display/wd-video-preview'
export type { VideoPreviewOptions } from '@wot-lynx/ui-display/wd-video-preview/types'
export { useToast, getToastOptionKey, toastIcon } from '@wot-lynx/primitives/wd-toast'
export type { Toast as ToastApi, ToastOptions } from '@wot-lynx/primitives/wd-toast/types'

// ---------------------------------------------------------------------------
// 内置图标注册表：扩展一套图标（另一个 iconfont 导出或手写 path）后经
// registerIconSet 注册，即可通过 `<wd-icon name="xxx" />` / `name="key:xxx"` 使用
// ---------------------------------------------------------------------------
export { registerIconSet, resolveIcon, hasIcon, listIcons, listIconSets } from '@wot-lynx/core/icons/registry'
export type { IconPaths, IconSet, ResolvedIcon } from '@wot-lynx/core/icons/types'

// ---------------------------------------------------------------------------
// 全局配置契约
// ---------------------------------------------------------------------------
export {
  CONFIG_PROVIDER_KEY,
  DEFAULT_GLOBAL_CONFIG,
  mergeConfig
} from '@wot-lynx/core/composables/global-config'
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
} from '@wot-lynx/core/composables/global-config'

// ---------------------------------------------------------------------------
// 组合式函数
// ---------------------------------------------------------------------------
export { useParent } from '@wot-lynx/core/composables/useParent'
export { useChildren, flattenVNodes, sortChildren } from '@wot-lynx/core/composables/useChildren'
export { useQueue } from '@wot-lynx/core/composables/useQueue'
export { useTouch } from '@wot-lynx/core/composables/useTouch'
export { useRaf } from '@wot-lynx/core/composables/useRaf'
export { useCountDown } from '@wot-lynx/core/composables/useCountDown'
export { useTranslate } from '@wot-lynx/core/composables/useTranslate'
export { useCell, CELL_GROUP_KEY } from '@wot-lynx/core/composables/useCell'
export type { CellGroupProvide, CellLayout, CellSize, CellValueAlign } from '@wot-lynx/core/composables/useCell'
export { useConfigProvider, mapThemeVarsToCSSVars } from '@wot-lynx/core/composables/useConfigProvider'
export { useGlobalConfig } from '@wot-lynx/core/composables/useGlobalConfig'
export { useFormDisabled, FORM_KEY, FORM_ITEM_DISABLED_KEY } from '@wot-lynx/core/composables/useFormDisabled'
export type { FormItemDisabledProvide, FormProvide } from '@wot-lynx/core/composables/useFormDisabled'
export { useLockScroll, usePageScrollLock, SCROLL_LOCK_TARGET_KEY } from '@wot-lynx/core/composables/useLockScroll'
export { useDeviceInfo } from '@wot-lynx/core/composables/useDeviceInfo'
export { useSafeArea } from '@wot-lynx/core/composables/useSafeArea'
export { getSafeAreaInsets } from '@wot-lynx/core/common/safe-area'
export type { SafeAreaInsets, SafeAreaInfo, SafeAreaEdge } from '@wot-lynx/core/common/safe-area'
export { useViewportSize, useViewportWidth, useIsWideViewport } from '@wot-lynx/core/composables/useWideViewport'
export type { ReactiveViewport } from '@wot-lynx/core/composables/useWideViewport'
export { usePopover } from '@wot-lynx/core/composables/usePopover'
export { useRadioGroup, RADIO_GROUP_KEY } from '@wot-lynx/core/composables/useRadioGroup'
export type { RadioDirection, RadioGroupProvide, RadioPlacement, RadioType } from '@wot-lynx/core/composables/useRadioGroup'
export { useCheckboxGroup, CHECKBOX_GROUP_KEY } from '@wot-lynx/core/composables/useCheckboxGroup'
export type { CheckboxDirection, CheckboxGroupProvide, CheckboxPlacement, CheckboxType } from '@wot-lynx/core/composables/useCheckboxGroup'
export { useSelection, formatColumnsData } from '@wot-lynx/core/composables/useSelection'
export { FORM_ITEM_VALIDATE_KEY } from '@wot-lynx/core/composables/useFormItemValidate'
export type { FormItemValidateProvide, FormValidateEvent } from '@wot-lynx/core/composables/useFormItemValidate'
export { useUpload, UPLOAD_STATUS } from '@wot-lynx/core/composables/useUpload'
export type {
  ChooseFile,
  ChooseFileOption,
  UploadFileItem,
  UploadMethod,
  UploadStatusType,
  UploadSuccessStatus
} from '@wot-lynx/core/composables/useUpload'
export { Locale, useCurrentLang } from '@wot-lynx/core/locale'

// ---------------------------------------------------------------------------
// 响应式视口（宽屏 / Web 端适配）：Lynx 无 CSS 媒体查询，断点与视口口径统一从
// 这里取。setViewportOverride 供宿主（如文档站预览）声明组件所在的画布尺寸。
// ---------------------------------------------------------------------------
export {
  VIEWPORT_BREAKPOINTS,
  getViewportSize,
  getViewportOverride,
  isWideViewport,
  isDesktopViewport,
  setViewportOverride,
  hasViewportOverride
} from '@wot-lynx/core/common/viewport'
export type { ViewportSize } from '@wot-lynx/core/common/viewport'

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------
export * from '@wot-lynx/core/common/util'
export * from '@wot-lynx/core/common/props'
export * from '@wot-lynx/core/common/formatDate'
export * from '@wot-lynx/core/common/style'
export { callInterceptor } from '@wot-lynx/core/common/interceptor'
export { AbortablePromise } from '@wot-lynx/core/common/AbortablePromise'

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

    const registry = [...allPrimitives, ...allLayout, ...allDisplay, ...allNav, ...allForm, ...allFeedback, ...allPicker, ...allComponents]
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
