#!/usr/bin/env node
/**
 * gen-component.mjs — 新组件脚手架。
 *
 * 为什么需要它：新增一个组件要同时改对 7 处——目录结构、SFC 首行样式导入、
 * props 工厂与 JSDoc 格式（docs 生成器按 `类型:/可选值:/默认值:` 解析）、
 * SCSS 私有令牌、生成 barrel、生成 index.css、测试骨架。漏任何一处都不报错，
 * 而是静默降级（样式不生成 / 文档缺字段 / 全局注册不到）。脚手架把「7 处」
 * 收敛成一条命令，把「靠记忆」换成「靠工具」。
 *
 * 用法：
 *   pnpm gen:component wd-foo                      # 业务组件（默认）
 *   pnpm gen:component wd-foo --root=primitives    # L3.5 基础件
 *   pnpm gen:component wd-foo --title="富文本"      # 指定中文名（文档标题）
 *   pnpm gen:component wd-foo --dry-run            # 只打印将创建的文件
 *
 * 产出：
 *   src/<root>/<name>/types.ts     Props 定义（baseProps + 一个示例 prop）
 *   src/<root>/<name>/<name>.vue   SFC 骨架（CONVENTIONS §4 模板）
 *   src/<root>/<name>/index.scss   样式骨架（CONVENTIONS §5 令牌约定）
 *   src/<root>/<name>/index.css    由 build-css 生成，勿手改
 *   test/<name>.test.ts            冒烟 + 规范一致性测试
 *   并自动跑 gen-index 更新 barrel
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'packages/ui/src')
const TEST_DIR = join(ROOT, 'packages/ui/test')
const ROOTS = ['components', 'primitives']

// ---------------------------------------------------------------------------
// 参数
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2)
const flags = new Map()
const positional = []
for (const a of argv) {
  const m = a.match(/^--([\w-]+)(?:=(.*))?$/)
  if (m) flags.set(m[1], m[2] ?? 'true')
  else positional.push(a)
}

const name = positional[0]
if (!name) {
  console.error('用法：pnpm gen:component <wd-xxx> [--root=components|primitives] [--title="中文名"] [--dry-run]')
  process.exit(1)
}
if (!/^wd-[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
  console.error(`✖ 组件名不合法：${name}\n  要求：wd- 前缀 + kebab-case（小写字母/数字/连字符），如 wd-foo-bar`)
  process.exit(1)
}

const root = flags.get('root') || 'components'
if (!ROOTS.includes(root)) {
  console.error(`✖ --root 只能是 ${ROOTS.join(' | ')}，收到：${root}`)
  process.exit(1)
}
const dryRun = flags.has('dry-run')
const title = flags.get('title') || name.replace(/^wd-/, '')
const pascal = name
  .split('-')
  .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
  .join('')
const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1)
// wd-foo-bar → foo-bar：BEM 的 b() 会自己拼命名空间，块名不能带 wd-
const blockName = name.replace(/^wd-/, '')
// wd-foo-bar → foo-bar：私有令牌用 --wot-foo-bar-*
const cssVar = blockName

const compDir = join(SRC, root, name)
const testFile = join(TEST_DIR, `${name}.test.ts`)

if (existsSync(compDir)) {
  console.error(`✖ 目录已存在：${relative(ROOT, compDir)}\n  脚手架只负责创建，不覆盖已有组件。`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// 模板
// ---------------------------------------------------------------------------

const relCommon = '../../common'
const relStyles = '../../styles'

const typesTs = `import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeStringProp } from '${relCommon}/props'

/**
 * ${title}尺寸
 * 可选值: 'small' | 'medium' | 'large'
 */
export type ${pascal}Size = 'small' | 'medium' | 'large'

/**
 * ${title}组件 Props 定义
 *
 * ⚠️ JSDoc 格式是文档生成器的解析依据（scripts/gen-docs.mjs），
 *    每个 prop 必须写全「类型 / 可选值 / 默认值」三行，缺字段会导致文档缺列。
 */
export const ${camel}Props = {
  ...baseProps,
  /**
   * 尺寸
   * 类型: ${pascal}Size
   * 可选值: 'small' | 'medium' | 'large'
   * 默认值: 'medium'
   */
  size: makeStringProp<${pascal}Size>('medium'),
  /**
   * 是否禁用
   * 类型: boolean
   * 默认值: false
   */
  disabled: makeBooleanProp(false),
  /**
   * 自定义内容
   * 类型: string
   * 默认值: undefined
   */
  label: String as PropType<string>
}

/**
 * ${title}组件 Props 类型
 */
export type ${pascal}Props = ExtractPropTypes<typeof ${camel}Props>
`

const vueFile = `/*
 * ${name} — ${title}
 *
 * Lynx 实现说明（没有适配点时删除本块）：
 * - 所有文本必须在 text 元素中（CONVENTIONS §4），裸文本会被静默丢弃；
 * - 内联样式一律对象语法（CONVENTIONS §19），字符串 style 会被静默丢弃；
 * - 横向布局必须显式 display: flex（CONVENTIONS §15）；
 * - 模板内组件标签用 PascalCase，kebab-case 会被判为 Lynx 原生元素。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { ${camel}Props } from './types'
import { parseStyle } from '${relCommon}/util'

const props = defineProps(${camel}Props)

/** 根节点类名：尺寸与禁用态（须与 index.scss 的 m()/when() 一致，CONVENTIONS §5.5） */
const rootClass = computed(() => [
  \`\${props.size ? 'is-' + props.size : ''}\`,
  props.disabled ? 'is-disabled' : ''
])
</script>

<template>
  <view :class="['${name}', rootClass, customClass]" :style="parseStyle(customStyle)">
    <text class="${name}__label">{{ label }}</text>
    <slot></slot>
  </view>
</template>
`

const scssFile = `@use '${relStyles}/variable.scss' as *;
@use '${relStyles}/mixin/mixin.scss' as *;

// ${title}私有令牌（消费者按名覆盖，回退到语义令牌）
$--${cssVar}-height: var(--wot-${cssVar}-height, $n-32) !default;
$--${cssVar}-padding: var(--wot-${cssVar}-padding, $padding-tight) !default;
$--${cssVar}-font-size: var(--wot-${cssVar}-font-size, $typography-body-size-main) !default;

// b() 会拼上命名空间：b(probe) → .wd-probe（不要写 b('wd-probe')）
@include b(${blockName}) {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: $--${cssVar}-height;
  padding: $--${cssVar}-padding;

  @include e(label) {
    font-size: $--${cssVar}-font-size;
  }

  // 尺寸用 when()（生成 .wd-xxx.is-small），与模板推送的 is-<size> 类名同源。
  // 若误用 m()（生成 .wd-xxx--small）会与 DOM 类名不匹配 → 整组声明静默丢弃（CONVENTIONS §5.5）
  @include when(small) {
    height: var(--wot-${cssVar}-height-small, $n-24);
  }

  @include when(large) {
    height: var(--wot-${cssVar}-height-large, $n-40);
  }

  @include when(disabled) {
    opacity: 0.5;
  }
}
`

const testFile_ = `/**
 * ${name}（${title}）冒烟与规范一致性测试。
 *
 * 脚手架生成的测试，覆盖两类「静默失败」：
 *   1. 样式未接入：index.css 缺失或根类名不匹配 → 组件无样式但不报错；
 *   2. SFC 结构违规：样式导入不在首行、出现 style 块 → 构建期或运行时才暴露。
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, cleanup } from './render'
import ${pascal} from '../src/${root}/${name}/${name}.vue'

const COMPONENT_DIR = join(__dirname, '..', 'src', '${root}', '${name}')

describe('${name}', () => {
  it('渲染冒烟：挂载后根节点存在', () => {
    const { container } = render(${pascal})
    expect(container.querySelector('.${name}')).toBeTruthy()
    cleanup()
  })

  it('样式已接入：index.css 存在且含根类名', () => {
    const cssPath = join(COMPONENT_DIR, 'index.css')
    expect(existsSync(cssPath), 'index.css 未生成，请运行 pnpm build:css').toBe(true)
    expect(readFileSync(cssPath, 'utf8')).toContain('.${name}')
  })

  it('SFC 结构合规：样式导入在 script 首行，且无 style 块', () => {
    const source = readFileSync(join(COMPONENT_DIR, '${name}.vue'), 'utf8')
    const scriptBody = source.split(/<script[^>]*>/)[1] || ''
    const firstCodeLine = scriptBody
      .split('\\n')
      .map((l) => l.trim())
      .filter(Boolean)[0]
    expect(firstCodeLine).toBe("import './index.css'")
    expect(source).not.toMatch(/<style[\\s>]/)
  })
})
`

// ---------------------------------------------------------------------------
// 生成
// ---------------------------------------------------------------------------

const files = [
  [join(compDir, 'types.ts'), typesTs],
  [join(compDir, `${name}.vue`), vueFile],
  [join(compDir, 'index.scss'), scssFile],
  [testFile, testFile_]
]

if (dryRun) {
  console.log('将创建以下文件（--dry-run 未写入）：')
  for (const [f] of files) console.log(`  ${relative(ROOT, f)}`)
  console.log(`  ${relative(ROOT, join(compDir, 'index.css'))}（由 build-css 生成）`)
  process.exit(0)
}

mkdirSync(compDir, { recursive: true })
for (const [f, content] of files) {
  mkdirSync(join(f, '..'), { recursive: true })
  writeFileSync(f, content, 'utf8')
  console.log(`  ✅ ${relative(ROOT, f)}`)
}

// ---------------------------------------------------------------------------
// 生成派生文件：index.css（scss 编译）与 barrel
// ---------------------------------------------------------------------------

function run(label, args) {
  process.stdout.write(`  ⏳ ${label}…`)
  try {
    execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'pipe' })
    console.log(' ✅')
  } catch (err) {
    console.log(' ✖')
    const out = [err.stdout?.toString(), err.stderr?.toString()].filter(Boolean).join('\n')
    if (out.trim()) console.error(out.trim().split('\n').slice(-12).join('\n'))
    process.exitCode = 1
  }
}

run('编译 index.scss → index.css', ['scripts/build-css.mjs', name])
run('更新组件 barrel', ['scripts/gen-index.mjs'])

console.log(`
组件 ${name} 已创建于 src/${root}/${name}/

后续步骤：
  1. 在 types.ts 里替换示例 prop（size / disabled / label 是占位）
  2. 在 ${name}.vue 里实现模板，文本务必包 <text>
  3. index.scss 里把私有令牌改成实际设计值，并确认 m()/when() 与 DOM 类名一致
  4. 跑门禁：pnpm check:index && pnpm check:deps && pnpm lint:conventions
  5. 依赖规则：业务组件不得 import 其他业务组件的 .vue/types；
     若 ${name} 被 3 个以上组件复用，考虑 --root=primitives 重新生成
`)
