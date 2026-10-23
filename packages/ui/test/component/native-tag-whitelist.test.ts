/**
 * Lynx 原生标签白名单回归测试 —— 锁死 603 / 60301 “Can't find ui tag” 崩溃族。
 *
 * 背景：vue-lynx 编译器配置了 `isNativeTag: () => true`，模板里任何
 * kebab-case 标签都会被编译成 `createElement(tag)`，主线程再调用
 * `__CreateElement(tag)`。标签若不在 Lynx 引擎注册表中，真机直接报
 *
 *   error_code: 603  sub_code: 60301  error: "Can't find ui tag"
 *   fix_suggestion: LynxUI has not been created or the creation failed ...
 *
 * 并崩掉整张卡片（node_index 0 即首个无法创建的节点）。
 *
 * 实弹：wd-select-picker 模板里残留 uni-app 的 `<block>` 占位标签。
 * uni-app / 小程序里它是「无渲染包裹」，Lynx 没有这个内置元素。
 * 正确写法是 Vue 的 `<template v-else>`（编译为 Fragment，不产生元素）。
 *
 * 本测试做两层防护：
 * 1. 静态扫描：所有 Lynx 模板只允许出现 Lynx 内置元素；
 * 2. 组件解析：库内 `wd-*` 标签必须有同名 PascalCase 导入、demo 的
 *    `wd-*` 标签必须对应真实组件目录（防止拼错标签退化为原生标签）；
 * 3. 运行期：真实挂载 wd-select-picker 并断言没有组件解析失败告警。
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { h, nextTick, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { captureConsole } from '../capture-console'
import { listComponents } from '../helpers/component-roots'
import SelectPicker from '../../src/components/wd-select-picker/wd-select-picker.vue'

/** 从 cwd 向上找 monorepo 根（vitest 的 cwd 为 packages/ui） */
function findRepoRoot(start: string): string {
  let dir = start
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`找不到 monorepo 根（从 ${start} 向上未发现 pnpm-workspace.yaml）`)
}

const REPO_ROOT = findRepoRoot(process.cwd())

/**
 * Lynx 引擎内置元素白名单。
 *
 * 来源：Lynx 内置组件文档（view / text / image / scroll-view / list /
 * list-item / swiper / swiper-item / input / textarea / switch / checkbox /
 * radio / slider / form / label / svg / video / web-view / page）。
 * **不要**把 uni-app 的 block 加进来——它不是 Lynx 元素。
 */
const LYNX_NATIVE_TAGS = new Set([
  'view',
  'text',
  'image',
  'scroll-view',
  'list',
  'list-item',
  'swiper',
  'swiper-item',
  'input',
  'textarea',
  'switch',
  'checkbox',
  'radio',
  'slider',
  'form',
  'label',
  'svg',
  'video',
  'web-view',
  'page'
])

/** Vue 编译器指令 / 内置标签：不会创建 Lynx 元素 */
const VUE_BUILTIN_TAGS = new Set(['template', 'slot', 'component'])

/** 常见 HTML 标签：误写时给出更直白的失败信息 */
const HTML_TAGS = new Set([
  'div',
  'span',
  'p',
  'a',
  'img',
  'ul',
  'ol',
  'li',
  'section',
  'header',
  'footer',
  'main',
  'nav',
  'button',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6'
])

function walkVueFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkVueFiles(full))
    else if (entry.name.endsWith('.vue')) out.push(full)
  }
  return out
}

/**
 * 取 SFC 的 template 块（仓库内每个 SFC 只有一个顶层 template）。
 *
 * 行首锚点与 tag-transform-loader 口径一致：避免把 script 字符串或
 * 模板注释里的 template 字面量误判为块边界。
 */
function templateOf(source: string): string {
  const open = /^<template(?:\s+[^>]*)?>/m.exec(source)
  if (!open) return ''
  const start = open.index
  const close = /^<\/template\s*>/m.exec(source.slice(start))
  if (!close) return ''
  return source.slice(start, start + close.index)
}

/** 去掉 HTML 注释，避免注释里的示例标签被误判 */
function stripComments(template: string): string {
  return template.replace(/<!--[\s\S]*?-->/g, '')
}

/** 模板中出现的全部小写标签名 */
function tagsOf(template: string): string[] {
  return [...template.matchAll(/<([a-z][a-z0-9-]*)\b/g)].map((m) => m[1])
}

function pascal(tag: string): string {
  return tag
    .split('-')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('')
}

function componentDirs(): Set<string> {
  // 双组件根（ADR-012）：primitives（基础件）+ components（业务组件）
  return new Set(listComponents())
}

function importBindings(source: string): Set<string> {
  return new Set(
    [...source.matchAll(/import\s+(\w+)\s+from\s+['"][^'"]+['"]/g)].map((m) => m[1])
  )
}

const libraryFiles = walkVueFiles(join(REPO_ROOT, 'packages/ui/src'))
const demoTemplateFiles = [
  ...walkVueFiles(join(REPO_ROOT, 'packages/demo/src')),
  ...walkVueFiles(join(REPO_ROOT, 'docs/.vitepress/theme/demos'))
]

describe('Lynx 模板标签白名单', () => {
  it('组件库模板只使用 Lynx 内置元素（禁止 block/div/span 等）', () => {
    const violations: string[] = []

    for (const file of libraryFiles) {
      const template = stripComments(templateOf(readFileSync(file, 'utf8')))
      for (const tag of tagsOf(template)) {
        // wd-* 是组件标签，由 tag-transform loader 转 PascalCase，另行校验
        if (tag.startsWith('wd-')) continue
        if (VUE_BUILTIN_TAGS.has(tag) || LYNX_NATIVE_TAGS.has(tag)) continue
        const hint = tag === 'block' ? '（uni-app 占位标签，请改用 <template>）' : HTML_TAGS.has(tag) ? '（HTML 标签，不是 Lynx 元素）' : ''
        violations.push(`${relative(REPO_ROOT, file)}: <${tag}>${hint}`)
      }
    }

    expect(violations, `以下标签会在真机触发 603 "Can't find ui tag"：\n${violations.join('\n')}`).toEqual([])
    // 全库模板扫描（~110 文件 × 解析）：空载 2–5s，并行高负载实测 19s
  }, 30_000)

  it('demo 模板只使用 Lynx 内置元素', () => {
    const violations: string[] = []

    for (const file of demoTemplateFiles) {
      const template = stripComments(templateOf(readFileSync(file, 'utf8')))
      for (const tag of tagsOf(template)) {
        if (tag.startsWith('wd-')) continue
        if (VUE_BUILTIN_TAGS.has(tag) || LYNX_NATIVE_TAGS.has(tag)) continue
        violations.push(`${relative(REPO_ROOT, file)}: <${tag}>`)
      }
    }

    expect(violations, `以下标签会在真机触发 603 "Can't find ui tag"：\n${violations.join('\n')}`).toEqual([])
    // 全库模板扫描（~110 文件 × 解析）：空载 2–5s，并行高负载实测 19s
  }, 30_000)

  it('组件库内每个 wd-* 标签都有同名 PascalCase 导入', () => {
    const violations: string[] = []

    for (const file of libraryFiles) {
      const source = readFileSync(file, 'utf8')
      const template = stripComments(templateOf(source))
      const bindings = importBindings(source)
      for (const tag of new Set(tagsOf(template).filter((tag) => tag.startsWith('wd-')))) {
        if (!bindings.has(pascal(tag))) {
          violations.push(`${relative(REPO_ROOT, file)}: <${tag}> 缺少 import ${pascal(tag)}`)
        }
      }
    }

    expect(
      violations,
      `未导入的组件标签会退化为原生元素并触发 603：\n${violations.join('\n')}`
    ).toEqual([])
    // 全库模板扫一遍（~110 文件 × 解析），空载 ~0.6s、高负载实测 5.6s，
    // 会撞默认 5s 上限。放宽的是这一条的重活预算，不是全局守卫。
  }, 30_000)

  it('组件库不依赖可选 tag-transform 插件：内部组件直接使用 PascalCase', () => {
    const violations: string[] = []
    for (const file of libraryFiles) {
      const template = stripComments(templateOf(readFileSync(file, 'utf8')))
      for (const tag of new Set(tagsOf(template).filter((tag) => tag.startsWith('wd-')))) {
        violations.push(`${relative(REPO_ROOT, file)}: <${tag}> 应写为 <${pascal(tag)}>`)
      }
    }
    expect(violations, `库内 kebab-case 组件会被原生编译器当作 Lynx 元素：\n${violations.join('\n')}`).toEqual([])
  }, 30_000)

  it('demo / 文档演示中的 wd-* 标签都能对应到真实组件目录', () => {
    const dirs = componentDirs()
    const violations: string[] = []

    for (const file of demoTemplateFiles) {
      const template = stripComments(templateOf(readFileSync(file, 'utf8')))
      for (const tag of new Set(tagsOf(template).filter((tag) => tag.startsWith('wd-')))) {
        if (!dirs.has(tag)) {
          violations.push(`${relative(REPO_ROOT, file)}: <${tag}> 没有对应的 src/{primitives,components}/${tag}/`)
        }
      }
    }

    expect(violations, `拼错的组件标签会退化为原生元素并触发 603：\n${violations.join('\n')}`).toEqual([])
  }, 30_000)
})

describe('wd-select-picker 渲染不再产生未知原生标签', () => {
  it('visible 时内容正常渲染且无 "Failed to resolve component" 告警', async () => {
    const capture = captureConsole()
    try {
      // visible 打开（部分 picker 的 visible watcher 非 immediate，挂载后翻转）
      const visible = ref(false)
      const App = {
        setup() {
          return () =>
            h(SelectPicker as any, {
              modelValue: '',
              visible: visible.value,
              type: 'radio',
              columns: [
                { value: 'fruit', label: '水果' },
                { value: 'veg', label: '蔬菜' }
              ]
            })
        }
      }
      const { container } = render(App as any)
      visible.value = true
      await nextTick()
      await nextTick()

      // 内容区真实渲染（用的是 <template v-else>，不再有 block 包裹层）
      const radioList = container.querySelector('.wd-select-picker__radio')
      expect(radioList, '选择器内容应渲染').not.toBeNull()
      expect(container.querySelectorAll('.wd-select-picker__radio-item').length).toBe(2)

      // 回归点：<block> 会让 Vue 报 "Failed to resolve component: block"，
      // 在真机上则直接是 603 "Can't find ui tag"
      const unresolved = capture.messages.filter((message) => /Failed to resolve component/.test(message))
      expect(unresolved, `不得出现组件解析失败：${unresolved.join('\n')}`).toEqual([])
    } finally {
      cleanup()
      capture.restore()
    }
  })
})
