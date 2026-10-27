/**
 * WdKeyboard 布局与交互回归测试。
 *
 * 实现现状（真机 2026-10-27 巡检后）：按键按「行」分组渲染，不再靠
 * `flex-wrap: wrap` 平铺——
 * - default / custom：每行 3 槽，wrapper `flex-basis: 33%`（wider 66%），
 *   12 键 = 4 行 × 3；
 * - car：每行 10 槽，wrapper `flex-basis: 10%`（wider 20%），中文 36 省份
 *   = 10+10+10+6，末行由 ABC / 省份（wider）+ 删除（wider）补足到 8 键。
 *
 * 历史包袱（本测试的由来）：
 * 1. 早期 wrapper 为 `flex-basis: 0`，所有按键假设主尺寸为 0、永不换行，
 *    12 个键全部挤成一行（用户反馈「一排并列在下面」）。改为百分比基准后
 *    wrap 才真正生效。
 * 2. wrap 生效后真机仍然只显示两行——引擎对多行 wrap 容器的高度只按前两行
 *    结算（CONVENTIONS §19 末「真机引擎行为差异清单」#6）。2026-10-27 改为
 *    显式行结构（纵向容器 + 每行一个 row），高度逐行累加。
 * 本测试同时锁定按键序列、wider 语义、行分组与 CSS 契约（防基准被改回 0 /
 * 百分比被改错 / 结构被改回 wrap）。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { h, nextTick, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { pause } from '../../src/common/util'
import { fireEvent } from '../fire-event'
import Keyboard from '../../src/components/wd-keyboard/wd-keyboard.vue'

const KEYBOARD_CSS = readFileSync(path.resolve(__dirname, '../..', 'src/components/wd-keyboard/index.css'), 'utf8')
const KEY_CSS = readFileSync(path.resolve(__dirname, '../..', 'src/components/wd-keyboard/key/index.css'), 'utf8')

/** 挂载一个受控 Keyboard（模拟 v-model），收集 update:modelValue */
function renderKeyboard(props: Record<string, unknown> = {}) {
  const updates: any[] = []
  const value = ref('')
  const { container } = render(
    {
      setup() {
        return () =>
          h(Keyboard, {
            visible: true,
            modelValue: value.value,
            ...props,
            'onUpdate:modelValue': (v: any) => {
              value.value = v
              updates.push(v)
            }
          })
      }
    } as any
  )
  return { container, updates }
}

/** 取扁平按键序列：[{ wider, text, isDelete }...]（按 DOM 顺序） */
function keySequence(container: Element, scope = '.wd-keyboard__keys, .wd-keyboard__car-keys') {
  const root = container.querySelector(scope)
  if (!root) throw new Error(`keys container not found: ${scope}`)
  return Array.from(root.querySelectorAll('.wd-key-wrapper')).map((w) => {
    const key = w.querySelector('.wd-key')
    return {
      wider: w.className.includes('wd-key-wrapper--wider'),
      text: (key?.textContent || '').trim(),
      isDelete: (key?.className || '').includes('wd-key--delete')
    }
  })
}

/** 按文本触摸一个按键（touchstart + touchend，useTouch 读取 touches[0]） */
async function tapKey(container: Element, text: string) {
  const wrapper = Array.from(container.querySelectorAll('.wd-key-wrapper')).find((w) => {
    const key = w.querySelector('.wd-key')
    return (key?.textContent || '').trim() === text && !(key?.className || '').includes('wd-key--delete')
  })
  if (!wrapper) throw new Error(`key not found: ${text}`)
  fireEvent.touchstart(wrapper, { touches: [{ clientX: 0, clientY: 0 }] })
  fireEvent.touchend(wrapper, { touches: [] })
  // 受控回写：等父组件重渲染把新 modelValue 传回键盘
  await nextTick()
}

/** 触摸删除键（无文本，wd-key--delete 类标识） */
async function tapDelete(container: Element) {
  const wrapper = Array.from(container.querySelectorAll('.wd-key-wrapper')).find((w) =>
    (w.querySelector('.wd-key')?.className || '').includes('wd-key--delete')
  )
  if (!wrapper) throw new Error('delete key not found')
  fireEvent.touchstart(wrapper, { touches: [{ clientX: 0, clientY: 0 }] })
  fireEvent.touchend(wrapper, { touches: [] })
  await nextTick()
}

describe('WdKeyboard 键盘布局与交互', () => {
  it('默认数字键盘：12 键三列网格（wrap + basis 33%，不再挤成一行）', async () => {
    const { container } = renderKeyboard()
    await pause(200)
    const keys = keySequence(container)
    expect(keys.length).toBe(12)
    // 序列：1-9、额外键（图标）/ 0 / 删除键（图标），均非 wider
    expect(keys.slice(0, 9).map((k) => k.text)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect(keys.every((k) => !k.wider)).toBe(true)
    expect(keys[10].text).toBe('0')
    expect(keys[11].isDelete).toBe(true)
    cleanup()
  })

  it('CSS 行结构契约：显式行容器（不再依赖 flex-wrap 结算高度）', () => {
    // 真机 2026-10-27 巡检：引擎对多行 wrap 容器的高度只按前两行结算
    // （CONVENTIONS §19 末「真机引擎行为差异清单」#6）——数字键盘 4 行只
    // 算出 2 行高，后两行画到屏幕外，用户看到的是「键盘只显示一半」。
    // 结构已改为「纵向容器 + 每行一个 row」，这里锁定三件事：
    // ① 键区容器不再 wrap（改回 wrap 就会重新踩高度结算的坑）；
    // ② 容器是 column、行是 row（方向反了布局全塌）；
    // ③ 键宽基准百分比仍在（基准改错列数就变）。
    expect(KEYBOARD_CSS).not.toMatch(/\.wd-keyboard__(keys|car-keys)\{[^}]*flex-wrap:wrap/)
    expect(KEYBOARD_CSS).toMatch(/\.wd-keyboard__keys\{[^}]*flex-direction:column/)
    expect(KEYBOARD_CSS).toMatch(/\.wd-keyboard__car-keys\{[^}]*flex-direction:column/)
    expect(KEYBOARD_CSS).toMatch(/\.wd-keyboard__row\{[^}]*display:flex[^}]*flex-direction:row/)
    expect(KEYBOARD_CSS).toMatch(/\.wd-keyboard__car-keys \.wd-key-wrapper\{flex-basis:10%/)
    expect(KEYBOARD_CSS).toMatch(/\.wd-keyboard__car-keys \.wd-key-wrapper--wider\{flex-basis:20%/)
    // wrapper 基准在 key/index.css（按键自身样式文件）
    expect(KEY_CSS).toMatch(/\.wd-key-wrapper\{[^}]*flex-basis:33%/)
    expect(KEY_CSS).toMatch(/\.wd-key-wrapper--wider\{flex-basis:66%/)

    // 2026-10-23 实测回归：百分比基准正确也可能排不出网格。
    // - 少了 min-width:0，flex 项下限取 min-content（实测 92.7px），
    //   十列网格塌成三列、单键 122.3px；
    // - 写成 flex:1（grow:1），英数末行只占 8 格时剩余宽度会把键拉宽到 40.9px，
    //   同一块键盘出现两种键宽。
    // 这两条在 DOM 断言里完全无感，只能锁 CSS 产物。
    expect(KEY_CSS, '缺少 min-width:0 会让十列网格塌成三列').toMatch(/\.wd-key-wrapper\{[^}]*min-width:0/)
    expect(KEY_CSS, 'wrapper 不得 flex-grow（末行键会被拉宽）').toMatch(/\.wd-key-wrapper\{[^}]*flex:0 1 auto/)
  })

  it('按键按行分组：数字 4 行 ×3 槽，车牌 4 行（末行 8 槽）', async () => {
    // 行数就是真机上「能看见几行」的直接来源：wrap 平铺时行数由引擎自己
    // 算（只算前两行），改成显式行结构后行数由这里锁死。
    const { container } = renderKeyboard()
    await pause(200)
    const rows = Array.from(container.querySelectorAll('.wd-keyboard__row'))
    expect(rows.length).toBe(4)
    expect(rows.map((r) => r.querySelectorAll('.wd-key-wrapper').length)).toEqual([3, 3, 3, 3])
    cleanup()

    const car = renderKeyboard({ mode: 'car' })
    await pause(200)
    const carRows = Array.from(car.container.querySelectorAll('.wd-keyboard__row'))
    expect(carRows.length).toBe(4)
    // 前三行满 10 键；末行 = ABC（wider，占 2 槽）+ 6 省份 + 删除（wider，占 2 槽）
    expect(carRows.map((r) => r.querySelectorAll('.wd-key-wrapper').length)).toEqual([10, 10, 10, 8])
    cleanup()
  })

  it('按键触摸交互 emit update:modelValue，删除键回删', async () => {
    const { container, updates } = renderKeyboard()
    await pause(200)
    await tapKey(container, '5')
    await tapKey(container, '8')
    await pause(50)
    expect(updates).toEqual(['5', '58'])
    await tapDelete(container)
    await pause(50)
    expect(updates[updates.length - 1]).toBe('5')
    cleanup()
  })

  it('自定义键盘：wider 的 0 键占 2 槽，末尾 [0, extraKey]', async () => {
    const { container } = renderKeyboard({ mode: 'custom', extraKey: '.' })
    await pause(200)
    const keys = keySequence(container)
    // 1-9 + wider 0 + extraKey
    expect(keys.length).toBe(11)
    expect(keys.slice(0, 9).every((k) => !k.wider)).toBe(true)
    expect(keys[9]).toMatchObject({ wider: true, text: '0' })
    expect(keys[10]).toMatchObject({ wider: false, text: '.' })
    // 侧栏：删除 + 关闭两个大键
    const sidebar = container.querySelectorAll('.wd-keyboard__sidebar .wd-key-wrapper')
    expect(sidebar.length).toBe(2)
    cleanup()
  })

  it('车牌键盘：zh 38 键十列网格，输入首位后 autoSwitchLang 切英文', async () => {
    const { container, updates } = renderKeyboard({ mode: 'car', autoSwitchLang: true })
    await pause(200)
    const zhKeys = keySequence(container)
    expect(zhKeys.length).toBe(38)
    // 省份顺序与 wot-ui 的 CAR_KEYBOARD_AREAS 一致
    expect(zhKeys.slice(0, 10).map((k) => k.text)).toEqual(['京', '沪', '粤', '津', '冀', '豫', '云', '辽', '黑', '湘'])
    // 30 省份之后依次是 ABC（wider）、剩余 6 省份、删除（wider）
    // ——末行（wrap 落位）即 ABC + 6 省份 + 删除
    expect(zhKeys[30]).toMatchObject({ text: 'ABC', wider: true })
    expect(zhKeys.slice(31, 37).map((k) => k.text)).toEqual(['藏', '港', '澳', '新', '使', '学'])
    expect(zhKeys[37].wider).toBe(true)
    expect(zhKeys[37].isDelete).toBe(true)

    // 点首个省份「京」→ 自动切英文键盘（34 字母数字 + 省份 + 删除 = 36 键）
    await tapKey(container, '京')
    await pause(50)
    expect(updates).toEqual(['京'])
    await pause(100)
    const enKeys = keySequence(container)
    expect(enKeys.length).toBe(36)
    // 英文键序为 QWERTY（对齐 wot-ui）：1-9、0 之后是 QWERTYUIOP / ASDFGHJKL / ZXCVBNM
    expect(enKeys.slice(0, 10).map((k) => k.text)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'])
    expect(enKeys.slice(10, 20).map((k) => k.text)).toEqual(['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'P', 'A', 'S'])
    expect(enKeys.slice(20, 30).map((k) => k.text)).toEqual(['D', 'F', 'G', 'H', 'J', 'K', 'L', 'Z', 'X', 'C'])
    // 末行：省份（wider）+ 剩余 4 字母 + 删除（wider）
    expect(enKeys[30]).toMatchObject({ text: '省份', wider: true })
    expect(enKeys.slice(31, 35).map((k) => k.text)).toEqual(['V', 'B', 'N', 'M'])
    expect(enKeys[35].wider).toBe(true)
    expect(enKeys[35].isDelete).toBe(true)
    // 车牌规则不使用 I / O
    expect(enKeys.some((k) => k.text === 'I' || k.text === 'O')).toBe(false)
    expect(enKeys.some((k) => k.text === '京')).toBe(false)
    cleanup()
  })

  it('maxlength 限制输入长度', async () => {
    const { container, updates } = renderKeyboard({ maxlength: 2 })
    await pause(200)
    await tapKey(container, '1')
    await tapKey(container, '2')
    await tapKey(container, '3')
    await pause(50)
    expect(updates).toEqual(['1', '12'])
    cleanup()
  })

  it('遮罩关闭应同步 update:visible(false)，受控后可再次打开', async () => {
    // 回归：popup 的 closeOnClickModal 只改写 v-model 的 show，键盘经
    // @click-modal → handleClose 向父级同步；该事件缺失时父级 visible
    // 停留在 true，再次触发按钮是无变化赋值，键盘再也打不开。
    const visible = ref(true)
    const visibleUpdates: any[] = []
    const closes: any[] = []
    const { container } = render(
      {
        setup() {
          return () =>
            h(Keyboard, {
              visible: visible.value,
              modelValue: '',
              onClose: () => closes.push(1),
              'onUpdate:visible': (v: boolean) => {
                visible.value = v
                visibleUpdates.push(v)
              }
            })
        }
      } as any
    )
    await pause(200)
    expect(container.querySelectorAll('.wd-keyboard__keys .wd-key-wrapper').length, '初始应渲染 12 个按键').toBe(12)

    // 真机语义：tap 遮罩（overlay 重新 emit 的 click → popup click-modal）
    const mask = container.querySelector('.wd-popup-wrapper .wd-overlay')
    expect(mask, '遮罩应渲染').not.toBeNull()
    fireEvent.tap(mask!)
    await pause(500)

    expect(visibleUpdates, '遮罩关闭应同步受控状态').toContain(false)
    expect(visible.value, '受控 visible 应为 false').toBe(false)
    expect(closes.length, '应派发 close 事件').toBe(1)

    // 受控状态同步后，再次打开应能重新渲染
    visible.value = true
    await pause(400)
    expect(container.querySelectorAll('.wd-keyboard__keys .wd-key-wrapper').length, '重新打开应渲染 12 个按键').toBe(12)
    cleanup()
  })
})
