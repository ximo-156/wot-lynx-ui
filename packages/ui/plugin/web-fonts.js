import { readFileSync } from 'node:fs'

/**
 * Lynx Web 将 bundle 样式放进 shadow root，但浏览器只在 document 级解析
 * @font-face。Vue 的后台线程没有 document，不能在那里补注册字体。
 * 此插件把原始 TTF 的声明放进宿主 HTML（含 Rspeedy 的固定预览页）。
 * 字体以内联 data URL 保持同源、离线可用，不改任何字形或原生端 CSS。
 */
export function pluginWotLynxWebFonts(options = {}) {
  const { enabled = true, previewPath = '/__web_preview' } = options
  return {
    name: 'wot-lynx-ui:web-fonts',
    setup(api) {
      if (!enabled) return
      const font = readFileSync(new URL('../src/icons/fonts/iconfont.ttf', import.meta.url))
      const css = `@font-face{font-family:wd-iconfont;src:url("data:font/ttf;base64,${font.toString('base64')}") format("truetype");font-weight:normal;font-style:normal;font-display:block}`
      const marker = 'data-wot-lynx-iconfont'
      const style = `<style ${marker}>${css}</style>`

      // 普通 Web 宿主页面（生产构建也生效）。Rspeedy 的固定预览 HTML 不经过
      // HtmlRspackPlugin，所以另外通过公开的 server hook 处理，不修改 node_modules。
      api.modifyHTMLTags(({ headTags, bodyTags }) => ({
        headTags: [...headTags, { tag: 'style', attrs: { [marker]: true }, children: css }],
        bodyTags
      }))
      api.onBeforeStartDevServer({
        order: 'pre',
        handler({ server, environments }) {
          if (!environments.web) return
          server.middlewares.use((req, res, next) => {
            const pathname = (req.url || '').split('?')[0].replace(/^\/\//, '/').replace(/\/$/, '')
            const previewBase = previewPath.replace(/\/$/, '')
            if (![previewBase, `${previewBase}/index.html`].includes(pathname) || !['GET', 'HEAD'].includes(req.method || 'GET')) {
              next()
              return
            }
            const originalEnd = res.end
            res.end = function (chunk, encoding, callback) {
              // 上游 createWebVirtualFilesMiddleware 一次性 end 完整 HTML。
              // 只处理 HTML，未知路由/错误响应保持原样。
              const type = String(this.getHeader('Content-Type') || '')
              if (type.includes('text/html') && (typeof chunk === 'string' || Buffer.isBuffer(chunk))) {
                const html = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk
                if (!html.includes(marker) && html.includes('</head>')) {
                  chunk = html.replace('</head>', `${style}</head>`)
                  this.setHeader('Content-Length', Buffer.byteLength(chunk))
                  this.removeHeader('ETag')
                }
              }
              return originalEnd.call(this, chunk, encoding, callback)
            }
            next()
          })
        }
      })
    }
  }
}

export default pluginWotLynxWebFonts
