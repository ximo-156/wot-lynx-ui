/**
 * 真机 2026-10-26 巡检回归 — 截图中暴露的「真机可见、Web 预览不可见」缺陷。
 *
 * 这批缺陷的共同点：参考源（wot-ui 2.3.2）依赖的某个 CSS 语义在 Lynx 3.x
 * 引擎上被静默丢弃或按不同规则结算，Web 预览（DOM）全绿而真机翻车。因此
 * 断言尽量落在「与平台无关的事实」上（DOM 实例数、内联具体色值 / 具体
 * 长度），而不是颜色类名或计算样式。
 *
 * 覆盖：
 * 1. wd-datetime-picker 两个 picker-view 常驻 → 列内容双份叠印（图一）
 * 2. wd-switch 轨道 min-width 不生效 → 宽度塌成月牙（图二 / 图三）
 * 3. wd-search 封面与 input 双状态并存 → 双份占位 + 图标叠印（图二）
 * 4. wd-button loading 继承色回落主色 → 紫底紫图不可见（图四）
 */
import { describe, it, expect } from 'vitest'
import { render, cleanup } from '../render'
import { pause } from '../../src/common/util'
import DatetimePicker from '../../src/components/wd-datetime-picker/wd-datetime-picker.vue'
import Switch from '../../src/components/wd-switch/wd-switch.vue'
import Search from '../../src/components/wd-search/wd-search.vue'
import Button from '../../src/primitives/wd-button/wd-button.vue'

function styleOf(el: Element | null): string {
  return el ? el.getAttribute('style') || '' : ''
}

describe('真机 2026-10-26 巡检（叠印 / 几何塌陷 / 隐形）', () => {
  it('wd-datetime-picker 非区间模式只挂载一个 picker-view（列内容双份叠印）', async () => {
    // 原实现 start / end 两个实例常驻，用 `__hidden { visibility: hidden }`
    // 互斥；Lynx 不解析 visibility，两个实例同位置绘制 → 滚轮列出现两份
    // 内容错半行叠印（2027 压着 2026）。
    const { container } = render(DatetimePicker, {
      modelValue: new Date(2026, 9, 26, 8, 41).getTime(),
      visible: true,
      type: 'datetime',
      title: '日期时间'
    })
    await pause(60)
    const views = container.querySelectorAll('.wd-picker-view')
    expect(views.length, '非区间模式应只有一个滚轮视图').toBe(1)
    cleanup()
  })

  it('wd-switch 轨道用内联 width 定宽（min-width 在真机不生效 → 月牙）', () => {
    // 26px 尺寸 → 轨道宽 = 26 * 1.8 + 2 * 2 = 50.8px
    const { container } = render(Switch, { modelValue: true })
    const inner = container.querySelector('.wd-switch__inner')
    expect(styleOf(inner)).toMatch(/width:\s*50\.8px/)
    expect(styleOf(inner), 'min-width 在真机被忽略，不能作为唯一宽度来源').not.toMatch(/min-width/)
    cleanup()
  })

  it('wd-switch 有内部文案时保留 min-width 语义（由文字撑开）', () => {
    const { container } = render(Switch, { modelValue: true, activeText: '开启', inactiveText: '关闭' })
    const inner = container.querySelector('.wd-switch__inner')
    expect(styleOf(inner)).toMatch(/min-width:\s*50\.8px/)
    cleanup()
  })

  it('wd-search 封面与原生 input 永不同时挂载（双份占位叠印）', () => {
    const { container } = render(Search, { modelValue: '' })
    expect(container.querySelector('.wd-search__cover'), '空值应渲染封面占位').toBeTruthy()
    expect(container.querySelector('.wd-search__input'), '空值不得同时渲染原生 input').toBeNull()
    cleanup()
  })

  it('wd-search 有值时只渲染 input，不再残留封面', () => {
    const { container } = render(Search, { modelValue: '已输入' })
    expect(container.querySelector('.wd-search__cover'), '有值时封面必须卸载').toBeNull()
    expect(container.querySelector('.wd-search__input')).toBeTruthy()
    cleanup()
  })

  it('wd-button loading 下发具体文字色（紫底紫图 → 整组不可见）', () => {
    const { container } = render(Button, { loading: true, type: 'primary' })
    // loading 默认 circular：圆环由 90 段 path 组成，fill 逐段显式下发
    // （真机 SVG 不继承 g 的展示属性）。若回落到主题主色 #755ffe，在
    // primary 按钮上与底色重合 → 整组不可见。
    const svg = container.querySelector('.wd-loading__spinner-circular')
    expect(svg, 'loading 应渲染圆环 svg').toBeTruthy()
    const content = svg!.getAttribute('content') || ''
    expect(content).toContain('#ffffff')
    expect(content, '不得回落到与按钮底色相同的主色').not.toContain('#755ffe')
    cleanup()
  })

  it('wd-button loading 颜色跟随 info 类型的深色文字', () => {
    const { container } = render(Button, { loading: true, type: 'info' })
    const content = container.querySelector('.wd-loading__spinner-circular')?.getAttribute('content') || ''
    expect(content).toContain('#1a1a1a')
    cleanup()
  })
})
