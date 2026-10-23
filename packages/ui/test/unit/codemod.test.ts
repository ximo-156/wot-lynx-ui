import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { rewriteSource, compileRules } from '../../../../scripts/codemod.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '../../../..')
const CODEMOD = path.join(REPO_ROOT, 'scripts/codemod.mjs')

/**
 * 构造 rewriteSource 需要的结构。
 *
 * 这里**必须调用生产的 `compileRules`**，不能自己复制一份正则构造逻辑：
 * 复制会让测试与生产各有一份边界断言，生产那份写错时测试照样绿。
 * 本轮负向验证就踩到了——去掉 `compileRules` 的 `(?=[\s=/>])` 边界后，
 * 测试因为走的是自己的副本，10 条全过。
 *
 * 与之相对，**期望输出仍是手写的字符串**：oracle 独立，实现共用。
 */
function rulesFor(map) {
  const compiled = new Map()
  for (const [component, list] of Object.entries(map)) {
    compiled.set(component, compileRules(list))
  }
  return compiled
}

describe('codemod：属性改写', () => {
  it('改写普通属性、`: ` 前缀、`v-bind:` 前缀，保留前缀', () => {
    const src = '<template><wd-alpha legacy="1" :legacy="a" v-bind:legacy="b" /></template>'
    const { text, count } = rewriteSource(src, rulesFor({ 'wd-alpha': [{ from: 'legacy', to: 'modern' }] }))
    expect(text).toBe('<template><wd-alpha modern="1" :modern="a" v-bind:modern="b" /></template>')
    expect(count).toBe(3)
  })

  it('驼峰与短横线两种拼写同时改写', () => {
    const src = '<template><wd-beta showZero="true" :show-zero="x" /></template>'
    const { text, count } = rewriteSource(src, rulesFor({ 'wd-beta': [{ from: 'showZero', to: 'showLeadingZero' }] }))
    expect(text).toBe('<template><wd-beta showLeadingZero="true" :show-leading-zero="x" /></template>')
    expect(count).toBe(2)
  })

  it('不误伤前缀/后缀相似的属性', () => {
    const src = '<template><wd-alpha :legacy-suffix="c" data-legacy="d" legacyExtra="e" /></template>'
    const { text, count } = rewriteSource(src, rulesFor({ 'wd-alpha': [{ from: 'legacy', to: 'modern' }] }))
    expect(text).toBe(src)
    expect(count).toBe(0)
  })

  it('不改属性值里的同名文本', () => {
    const src = '<template><wd-alpha title="legacy" /></template>'
    const { text } = rewriteSource(src, rulesFor({ 'wd-alpha': [{ from: 'legacy', to: 'modern' }] }))
    expect(text).toBe(src)
  })

  it('只改目标组件，别的组件上的同名属性不动', () => {
    const src = '<template><wd-alpha legacy="1" /><wd-beta legacy="2" /></template>'
    const { text } = rewriteSource(src, rulesFor({ 'wd-alpha': [{ from: 'legacy', to: 'modern' }] }))
    expect(text).toBe('<template><wd-alpha modern="1" /><wd-beta legacy="2" /></template>')
  })

  it('不改 script 与 style 块（同名局部变量是常态）', () => {
    const src = [
      '<template>',
      '  <wd-alpha legacy="1" />',
      '</template>',
      '<script setup>',
      'const legacy = 1',
      'const legacyHandler = () => legacy',
      '</script>',
      '<style>',
      '.legacy { color: red }',
      '</style>'
    ].join('\n')
    const { text, count } = rewriteSource(src, rulesFor({ 'wd-alpha': [{ from: 'legacy', to: 'modern' }] }))
    expect(count).toBe(1)
    expect(text).toContain('<wd-alpha modern="1" />')
    expect(text).toContain('const legacy = 1')
    expect(text).toContain('const legacyHandler = () => legacy')
    expect(text).toContain('.legacy { color: red }')
  })

  it('属性值里的 `>` 不会提前截断标签', () => {
    const src = '<template><wd-alpha title="a > b" legacy="1" /></template>'
    const { text, count } = rewriteSource(src, rulesFor({ 'wd-alpha': [{ from: 'legacy', to: 'modern' }] }))
    expect(text).toBe('<template><wd-alpha title="a > b" modern="1" /></template>')
    expect(count).toBe(1)
  })

  it('没有规则时原样返回', () => {
    const src = '<template><wd-alpha legacy="1" /></template>'
    const { text, count } = rewriteSource(src, new Map())
    expect(text).toBe(src)
    expect(count).toBe(0)
  })
})

describe('codemod：CLI 端到端', () => {
  let dir

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'wot-codemod-'))
    mkdirSync(path.join(dir, 'src'), { recursive: true })
    mkdirSync(path.join(dir, 'node_modules/fake'), { recursive: true })
    writeFileSync(
      path.join(dir, 'src/page.vue'),
      [
        '<template>',
        '  <wd-alpha :legacy="a" />',
        '</template>',
        '<script setup>',
        'const legacy = 1',
        '</script>'
      ].join('\n')
    )
    // node_modules 里的文件不应被扫到
    writeFileSync(path.join(dir, 'node_modules/fake/x.vue'), '<template><wd-alpha :legacy="z" /></template>')
    writeFileSync(
      path.join(dir, 'plan.json'),
      JSON.stringify({
        rules: [{ kind: 'rename-prop', component: 'wd-alpha', from: 'legacy', to: 'modern' }],
        manual: []
      })
    )
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('dry-run 不改文件，--write 才落盘，且第二次运行无命中（幂等）', () => {
    const run = (extra = []) =>
      execFileSync(process.execPath, [CODEMOD, '--plan', path.join(dir, 'plan.json'), '--dir', dir, ...extra], {
        encoding: 'utf8'
      })

    const target = path.join(dir, 'src/page.vue')
    const original = readFileSync(target, 'utf8')

    const dry = run()
    expect(readFileSync(target, 'utf8')).toBe(original)
    expect(dry).toContain('未写入')
    expect(dry).toContain('命中 1 个 / 1 处')
    // node_modules 被跳过，所以只扫到 1 个文件
    expect(dry).toContain('扫描 1 个文件')

    run(['--write'])
    const written = readFileSync(target, 'utf8')
    expect(written).toContain('<wd-alpha :modern="a" />')
    expect(written).toContain('const legacy = 1')

    const again = run()
    expect(again).toContain('命中 0 个')
    expect(again).toContain('未发现需要改写的用法')
  })

  it('计划里没有规则时明确提示，不静默成功', () => {
    const emptyPlan = path.join(dir, 'empty-plan.json')
    writeFileSync(emptyPlan, JSON.stringify({ rules: [], manual: [{ component: 'wd-x' }] }))
    const out = execFileSync(process.execPath, [CODEMOD, '--plan', emptyPlan, '--dir', dir], { encoding: 'utf8' })
    expect(out).toContain('没有可自动改写的规则')
    expect(out).toContain('1 项需人工确认')
  })
})
