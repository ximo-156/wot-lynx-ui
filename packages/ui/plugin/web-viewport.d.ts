import type { RsbuildPlugin } from '@rsbuild/core'

export interface PluginWotLynxWebViewportOptions {
  /** Forward lynx-view dimensions to its worker. Default true. */
  enabled?: boolean
  /** Rspeedy virtual preview path. Default /__web_preview. */
  previewPath?: string
}

export function webViewportScript(): string
export function pluginWotLynxWebViewport(options?: PluginWotLynxWebViewportOptions): RsbuildPlugin
export default pluginWotLynxWebViewport
