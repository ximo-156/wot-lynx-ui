/**
 * 遮罩全屏 + 键盘输入回显回归测试 — 锁定用户 2026-11-05 反馈的两条真机缺陷：
 *
 * ① 「输入面板没有全屏」：`.wd-overlay` 是 `position: fixed` + `display: flex`
 *    的节点，真机上按内容尺寸收缩、四边 0 撑不开（CONVENTIONS §19 差异
 *    #10——wd-toast 2026-11-01 / wd-popup 2026-11-05 同款）。2026-11-02
 *    给遮罩补 `display: flex`（插槽 `flex: 1` 内容居中）时落入该差异却漏了
 *    「显式窗口像素」那半场修复：空插槽塌成 0×0、带插槽塌成内容尺寸，
 *    于是所有弹层（日期时间 / Picker / Dialog / 键盘…）在真机上**没有
 *    全屏遮罩**，且「点遮罩关闭」失效——默认数字键盘没有关闭按钮，只能靠
 *    遮罩关闭，用户被卡在关不掉。
 *    本测试锁定遮罩根节点内联样式必须带显式窗口像素宽高。
 *
 * ② 「输入之后文字没有保留到面板上」：数字键盘 → PasswordInput 的受控链路
 *    （demo 支付密码场景）。按键 touchend → press → update:modelValue →
 *    密码格子回显掩码圆点；关闭键盘后值不丢失。任何一环断掉都表现为
 *    「输了但面板上不保留 / 一松手就没了」。
 */
import { describe, it, expect } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { getSystemInfo, pause } from '../../src/common/util'
import { fireEvent } from '../fire-event'
import Keyboard from '../../src/components/wd-keyboard/wd-keyboard.vue'
import PasswordInput from '../../src/components/wd-password-input/wd-password-input.vue'
import Overlay from '../../src/primitives/wd-overlay/wd-overlay.vue'
import Popup from '../../src/primitives/wd-popup/wd-popup.vue'

/** 等待过渡入场（pause 约 33ms 一帧，enter 需 2 帧置 display） */
async function frames(n = 6) {
  for (let i = 0; i < n; i++) await pause()
}

/** 等待离场动画完整落地（duration 兜底定时器 + 框架按 v-if 卸载） */
async function settle() {
  await pause(500)
  await frames(4)
}

function firstMatch(container: Element, selector: string): Element | null {
  return container.querySelector(selector)
}

/** 按文本触摸一个按键（touchstart + touchend，useTouch 读 touches[0]） */
async function tapKey(container: Element, text: string) {
  const wrapper = Array.from(container.querySelectorAll('.wd-key-wrapper')).find((w) => {
    const key = w.querySelector('.wd-key')
    return (key?.textContent || '').trim() === text && !(key?.className || '').includes('wd-key--delete')
  })
  if (!wrapper) throw new Error(`key not found: ${text}`)
  fireEvent.touchstart(wrapper, { touches: [{ clientX: 0, clientY: 0 }] })
  fireEvent.touchend(wrapper, { touches: [] })
  await nextTick()
}

describe('遮罩全屏 + 键盘输入回显（2026-11-05 用户反馈回归）', () => {
  it('overlay 根节点内联宽高按窗口像素下发（真机 fixed+flex 收缩的对策）', async () => {
    const { container } = render({
      setup() {
        return () => h('view', { class: 'host' }, [h(Overlay as any, { show: true, zIndex: 66 })])
      }
    } as any)
    await frames()
    const overlay = firstMatch(container, '.wd-overlay')!
    expect(overlay, '遮罩应渲染').not.toBeNull()
    const style = overlay.getAttribute('style') || ''
    // 显式窗口像素：四边 0 在真机上撑不开 fixed + display:flex 的节点
    const info = getSystemInfo()
    expect(style, '遮罩宽度必须按窗口像素显式下发').toMatch(new RegExp(`width:\\s*${info.windowWidth}px`))
    expect(style, '遮罩高度必须按窗口像素显式下发').toMatch(new RegExp(`height:\\s*${info.windowHeight}px`))
    expect(style).toMatch(/z-index:\s*66/)
    cleanup()
  })

  it('popup 遮罩同样带全屏宽高，且 customStyle 仍可覆盖', async () => {
    const { container } = render({
      setup() {
        return () =>
          h(
            Popup as any,
            { modelValue: true, modalStyle: 'opacity: 0;' },
            { default: () => h('view', { class: 'popup-body' }, ['内容']) }
          )
      }
    } as any)
    await frames()
    const mask = firstMatch(container, '.wd-popup-wrapper .wd-overlay')!
    expect(mask, '遮罩应渲染').not.toBeNull()
    const style = mask.getAttribute('style') || ''
    const info = getSystemInfo()
    expect(style, 'popup 遮罩宽度必须按窗口像素显式下发').toMatch(new RegExp(`width:\\s*${info.windowWidth}px`))
    expect(style, 'popup 遮罩高度必须按窗口像素显式下发').toMatch(new RegExp(`height:\\s*${info.windowHeight}px`))
    // 键盘场景的隐形遮罩（opacity: 0）与自定义样式不被宽高挤掉
    expect(style).toMatch(/opacity:\s*0/)
    cleanup()
  })

  it('键盘 → PasswordInput 受控链路：输入回显掩码圆点，关闭后值不丢失', async () => {
    // 与 demo「默认数字键盘 + PasswordInput（支付密码场景）」完全同构的 wiring
    const payValue = ref('')
    const keyboardVisible = ref(false)
    const { container } = render({
      setup() {
        return () =>
          h('view', { class: 'host' }, [
            h(PasswordInput as any, { modelValue: payValue.value, length: 6 }),
            h(Keyboard as any, {
              visible: keyboardVisible.value,
              modelValue: payValue.value,
              'onUpdate:modelValue': (v: string) => { payValue.value = v },
              'onUpdate:visible': (v: boolean) => { keyboardVisible.value = v }
            })
          ])
      }
    } as any)
    await frames()

    // 打开键盘
    keyboardVisible.value = true
    await frames()
    const keys = firstMatch(container, '.wd-keyboard__keys')
    expect(keys, '键盘应弹出').not.toBeNull()

    // 输入 6 位：每位都立即回写受控状态并渲染掩码圆点
    for (const digit of ['1', '2', '3', '4', '5', '6']) {
      await tapKey(container, digit)
    }
    await pause(50)
    expect(payValue.value, '受控值应累积输入').toBe('123456')
    const dots = container.querySelectorAll('.wd-password-input__mask')
    expect(dots.length, '每位输入渲染一个掩码圆点').toBe(6)

    // 点遮罩关闭键盘（默认数字键盘没有关闭按钮，只能靠遮罩）
    const mask = firstMatch(container, '.wd-popup-wrapper .wd-overlay')
    expect(mask, '键盘遮罩应渲染').not.toBeNull()
    // 隐形遮罩用透明底色（不是 opacity: 0）：真机上 opacity 与命中测试的
    // 依赖关系没有保证，透明底色才能既不可见又可接收「点外部收起」
    const maskStyle = mask!.getAttribute('style') || ''
    expect(maskStyle, '键盘遮罩应为透明底色而非 opacity: 0').toMatch(/background-color:\s*transparent/)
    expect(maskStyle).not.toMatch(/opacity:\s*0(;|$)/)
    fireEvent.tap(mask!)
    await settle()
    expect(keyboardVisible.value, '点遮罩后键盘应关闭').toBe(false)

    // 关闭后值保留：密码格子仍有 6 个圆点（「文字没有保留」的对立面）
    expect(payValue.value, '关闭键盘后值不得丢失').toBe('123456')
    expect(container.querySelectorAll('.wd-password-input__mask').length, '关闭后圆点仍在').toBe(6)

    // 重新打开：键盘读到的是已保留的值，可继续输入
    keyboardVisible.value = true
    await frames()
    await tapKey(container, '7')
    await pause(50)
    expect(payValue.value, '重新打开后可继续输入').toBe('1234567')
    cleanup()
  })
})
