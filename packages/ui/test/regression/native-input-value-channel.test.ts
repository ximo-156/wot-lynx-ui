/**
 * 原生输入框受控值同步回归 — 锁定用户 2026-11-05 真机复报的缺陷：
 *
 *   「这个数字输入框加减没有鸟用。」
 *
 * 现象（真机、demo Showcase 表单区，min=0/max=10 的步进器）：
 *   ① 键入 33 后显示停在 33，不回落到 max=10（归一化不回显）；
 *   ② 点加减号界面无变化（模型其实已变，输入框文本不动）。
 *
 * 根因：:value 属性通道（SET_PROP）在真机上刷新不了「用户已输入过」的
 * 原生输入框——IME 接管后文本由输入法所有，属性更新被吞。Web 预览的
 * @lynx-js/web-elements XInput 属性处理器直接写 input.value 所以全绿，
 * 该类缺陷只在真机暴露。程序化改写必须走 input 元素方法 setValue
 * （官方 API，经 SelectorQuery.invoke 触达，与 getRect/scrollViewTo 同链）。
 *
 * 本测试经双线程管线挂载真实组件：
 *   - 程序化改写（步进 / 归一化 / 清除）必须 invoke setValue；
 *   - 用户输入回声不得重复 invoke（避免打扰 IME 光标）；
 *   - 步进与归一化的值语义不变（与修复前一致）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '../../src/common/util'
import InputNumber from '../../src/components/wd-input-number/wd-input-number.vue'
import Input from '../../src/primitives/wd-input/wd-input.vue'

afterEach(() => cleanup())

/** 捕获 SelectorQuery.invoke 调用（setValue 即原生输入框文本通道） */
function captureInvoke() {
  const calls: any[] = []
  const lynx = (globalThis as any).lynx
  const original = lynx.createSelectorQuery
  lynx.createSelectorQuery = () => {
    const nodesRef = {
      invoke(options: any) {
        calls.push(options)
        return { exec: () => {} }
      },
      select: () => nodesRef,
      selectAll: () => nodesRef,
      in: () => nodesRef,
      exec: () => {}
    }
    return nodesRef
  }
  return {
    calls,
    restore: () => { lynx.createSelectorQuery = original },
    setValueCalls: () => calls.filter((c) => c?.method === 'setValue').map((c) => c.params?.value)
  }
}

/** 等受控 watch（flush: pre）落地 */
async function flush() {
  await nextTick()
  await nextTick()
}

describe('原生输入框受控值同步（真机 setValue 通道）', () => {
  it('input-number 加减步进：模型变化同时 invoke setValue（真机文本才会刷新）', async () => {
    const captured = captureInvoke()
    try {
      const updates: any[] = []
      const { container } = render({
        setup() {
          const value = ref(5)
          return () =>
            h(InputNumber as any, {
              modelValue: value.value,
              min: 0,
              max: 10,
              'onUpdate:modelValue': (v: any) => {
                value.value = v
                updates.push(v)
              }
            })
        }
      } as any)
      await flush()
      captured.calls.length = 0

      // 点加号：模型 5 → 6，且必须推送原生 setValue('6')
      fireEvent.tap(container.querySelector('.wd-input-number__add')!)
      await flush()
      expect(updates).toContain(6)
      expect(captured.setValueCalls(), '步进后必须走原生 setValue 通道').toContain('6')

      // 点减号：模型 6 → 5，同样推送
      captured.calls.length = 0
      fireEvent.tap(container.querySelector('.wd-input-number__sub')!)
      await flush()
      expect(updates).toContain(5)
      expect(captured.setValueCalls()).toContain('5')
    } finally {
      captured.restore()
    }
  })

  it('input-number 键入越界值：归一化回落 max 并 invoke setValue（复报症状①）', async () => {
    const captured = captureInvoke()
    try {
      const updates: any[] = []
      const { container } = render({
        setup() {
          const value = ref(5)
          return () =>
            h(InputNumber as any, {
              modelValue: value.value,
              min: 0,
              max: 10,
              'onUpdate:modelValue': (v: any) => {
                value.value = v
                updates.push(v)
              }
            })
        }
      } as any)
      await flush()
      const input = container.querySelector('.wd-input-number__input')!

      // 用户键入 33（越界）：输入回声不推送 setValue，归一化推送 '10'
      captured.calls.length = 0
      fireEvent.input(input, { detail: { value: '33' } })
      await flush()
      expect(updates, '越界值应归一化到 max=10').toContain(10)
      expect(captured.setValueCalls(), '归一化结果必须推送到原生输入框').toContain('10')
      expect(input.getAttribute('value')).toBe('10')
    } finally {
      captured.restore()
    }
  })

  it('input-number 用户输入回声不重复 invoke setValue（不打扰 IME 光标）', async () => {
    const captured = captureInvoke()
    try {
      const { container } = render({
        setup() {
          const value = ref(5)
          return () =>
            h(InputNumber as any, {
              modelValue: value.value,
              min: 0,
              max: 10,
              'onUpdate:modelValue': (v: any) => { value.value = v }
            })
        }
      } as any)
      await flush()
      const input = container.querySelector('.wd-input-number__input')!

      // immediateChange 关闭时键入不触发归一化：除挂载初值外不应有任何推送
      captured.calls.length = 0
      fireEvent.input(input, { detail: { value: '7' } })
      await flush()
      expect(captured.setValueCalls(), '用户输入回声不得重复 setValue').toEqual([])
      expect(input.getAttribute('value')).toBe('7')
    } finally {
      captured.restore()
    }
  })

  it('input clearable：点击清除后 invoke setValue("")（真机文本才会清掉）', async () => {
    const captured = captureInvoke()
    try {
      const updates: any[] = []
      const { container } = render({
        setup() {
          const value = ref('已输入')
          return () =>
            h(Input as any, {
              modelValue: value.value,
              clearable: true,
              'onUpdate:modelValue': (v: any) => {
                value.value = v
                updates.push(v)
              }
            })
        }
      } as any)
      await flush()
      captured.calls.length = 0

      const clearIcon = container.querySelector('.wd-input__clear')
      expect(clearIcon, '有值时应展示清除图标').not.toBeNull()
      fireEvent.tap(clearIcon!)
      // handleClear 经 pause()（约一帧）续写，等它落地
      await pause(120)
      await flush()
      expect(updates).toContain('')
      expect(captured.setValueCalls(), '清除必须走原生 setValue 通道').toContain('')
    } finally {
      captured.restore()
    }
  })
})
