/**
 * 事件注册表完整性回归 — 锁定 vue-lynx publishEvent 的处理器可调用性。
 *
 * 背景（真机报错）：
 *   TypeError: _getRegistryState_handlers_get is not a function
 *     at publishEvent (background.js:...)
 *   run_type: lynx_core
 *
 * vue-lynx 的事件注册表（event-registry.js）把「绑定到元素上的事件处理器」
 * 按 sign 存入 globalThis 上的 Map，原生事件到来时由 lynx_core 调
 * tt.publishEvent(sign, data) 取出并调用：
 *   (_getRegistryState_handlers_get = getRegistryState().handlers.get(sign))
 *     === null || _getRegistryState_handlers_get === void 0
 *       ? void 0 : _getRegistryState_handlers_get(data)
 *
 * 该实现只容忍 null/undefined；注册表中存入任何「非函数」值（数组、数字、
 * 字符串……）都会在事件派发时抛上述 TypeError。
 *
 * 触发路径（本文件锁定）：父组件在 <WdOverlay> 上绑 @touchmove，同时
 * WdOverlay → WdTransition 的根 view 在 lockScroll/disableTouchMove 为真时
 * 也绑了自己的 @touchmove.stop.prevent。Vue 的 mergeProps 会把两个同名
 * on* 监听合并成**数组** [wrapped, parentHandler]，数组被原样注册进注册表，
 * touchmove 一到就炸。
 */
import { describe, it, expect } from 'vitest'
import { render } from './render'
import { fireEvent } from './fire-event'
import WdPopup from '../src/components/wd-popup/wd-popup.vue'
import WdDropMenu from '../src/components/wd-drop-menu/wd-drop-menu.vue'
import WdDropMenuItem from '../src/components/wd-drop-menu-item/wd-drop-menu-item.vue'

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))

/**
 * 直接检查 vue-lynx 事件注册表：任何 sign 对应的值都必须是可调用函数。
 * 这是 publishEvent 能安全派发的前提，也是上述 TypeError 的直接不变式。
 */
function assertRegistryHandlersCallable() {
  const reg = (globalThis as any).__VUE_LYNX_EVENT_REGISTRY__
  expect(reg, '事件注册表应已初始化').toBeTruthy()
  const bad: string[] = []
  for (const [sign, handler] of reg.handlers as Map<string, unknown>) {
    if (typeof handler !== 'function') {
      const shape = Array.isArray(handler)
        ? `Array(${(handler as unknown[]).length}) [${(handler as unknown[]).map((h) => typeof h).join(', ')}]`
        : typeof handler
      bad.push(`${sign} => ${shape}`)
    }
  }
  expect(bad, `注册表中存在不可调用的处理器: ${bad.join('; ')}`).toEqual([])
}

describe('事件注册表完整性：注册的处理器必须可调用', () => {
  it('WdPopup：遮罩渲染后注册表无非函数处理器', async () => {
    const Wrapper = {
      components: { WdPopup },
      setup: () => ({ show: true }),
      template: `<wd-popup v-model="show" position="bottom"><view class="popup-body">内容</view></wd-popup>`
    }
    const { container } = render(Wrapper)
    await wait()
    assertRegistryHandlersCallable()

    const overlay = container.querySelector('.wd-overlay')!
    expect(overlay).toBeTruthy()
    fireEvent.touchmove(overlay)
    await wait()
  })

  it('WdPopup（center）：注册表无非函数处理器', async () => {
    const Wrapper = {
      components: { WdPopup },
      setup: () => ({ show: true }),
      template: `<wd-popup v-model="show" position="center"><view class="popup-body">内容</view></wd-popup>`
    }
    render(Wrapper)
    await wait()
    assertRegistryHandlersCallable()
  })

  it('WdDropMenu：展开后注册表无非函数处理器', async () => {
    const Wrapper = {
      components: { WdDropMenu, WdDropMenuItem },
      setup: () => ({ value: 0 }),
      template: `
        <wd-drop-menu>
          <wd-drop-menu-item v-model="value" :options="[{ text: 'A', value: 0 }]" />
        </wd-drop-menu>`
    }
    const { container } = render(Wrapper)
    await wait()
    assertRegistryHandlersCallable()

    const overlay = container.querySelector('.wd-overlay')
    if (overlay) fireEvent.touchmove(overlay)
    await wait()
  })
})
