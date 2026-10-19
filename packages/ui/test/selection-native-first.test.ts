/**
 * 原生优先重写 · 布局居中契约回归测试（wd-radio / wd-radio-group /
 * wd-checkbox / wd-checkbox-group / wd-switch / wd-rate / wd-segmented）。
 *
 * 背景（NATIVE-REWRITE §3 / CONVENTIONS §15）：Lynx 3.x 默认 linear 布局，
 * `flex-direction` 等弹性属性只在 `display: flex` 上生效；`inline-flex` /
 * `inline-block` / `float` / `vertical-align` 写了即静默丢失——这是「样式
 * 不居中」的根因。本批组件中仅 wd-rate 的滑动评分是跟手交互（已 MTS 化，
 * 见 test/rate-mts.test.ts），其余为点选类交互；本测试锁定其「根节点三件套
 * + 居中成对书写 + 无 Web 专有属性 + DOM 结构不回退」的静态契约：
 *
 * 1. 每个组件根 view 显式 `display: flex` + `flex-direction`（按内容方向）；
 * 2. 需要居中的容器 `justify-content` + `align-items` 成对写全，文本节点
 *    另加 `text-align: center`；
 * 3. 编译产物中不出现 Lynx 不识别的 Web 专有写法（inline-flex /
 *    inline-block / float / vertical-align / cursor / user-select /
 *    outline / -webkit-*）；
 * 4. DOM 结构（BEM 类名 / 层级）与 wot-ui 2.3.2 对齐不回退。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import Radio from '../src/components/wd-radio/wd-radio.vue'
import RadioGroup from '../src/components/wd-radio-group/wd-radio-group.vue'
import Checkbox from '../src/components/wd-checkbox/wd-checkbox.vue'
import CheckboxGroup from '../src/components/wd-checkbox-group/wd-checkbox-group.vue'
import Switch from '../src/components/wd-switch/wd-switch.vue'
import Rate from '../src/components/wd-rate/wd-rate.vue'
import Segmented from '../src/components/wd-segmented/wd-segmented.vue'

const SRC = path.resolve(__dirname, '..', 'src/components')
const css = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8')

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
  'wd-radio/index.css',
  'wd-radio-group/index.css',
  'wd-checkbox/index.css',
  'wd-checkbox-group/index.css',
  'wd-switch/index.css',
  'wd-rate/index.css',
  'wd-segmented/index.css'
]

describe('原生优先重写 · 布局居中契约（radio / checkbox / switch / rate / segmented）', () => {
  afterEach(() => cleanup())

  it('编译产物不含 Lynx 静默丢失的 Web 专有写法', () => {
    for (const rel of BATCH_CSS) {
      const text = css(rel)
      for (const re of SILENTLY_DROPPED) {
        expect(re.test(text), `${rel} 含 Lynx 不识别写法: ${re}`).toBe(false)
      }
    }
  })

  it('wd-radio：根节点横向三件套 + 图标容器/文案居中', () => {
    const c = css('wd-radio/index.css')
    expectRootFlex(c, '.wd-radio', 'row')
    // 图标容器（未选中空心圆 / dot 圆心点 / 字体图标）：成对居中
    expectCenterPair(c, '.wd-radio__shape')
    expectCenterPair(c, '.wd-radio__icon--dot')
    // 文案：flex 居中 + 文本居中
    expect(ruleOf(c, '.wd-radio__label')).toMatch(/(^|;)text-align:center(;|$)/)
    // 按钮模式（wot-ui 为 inline-block）：内容宽度自适应 + 横向流
    expectRootFlex(c, '.wd-radio.is-button', 'row')
    // 水平排列模式（wot-ui 为 inline-flex）：显式 row
    expectRootFlex(c, '.wd-radio--horizontal', 'row')
  })

  it('wd-radio-group：根节点纵向三件套 + 横向模式 wrap 居中', () => {
    const c = css('wd-radio-group/index.css')
    expectRootFlex(c, '.wd-radio-group', 'column')
    const horizontal = ruleOf(c, '.wd-radio-group--horizontal')
    expect(horizontal).toMatch(/(^|;)flex-direction:row(;|$)/)
    expect(horizontal).toMatch(/(^|;)flex-wrap:wrap(;|$)/)
    expect(horizontal).toMatch(/(^|;)align-items:center(;|$)/)
  })

  it('wd-checkbox：根节点横向三件套 + 图标容器/按钮文案居中', () => {
    const c = css('wd-checkbox/index.css')
    expectRootFlex(c, '.wd-checkbox', 'row')
    expectCenterPair(c, '.wd-checkbox__shape')
    expectCenterPair(c, '.wd-checkbox__icon--dot')
    expectRootFlex(c, '.wd-checkbox.is-button', 'row')
    // 按钮模式文案居中（wot-ui 同款 text-align）
    expect(ruleOf(c, '.wd-checkbox.is-button .wd-checkbox__label')).toMatch(/(^|;)text-align:center(;|$)/)
    expectRootFlex(c, '.wd-checkbox--horizontal', 'row')
  })

  it('wd-checkbox-group：根节点纵向三件套 + 横向模式 wrap 居中', () => {
    const c = css('wd-checkbox-group/index.css')
    expectRootFlex(c, '.wd-checkbox-group', 'column')
    const horizontal = ruleOf(c, '.wd-checkbox-group--horizontal')
    expect(horizontal).toMatch(/(^|;)flex-direction:row(;|$)/)
    expect(horizontal).toMatch(/(^|;)flex-wrap:wrap(;|$)/)
    expect(horizontal).toMatch(/(^|;)align-items:center(;|$)/)
  })

  it('wd-switch：根/轨道/操作块横向三件套 + 操作块成对居中', () => {
    const c = css('wd-switch/index.css')
    expectRootFlex(c, '.wd-switch', 'row')
    expectRootFlex(c, '.wd-switch__inner', 'row')
    // 操作块（absolute 定位的滑块）：flex 成对居中承载图标/loading
    expectCenterPair(c, '.wd-switch__action')
    // 方角 / 圆角两种形状的圆角声明（display 由基类 .wd-switch__inner 承担）
    expect(ruleOf(c, '.wd-switch--round .wd-switch__inner')).toMatch(/(^|;)border-radius:/)
    expect(ruleOf(c, '.wd-switch--square .wd-switch__inner')).toMatch(/(^|;)border-radius:/)
  })

  it('wd-rate：根节点横向三件套 + 星星项成对居中', () => {
    const c = css('wd-rate/index.css')
    expectRootFlex(c, '.wd-rate', 'row')
    expectCenterPair(c, '.wd-rate__item')
    // 块级模式：撑满父容器（wot-ui 为 display: block）
    const block = ruleOf(c, '.wd-rate.is-block')
    expect(block).toMatch(/(^|;)display:flex(;|$)/)
    expect(block).toMatch(/(^|;)width:100%(;|$)/)
  })

  it('wd-segmented：根/选项横向三件套 + 选项内容成对居中且文本居中', () => {
    const c = css('wd-segmented/index.css')
    expectRootFlex(c, '.wd-segmented', 'row')
    expectCenterPair(c, '.wd-segmented__item')
    expect(ruleOf(c, '.wd-segmented__item')).toMatch(/(^|;)text-align:center(;|$)/)
  })

  it('DOM 对齐：radio / checkbox 的 文案 + 图标容器 结构与 wot-ui 一致', async () => {
    const { container } = render(
      {
        setup() {
          return () =>
            h(RadioGroup as any, { modelValue: 'a' }, {
              default: () => [
                h(Radio as any, { value: 'a' }, { default: () => h('text', '选项A') }),
                h(Radio as any, { value: 'b' }, { default: () => h('text', '选项B') })
              ]
            })
        }
      } as any
    )
    await pause(50)
    const radios = container.querySelectorAll('.wd-radio')
    expect(radios.length).toBe(2)
    expect(radios[0].querySelector('.wd-radio__label')).not.toBeNull()
    expect(radios[0].querySelector('.wd-radio__shape')).not.toBeNull()
    // 选中项：is-checked + 选中态图标（circle 型为 success-filling 字形）
    expect(radios[0].classList.contains('is-checked')).toBe(true)
    expect(radios[1].classList.contains('is-checked')).toBe(false)
    // 未选中态空心圆：CSS 绘制（border + currentColor）
    expect(radios[1].querySelector('.wd-radio__icon--empty')).not.toBeNull()
    cleanup()

    const boxes = render(
      {
        setup() {
          return () =>
            h(CheckboxGroup as any, { modelValue: ['a'] }, {
              default: () => [
                h(Checkbox as any, { name: 'a' }, { default: () => h('text', '多选A') }),
                h(Checkbox as any, { name: 'b' }, { default: () => h('text', '多选B') })
              ]
            })
        }
      } as any
    )
    await pause(50)
    const checkboxList = boxes.container.querySelectorAll('.wd-checkbox')
    expect(checkboxList.length).toBe(2)
    expect(checkboxList[0].querySelector('.wd-checkbox__label')).not.toBeNull()
    expect(checkboxList[0].querySelector('.wd-checkbox__shape')).not.toBeNull()
    expect(checkboxList[0].classList.contains('is-checked')).toBe(true)
  })

  it('DOM 对齐：switch 轨道 + 操作块、segmented 选项 + 滑块 结构与 wot-ui 一致', async () => {
    const sw = render(Switch as any, { modelValue: true, activeText: '开', inactiveText: '关' })
    await pause(50)
    const root = sw.container.querySelector('.wd-switch')!
    expect(root.classList.contains('is-active')).toBe(true)
    expect(root.querySelector('.wd-switch__inner')).not.toBeNull()
    expect(root.querySelector('.wd-switch__inner-text')).not.toBeNull()
    expect(root.querySelector('.wd-switch__action')).not.toBeNull()
    cleanup()

    const value = ref<string | number>('日')
    const seg = render({
      setup() {
        return () =>
          h(Segmented as any, {
            options: ['日', '周', '月'],
            value: value.value,
            'onUpdate:value': (v: string | number) => (value.value = v)
          })
      }
    } as any)
    await pause(100)
    const items = seg.container.querySelectorAll('.wd-segmented__item')
    expect(items.length).toBe(3)
    // card 主题（默认）：选项 + 滑块指示器
    expect(seg.container.querySelector('.wd-segmented__slider')).not.toBeNull()
    expect(items[0].querySelector('.wd-segmented__item-label')).not.toBeNull()
    expect(items[0].classList.contains('is-active')).toBe(true)
    cleanup()

    // outline 主题：无滑块，选项间分隔线经索引类名 is-not-first
    const outline = render(Segmented as any, { value: 'a', options: ['a', 'b'], theme: 'outline' })
    await pause(50)
    const outlineItems = outline.container.querySelectorAll('.wd-segmented__item')
    expect(outlineItems.length).toBe(2)
    expect(outline.container.querySelector('.wd-segmented__slider')).toBeNull()
    expect(outlineItems[1].classList.contains('is-not-first')).toBe(true)
  })

  it('DOM 对齐：rate 星星项 + 主星/半星层级结构与 wot-ui 一致', async () => {
    const { container } = render(Rate as any, { modelValue: 3, num: 5 })
    await pause(50)
    const items = container.querySelectorAll('.wd-rate__item')
    expect(items.length).toBe(5)
    // 每项一颗主星；未开启 allowHalf 时无半星叠加层
    expect(container.querySelectorAll('.wd-rate__item > .wd-rate__item-star').length).toBe(5)
    expect(container.querySelectorAll('.wd-rate__item-half').length).toBe(0)
    // 满星 3 颗：前 3 颗 --active
    const stars = container.querySelectorAll('.wd-rate__item > .wd-rate__item-star')
    expect(stars[0].classList.contains('wd-rate__item-star--active')).toBe(true)
    expect(stars[2].classList.contains('wd-rate__item-star--active')).toBe(true)
    expect(stars[3].classList.contains('wd-rate__item-star--active')).toBe(false)
    cleanup()

    const half = render(Rate as any, { modelValue: 2.5, num: 5, allowHalf: true })
    await pause(50)
    // 半星叠加层：absolute 左半裁剪容器 + 一颗星
    expect(half.container.querySelectorAll('.wd-rate__item-half').length).toBe(5)
    expect(half.container.querySelectorAll('.wd-rate__item-half > .wd-rate__item-star').length).toBe(5)
    const mainStars = half.container.querySelectorAll('.wd-rate__item > .wd-rate__item-star')
    expect(mainStars[2].classList.contains('wd-rate__item-star--active')).toBe(false)
    const halfStars = half.container.querySelectorAll('.wd-rate__item-half > .wd-rate__item-star')
    expect(halfStars[2].classList.contains('wd-rate__item-star--active')).toBe(true)
    expect(halfStars[3].classList.contains('wd-rate__item-star--active')).toBe(false)
  })
})
