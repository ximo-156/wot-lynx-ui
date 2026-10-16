/**
 * Style Funnel 回归测试（CONVENTIONS §20）。
 *
 * 锁定「Lynx SetStyle 逐属性合并 → 省略键不清除已应用内联样式」这一平台语义下
 * 的架构级约束：经 `resolveStyle` 下发的样式对象，**键集必须完整**。
 *
 * 这些用例是纯函数断言，不依赖双线程渲染；真正的渲染回归见
 * `inline-style-regression.test.ts` 与真机验收清单。
 */
import { describe, it, expect } from 'vitest'
import { defineStyleKeys, resolveStyle } from '../src/common/style'

describe('defineStyleKeys', () => {
  it('原样返回中性值声明（仅做类型收敛）', () => {
    const keys = defineStyleKeys({ transform: 'translateX(0px)', transition: 'none' })
    expect(keys).toEqual({ transform: 'translateX(0px)', transition: 'none' })
  })
})

describe('resolveStyle', () => {
  const SLIDER = defineStyleKeys({
    transform: 'translateX(0px)',
    transition: 'none'
  })

  it('源省略某个键时，该键仍以中性值出现（键集完整）', () => {
    // 这是本模块存在的根本理由：旧写法 `if (left) style.transform = ...`
    // 在 left === 0 时省略 transform，导致上一帧位移残留。
    const style = resolveStyle(SLIDER, {})
    expect(style).toEqual({ transform: 'translateX(0px)', transition: 'none' })
  })

  it('位移归零时仍输出 translateX(0px)（滑块可归位）', () => {
    const style = resolveStyle(SLIDER, { transform: 'translateX(0px)' })
    expect(style.transform).toBe('translateX(0px)')
  })

  it('显式传 undefined / null / 空串视为清除，回落中性值', () => {
    expect(resolveStyle(SLIDER, { transform: undefined }).transform).toBe('translateX(0px)')
    expect(resolveStyle(SLIDER, { transform: null }).transform).toBe('translateX(0px)')
    expect(resolveStyle(SLIDER, { transform: '' }).transform).toBe('translateX(0px)')
  })

  it('未在 neutral 中声明的键被清除后从结果移除', () => {
    const style = resolveStyle(SLIDER, { opacity: '0.5' }, { opacity: undefined })
    expect('opacity' in style).toBe(false)
  })

  it('后写的源覆盖先写的源', () => {
    const style = resolveStyle(SLIDER, { transform: 'translateX(10px)' }, { transform: 'translateX(20px)' })
    expect(style.transform).toBe('translateX(20px)')
  })

  it('多源中 null / undefined 源被跳过，不影响既有键', () => {
    const style = resolveStyle(SLIDER, null, { transform: 'translateX(5px)' }, undefined)
    expect(style).toEqual({ transform: 'translateX(5px)', transition: 'none' })
  })

  it('数值取值按 String 归一（与 filterStyle 一致）', () => {
    const keys = defineStyleKeys({ width: '0px' })
    expect(resolveStyle(keys, { width: 120 }).width).toBe('120')
  })

  it('不修改传入的 neutral 对象（模块级常量可安全复用）', () => {
    const keys = defineStyleKeys({ transform: 'translateX(0px)' })
    resolveStyle(keys, { transform: 'translateX(99px)' })
    expect(keys.transform).toBe('translateX(0px)')
  })

  it('合并顺序与键集完整性同时成立（多键条件翻转场景）', () => {
    const POSITION = defineStyleKeys({ top: 'auto', bottom: 'auto', transform: 'none' })
    // 由 top 切到 bottom：top 必须被显式复位，否则两个定位同时存在
    const style = resolveStyle(POSITION, { top: undefined, bottom: '10%' })
    expect(style).toEqual({ top: 'auto', bottom: '10%', transform: 'none' })
  })
})
