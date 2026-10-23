/**
 * 原生优先重写 · 布局居中契约回归（wd-backtop / wd-qr-code / wd-upload）。
 *
 * 背景（NATIVE-REWRITE §3 / CONVENTIONS §15/§19）：本批三个组件均为「静态/
 * 展示」类别——回到顶部按钮（显隐由 wd-transition 承担、点击走事件）、
 * 二维码（码图由后台线程编码为 svg content，UI 线程原生绘制）、上传
 * （预览网格 + 唤起项，无拖动/滑动/缩放跟手手势），按 §8 分工不涉及 MTS
 * worklet（fab 的拖动 MTS 化另见 test/fab-mts.test.ts）。重写重点是根节点
 * 三件套与居中补全：
 *
 * 1. Lynx 3.x 默认 linear 布局，`flex-direction` 只在 `display: flex` 上生效
 *    （CONVENTIONS §15）——三组件根视图显式 display: flex + flex-direction；
 * 2. 需要居中处 justify-content + align-items 成对写全，文本节点另加
 *    text-align: center（Lynx text 不依赖继承）；
 * 3. 编译产物不出现 Lynx 静默丢失的 Web 专有写法（inline-flex /
 *    inline-block / float / vertical-align / cursor / user-select /
 *    outline / -webkit-*）；
 * 4. 绝对定位居中用四边 0 + flex 居中，禁 left/top 50% + translate 找中心
 *    （upload 的播放图标即由该写法改写而来）；
 * 5. DOM 结构（BEM 类名 / 层级 / 原生元素）与 wot-ui 2.3.2 对齐不回退，
 *    各组件既有交互事件链路（backtop 的 click / tap、qr-code 的 click /
 *    tap / exportImage、upload 的 remove / change）保持可用。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { h } from 'vue-lynx'
import { render, cleanup } from '../render'
import { pause } from '../../src/common/util'
import Backtop from '../../src/components/wd-backtop/wd-backtop.vue'
import QrCode from '../../src/components/wd-qr-code/wd-qr-code.vue'
import Upload from '../../src/components/wd-upload/wd-upload.vue'
import { compRead } from '../helpers/component-roots'

// 双组件根解析（ADR-012）：rel 形如 'wd-cell/index.css'
const css = (rel: string) => compRead(...rel.split('/'))

/**
 * 抽取指定选择器的声明体（编译产物为压缩单行）。
 *
 * 一个选择器可能命中多条规则（mixin 的 `e(a, b)` 会生成逗号合并选择器，
 * 且同名选择器可能被后续规则覆盖）——按层叠顺序拼接全部命中体，断言
 * 「包含某声明」时等价于最终生效值。
 */
function ruleOf(cssText: string, selector: string): string {
  const bodies: string[] = []
  for (const rule of cssText.split('}')) {
    const idx = rule.lastIndexOf('{')
    if (idx === -1) continue
    const sels = rule.slice(0, idx).split(',').map((s) => s.trim())
    if (sels.includes(selector)) bodies.push(rule.slice(idx + 1))
  }
  if (!bodies.length) throw new Error(`selector not found in compiled css: ${selector}`)
  return bodies.join(';')
}

/** 根节点三件套：display: flex + 显式 flex-direction */
function expectRootFlex(cssText: string, selector: string, direction: 'row' | 'column') {
  const body = ruleOf(cssText, selector)
  expect(body, `${selector} 必须显式 display: flex`).toMatch(/(^|;)display:flex(;|$)/)
  expect(body, `${selector} 必须显式 flex-direction: ${direction}`).toMatch(
    new RegExp(`(^|;)flex-direction:${direction}(;|$)`)
  )
}

/** 居中成对：justify-content + align-items 同时出现 */
function expectCenterPair(cssText: string, selector: string) {
  const body = ruleOf(cssText, selector)
  expect(body, `${selector} 需要 justify-content: center`).toMatch(/(^|;)justify-content:center(;|$)/)
  expect(body, `${selector} 需要 align-items: center`).toMatch(/(^|;)align-items:center(;|$)/)
}

/** 文本居中：text-align: center */
function expectTextCenter(cssText: string, selector: string) {
  expect(ruleOf(cssText, selector), `${selector} 需要 text-align: center`).toMatch(/(^|;)text-align:center(;|$)/)
}

/** Lynx 不识别、写了即静默丢失的 Web 专有写法 */
const SILENTLY_DROPPED = [
  /display:inline-flex/,
  /display:inline-block/,
  /(^|;)float:/,
  /(^|;)vertical-align:/,
  /(^|;)cursor:/,
  /(^|;)user-select:/,
  /(^|;)outline:/,
  /-webkit-/
]

/** 百分比位移找中心（NATIVE-REWRITE §3.2：绝对定位居中应四边 0 + flex） */
const PERCENT_CENTERING = [/left:\s*50%/, /top:\s*50%/, /translate\(-50%/]

const BATCH_CSS = ['wd-backtop/index.css', 'wd-qr-code/index.css', 'wd-upload/index.css']

describe('原生优先重写 · 布局居中契约（backtop / qr-code / upload）', () => {
  afterEach(() => cleanup())

  it('编译产物不含 Lynx 静默丢失的 Web 专有写法', () => {
    for (const rel of BATCH_CSS) {
      const text = css(rel)
      for (const re of SILENTLY_DROPPED) {
        expect(re.test(text), `${rel} 含 Lynx 不识别写法: ${re}`).toBe(false)
      }
    }
  })

  it('编译产物不用 left/top 50% + translate 找中心（四边 0 + flex 居中）', () => {
    for (const rel of BATCH_CSS) {
      const text = css(rel)
      for (const re of PERCENT_CENTERING) {
        expect(re.test(text), `${rel} 含百分比位移找中心: ${re}`).toBe(false)
      }
    }
  })

  it('wd-backtop：transition 根节点（承载 fixed）纵向三件套 + 内容/文本居中', () => {
    const c = css('wd-backtop/index.css')
    // 契约（test/backtop-visibility.test.ts）：.wd-backtop 类必须下发到
    // wd-transition 根节点，显隐与定位同源——故三件套落在该选择器上
    expectRootFlex(c, '.wd-backtop', 'column')
    expectCenterPair(c, '.wd-backtop')
    // 内容容器：图标 + 文本纵排居中
    expectRootFlex(c, '.wd-backtop__content', 'column')
    expectCenterPair(c, '.wd-backtop__content')
    // 文本节点自身补 text-align: center
    expectTextCenter(c, '.wd-backtop__text')
  })

  it('wd-qr-code：根节点横向三件套 + 成对居中', () => {
    const c = css('wd-qr-code/index.css')
    expectRootFlex(c, '.wd-qr-code', 'row')
    expectCenterPair(c, '.wd-qr-code')
  })

  it('wd-upload：根节点横向换行三件套 + 唤起项/文件/状态层居中', () => {
    const c = css('wd-upload/index.css')
    expectRootFlex(c, '.wd-upload', 'row')
    expect(ruleOf(c, '.wd-upload'), '预览项横向换行').toMatch(/(^|;)flex-wrap:wrap(;|$)/)
    // 唤起项：图标 + 计数文本纵排居中
    expectRootFlex(c, '.wd-upload__evoke', 'column')
    expectCenterPair(c, '.wd-upload__evoke')
    expectTextCenter(c, '.wd-upload__evoke-num')
    // 文件 / 视频预览容器：图标 + 名称纵排居中
    expectRootFlex(c, '.wd-upload__file', 'column')
    expectCenterPair(c, '.wd-upload__file')
    expectRootFlex(c, '.wd-upload__video', 'column')
    expectCenterPair(c, '.wd-upload__video')
    // 播放图标：四边 0 + flex 居中（替代 left/top 50% + translate）
    expect(ruleOf(c, '.wd-upload .wd-upload__video-play')).toMatch(/(^|;)top:0(;|$)/)
    expect(ruleOf(c, '.wd-upload .wd-upload__video-play')).toMatch(/(^|;)right:0(;|$)/)
    expect(ruleOf(c, '.wd-upload .wd-upload__video-play')).toMatch(/(^|;)bottom:0(;|$)/)
    expect(ruleOf(c, '.wd-upload .wd-upload__video-play')).toMatch(/(^|;)left:0(;|$)/)
    expectCenterPair(c, '.wd-upload .wd-upload__video-play')
    // 文件名 / 进度文本：text-align: center
    expectTextCenter(c, '.wd-upload__file-name')
    expectTextCenter(c, '.wd-upload__progress-txt')
    // 上传中 / 失败蒙层内容：纵排居中
    expectRootFlex(c, '.wd-upload__status-content', 'column')
    expectCenterPair(c, '.wd-upload__status-content')
  })

  it('DOM 结构与事件链路不回退：backtop / qr-code / upload', async () => {
    const backtop = render({
      setup: () => () => h(Backtop as any, { scrollTop: 500, top: 60, text: '顶部' })
    } as any)
    await pause(30)
    expect(backtop.container.querySelector('.wd-backtop__content')).not.toBeNull()
    expect(backtop.container.querySelector('.wd-backtop__backicon')).not.toBeNull()
    expect(backtop.container.querySelector('.wd-backtop__text')!.textContent).toBe('顶部')
    cleanup()

    const qr = render({
      setup: () => () => h(QrCode as any, { text: 'HELLO', size: 120 })
    } as any)
    await pause(30)
    const svg = qr.container.querySelector('svg')
    expect(svg, '码图经原生 svg content 渲染').not.toBeNull()
    expect(svg!.getAttribute('content')).toMatch(/<svg/)
    cleanup()

    const upload = render({
      setup: () => () =>
        h(Upload as any, {
          fileList: [{ uid: 1, url: 'https://example.com/a.png', name: 'a.png' }] as any
        })
    } as any)
    await pause(30)
    expect(upload.container.querySelector('.wd-upload__preview')).not.toBeNull()
    expect(upload.container.querySelector('.wd-upload__picture')).not.toBeNull()
    expect(upload.container.querySelector('.wd-upload__evoke')).not.toBeNull()
    cleanup()
  })
})
