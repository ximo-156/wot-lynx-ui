import type { RsbuildPlugin } from '@rsbuild/core'

export interface PluginWotLynxWebFontsOptions {
  /** 是否在 Web 宿主 HTML 注册内置字体，默认 true。 */
  enabled?: boolean
  /** Rspeedy 固定预览页路径，默认 /__web_preview。 */
  previewPath?: string
}

export function pluginWotLynxWebFonts(options?: PluginWotLynxWebFontsOptions): RsbuildPlugin
export default pluginWotLynxWebFonts
