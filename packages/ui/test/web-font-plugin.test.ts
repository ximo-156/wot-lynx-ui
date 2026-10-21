import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
// @ts-expect-error Node build plugin is JavaScript; public declaration lives alongside it.
import { pluginWotLynxWebFonts } from '../plugin/web-fonts.js'

function setup(enabled = true) {
  let tags: any
  let hook: any
  pluginWotLynxWebFonts({ enabled }).setup({
    modifyHTMLTags(handler: any) { tags = handler },
    onBeforeStartDevServer(handler: any) { hook = handler }
  })
  return { tags, hook }
}

function renderPreview(html: string | Buffer, path = '/__web_preview?casename=main.web.bundle', type = 'text/html; charset=utf-8', existing = true) {
  const { hook } = setup()
  let middleware: any
  hook.handler({ server: { middlewares: { use(handler: any) { middleware = handler } } }, environments: existing ? { web: {} } : { lynx: {} } })
  const headers = new Map<string, any>([['Content-Type', type], ['Content-Length', Buffer.byteLength(html)], ['ETag', 'old']])
  let result: any
  let nextCount = 0
  const response = {
    getHeader(name: string) { return headers.get(name) },
    setHeader(name: string, value: any) { headers.set(name, value) },
    removeHeader(name: string) { headers.delete(name) },
    end(chunk: any) { result = chunk; return this }
  }
  if (middleware) middleware({ url: path, method: 'GET' }, response, () => { nextCount++ })
  response.end(html)
  return { result, headers, nextCount, middleware }
}

describe('document-level Lynx Web icon font', () => {
  it('injects the ORIGINAL TTF in a host-page stylesheet, not into Worker JavaScript', () => {
    const { tags, hook } = setup()
    expect(hook.order).toBe('pre') // must precede Rspeedy fixed preview middleware
    const out = tags({ headTags: [], bodyTags: [] })
    expect(out.headTags[0].attrs['data-wot-lynx-iconfont']).toBe(true)
    expect(out.headTags[0].children).toContain('font-family:wd-iconfont;')
    const base64 = out.headTags[0].children.match(/base64,([^"\)]+)/)[1]
    expect(Buffer.from(base64, 'base64')).toEqual(readFileSync(fileURLToPath(new URL('../src/icons/fonts/iconfont.ttf', import.meta.url))))
  })

  it('handles fixed preview HTML and recomputes Content-Length after insertion', () => {
    const html = '<!doctype html><html><head><title>Demo</title></head><body>图标</body></html>'
    const { result, headers, nextCount } = renderPreview(Buffer.from(html))
    expect(result).toContain('<style data-wot-lynx-iconfont>')
    expect(result).toContain('</style></head>')
    expect(headers.get('Content-Length')).toBe(Buffer.byteLength(result))
    expect(headers.has('ETag')).toBe(false)
    expect(nextCount).toBe(1)
  })

  it('does not inject twice and leaves non-preview/non-HTML responses untouched', () => {
    const html = '<html><head><style data-wot-lynx-iconfont></style></head></html>'
    expect(renderPreview(html).result).toBe(html)
    expect(renderPreview('<head></head>', '/other-page').result).toBe('<head></head>')
    expect(renderPreview('runtime JS', '/__web_preview', 'application/javascript').result).toBe('runtime JS')
    expect(renderPreview('<head></head>', '/__web_preview', 'text/html', false).middleware).toBeUndefined()
  })

  it('registers fonts on every HTML alias served by the Lynx preview middleware', () => {
    for (const path of ['/__web_preview/', '/__web_preview/index.html?casename=main.web.bundle', '//__web_preview?casename=main.web.bundle']) {
      expect(renderPreview('<html><head></head></html>', path).result).toContain('<style data-wot-lynx-iconfont>')
    }
  })

  it('can be disabled without touching any Web or Lynx hooks', () => {
    const { tags, hook } = setup(false)
    expect(tags).toBeUndefined()
    expect(hook).toBeUndefined()
  })
})
