/** Forward actual lynx-view dimensions to its Web Worker; no native-side changes. */
export function webViewportScript() {
  return `(${installWebViewport.toString()})()`
}

function installWebViewport() {
  if (window.__wotLynxViewportInstalled) return
  window.__wotLynxViewportInstalled = true
  const tracked = new Map()
  const eventName = 'wot:viewport-change'

  function publish(view, state, force = false) {
    const width = view.clientWidth
    const height = view.clientHeight
    if (!view.isConnected || width <= 0 || height <= 0) return
    if (!force && state.width === width && state.height === height) return
    state.width = width
    state.height = height
    let config = view.browserConfig
    if (!config) {
      try { config = JSON.parse(view.getAttribute('browser-config') || '{}') } catch { config = {} }
    }
    // Set before the custom element creates its instance: SystemInfo is frozen
    // at initialization. Keep unrelated browserConfig options intact.
    view.browserConfig = { ...config, windowWidth: width, windowHeight: height }
    view.sendGlobalEvent?.(eventName, [{ width, height }])
    // Vue Lynx Web receives cross-thread SDK messages on CoreContext. The Web
    // runtime exposes the sender on its main-thread SDK object (iframe realm).
    const context = jsContext(view)
    context?.dispatchEvent({ type: eventName, data: { width, height } })
  }

  function jsContext(view) {
    try {
      return view.getJSContext?.() || view.shadowRoot?.querySelector('iframe')?.contentWindow?.lynx?.getJSContext?.()
    } catch { return null }
  }

  function observeReady(view, state) {
    if (state.shadowObserver || !view.shadowRoot) return
    function ready() {
      if (!jsContext(view) || !view.shadowRoot.querySelector('[part~="page"]')) return false
      state.shadowObserver?.disconnect()
      state.shadowObserver = null
      publish(view, state, true)
      return true
    }
    if (ready()) return
    state.shadowObserver = new MutationObserver(ready)
    state.shadowObserver.observe(view.shadowRoot, { childList: true, subtree: true })
  }

  function attach(view) {
    if (tracked.has(view)) return
    const state = { width: 0, height: 0, observer: null, shadowObserver: null, ready: null }
    state.ready = () => { publish(view, state, true); observeReady(view, state) }
    tracked.set(view, state)
    publish(view, state)
    if (typeof ResizeObserver === 'function') {
      state.observer = new ResizeObserver(() => publish(view, state))
      state.observer.observe(view)
    }
    view.addEventListener('load', state.ready)
    view.addEventListener('ready', state.ready)
  }

  function scan() {
    for (const [view, state] of tracked) {
      if (!view.isConnected) {
        state.observer?.disconnect(); state.shadowObserver?.disconnect()
        view.removeEventListener('load', state.ready)
        view.removeEventListener('ready', state.ready)
        tracked.delete(view)
      }
    }
    document.querySelectorAll('lynx-view').forEach(attach)
  }

  const mutations = new MutationObserver(scan)
  mutations.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('resize', () => {
    for (const [view, state] of tracked) publish(view, state)
  })
  window.addEventListener('pagehide', () => {
    mutations.disconnect()
    for (const state of tracked.values()) {
      state.observer?.disconnect()
      state.shadowObserver?.disconnect()
    }
    tracked.clear()
  }, { once: true })
  customElements.whenDefined('lynx-view').then(() => {
    scan()
    for (const [view, state] of tracked) state.ready()
  })
  scan()
}

export function pluginWotLynxWebViewport(options = {}) {
  const { enabled = true, previewPath = '/__web_preview' } = options
  const marker = 'data-wot-lynx-viewport'
  return {
    name: 'wot-lynx-ui:web-viewport',
    setup(api) {
      if (!enabled) return
      const script = webViewportScript()
      const tag = `<script ${marker}>${script}</script>`
      api.modifyHTMLTags(({ headTags, bodyTags }) => ({
        headTags: [...headTags, { tag: 'script', attrs: { [marker]: true }, children: script }],
        bodyTags
      }))
      // Rspeedy's built-in preview is virtual HTML, outside HtmlRspackPlugin.
      api.onBeforeStartDevServer({
        order: 'pre',
        handler({ server, environments }) {
          if (!environments.web) return
          server.middlewares.use((req, res, next) => {
            const pathname = (req.url || '').split('?')[0].replace(/^\/\//, '/').replace(/\/$/, '')
            const base = previewPath.replace(/\/$/, '')
            if (![base, `${base}/index.html`].includes(pathname) || !['GET', 'HEAD'].includes(req.method || 'GET')) return next()
            const end = res.end
            res.end = function (chunk, encoding, callback) {
              if (String(this.getHeader('Content-Type') || '').includes('text/html') && (typeof chunk === 'string' || Buffer.isBuffer(chunk))) {
                const html = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk
                if (!html.includes(marker) && html.includes('</head>')) {
                  chunk = html.replace('</head>', `${tag}</head>`)
                  this.setHeader('Content-Length', Buffer.byteLength(chunk))
                  this.removeHeader('ETag')
                }
              }
              return end.call(this, chunk, encoding, callback)
            }
            next()
          })
        }
      })
    }
  }
}

export default pluginWotLynxWebViewport
