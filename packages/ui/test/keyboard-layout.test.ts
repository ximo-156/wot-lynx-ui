/**
 * WdKeyboard 布局与交互回归测试。
 *
 * 背景：早期实现把按键交给 `flex-wrap: wrap` 排布，而 wd-key-wrapper 为
 * `flex-basis: 0`——所有按键假设主尺寸为 0、永不换行，12 个键全部挤成
 * 一行（用户反馈「一排并列在下面」）。同时 Lynx 新 CSS 引擎下 wrap 的
 * flex line 会被拉伸（参照 wd-calendar-view 的显式行方案）。
 * 现实现改为 JS 切分显式行容器（wd-keyboard__row，每行 3 槽、wider 键
 * 占 2 槽），行内用 flex-grow 分配宽度。本测试锁定行结构与交互语义。
 */
import { describe, it, expect } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import { fireEvent } from './fire-event'
import Keyboard from '../src/components/wd-keyboard/wd-keyboard.vue'

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

/** 取显式行容器结构：[[{ wider, text, isDelete }...], ...] */
function rowStructure(container: Element) {
  return Array.from(container.querySelectorAll('.wd-keyboard__row')).map((row) =>
    Array.from(row.querySelectorAll('.wd-key-wrapper')).map((w) => {
      const key = w.querySelector('.wd-key')
      return {
        wider: w.className.includes('wd-key-wrapper--wider'),
        text: (key?.textContent || '').trim(),
        isDelete: (key?.className || '').includes('wd-key--delete')
      }
    })
  )
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
  it('默认数字键盘：4 行 × 3 键的显式行结构（不再挤成一行）', async () => {
    const { container } = renderKeyboard()
    await pause(200)
    const rows = rowStructure(container)
    expect(rows.length).toBe(4)
    for (const row of rows) expect(row.length).toBe(3)
    // 前三行为 1-9
    expect(rows.slice(0, 3).flat().map((k) => k.text)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    // 末行：额外键（图标）/ 0 / 删除键（图标），均非 wider
    const last = rows[3]
    expect(last.map((k) => k.wider)).toEqual([false, false, false])
    expect(last[1].text).toBe('0')
    expect(last[2].isDelete).toBe(true)
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

  it('自定义键盘：wider 的 0 键占 2 槽，末行 [0, extraKey]', async () => {
    const { container } = renderKeyboard({ mode: 'custom', extraKey: '.' })
    await pause(200)
    const rows = rowStructure(container)
    expect(rows.length).toBe(4)
    const last = rows[3]
    expect(last.length).toBe(2)
    expect(last[0]).toMatchObject({ wider: true, text: '0' })
    expect(last[1]).toMatchObject({ wider: false, text: '.' })
    // 前三行各 3 个普通键
    for (const row of rows.slice(0, 3)) {
      expect(row.length).toBe(3)
      expect(row.every((k) => !k.wider)).toBe(true)
    }
    // 侧栏：删除 + 关闭两个大键
    const sidebar = container.querySelectorAll('.wd-keyboard__sidebar .wd-key-wrapper')
    expect(sidebar.length).toBe(2)
    cleanup()
  })

  it('车牌键盘：zh 38 键 14 行，输入首位后 autoSwitchLang 切英文', async () => {
    const { container, updates } = renderKeyboard({ mode: 'car', autoSwitchLang: true })
    await pause(200)
    const zhRows = rowStructure(container)
    expect(zhRows.length).toBe(14)
    const allKeys = zhRows.flat()
    expect(allKeys.length).toBe(38)
    // ABC 中英切换键与删除键为 wider
    expect(allKeys.find((k) => k.text === 'ABC')?.wider).toBe(true)
    expect(allKeys.filter((k) => k.wider && k.isDelete).length).toBe(1)

    // 点首个省份「京」→ 自动切英文键盘（34 字母数字 + ABC + 删除 = 36 键）
    await tapKey(container, '京')
    await pause(50)
    expect(updates).toEqual(['京'])
    await pause(100)
    const enRows = rowStructure(container)
    const enKeys = enRows.flat()
    expect(enKeys.length).toBe(36)
    expect(enKeys.some((k) => k.text === 'A')).toBe(true)
    expect(enKeys.some((k) => k.text === '京')).toBe(false)
    expect(enKeys.find((k) => k.text === '省份')?.wider).toBe(true)
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
    expect(container.querySelectorAll('.wd-keyboard__row').length, '初始应渲染 4 行').toBe(4)

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
    expect(container.querySelectorAll('.wd-keyboard__row').length, '重新打开应渲染 4 行').toBe(4)
    cleanup()
  })
})
