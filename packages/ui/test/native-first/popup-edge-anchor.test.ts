/**
 * 原生优先重写 · 贴边弹层主轴摆位契约（wd-popup spacer）。
 *
 * 背景（真机 2026-11-05 复测，用户截图反馈「适配太差」）：R8 把弹层定位改成
 * 「全屏 harness（fixed + 四边 0 + 显式窗口像素）+ 面板 flex 子项」后，center
 * 弹层（Dialog / Toast）经 justify-content: center 正常居中，但 flex-start /
 * flex-end 在真机上被按 center 处理——底部 Popup 贴在屏幕**正中**而不是屏幕
 * 底部（实测面板上下边距对称、垂直中心 = 屏幕中心）。改为主轴放一个
 * `flex-grow: 1` 的空占位 view 吸收剩余空间，把面板挤到目标边：
 *   - bottom / right：占位在面板**前**（挤向主轴末端）；
 *   - top / left：占位在面板**后**（挤向主轴起点）；
 *   - center：不放占位，沿用已验证的 justify-content: center。
 *
 * 为什么不用「单边 edge 定位」：真机对缺省边按 0 锚定（CONVENTIONS §19
 * 差异 #2），`bottom: 0` 会被缺省 top 的 0 值顶掉（pre-R8 贴左上角同源），
 * 且内容高度未知、无法补显式 top。flex-grow 是真机可用路径——同页 wd-cell
 * 的 __left / __right（flex: 1）两端对齐即证据。
 *
 * 本测试锁定：
 * 1. 占位在 harness 内的**DOM 顺序**（前 / 后 / 不渲染）；
 * 2. 编译产物里 `.wd-popup-spacer` 只有 flex-grow（不写死宽高，避免又把
 *    主轴空间占掉）；
 * 3. harness / 面板内联样式契约不回退（显式窗口像素、无 auto 边）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '../render'
import { pause } from '@wot-lynx/core/common/util'
import Popup from '@wot-lynx/primitives/wd-popup'
import { compRead } from '../helpers/component-roots'

const css = (rel: string) => compRead(...rel.split('/'))

async function frames(n = 6) {
  for (let i = 0; i < n; i++) await pause()
}

/** harness 直接子元素的类名序列（占位 + 过渡根） */
function harnessChildClasses(container: Element): string[] {
  const harness = container.querySelector('.wd-popup-harness')
  expect(harness, 'harness 应渲染').not.toBeNull()
  return Array.from(harness!.children).map((el) => el.getAttribute('class') || '')
}

function renderPopup(position: string) {
  return render(Popup as any, {
    modelValue: true,
    position
  } as any)
}

describe('原生优先重写 · 贴边弹层主轴摆位（wd-popup spacer，真机 2026-11-05）', () => {
  afterEach(() => cleanup())

  it('编译产物：.wd-popup-spacer 只声明 flex-grow', () => {
    const text = css('wd-popup/index.css')
    const m = text.match(/\.wd-popup-spacer\{([^}]*)\}/)
    expect(m, '编译产物应含 .wd-popup-spacer 规则').not.toBeNull()
    const body = m![1]
    expect(body, '占位靠 flex-grow 吸收主轴剩余空间').toMatch(/(^|;)flex-grow:1(;|$)/)
    // 不写死宽高：写了就等于把主轴空间又占回去，面板仍会贴错边
    expect(body, '占位不写 width / height').not.toMatch(/(^|;)(width|height):/)
  })

  it('bottom / right：占位在面板前，把面板挤向主轴末端', async () => {
    for (const position of ['bottom', 'right']) {
      const { container } = renderPopup(position)
      await frames()
      const classes = harnessChildClasses(container)
      expect(classes.length, `${position} 应有占位 + 过渡根两个子元素`).toBe(2)
      expect(classes[0], `${position} 占位应在面板前`).toContain('wd-popup-spacer')
      expect(classes[1], `${position} 第二项才是过渡根面板`).toContain('wd-popup')
      cleanup()
    }
  })

  it('top / left：占位在面板后，把面板顶向主轴起点', async () => {
    for (const position of ['top', 'left']) {
      const { container } = renderPopup(position)
      await frames()
      const classes = harnessChildClasses(container)
      expect(classes.length, `${position} 应有过渡根 + 占位两个子元素`).toBe(2)
      expect(classes[0], `${position} 第一项应是过渡根面板`).toContain('wd-popup')
      expect(classes[1], `${position} 占位应在面板后`).toContain('wd-popup-spacer')
      cleanup()
    }
  })

  it('center：不渲染占位，面板是 harness 唯一流式子项（flex 居中）', async () => {
    const { container } = renderPopup('center')
    await frames()
    const classes = harnessChildClasses(container)
    expect(classes.length, 'center 只有过渡根一个子元素').toBe(1)
    expect(classes[0]).toContain('wd-popup')
    expect(classes[0], 'center 不渲染占位').not.toContain('wd-popup-spacer')
  })

  it('harness / 面板内联样式契约不回退（显式窗口像素、无 auto 边）', async () => {
    const { container } = renderPopup('bottom')
    await frames()
    const harness = container.querySelector('.wd-popup-harness')!
    const panel = container.querySelector('.wd-popup')!
    const harnessStyle = harness.getAttribute('style') || ''
    const panelStyle = panel.getAttribute('style') || ''

    // harness：fixed + 四边 0 + 显式窗口像素宽高（真机不认四边 0 的尺寸推导）
    expect(harnessStyle).toMatch(/position:\s*fixed/)
    for (const edge of ['left', 'right', 'top', 'bottom']) {
      expect(harnessStyle, `harness ${edge} 恒为 0px`).toMatch(new RegExp(`(^|;)\\s*${edge}:\\s*0px`))
    }
    expect(harnessStyle, 'harness 宽高按窗口像素显式下发').toMatch(/width:\s*\d+px/)
    expect(harnessStyle).toMatch(/height:\s*\d+px/)

    // 面板：贴边位置宽度取窗口像素，四边恒为 0px（不再出现 auto）
    expect(panelStyle, 'bottom 面板宽度按窗口像素下发').toMatch(/width:\s*\d+px/)
    expect(panelStyle, '面板不写 auto 边').not.toMatch(/(left|right|top|bottom):\s*auto/)
    expect(panelStyle, '面板不写 fixed').not.toMatch(/position:\s*fixed/)
  })
})
