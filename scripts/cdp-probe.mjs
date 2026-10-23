/**
 * cdp-probe — 用无头 Chrome 通过 CDP 驱动文档站 H5 预览，复现/验证交互修复。
 * 用法：node scripts/cdp-probe.mjs <url> <scenario> [fileForChooser]
 *   scenario: slide-verify | upload
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveChrome } from './lib/chrome.mjs'

const URL_TARGET = process.argv[2] || 'http://localhost:5173/components/slide-verify.html'
const SCENARIO = process.argv[3] || 'slide-verify'
const CHOOSER_FILE = process.argv[4] || ''

const profileDir = mkdtempSync(join(tmpdir(), 'cdp-probe-'))
const chrome = spawn(resolveChrome(), [
  '--headless=new',
  `--user-data-dir=${profileDir}`,
  '--remote-debugging-port=9222',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--window-size=1400,1000',
  URL_TARGET
])

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function findPageWsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/list')
      const list = await res.json()
      const page = list.find((t) => t.type === 'page' && t.url.includes('localhost:5173'))
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  throw new Error('Chrome CDP page target not ready')
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.handlers = []
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      } else if (msg.method) {
        for (const h of this.handlers) h(msg)
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  on(fn) {
    this.handlers.push(fn)
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result?.value
  }
}

const consoleLogs = []
try {
  const wsUrl = await findPageWsUrl()
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', reject)
  })
  const cdp = new CDP(ws)

  cdp.send('Runtime.enable')
  cdp.send('Page.enable')
  cdp.on((msg) => {
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ')
      consoleLogs.push(`[console.${msg.params.type}] ${text}`)
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleLogs.push(`[exception] ${(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || '').slice(0, 200)}`)
    }
  })

  await sleep(4000)

  for (let i = 0; i < 30; i++) {
    const ready = await cdp.eval(`(() => {
      const el = document.querySelector('.wd-h5-phone__screen')
      return !!el && el.children.length > 0 && !document.querySelector('.wd-h5-phone__error')
    })()`)
    if (ready) break
    await sleep(500)
  }

  const screenInfo = await cdp.eval(`(() => {
    const el = document.querySelector('.wd-h5-phone__screen')
    return el ? { childCount: el.children.length, text: el.textContent?.slice(0, 120) } : null
  })()`)
  console.log('== 屏幕状态 ==', JSON.stringify(screenInfo))

  if (SCENARIO === 'slide-verify') {
    const info = await cdp.eval(`(() => {
      const root = document.querySelector('.wd-slide-verify')
      const btn = document.querySelector('.wd-slide-verify__button')
      const track = document.querySelector('.wd-slide-verify__track')
      if (!root || !btn || !track) return { found: false }
      const rb = btn.getBoundingClientRect()
      const rr = root.getBoundingClientRect()
      return {
        found: true,
        btnRect: { x: rb.x, y: rb.y, w: rb.width, h: rb.height },
        rootRect: { x: rr.x, y: rr.y, w: rr.width, h: rr.height },
        trackWidthBefore: track.style.width || '(css)',
        passClass: root.className
      }
    })()`)
    console.log('== 拖拽前 ==', JSON.stringify(info))

    if (info.found) {
      const cx = Math.round(info.btnRect.x + info.btnRect.w / 2)
      const cy = Math.round(info.btnRect.y + info.btnRect.h / 2)
      // 设计约定（对齐 wot-ui）：按钮不动、彩色轨道随之生长；maxDistance =
      // 容器宽 - 按钮宽，手指需移动满 maxDistance 才算拖到末端
      const maxDistance = info.rootRect.w - info.btnRect.w
      const endX = cx + maxDistance - 1
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 })
      const steps = 24
      for (let i = 1; i <= steps; i++) {
        const x = Math.round(cx + ((endX - cx) * i) / steps)
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: cy, button: 'left' })
        await sleep(16)
      }
      const mid = await cdp.eval(`(() => {
        const root = document.querySelector('.wd-slide-verify')
        const track = document.querySelector('.wd-slide-verify__track')
        return { trackWidthDuring: track?.style.width || '(css)', passDuring: root?.className?.includes('is-pass') }
      })()`)
      console.log('== 拖到末端（未抬手） ==', JSON.stringify(mid))
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: endX, y: cy, button: 'left', clickCount: 1 })
      await sleep(400)
      const after = await cdp.eval(`(() => {
        const root = document.querySelector('.wd-slide-verify')
        const track = document.querySelector('.wd-slide-verify__track')
        return { trackWidthAfter: track?.style.width || '(css)', passClass: root?.className || '' }
      })()`)
      console.log('== 抬手后 ==', JSON.stringify(after))
    }

    // 场景二：拖到一半抬手 → 应回弹且不通过
    await cdp.send('Page.navigate', { url: URL_TARGET })
    await sleep(4000)
    const info2 = await cdp.eval(`(() => {
      const root = document.querySelector('.wd-slide-verify')
      const btn = document.querySelector('.wd-slide-verify__button')
      const track = document.querySelector('.wd-slide-verify__track')
      if (!root || !btn || !track) return { found: false }
      const rb = btn.getBoundingClientRect()
      return { found: true, cx: Math.round(rb.x + rb.width / 2), cy: Math.round(rb.y + rb.height / 2), trackWidthBefore: track.style.width }
    })()`)
    if (info2.found) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: info2.cx, y: info2.cy, button: 'left', clickCount: 1 })
      for (let i = 1; i <= 5; i++) {
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: info2.cx + i * 10, y: info2.cy, button: 'left' })
        await sleep(16)
      }
      const during = await cdp.eval(`(() => document.querySelector('.wd-slide-verify__track')?.style.width || '(css)')()`)
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: info2.cx + 50, y: info2.cy, button: 'left', clickCount: 1 })
      await sleep(700)
      const back = await cdp.eval(`(() => {
        const root = document.querySelector('.wd-slide-verify')
        const track = document.querySelector('.wd-slide-verify__track')
        return { trackWidthAfterRelease: track?.style.width || '(css)', pass: root?.className?.includes('is-pass') }
      })()`)
      console.log('== 半途拖拽 ==', JSON.stringify({ during }), '== 抬手回弹 ==', JSON.stringify(back))
    }
  }

  if (SCENARIO === 'upload') {
    const before = await cdp.eval(`(() => {
      const btn = document.querySelector('.wd-upload__upload')
      return { uploadBtn: !!btn, previewCount: document.querySelectorAll('.wd-upload__preview').length }
    })()`)
    console.log('== 点击前 ==', JSON.stringify(before))

    if (before.uploadBtn) {
      // 预览适配器会同步创建隐藏 input[type=file] 并 click()；headless 下原生
      // 对话框会被立即 dismiss（cancel → input 被移除）。这里先把 input.click()
      // 置空让 input 留在 DOM 中，再用 DOM.setFileInputFiles 回填文件
      // （等价用户在对话框选中文件），完整走通组件流程。
      if (CHOOSER_FILE) {
        await cdp.eval(`HTMLInputElement.prototype.click = function () {}`)
      }
      const box = await cdp.eval(`(() => {
        const r = document.querySelector('.wd-upload__upload').getBoundingClientRect()
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
      })()`)
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 })
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 })
      if (CHOOSER_FILE) {
        await cdp.send('DOM.enable')
        const { root } = await cdp.send('DOM.getDocument')
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' })
        if (nodeId) {
          await cdp.send('DOM.setFileInputFiles', { nodeId, files: [CHOOSER_FILE] })
          console.log('== 已回填文件到 input ==', { nodeId })
        } else {
          console.log('== 未找到 input[type=file] ==')
        }
      }
      await sleep(300)
      const loading = await cdp.eval(`(() => ({
        previewCount: document.querySelectorAll('.wd-upload__preview').length,
        hasLoading: !!document.querySelector('.wd-upload__loading'),
        imgSrc: document.querySelector('.wd-upload__picture')?.getAttribute('src')?.slice(0, 40) || ''
      }))()`)
      console.log('== 选文件后 300ms ==', JSON.stringify(loading))
      await sleep(1500)
      const after = await cdp.eval(`(() => ({
        previewCount: document.querySelectorAll('.wd-upload__preview').length,
        hasLoading: !!document.querySelector('.wd-upload__loading'),
        hasFail: !!document.querySelector('.wd-upload__fail-mask'),
        imgSrc: document.querySelector('.wd-upload__picture')?.getAttribute('src')?.slice(0, 40) || '',
        natural: (() => { const i = document.querySelector('.wd-upload__picture'); return i ? { w: i.naturalWidth, h: i.naturalHeight } : null })()
      }))()`)
      console.log('== 上传完成后 ==', JSON.stringify(after))
    }
  }

  console.log('== console 输出 ==')
  for (const l of consoleLogs) console.log('  ' + l)
} catch (err) {
  console.error('PROBE ERROR:', err.message)
} finally {
  chrome.kill()
  try { rmSync(profileDir, { recursive: true, force: true }) } catch {}
}
