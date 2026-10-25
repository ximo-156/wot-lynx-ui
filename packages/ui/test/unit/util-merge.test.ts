/**
 * common/util 核心函数回归测试。
 *
 * 锁定 2026-10-16 代码审查中实证确认的四个缺陷（修复前均可在 Node 下复现）：
 * 1. isObj 把 null / 数组误判为普通对象（`typeof null === 'object'`）；
 * 2. 连带 deepMerge 数组覆盖失效、无法置 null —— 影响 wd-dialog / wd-toast /
 *    wd-notify 全部命令式弹层的选项合并；
 * 3. debounce({ leading: true }) 单次调用触发两次（trailing 无条件执行）；
 * 4. closest([]) 抛 "Reduce of empty array with no initial value"。
 *
 * 另锁定 isEqual 的普通对象结构比较（wd-upload 的「无变化则跳过」守卫依赖它）。
 */
import { describe, it, expect, vi } from 'vitest'
import { closest, debounce, deepMerge, isEqual, isObj } from '../../src/common/util'

describe('isObj', () => {
  it('只把普通对象判为对象', () => {
    expect(isObj({})).toBe(true)
    expect(isObj({ a: 1 })).toBe(true)
    // 无原型对象 toString 仍为 [object Object]，按普通对象处理
    expect(isObj(Object.create(null))).toBe(true)
  })

  it('null / 数组 / 其他类型一律不是普通对象', () => {
    expect(isObj(null)).toBe(false)
    expect(isObj(undefined)).toBe(false)
    expect(isObj([])).toBe(false)
    expect(isObj([1, 2])).toBe(false)
    expect(isObj(new Date())).toBe(false)
    expect(isObj(new Map())).toBe(false)
    expect(isObj('str')).toBe(false)
    expect(isObj(0)).toBe(false)
    expect(isObj(() => {})).toBe(false)
  })
})

describe('deepMerge', () => {
  it('数组整体替换，不保留 target 的尾部元素', () => {
    const target = { buttons: [1, 2, 3], zIndex: 10 }
    const merged = deepMerge(target, { buttons: [9] })
    expect(merged.buttons).toEqual([9])
    // 不污染入参
    expect(target.buttons).toEqual([1, 2, 3])
  })

  it('可以用 null 覆盖已有对象（置空生效）', () => {
    expect(deepMerge({ a: { x: 1 } }, { a: null })).toEqual({ a: null })
  })

  it('嵌套对象仍然深合并（既有语义不回退）', () => {
    const merged = deepMerge({ a: { x: 1, y: 2 } }, { a: { y: 3 } })
    expect(merged).toEqual({ a: { x: 1, y: 3 } })
  })

  it('结果与 source 的数组不共享引用', () => {
    const source = { list: [{ id: 1 }] }
    const merged = deepMerge({ list: [] }, source)
    expect(merged.list).toEqual([{ id: 1 }])
    expect(merged.list).not.toBe(source.list)
    expect(merged.list[0]).not.toBe(source.list[0])
  })

  it('函数等非普通对象按引用赋值（不被深拷贝）', () => {
    const fn = () => 'ok'
    const merged = deepMerge({}, { onConfirm: fn })
    expect(merged.onConfirm).toBe(fn)
  })

  it('返回新对象，不修改 target（命令式弹层依赖新引用触发 watch）', () => {
    const target = { show: false }
    const merged = deepMerge(target, { show: true })
    expect(merged).not.toBe(target)
    expect(target.show).toBe(false)
    expect(merged.show).toBe(true)
  })
})

describe('debounce', () => {
  it('leading + trailing：单次调用只触发一次', async () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 30, { leading: true, trailing: true })
    debounced()
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('leading + trailing：窗口内多次调用触发两次（首次立即 + 末尾补一次）', async () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 30, { leading: true, trailing: true })
    debounced()
    debounced()
    debounced()
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('trailing 模式：窗口内多次调用只触发一次且取最后一次参数', async () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 30)
    debounced(1)
    debounced(2)
    debounced(3)
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenLastCalledWith(3)
  })

  it('leading 且 trailing=false：单次调用只触发一次', async () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 30, { leading: true, trailing: false })
    debounced()
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancel 后不再触发', async () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 30, { leading: true, trailing: true })
    debounced()
    debounced()
    debounced.cancel()
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(fn).toHaveBeenCalledTimes(1) // 仅 leading 那一次
  })
})

describe('closest', () => {
  it('返回最接近目标值的元素', () => {
    expect(closest([1, 5, 10], 6)).toBe(5)
    expect(closest([1, 5, 10], 9)).toBe(10)
  })

  it('空数组返回 undefined（旧实现抛 Reduce of empty array）', () => {
    expect(() => closest([], 1)).not.toThrow()
    expect(closest([], 1)).toBeUndefined()
  })
})

describe('isEqual', () => {
  it('普通对象按结构比较（wd-upload 守卫依赖）', () => {
    expect(isEqual({ a: 1 }, { a: 1 })).toBe(true)
    expect(isEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(isEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(isEqual({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toBe(true)
  })

  it('数组与基本类型行为保持不变', () => {
    expect(isEqual([1, 2], [1, 2])).toBe(true)
    expect(isEqual([1, 2], [1, 2, 3])).toBe(false)
    expect(isEqual(1, 1)).toBe(true)
    expect(isEqual('a', 'b')).toBe(false)
    expect(isEqual(null, null)).toBe(true)
    expect(isEqual(null, undefined)).toBe(false)
  })

  it('函数与类实例退化为引用比较', () => {
    const fn = () => {}
    expect(isEqual(fn, fn)).toBe(true)
    expect(isEqual(fn, () => {})).toBe(false)
  })
})
