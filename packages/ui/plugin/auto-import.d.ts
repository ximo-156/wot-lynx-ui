import type { RsbuildPlugin } from '@rsbuild/core'

export interface PluginWotLynxAutoImportOptions {
  /** 是否启用自动导入，默认 true。 */
  enabled?: boolean
  /** 自动导入的组件目录（相对于项目根目录），默认 ['src/components', 'src/views', 'src/pages']。 */
  dirs?: string[]
  /** 是否自动注入主题 CSS（入口 App.vue），默认 true。 */
  injectTheme?: boolean
  /** 组件名前缀（用于匹配 <wd-xxx> 标签），默认 'wd-'。 */
  prefix?: string
}

export function pluginWotLynxAutoImport(options?: PluginWotLynxAutoImportOptions): RsbuildPlugin
export default pluginWotLynxAutoImport
