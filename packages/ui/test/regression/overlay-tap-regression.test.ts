/**
 * 遮罩 tap 关闭回归测试 — 锁定「真机点击遮罩无反应」缺陷。
 *
 * 背景（2026-10-16 真机核实，com.lynx.explorer）：
 * demo 真机测试页点「Overlay 遮罩」后，遮罩常驻、点击任意处不关闭。
 *
 * 根因：WdTransition 根 view 的内部点击绑定自 e2931b8 起为 @click，
 * 但 Lynx 引擎（含 @lynx-js/web-core 的 click→tap 映射）根本不向 view
 * 派发 click 事件——触摸点击派发的是 tap。于是遮罩点击是死链：
 * WdOverlay 永远收不到 click，overlayVisible 永远为 true。
 *
 * 既有 overlay-chain-regression.test.ts 用 fireEvent.click 断言「点击可关闭」，
 * 但 click 是测试环境凭空合成的 bindEvent:click（__AddEvent 拦截），
 * 真机永远不会派发它——测试绿着，真机上遮罩关不掉。
 *
 * 本文件按真机语义用 fireEvent.tap 断言关闭行为。
 */
import { describe, it, expect } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { pause } from '../../src/common/util'
import { fireEvent } from '../fire-event'
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

function isHidden(el: Element | null): boolean {
  if (!el) return true
  return /display:\s*none/.test((el as HTMLElement).getAttribute('style') || '')
}

function firstMatch(container: Element, selector: string): Element | null {
  return container.querySelector(selector)
}

describe('遮罩 tap 关闭（真机事件语义）', () => {
  it('overlay：tap 遮罩应触发 click 事件并关闭', async () => {
    const show = ref(true)
    const clicks: unknown[] = []
    const { container } = render({
      setup() {
        return () =>
          h(Overlay as any, {
            show: show.value,
            onClick: () => {
              clicks.push(1)
              show.value = false
            }
          })
      }
    } as any)

    await frames()
    const overlay = firstMatch(container, '.wd-overlay')
    expect(overlay, '遮罩应渲染').not.toBeNull()
    expect(isHidden(overlay), '遮罩应可见').toBe(false)

    // 真机派发的是 tap，不是 click
    fireEvent.tap(overlay!)
    await settle()

    expect(clicks.length, 'tap 遮罩应触发 click 回调').toBe(1)
    expect(isHidden(firstMatch(container, '.wd-overlay')), 'tap 后遮罩应关闭').toBe(true)
    cleanup()
  })

  it('popup：tap 遮罩应触发 update:modelValue(false)（closeOnClickModal）', async () => {
    const show = ref(true)
    const updates: boolean[] = []
    const { container } = render({
      setup() {
        return () =>
          h(
            Popup as any,
            {
              modelValue: show.value,
              closeOnClickModal: true,
              'onUpdate:modelValue': (val: boolean) => {
                show.value = val
                updates.push(val)
              }
            },
            { default: () => h('view', { class: 'popup-content' }, ['内容']) }
          )
      }
    } as any)

    await frames()
    const mask = firstMatch(container, '.wd-popup-wrapper .wd-overlay')
    expect(mask, '遮罩应渲染').not.toBeNull()

    // 真机派发的是 tap，不是 click
    fireEvent.tap(mask!)
    await settle()

    expect(updates, 'tap 遮罩应触发 update:modelValue(false)').toContain(false)
    expect(
      isHidden(firstMatch(container, '.wd-popup-wrapper > .wd-transition')),
      'tap 后弹层内容应隐藏'
    ).toBe(true)
    cleanup()
  })
})
