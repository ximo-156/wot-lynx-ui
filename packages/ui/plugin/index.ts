import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildPlugin } from '@rsbuild/core'

const _dirname = path.dirname(fileURLToPath(import.meta.url))

export interface PluginWotLynxTagsOptions {
  /**
   * 是否启用 wd-* → PascalCase 标签转换。
   * @defaultValue true
   */
  enabled?: boolean
}

/**
 * wot-lynx-ui 标签兼容插件。
 *
 * Vue Lynx 编译器将所有 kebab-case 标签视为 Lynx 原生元素，
 * 组件必须使用 PascalCase 标签（<WdButton>）。本插件在构建时将
 * 业务模板中的 <wd-xxx> 标签改写为 <WdXxx>，使业务代码可以
 * 沿用 wot-ui 的标签写法，props / events / slots 完全一致。
 *
 * @example
 * ```ts
 * // lynx.config.ts
 * import { defineConfig } from '@lynx-js/rspeedy'
 * import { pluginWotLynxTags } from 'wot-lynx-ui/plugin'
 *
 * export default defineConfig({
 *   plugins: [pluginWotLynxTags()]
 * })
 * ```
 */
export function pluginWotLynxTags(options: PluginWotLynxTagsOptions = {}): RsbuildPlugin {
  const { enabled = true } = options

  return {
    name: 'wot-lynx-ui:tag-transform',

    setup(api) {
      if (!enabled) return

      api.modifyBundlerChain((chain) => {
        chain.module
          .rule('wot-lynx-ui:tag-transform')
          .enforce('pre')
          .test(/\.vue$/)
          .use('wot-lynx-ui:tag-transform')
          .loader(path.join(_dirname, 'tag-transform-loader.cjs'))
      })
    }
  }
}

export default pluginWotLynxTags

export { pluginWotLynxAutoImport } from './auto-import'
export type { PluginWotLynxAutoImportOptions } from './auto-import'
