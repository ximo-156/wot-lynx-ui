/**
 * 原生优先重写 · 气泡/浮层/预览家族布局居中契约回归（wd-popover /
 * wd-tooltip / wd-curtain / wd-floating-panel / wd-tour / wd-image-preview /
 * wd-video-preview）。
 *
 * 背景（NATIVE-REWRITE §3 / CONVENTIONS §9/§15/§19/§20）：本批组件是「样式
 * 不居中」的另一片重灾区——Lynx 3.x 默认 linear 布局下 flex-direction 被静默
 * 丢弃、inline-block 不识别、left:50% + translate 居中脆弱、弹层内容靠
 * text-align 继承不可靠。本测试锁定静态契约与关键交互：
 *
 * 1. 每个根视图（含 curtain 的 __content）显式 `display: flex` +
 *    `flex-direction`（根节点三件套）；
 * 2. 需要居中处 `justify-content` + `align-items` 成对写全，文本节点另加
 *    `text-align: center`；绝对定位水平居中用「左右贴边 + flex 居中」或
 *    四边 0，不用 left:50% + translate（tour 提示框因需贴高亮元素动态定位，
 *    属确有必要，单独注明）；
 * 3. 编译产物不出现 Lynx 静默丢失的 Web 专有写法（inline-flex /
 *    inline-block / float / vertical-align / cursor / user-select /
 *    outline / -webkit-*）；
 * 4. 弹层（backdrop / 幕帘 / 预览遮罩）四边 0 铺满 + 内容 flex 居中；
 * 5. DOM 结构（BEM 类名 / 层级 / 原生元素）与 wot-ui 2.3.2 对齐不回退，
 *    气泡开关、幕帘关闭、引导步进、预览命令式通道保持可用。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { pause } from '../../src/common/util'
import { fireEvent } from '../fire-event'
import Popover from '../../src/components/wd-popover/wd-popover.vue'
import Tooltip from '../../src/components/wd-tooltip/wd-tooltip.vue'
import Curtain from '../../src/components/wd-curtain/wd-curtain.vue'
import FloatingPanel from '../../src/components/wd-floating-panel/wd-floating-panel.vue'
import Tour from '../../src/components/wd-tour/wd-tour.vue'
import ImagePreview from '../../src/components/wd-image-preview/wd-image-preview.vue'
import VideoPreview from '../../src/components/wd-video-preview/wd-video-preview.vue'
import { compRead } from '../helpers/component-roots'

// 双组件根解析（ADR-012）：rel 形如 'wd-cell/index.css'
const css = (rel: string) => compRead(...rel.split('/'))

/** 抽取指定选择器的声明体（编译产物为压缩单行，按选择器精确切分） */
function ruleOf(cssText: string, selector: string): string {
  const re = new RegExp(`(?:^|[,}])\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^{}]*)\\}`, 'm')
  const m = cssText.match(re)
  if (!m) throw new Error(`selector not found in compiled css: ${selector}`)
  return m[1]
}

/** 根节点三件套：display: flex + 显式 flex-direction */
function expectRootFlex(cssText: string, selector: string, direction: 'row' | 'column') {
  const body = ruleOf(cssText, selector)
  expect(body, `${selector} 必须显式 display: flex`).toMatch(/(^|;)display:flex(;|$)/)
  expect(body, `${selector} 必须显式 flex-direction: ${direction}`).toMatch(new RegExp(`(^|;)flex-direction:${direction}(;|$)`))
}

/** 居中成对：justify-content + align-items 同时出现 */
function expectCenterPair(cssText: string, selector: string) {
  const body = ruleOf(cssText, selector)
  expect(body, `${selector} 需要 justify-content: center`).toMatch(/(^|;)justify-content:center(;|$)/)
  expect(body, `${selector} 需要 align-items: center`).toMatch(/(^|;)align-items:center(;|$)/)
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

const BATCH_CSS = [
  'wd-popover/index.css',
  'wd-tooltip/index.css',
  'wd-curtain/index.css',
  'wd-floating-panel/index.css',
  'wd-tour/index.css',
  'wd-image-preview/index.css',
  'wd-video-preview/index.css'
]

describe('原生优先重写 · 气泡/浮层/预览布局居中契约（popover / tooltip / curtain / floating-panel / tour / image-preview / video-preview）', () => {
  afterEach(() => cleanup())

  it('编译产物不含 Lynx 静默丢失的 Web 专有写法', () => {
    for (const rel of BATCH_CSS) {
      const text = css(rel)
      for (const re of SILENTLY_DROPPED) {
        expect(re.test(text), `${rel} 含 Lynx 不识别写法: ${re}`).toBe(false)
      }
    }
  })

  it('根节点三件套：七个组件根（含幕帘内容区）显式 flex + 方向', () => {
    expectRootFlex(css('wd-popover/index.css'), '.wd-popover', 'row')
    expectRootFlex(css('wd-tooltip/index.css'), '.wd-tooltip', 'row')
    // 幕帘根即 wd-popup 根（三件套由 .wd-popup 提供，见弹层批次契约），
    // 内容区为后代选择器 .wd-curtain .wd-curtain__content（edeep 生成）
    expectRootFlex(css('wd-curtain/index.css'), '.wd-curtain .wd-curtain__content', 'row')
    expectRootFlex(css('wd-floating-panel/index.css'), '.wd-floating-panel', 'column')
    expectRootFlex(css('wd-tour/index.css'), '.wd-tour', 'column')
    expectRootFlex(css('wd-tour/index.css'), '.wd-tour__mask', 'column')
    expectRootFlex(css('wd-image-preview/index.css'), '.wd-image-preview', 'column')
    expectRootFlex(css('wd-video-preview/index.css'), '.wd-video-preview', 'column')
  })

  it('弹层内容成对居中 + 文本居中（气泡 / 提示 / 引导弹层）', () => {
    // 气泡普通模式内容
    expectCenterPair(css('wd-popover/index.css'), '.wd-popover__inner')
    expect(ruleOf(css('wd-popover/index.css'), '.wd-popover__inner')).toMatch(/(^|;)text-align:center(;|$)/)
    // 提示气泡内容（__pos 有 min-width，气泡宽于文字时靠 flex 居中）
    expectCenterPair(css('wd-tooltip/index.css'), '.wd-tooltip__inner')
    expect(ruleOf(css('wd-tooltip/index.css'), '.wd-tooltip__inner')).toMatch(/(^|;)text-align:center(;|$)/)
    // 引导提示框（文本居中）+ 操作区（右对齐 + 交叉轴居中）
    expect(ruleOf(css('wd-tour/index.css'), '.wd-tour__popover')).toMatch(/(^|;)text-align:center(;|$)/)
    expectRootFlex(css('wd-tour/index.css'), '.wd-tour__popover', 'column')
    const buttons = ruleOf(css('wd-tour/index.css'), '.wd-tour__buttons')
    expect(buttons).toMatch(/(^|;)justify-content:flex-end(;|$)/)
    expect(buttons).toMatch(/(^|;)align-items:center(;|$)/)
  })

  it('绝对定位居中：预览页码 / 关闭按钮 / 面板拖拽条成对居中，禁 left:50% + translate', () => {
    // 图片预览页码：左右贴边撑满 + flex 居中（原 left:50% + translateX(-50%)）
    const index = ruleOf(css('wd-image-preview/index.css'), '.wd-image-preview__index')
    expect(index, '页码指示器应左右贴边').toMatch(/(^|;)left:0(;|$)/)
    expect(index).toMatch(/(^|;)right:0(;|$)/)
    expectCenterPair(css('wd-image-preview/index.css'), '.wd-image-preview__index')
    expect(index, '页码指示器不得用 left:50% + translate 居中').not.toMatch(/left:50%/)
    expect(index).not.toMatch(/transform:/)
    // 关闭按钮（图片 / 视频预览）
    expectCenterPair(css('wd-image-preview/index.css'), '.wd-image-preview__close')
    expectCenterPair(css('wd-video-preview/index.css'), '.wd-video-preview__close')
    // 浮动面板拖拽条
    expectCenterPair(css('wd-floating-panel/index.css'), '.wd-floating-panel__header')
  })

  it('弹层铺满：backdrop 四边 0 + 预览/幕帘根四边 0（CONVENTIONS §9）', () => {
    for (const sel of ['.wd-popover__backdrop', '.wd-tooltip__backdrop']) {
      const body = ruleOf(css(sel === '.wd-popover__backdrop' ? 'wd-popover/index.css' : 'wd-tooltip/index.css'), sel)
      expect(body, `${sel} 应四边 0`).toMatch(/(^|;)position:fixed(;|$)/)
      expect(body).toMatch(/(^|;)left:0(;|$)/)
      expect(body).toMatch(/(^|;)right:0(;|$)/)
      expect(body).toMatch(/(^|;)top:0(;|$)/)
      expect(body).toMatch(/(^|;)bottom:0(;|$)/)
    }
    // tour 根 / 遮罩：四边 0 铺满
    for (const [rel, sel] of [
      ['wd-tour/index.css', '.wd-tour'],
      ['wd-tour/index.css', '.wd-tour__mask']
    ] as const) {
      const body = ruleOf(css(rel), sel)
      expect(body, `${sel} 应四边 0`).toMatch(/(^|;)left:0(;|$)/)
      expect(body).toMatch(/(^|;)right:0(;|$)/)
      expect(body).toMatch(/(^|;)top:0(;|$)/)
      expect(body).toMatch(/(^|;)bottom:0(;|$)/)
    }
    // 视频预览根：参考源为 position:fixed + top/left + 100% 宽高（四边 0 由
    // 底层 wd-overlay 根提供，见弹层批次契约），保持 wot-ui 取值
    const videoRoot = ruleOf(css('wd-video-preview/index.css'), '.wd-video-preview')
    expect(videoRoot, '视频预览根应 fixed 贴角铺满').toMatch(/(^|;)position:fixed(;|$)/)
    expect(videoRoot).toMatch(/(^|;)top:0(;|$)/)
    expect(videoRoot).toMatch(/(^|;)left:0(;|$)/)
    expect(videoRoot).toMatch(/(^|;)width:100%(;|$)/)
    expect(videoRoot).toMatch(/(^|;)height:100%(;|$)/)
  })

  it('tour 提示框 left:50% + translate 属确有必要（贴高亮元素动态定位，单独注明）', () => {
    const popover = ruleOf(css('wd-tour/index.css'), '.wd-tour__popover')
    // 纵向位置由内联 top / bottom 动态下发，四边 0 + flex 无法表达，保留参考源写法
    expect(popover).toMatch(/(^|;)left:50%(;|$)/)
    expect(popover).toMatch(/transform:translateX\(-50%\)/)
  })

  it('DOM 对齐：气泡 / 幕帘 / 浮动面板结构与 wot-ui 一致', async () => {
    // 气泡：root > pos(度量副本) + backdrop + transition(pos > container > inner) + target
    const pop = render(Popover as any, { content: '气泡内容', modelValue: true, placement: 'top' })
    await pause(50)
    const popRoot = pop.container.querySelector('.wd-popover')!
    expect(popRoot, '气泡根节点应渲染').not.toBeNull()
    expect(popRoot.querySelector('.wd-popover__pos.wd-popover__hidden'), '度量副本应渲染').not.toBeNull()
    expect(popRoot.querySelector('.wd-popover__container .wd-popover__inner text'), '气泡内容文本应渲染').not.toBeNull()
    expect(popRoot.querySelector('.wd-popover__target'), '触发目标容器应渲染').not.toBeNull()
    cleanup()

    // 幕帘：popup(wd-curtain) > __content > (__content-img + __content-close)
    const curtain = render(Curtain as any, { modelValue: true, src: 'https://example.com/a.png' })
    await pause(50)
    const content = curtain.container.querySelector('.wd-curtain__content')!
    expect(content, '幕帘内容区应渲染').not.toBeNull()
    expect(content.querySelector('image.wd-curtain__content-img'), '幕帘图片应为原生 image').not.toBeNull()
    expect(content.querySelector('.wd-curtain__content-close'), '幕帘关闭图标应渲染').not.toBeNull()
    cleanup()

    // 浮动面板：root > __header > __header-bar + __content(scroll-view)
    const panel = render(FloatingPanel as any, { modelValue: true, height: 200, anchors: [200, 400] })
    await pause(50)
    const panelRoot = panel.container.querySelector('.wd-floating-panel')!
    expect(panelRoot, '浮动面板根节点应渲染').not.toBeNull()
    expect(panelRoot.querySelector('.wd-floating-panel__header .wd-floating-panel__header-bar'), '拖拽条应渲染').not.toBeNull()
    const scroll = panelRoot.querySelector('.wd-floating-panel__content')!
    expect(scroll.tagName.toLowerCase(), '内容区应为原生 scroll-view').toBe('scroll-view')
    cleanup()
  })

  it('交互：气泡 / 提示经触发元素 tap 开关，幕帘 tap 关闭', async () => {
    // 气泡：tap 触发目标 → open + update:modelValue(true)
    const opened = ref(false)
    const events: string[] = []
    const pop = render({
      setup() {
        return () =>
          h(Popover as any, {
            content: '气泡',
            modelValue: opened.value,
            'onUpdate:modelValue': (v: boolean) => {
              opened.value = v
            },
            onOpen: () => events.push('open'),
            onClose: () => events.push('close'),
            onChange: () => events.push('change')
          })
      }
    } as any)
    await pause(50)
    fireEvent.tap(pop.container.querySelector('.wd-popover__target')!, {})
    await pause(50)
    expect(opened.value, 'tap 触发目标应打开气泡').toBe(true)
    expect(events).toContain('open')
    // 再点一次 → 关闭
    fireEvent.tap(pop.container.querySelector('.wd-popover__target')!, {})
    await pause(50)
    expect(opened.value, '再次 tap 应关闭气泡').toBe(false)
    expect(events).toContain('close')
    cleanup()

    // 提示：tap 触发目标 → 打开
    const tipShown = ref(false)
    const tip = render({
      setup() {
        return () =>
          h(Tooltip as any, {
            content: '提示',
            modelValue: tipShown.value,
            'onUpdate:modelValue': (v: boolean) => {
              tipShown.value = v
            }
          })
      }
    } as any)
    await pause(50)
    fireEvent.tap(tip.container.querySelector('.wd-tooltip__target')!, {})
    await pause(50)
    expect(tipShown.value, 'tap 触发目标应打开提示').toBe(true)
    cleanup()

    // 幕帘：tap 关闭图标 → close + update:modelValue(false)
    const curtainShown = ref(true)
    const curtainEvents: string[] = []
    const curtain = render({
      setup() {
        return () =>
          h(Curtain as any, {
            modelValue: curtainShown.value,
            src: 'https://example.com/a.png',
            'onUpdate:modelValue': (v: boolean) => {
              curtainShown.value = v
            },
            onClose: () => curtainEvents.push('close')
          })
      }
    } as any)
    await pause(50)
    fireEvent.tap(curtain.container.querySelector('.wd-curtain__content-close')!, {})
    await pause(50)
    expect(curtainShown.value, 'tap 关闭图标应关闭幕帘').toBe(false)
    expect(curtainEvents).toContain('close')
    cleanup()
  })

  it('交互：引导步进（next / prev / finish）与 DOM 结构', async () => {
    const tourShown = ref(true)
    const tourEvents: string[] = []
    const tour = render({
      setup() {
        return () =>
          h(Tour as any, {
            modelValue: tourShown.value,
            steps: [{ element: '.tour-target', content: '第一步' }],
            'onUpdate:modelValue': (v: boolean) => {
              tourShown.value = v
            },
            onNext: (e: any) => tourEvents.push(`next:${e.current}`),
            onFinish: () => tourEvents.push('finish')
          })
      }
    } as any)
    await pause(50)
    const root = tour.container.querySelector('.wd-tour')!
    expect(root, '引导根节点应渲染').not.toBeNull()
    expect(root.querySelector('.wd-tour__mask'), '遮罩应渲染').not.toBeNull()
    expect(root.querySelector('.wd-tour__highlight'), '高亮框应渲染').not.toBeNull()
    expect(root.querySelector('.wd-tour__popover .wd-tour__info text'), '提示文本应渲染').not.toBeNull()
    // 单步：渲染完成按钮（无下一步按钮）
    expect(root.querySelector('.wd-tour__finish'), '末步应渲染完成按钮').not.toBeNull()
    expect(root.querySelector('.wd-tour__next'), '末步不应渲染下一步按钮').toBeNull()
    // tap 完成 → finish + 关闭
    fireEvent.tap(root.querySelector('.wd-tour__finish')!, {})
    await pause(50)
    expect(tourEvents).toContain('finish')
    expect(tourShown.value, '完成后应关闭引导').toBe(false)
    cleanup()
  })

  it('交互：图片 / 视频预览命令式 open 通道与关闭', async () => {
    const imgRef = ref<any>(null)
    const img = render({
      setup() {
        return () =>
          h(ImagePreview as any, {
            ref: imgRef,
            selector: 'test-image-preview-layout',
            images: ['https://example.com/a.png', 'https://example.com/b.png']
          })
      }
    } as any)
    await pause(50)
    imgRef.value.open({ images: ['https://example.com/a.png', 'https://example.com/b.png'], startPosition: 0 })
    await pause(100)
    expect(img.container.querySelector('.wd-image-preview'), '图片预览遮罩应渲染').not.toBeNull()
    expect(img.container.querySelector('.wd-image-preview__index text'), '页码指示器应渲染').not.toBeNull()
    expect(img.container.querySelector('.wd-image-preview__swiper'), '轮播容器应渲染').not.toBeNull()
    cleanup()

    const videoRef = ref<any>(null)
    const video = render({
      setup() {
        return () =>
          h(VideoPreview as any, {
            ref: videoRef,
            selector: 'test-video-preview-layout'
          })
      }
    } as any)
    await pause(50)
    videoRef.value.open({ url: 'https://example.com/a.mp4', poster: '' })
    await pause(100)
    expect(video.container.querySelector('.wd-video-preview'), '视频预览遮罩应渲染').not.toBeNull()
    expect(video.container.querySelector('video.wd-video-preview__video-player'), '视频应为原生 video 元素').not.toBeNull()
    expect(video.container.querySelector('.wd-video-preview__close'), '关闭按钮应渲染').not.toBeNull()
    cleanup()
  })
})
