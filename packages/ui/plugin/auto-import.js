import path from 'node:path'
import { fileURLToPath } from 'node:url'

const _dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * wot-lynx-ui 自动导入插件。
 *
 * 扫描业务代码中的 <wd-xxx> 标签使用，自动生成 import 语句并注入主题 CSS，
 * 消除手动 import 组件和 import 'wot-lynx-ui/theme' 的负担。
 *
 * 本文件是 exports "./plugin" 指向的运行时入口能加载的纯 JS 实现
 * （与 web-fonts.js 同模式）；类型声明见 auto-import.d.ts。
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
export function pluginWotLynxAutoImport(options = {}) {
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
