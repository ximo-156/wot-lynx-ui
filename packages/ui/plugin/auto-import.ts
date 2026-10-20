import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'

import type { RsbuildPlugin } from '@rsbuild/core'

const _dirname = path.dirname(fileURLToPath(import.meta.url))

export interface PluginWotLynxAutoImportOptions {
  /**
   * 是否启用自动导入。
   * @defaultValue true
   */
  enabled?: boolean
  /**
   * 自动导入的组件目录（相对于项目根目录）。
   * @defaultValue ['src/components', 'src/views', 'src/pages']
   */
  dirs?: string[]
  /**
   * 是否自动注入主题 CSS。
   * @defaultValue true
   */
  injectTheme?: boolean
  /**
   * 组件名前缀（用于匹配 <wd-xxx> 标签）。
   * @defaultValue 'wd-'
   */
  prefix?: string
}

/**
 * wot-lynx-ui 自动导入插件。
 *
 * 扫描业务代码中的 <wd-xxx> 标签使用，自动生成 import 语句并注入主题 CSS，
 * 消除手动 import 组件和 import 'wot-lynx-ui/theme' 的负担。
 *
 * @example
 * ```ts
 * // lynx.config.ts
 * import { defineConfig } from '@lynx-js/rspeedy'
 * import { pluginWotLynxAutoImport } from 'wot-lynx-ui/plugin'
 *
 * export default defineConfig({
 *   plugins: [pluginWotLynxAutoImport()]
 * })
 * ```
 */
export function pluginWotLynxAutoImport(options: PluginWotLynxAutoImportOptions = {}): RsbuildPlugin {
  const {
    enabled = true,
    dirs = ['src/components', 'src/views', 'src/pages'],
    injectTheme = true,
    prefix = 'wd-'
  } = options

  return {
    name: 'wot-lynx-ui:auto-import',

    setup(api) {
      if (!enabled) return

      const root = api.context.rootPath

      // 收集业务代码中使用的 wd-* 组件
      const usedComponents = new Set<string>()

      api.modifyBundlerChain((chain) => {
        chain.module
          .rule('wot-lynx-ui:auto-import')
          .enforce('pre')
          .test(/\.vue$/)
          .use('wot-lynx-ui:auto-import')
          .loader(path.join(_dirname, 'auto-import-loader.cjs'))
          .options({
            root,
            dirs,
            prefix,
            injectTheme
          })
      })
    }
  }
}

export default pluginWotLynxAutoImport
