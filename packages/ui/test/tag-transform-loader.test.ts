/**
 * tag-transform-loader 回归测试。
 *
 * 背景：Vue Lynx 编译器将所有 kebab-case 标签视为 Lynx 原生元素，
 * 组件必须使用 PascalCase 标签（<WdButton>）。loader 负责把业务模板中的
 * <wd-xxx> 改写为 <WdXxx>。
 *
 * 曾经此处把首段 'wd' 又拼了一次 'Wd' 前缀，产出 <WdWdButton>，
 * 导致 resolveComponent 失败、标签退化为原生元素，真机上报
 * 603 "Can't find ui tag"（node_index 0）且页面空白。
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error —— CommonJS loader，无类型声明
import tagTransformLoader from '../plugin/tag-transform-loader.cjs'

const ctx = { cacheable: () => {}, resourcePath: '/repo/src/App.vue' }

function transform(source: string): string {
  return tagTransformLoader.call(ctx, source)
}

describe('tag-transform-loader', () => {
  it('wd-xxx 改写为 WdXxx（不产生 WdWdXxx）', () => {
    const out = transform(`<template>
  <wd-config-provider>
    <wd-button type="primary">主要</wd-button>
    <wd-swipe-action><wd-cell title="单元格" /></wd-swipe-action>
  </wd-config-provider>
</template>
`)
    expect(out).toContain('<WdConfigProvider>')
    expect(out).toContain('<WdButton type="primary">主要</WdButton>')
    expect(out).toContain('<WdSwipeAction>')
    expect(out).toContain('<WdCell title="单元格" />')
    expect(out).toContain('</WdConfigProvider>')
    // 回归点：不得出现双重 Wd 前缀
    expect(out).not.toContain('WdWd')
    expect(out).not.toContain('<wd-')
    expect(out).not.toContain('</wd-')
  })

  it('不改写 template 块之外的内容（script / style / 注释文案）', () => {
    const source = `<script setup lang="ts">
const tag = 'wd-button'
</script>

<template>
  <wd-button>{{ tag }}</wd-button>
</template>

<style>
.wd-button { color: red; }
</style>
`
    const out = transform(source)
    // 模板内标签被改写
    expect(out).toContain('<WdButton>')
    // script 中的字符串与 style 中的选择器保持原样
    expect(out).toContain(`const tag = 'wd-button'`)
    expect(out).toContain('.wd-button { color: red; }')
  })

  it('无 template 块或非 .vue 资源时原样返回', () => {
    const noTemplate = `<script>export default {}</script>`
    expect(transform(noTemplate)).toBe(noTemplate)

    const source = `<template><wd-button /></template>`
    const notVue = tagTransformLoader.call(
      { cacheable: () => {}, resourcePath: '/repo/src/App.ts' },
      source
    )
    expect(notVue).toBe(source)
  })
})
