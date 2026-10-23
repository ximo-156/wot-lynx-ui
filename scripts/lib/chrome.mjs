/**
 * 无头 Chrome 的定位、启动与最小 CDP 会话。
 *
 * 零依赖：CDP 走 WebSocket（Node 22 起为全局内建），不装 puppeteer/playwright。
 *
 * 抽成模块的直接原因：`scripts/cdp-probe.mjs` 把 Chrome 路径写死成
 * `/Applications/Google Chrome.app/...`，在 Windows / Linux 上直接跑不起来。
 * 定位逻辑只该有一份。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

/** 各平台常见安装位置，按优先级排列 */
const CANDIDATES = {
  win32: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
}

/**
 * 找到可用的 Chromium 内核浏览器。
 *
 * 优先 `CHROME_PATH` 环境变量：CI 镜像里的位置千奇百怪，写死列表一定会漏。
 */
export function resolveChrome() {
  const fromEnv = process.env.CHROME_PATH
  if (fromEnv) {
    if (!existsSync(fromEnv)) throw new Error(`CHROME_PATH 指向的文件不存在：${fromEnv}`)
    return fromEnv
  }
  for (const candidate of CANDIDATES[process.platform] ?? []) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error(
    `找不到 Chrome / Edge（平台 ${process.platform}）。\n` +
      `  已尝试：${(CANDIDATES[process.platform] ?? []).join(', ') || '(该平台无内置候选)'}\n` +
      `  可用 CHROME_PATH 环境变量显式指定。`
  )
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 启动无头 Chrome，返回 `{ cdp, close }`。
 *
 * 用一个临时 user-data-dir：复用真实配置会带上扩展、书签栏与已登录状态，
 * 截图就不再可复现。
 */
export async function launchChrome({ port, viewport = { width: 1600, height: 1200 }, extraArgs = [] } = {}) {
  const chrome = resolveChrome()
  const profileDir = mkdtempSync(path.join(tmpdir(), 'wot-chrome-'))
  const child = spawn(
    chrome,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${viewport.width},${viewport.height}`,
      ...extraArgs,
      'about:blank'
    ],
    { stdio: 'ignore' }
  )

  let exited = false
  child.on('exit', () => {
    exited = true
  })

  const close = () => {
    if (!exited) child.kill()
    try {
      rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    } catch {
      // 临时目录删不掉不影响结果，Windows 上偶发句柄未释放
    }
  }

  let wsUrl = null
  for (let i = 0; i < 100; i++) {
    if (exited) throw new Error(`Chrome 启动后立即退出（${chrome}）`)
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl
        break
      }
    } catch {
      // 端口还没起来
    }
    await sleep(120)
  }
  if (!wsUrl) {
    close()
    throw new Error(`Chrome 未在预期时间内暴露调试端口 ${port}`)
  }

  const cdp = await CdpSession.connect(wsUrl)
  return { cdp, close, chromePath: chrome }
}

/** 最小 CDP 客户端：够用即止，不做事件订阅框架 */
export class CdpSession {
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', () => reject(new Error(`CDP WebSocket 连接失败：${wsUrl}`)), { once: true })
    })
    return new CdpSession(ws)
  }

  constructor(ws) {
    this.ws = ws
    this.nextId = 0
    this.pending = new Map()
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (!msg.id || !this.pending.has(msg.id)) return
      const { resolve, reject } = this.pending.get(msg.id)
      this.pending.delete(msg.id)
      if (msg.error) reject(new Error(`${msg.error.message ?? 'CDP 错误'}（${JSON.stringify(msg.error)}）`))
      else resolve(msg.result)
    })
  }

  send(method, params = {}) {
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  /** 求值并取回 JS 值（`returnByValue`），异常直接抛 */
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) {
      throw new Error(`页面求值异常：${result.exceptionDetails.text ?? JSON.stringify(result.exceptionDetails)}`)
    }
    return result.result?.value
  }

  close() {
    try {
      this.ws.close()
    } catch {
      // 已断开
    }
  }
}
