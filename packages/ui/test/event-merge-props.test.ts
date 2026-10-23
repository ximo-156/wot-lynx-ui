/**
 * mergeProps 同名监听合并崩溃回归测试。
 *
 * 背景（用户真机反馈）：点击「时间筛选器」按钮时 Lynx 抛
 *   TypeError: _getRegistryState_handlers_get is not a function
 *
 * 根因：vue-lynx 把元素事件处理器按 sign 存进
 * globalThis.__VUE_LYNX_EVENT_REGISTRY__ 的 Map，原生事件到来时由
 * lynx_core 调 publishEvent(sign, data) 取出并直接调用——只容忍函数值。
 * 当父组件在「包裹层组件」上绑 @tap，而该组件的根 view 也绑了自己的
 * @tap 时，Vue 的 mergeProps 会把两个同名监听合并成数组，数组被原样
 * 注册，事件一派发即抛上述错误（标准 Vue DOM 的 patchEvent 支持监听
 * 数组，故此 bug 只在 Lynx 暴露）。
 *
 * 修复：交互组件的 defineEmits 均声明同名事件（Lynx 原生事件惯用法），
 * 父级监听被消费为组件 emit 而不再穿透 $attrs 与根元素合并；组件在
 * 自有处理器中转发该事件，父级行为不变。
 *
 * 本文件覆盖：
 *   1. 用户场景复现（wd-button / wd-cell 父级 @tap）
 *   2. touch 事件同类风险（wd-rate / wd-fab / wd-swipe-action）
 *   3. 注册表不变量（任何挂载后都不存在非函数处理器）
 */
import { describe, it, expect } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'
import { pause } from '../src/common/util'
import Button from '../src/primitives/wd-button/wd-button.vue'
import Cell from '../src/primitives/wd-cell/wd-cell.vue'
import Rate from '../src/components/wd-rate/wd-rate.vue'
import Fab from '../src/components/wd-fab/wd-fab.vue'
import SwipeAction from '../src/components/wd-swipe-action/wd-swipe-action.vue'

const REGISTRY_KEY = '__VUE_LYNX_EVENT_REGISTRY__'

/** 断言注册表中所有处理器均为函数（合并崩溃的根因是不变量被破坏） */
function expectNoBadHandlers() {
  const state = (globalThis as any)[REGISTRY_KEY]
  if (!state) return
  for (const [sign, handler] of state.handlers as Map<string, unknown>) {
    expect(typeof handler, `handler ${sign} 为 ${typeof handler}`).toBe('function')
  }
}

describe('mergeProps 同名监听合并崩溃回归', () => {
  it('用户场景：wd-button 父级 @tap（时间筛选器）不崩溃且父子均触发', async () => {
    let parentTaps = 0
    const { container } = render({
      setup() {
        return () =>
          h(Button, { type: 'primary', onTap: () => { parentTaps++ } }, { default: () => '日期时间' })
      }
    } as any)
    await pause(50)
    fireEvent.tap(container.querySelector('.wd-button') as Element)
    await pause(50)
    expect(parentTaps).toBe(1)
    expectNoBadHandlers()
    cleanup()
  })

  it('用户场景：wd-cell 父级 @tap 不崩溃且父子均触发', async () => {
    let parentTaps = 0
    const { container } = render({
      setup() {
        return () => h(Cell, { title: '时间筛选', isLink: true, onTap: () => { parentTaps++ } })
      }
    } as any)
    await pause(50)
    fireEvent.tap(container.querySelector('.wd-cell') as Element)
    await pause(50)
    expect(parentTaps).toBe(1)
    expectNoBadHandlers()
    cleanup()
  })

  it('wd-rate：父级 @touchmove 与根 view touchmove 不合并崩溃', async () => {
    let parentMoves = 0
    const { container } = render({
      setup() {
        const v = ref(3)
        return () =>
          h(Rate, {
            modelValue: v.value,
            onTouchmove: () => { parentMoves++ },
            'onUpdate:modelValue': (x: number) => (v.value = x)
          })
      }
    } as any)
    await pause(50)
    const root = container.querySelector('.wd-rate') as Element
    expect(root).toBeTruthy()
    fireEvent.touchmove(root, { touches: [{ clientX: 10, clientY: 10 }] })
    await pause(50)
    expect(parentMoves).toBe(1)
    expectNoBadHandlers()
    cleanup()
  })

  it('wd-fab：父级 @touchstart 与根 view touchstart 不合并崩溃', async () => {
    let parentStarts = 0
    const { container } = render({
      setup() {
        return () =>
          h(Fab, { onTouchstart: () => { parentStarts++ } }, { default: () => h('view', 'action') })
      }
    } as any)
    await pause(50)
    const root = container.querySelector('.wd-fab') as Element
    expect(root).toBeTruthy()
    fireEvent.touchstart(root, { touches: [{ clientX: 10, clientY: 10 }] })
    await pause(50)
    expect(parentStarts).toBe(1)
    expectNoBadHandlers()
    cleanup()
  })

  it('wd-swipe-action：父级 @touchstart 与 wrapper touchstart 不合并崩溃', async () => {
    let parentStarts = 0
    const { container } = render({
      setup() {
        return () =>
          h(
            SwipeAction,
            { onTouchstart: () => { parentStarts++ } },
            { default: () => h('view', { class: 'sa-content' }, '内容'), right: () => h('view', '删除') }
          )
      }
    } as any)
    await pause(50)
    const wrapper = container.querySelector('.wd-swipe-action__wrapper') as Element
    expect(wrapper).toBeTruthy()
    // MTS 化后的分工（NATIVE-REWRITE §2）：主线程 touchstart/move 绑根 view，
    // 后台 touchstart（事件转发 + 手势起点记录）绑内容容器 wrapper——真机上
    // 内容区触摸先经 wrapper 再冒泡到根 view；jsdom 不冒泡，直接派发到
    // 后台处理器所在元素验证转发链路
    fireEvent.touchstart(wrapper, { touches: [{ clientX: 10, clientY: 10 }] })
    await pause(50)
    expect(parentStarts).toBe(1)
    expectNoBadHandlers()
    cleanup()
  })
})
