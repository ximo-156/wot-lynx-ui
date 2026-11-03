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
import tagTransformLoader from '../../plugin/tag-transform-loader.cjs'

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

  it('嵌套 template / 注释中的 template 字面量不影响块定位', () => {
    const source = `<!--
<template>
  <wd-not-a-real-tag />
</template>
-->
<script setup lang="ts">
const tag = 'wd-button'
</script>

<template>
  <view>
    <!-- 注释里的 template 字面量不应打乱深度配对 -->
    <template v-else>
      <wd-button>按钮</wd-button>
    </template>
    <wd-search v-model="keyword" />
  </view>
</template>

<style>
.wd-button { color: red; }
</style>
`
    const out = transform(source)
    // 嵌套 template 内部的组件仍被转换
    expect(out).toContain('<WdButton>按钮</WdButton>')
    // 带 v-model 的组件必须被转换：否则编译器会按原生元素校验 v-model 而失败
    expect(out).toContain('<WdSearch v-model="keyword" />')
    // 模板块内不得残留原始 wd-* 标签（顶层注释里的示例字面量不在改写范围）
    expect(out).not.toContain('<wd-button')
    expect(out).not.toContain('</wd-button')
    expect(out).not.toContain('<wd-search')
    // 嵌套 template 的闭合标签保持原样（不是组件）
    expect(out).toContain('<template v-else>')
    expect(out).toContain('</template>')
    // 模板块之外的 script / style 内容不被改写
    expect(out).toContain(`const tag = 'wd-button'`)
    expect(out).toContain('.wd-button { color: red; }')
  })

  it('顶层 template 未闭合时构建期报错（而不是静默产出 603 崩溃包）', () => {
    expect(() => transform(`<template>
  <view><wd-button /></view>
`)).toThrow(/未找到配对的/)
  })

  it('无法识别的 wd-* 标签残留时构建期报错', () => {
    expect(() => transform(`<template>
  <wd-
button />
</template>
`)).toThrow(/仍有未转换的 wd-\* 标签/)
  })
})

/**
 * 静态 style → 对象语法（CONVENTIONS §19）。
 *
 * vue-lynx 的 patchProp 只处理对象/数组，字符串 style 被静默替换为 {}：
 * Web 预览按 DOM 属性解析所以「电脑正常」，真机上高度塌陷、背景丢失、
 * 固定定位失效。loader 在构建期把静态 style 改写成对象语法，两端一致。
 */
describe('tag-transform-loader · 静态 style 改写', () => {
  it('style="a: b; c: d" 改写为 :style="{ \'a\': \'b\', \'c\': \'d\' }"', () => {
    const out = transform(`<template>
  <view style="height: 120px; background: #fff" />
</template>
`)
    expect(out).toContain(`:style="{ 'height': '120px', 'background': '#fff' }"`)
    expect(out).not.toContain('style="height: 120px')
  })

  it('已带 :style 的标签不再改写静态 style（避免重复属性覆盖动态绑定）', () => {
    const out = transform(`<template>
  <view :style="{ color: 'red' }" style="top: 0" />
</template>
`)
    expect(out).toContain(`:style="{ color: 'red' }"`)
    expect(out).toContain('style="top: 0"')
    // 同一标签上不得出现两个 :style（后者会覆盖前者）
    expect(out).not.toMatch(/:style="[^"]*"[^>]*:style="/)
  })

  it('v-bind:style 同样视为动态绑定，原样保留', () => {
    const out = transform(`<template>
  <view v-bind:style="dyn" style="top: 0" />
</template>
`)
    expect(out).toContain('<view v-bind:style="dyn" style="top: 0" />')
  })

  it('含插值的 style 不改写（无法静态求值，宁可保留原样）', () => {
    const out = transform(`<template>
  <view style="width: {{ w }}px" />
</template>
`)
    expect(out).toContain('style="width: {{ w }}px"')
    expect(out).not.toContain(':style=')
  })

  it('组件标签改写与 style 改写在同一次转换里都生效', () => {
    const out = transform(`<template>
  <wd-button style="height: 40px">按钮</wd-button>
</template>
`)
    expect(out).toContain('<WdButton :style="{ \'height\': \'40px\' }">按钮</WdButton>')
  })
})
