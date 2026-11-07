import { afterEach, describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { pluginWotLynxWebViewport, webViewportScript } from '../../plugin/web-viewport.js'

function setup(enabled = true) {
  let tags: any
  let hook: any
  ;(pluginWotLynxWebViewport({ enabled }) as any).setup({
    modifyHTMLTags(handler: any) { tags = handler },
    onBeforeStartDevServer(handler: any) { hook = handler }
  })
  return { tags, hook }
}

let dom: JSDOM | undefined
afterEach(() => { dom?.window.close(); dom = undefined })

describe('Lynx Web viewport host plugin', () => {
  it('injects browser-only host code and can be disabled', () => {
    const { tags, hook } = setup()
    const bodyTags = [{ tag: 'div' }]
    const out = tags({ headTags: [], bodyTags })
    expect(out.bodyTags).toBe(bodyTags)
    expect(out.headTags[0].attrs['data-wot-lynx-viewport']).toBe(true)
    expect(out.headTags[0].children).toContain('ResizeObserver')
    expect(hook.order).toBe('pre')
    expect(setup(false)).toEqual({ tags: undefined, hook: undefined })
  })

  it('forwards per-view initial dimensions and resized dimensions, preserving other config', async () => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { runScripts: 'outside-only', url: 'http://localhost/' })
    const win = dom.window as any
    const observers: any[] = []
    win.ResizeObserver = class {
      disconnected = false
      constructor(public callback: () => void) { observers.push(this) }
      observe() {}
      disconnect() { this.disconnected = true }
    }
    win.customElements.define('lynx-view', class extends win.HTMLElement {
      browserConfig = { customHostOption: true }
      events: unknown[] = []
      messages: unknown[] = []
      getJSContext() { return { dispatchEvent: (event: unknown) => this.messages.push(event) } }
      sendGlobalEvent(name: string, params: unknown[]) { this.events.push({ name, params }) }
    })
    const view = win.document.createElement('lynx-view')
    let width = 390
    let height = 844
    Object.defineProperties(view, { clientWidth: { get: () => width }, clientHeight: { get: () => height } })
    win.document.body.append(view)
    win.eval(webViewportScript())
    await Promise.resolve()
    await Promise.resolve()
    expect(view.browserConfig).toEqual({ customHostOption: true, windowWidth: 390, windowHeight: 844 })
    expect(view.events.at(-1)).toEqual({ name: 'wot:viewport-change', params: [{ width: 390, height: 844 }] })
    expect(view.messages.at(-1)).toEqual({ type: 'wot:viewport-change', data: { width: 390, height: 844 } })
    const before = view.events.length
    width = 1440; height = 900
    observers[0].callback()
    expect(view.events.at(-1)).toEqual({ name: 'wot:viewport-change', params: [{ width: 1440, height: 900 }] })
    expect(view.events.length).toBe(before + 1)
    observers[0].callback()
    expect(view.events.length).toBe(before + 1)
    win.eval(webViewportScript()) // duplicate HTML/plugin install is idempotent
    expect(observers).toHaveLength(1)
    view.remove()
    await Promise.resolve()
    await Promise.resolve()
    expect(observers[0].disconnected).toBe(true)
  })

  it('injects virtual preview HTML once, updates headers, and ignores unrelated responses', () => {
    const { hook } = setup()
    let middleware: any
    hook.handler({ server: { middlewares: { use(value: any) { middleware = value } } }, environments: { web: {} } })
    function response(path: string, html: string, type = 'text/html') {
      const headers = new Map<string, unknown>([['Content-Type', type], ['ETag', 'old']])
      let output = ''
      const res = {
        getHeader: (key: string) => headers.get(key),
        setHeader: (key: string, value: unknown) => headers.set(key, value),
        removeHeader: (key: string) => headers.delete(key),
        end: (chunk: string) => { output = chunk }
      }
      middleware({ url: path, method: 'GET' }, res, () => {})
      res.end(html)
      return { headers, output }
    }
    for (const path of ['/__web_preview?casename=main.web.bundle', '/__web_preview/index.html', '/__web_preview/']) {
      const first = response(path, '<html><head></head></html>')
      expect(first.output).toContain('<script data-wot-lynx-viewport>')
      expect(first.headers.get('Content-Length')).toBe(Buffer.byteLength(first.output))
      expect(first.headers.has('ETag')).toBe(false)
      expect(response(path, first.output).output).toBe(first.output)
    }
    expect(response('/other', '<head></head>').output).toBe('<head></head>')
    expect(response('/__web_preview', 'runtime', 'application/javascript').output).toBe('runtime')
  })
})
