/**
 * 事件注册表回归测试 — CONVENTIONS §14 同类 on* 事件合并崩溃。
 *
 * 背景：vue-lynx 把元素事件处理器按 sign 存进
 * globalThis.__VUE_LYNX_EVENT_REGISTRY__ 的 Map，原生事件到来时由
 * lynx_core 调 publishEvent(sign, data) 取出并直接调用。该实现只容忍
 * 函数值：父组件在「包裹层组件」上绑 @tap，而该组件的根 view 也绑了
 * 自己的 @tap 时，Vue 的 mergeProps 会把两个同名监听合并成数组，
 * 数组被原样注册，事件一派发即抛：
 *
 *   TypeError: getRegistryState().handlers.get(...) is not a function
 *
 * （标准 Vue DOM 下 patchEvent 支持监听数组，所以该 bug 只在 Lynx 暴露。）
 *
 * 修复：交互组件的 defineEmits 均声明 'tap'（Lynx 原生事件惯用法），
 * 父级的 @tap 被消费为组件 emit 而不再穿透 $attrs 与根元素合并。
 * 本文件对每个修复过的组件做回归：@tap 必须正常触发且不得抛异常。
 */
import { describe, it, expect } from 'vitest'
import { h } from 'vue-lynx'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'
import Button from '../src/components/wd-button/wd-button.vue'
import Cell from '../src/components/wd-cell/wd-cell.vue'
import GridItem from '../src/components/wd-grid-item/wd-grid-item.vue'
import Icon from '../src/components/wd-icon/wd-icon.vue'
import Text from '../src/components/wd-text/wd-text.vue'
import Img from '../src/components/wd-img/wd-img.vue'
import Avatar from '../src/components/wd-avatar/wd-avatar.vue'
import Backtop from '../src/components/wd-backtop/wd-backtop.vue'
import Switch from '../src/components/wd-switch/wd-switch.vue'
import Checkbox from '../src/components/wd-checkbox/wd-checkbox.vue'
import Loadmore from '../src/components/wd-loadmore/wd-loadmore.vue'
import SortButton from '../src/components/wd-sort-button/wd-sort-button.vue'
import Tag from '../src/components/wd-tag/wd-tag.vue'
import Input from '../src/components/wd-input/wd-input.vue'
import Overlay from '../src/components/wd-overlay/wd-overlay.vue'

/** 挂载「组件 + 父级 @tap 监听」并派发 tap，返回触发次数 */
function tapThrough(component: any, props: Record<string, unknown> = {}, selector = '.wd-button'): number {
  let taps = 0
  const { container } = render({
    setup() {
      return () => h(component, { ...props, onTap: () => taps++ })
    }
  } as any)
  const el = container.querySelector(selector)
  expect(el, `未找到 ${selector}`).not.toBeNull()
  fireEvent.tap(el!)
  cleanup()
  return taps
}

describe('事件注册表：组件根 @tap 与父级 @tap 合并崩溃回归（CONVENTIONS §14）', () => {
  it('WdButton：@tap 正常触发且不抛 TypeError', () => {
    expect(tapThrough(Button, { text: '按钮' })).toBe(1)
  })

  it('WdCell：@tap 正常触发', () => {
    expect(tapThrough(Cell, { title: '单元格', isLink: true }, '.wd-cell')).toBe(1)
  })

  it('WdGridItem：@tap 正常触发', () => {
    expect(tapThrough(GridItem, { text: '宫格' }, '.wd-grid-item')).toBe(1)
  })

  it('WdIcon：@tap 正常触发', () => {
    expect(tapThrough(Icon, { name: 'close' }, '.wd-icon')).toBe(1)
  })

  it('WdText：@tap 正常触发', () => {
    expect(tapThrough(Text, { text: '文本' }, '.wd-text')).toBe(1)
  })

  it('WdImg：@tap 正常触发', () => {
    expect(tapThrough(Img, { src: 'https://example.com/a.png' }, '.wd-img')).toBe(1)
  })

  it('WdAvatar：@tap 正常触发', () => {
    expect(tapThrough(Avatar, { text: 'A' }, '.wd-avatar')).toBe(1)
  })

  it('WdBacktop：@tap 正常触发', () => {
    expect(tapThrough(Backtop, {}, '.wd-backtop')).toBe(1)
  })

  it('WdSwitch：@tap 正常触发', () => {
    expect(tapThrough(Switch, { modelValue: false }, '.wd-switch')).toBe(1)
  })

  it('WdCheckbox：@tap 正常触发', () => {
    expect(tapThrough(Checkbox, { modelValue: false }, '.wd-checkbox')).toBe(1)
  })

  it('WdLoadmore：@tap 正常触发', () => {
    expect(tapThrough(Loadmore, { state: 'error' }, '.wd-loadmore')).toBe(1)
  })

  it('WdSortButton：@tap 正常触发', () => {
    expect(tapThrough(SortButton, { title: '排序' }, '.wd-sort-button')).toBe(1)
  })

  it('WdTag：@tap 正常触发', () => {
    expect(tapThrough(Tag, { text: '标签' }, '.wd-tag')).toBe(1)
  })

  it('WdInput：@tap 正常触发', () => {
    expect(tapThrough(Input, { modelValue: '' }, '.wd-input')).toBe(1)
  })
})

describe('WdTransition 根 view @tap 链路回归', () => {
  // 2026-10-16 订正：Lynx 引擎只向 view 派发 tap，不派发 click。e2931b8 曾把
  // 根 view 内部绑定改为 @click 规避同名合并，导致遮罩/弹层点击全端失效
  // （真机复报，见 overlay-tap-regression.test.ts）。现根 view 绑 @tap 并经
  // emits 声明转发，消费方的 @tap 作为组件事件被消费，不再穿透合并。
  it('WdOverlay：tap 经 transition 根 view 触发（click/tap 双轨 emit）', () => {
    let clicks = 0
    let taps = 0
    const { container } = render({
      setup() {
        return () =>
          h(
            Overlay,
            {
              show: true,
              onClick: () => {
                clicks++
              },
              onTap: () => {
                taps++
              }
            },
            { default: () => h('view', 'x') }
          )
      }
    } as any)
    fireEvent.tap(container.querySelector('.wd-overlay') as Element)
    expect(clicks).toBe(1)
    expect(taps).toBe(1)
    cleanup()
  })
})
