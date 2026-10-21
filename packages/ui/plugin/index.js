import path from 'node:path'
import { fileURLToPath } from 'node:url'

const _dirname = path.dirname(fileURLToPath(import.meta.url))

export function pluginWotLynxTags(options = {}) {
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

export { pluginWotLynxWebFonts } from './web-fonts.js'
