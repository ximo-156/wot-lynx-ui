import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { diffMeta, buildPlan, renderMarkdown, classifyTypeChange, splitTopLevel } from '../../../scripts/api-diff.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.join(HERE, 'fixtures/api-diff')

const readFixture = (name) => JSON.parse(readFileSync(path.join(FIXTURES, name), 'utf8'))

/**
 * 期望清单**手工写死**，不从 diffMeta 的返回值推导。
 *
 * 这是本文件的核心价值：如果哪天 diffMeta 少识别一类变更（比如漏了
 * `prop-options-removed`），写死的期望值会立刻失配。反过来，如果期望值也
 * 由 diffMeta 生成，测试就退化成「代码跑过了」，对解析/识别类缺陷毫无防御力。
 */
const EXPECTED = [
  ['wd-alpha', 'model-value-changed', null, 'major'],
  ['wd-alpha', 'event-removed', 'change', 'major'],
  ['wd-alpha', 'event-added', 'input', 'minor'],
  ['wd-alpha', 'slot-removed', 'default', 'major'],
  ['wd-alpha', 'slot-added', 'header', 'minor'],
  ['wd-alpha', 'prop-renamed', 'legacy', 'major'],
  ['wd-alpha', 'prop-options-removed', 'mode', 'major'],
  ['wd-alpha', 'prop-required-changed', 'strict', 'major'],
  ['wd-alpha', 'prop-description-changed', 'value', 'docs'],
  ['wd-alpha', 'prop-type-changed', 'value', 'minor'],
  ['wd-beta', 'component-layer-changed', null, 'major'],
  ['wd-beta', 'family-changed', null, 'patch'],
  ['wd-beta', 'prop-type-changed', 'count', 'major'],
  ['wd-beta', 'prop-added', 'hint', 'minor'],
  ['wd-beta', 'prop-added', 'items', 'major'],
  ['wd-beta', 'prop-default-changed', 'size', 'minor'],
  ['wd-delta', 'component-added', null, 'minor'],
  ['wd-gamma', 'component-removed', null, 'major']
]

const asTuple = (c) => [c.component, c.kind, c.target ?? null, c.severity]

describe('api-diff：语义 diff', () => {
  it('fixture 对产出 18 项，逐项与手写期望一致', () => {
    const changes = diffMeta(readFixture('base.json'), readFixture('head.json'))
    expect(changes.map(asTuple)).toEqual(EXPECTED)
  })

  it('完全相同的 meta 产出 0 项', () => {
    const meta = readFixture('base.json')
    expect(diffMeta(meta, meta)).toEqual([])
  })

  it('只改键顺序与缩进时产出 0 项（比较语义而非文本）', () => {
    const base = readFixture('base.json')
    // 把每个组件的键倒序、props 数组倒序：JSON 文本完全不同，语义完全相同
    const reordered = {}
    for (const name of Object.keys(base).reverse()) {
      const c = base[name]
      reordered[name] = {
        props: [...c.props].reverse(),
        slots: c.slots,
        events: c.events,
        modelValue: c.modelValue,
        family: c.family,
        layer: c.layer,
        name: c.name
      }
    }
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(base))
    expect(diffMeta(base, reordered)).toEqual([])
  })

  it('新增组件只报一条，不展开它的 props', () => {
    const changes = diffMeta({}, { 'wd-new': { name: 'wd-new', layer: 'components', props: [{ name: 'a' }] } })
    expect(changes).toHaveLength(1)
    expect(changes[0].kind).toBe('component-added')
  })

  it('新增必填 prop 是 major，可选 prop 是 minor', () => {
    const base = { 'wd-x': { name: 'wd-x', layer: 'components', props: [] } }
    const head = {
      'wd-x': {
        name: 'wd-x',
        layer: 'components',
        props: [
          { name: 'must', type: 'string', required: true },
          { name: 'may', type: 'string' }
        ]
      }
    }
    const byTarget = Object.fromEntries(diffMeta(base, head).map((c) => [c.target, c.severity]))
    expect(byTarget).toEqual({ must: 'major', may: 'minor' })
  })
})

describe('api-diff：改名识别', () => {
  it('类型/默认值/可选值全同 → 判定改名，折叠为一条 prop-renamed', () => {
    const base = { 'wd-x': { name: 'wd-x', layer: 'components', props: [{ name: 'oldName', type: 'number', default: '1' }] } }
    const head = { 'wd-x': { name: 'wd-x', layer: 'components', props: [{ name: 'newName', type: 'number', default: '1' }] } }
    const changes = diffMeta(base, head)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ kind: 'prop-renamed', before: 'oldName', after: 'newName', severity: 'major' })
  })

  it('类型不同 → 不判定改名，退回「删 + 加」两条', () => {
    const base = { 'wd-x': { name: 'wd-x', layer: 'components', props: [{ name: 'oldName', type: 'number', default: '1' }] } }
    const head = { 'wd-x': { name: 'wd-x', layer: 'components', props: [{ name: 'newName', type: 'string', default: '1' }] } }
    const kinds = diffMeta(base, head).map((c) => c.kind).sort()
    expect(kinds).toEqual(['prop-added', 'prop-removed'])
  })

  it('签名桶有歧义时不猜配对（2 删 2 加 → 4 条独立变更）', () => {
    const prop = (name) => ({ name, type: 'number', default: '1' })
    const base = { 'wd-x': { name: 'wd-x', layer: 'components', props: [prop('a'), prop('b')] } }
    const head = { 'wd-x': { name: 'wd-x', layer: 'components', props: [prop('c'), prop('d')] } }
    const changes = diffMeta(base, head)
    expect(changes).toHaveLength(4)
    expect(changes.some((c) => c.kind === 'prop-renamed')).toBe(false)
  })
})

describe('api-diff：类型比较', () => {
  it('联合类型按集合包含关系分类', () => {
    expect(classifyTypeChange('number', 'number')).toBe('same')
    expect(classifyTypeChange('number', 'number | string')).toBe('widened')
    expect(classifyTypeChange('number | string', 'number')).toBe('narrowed')
    expect(classifyTypeChange('number', 'string')).toBe('incompatible')
    expect(classifyTypeChange('number | string', 'boolean | number')).toBe('incompatible')
  })

  it('泛型里的逗号不被当成顶层分隔符', () => {
    expect(splitTopLevel('Record<string, any> | null', '|')).toEqual(['Record<string, any>', 'null'])
    expect(splitTopLevel('number | string', '|')).toEqual(['number', 'string'])
  })

  it('箭头函数类型里的 => 不影响括号配平', () => {
    // `=>` 的 `>` 若被当成闭合括号，深度会变 -1，后面的 `|` 就切不开
    expect(splitTopLevel('(() => void) | string', '|')).toEqual(['(() => void)', 'string'])
  })
})

describe('api-diff：迁移计划', () => {
  const changes = diffMeta(readFixture('base.json'), readFixture('head.json'))
  const plan = buildPlan(changes, { base: 'base.json', head: 'head.json' })

  it('只有 prop 改名进自动改写规则', () => {
    expect(plan.rules).toEqual([
      { kind: 'rename-prop', component: 'wd-alpha', from: 'legacy', to: 'modern' }
    ])
  })

  it('每条破坏性变更都有手工指引，且不与自动规则重复', () => {
    const manualKeys = plan.manual.map((m) => `${m.component}|${m.kind}|${m.target ?? ''}`)
    expect(manualKeys).not.toContain('wd-alpha|prop-renamed|legacy')
    // major 共 9 条，其中改名 1 条被规则接管 → 手工 8 条
    const majorCount = changes.filter((c) => c.severity === 'major').length
    expect(plan.manual).toHaveLength(majorCount - plan.rules.length)
    for (const m of plan.manual) expect(m.guidance.length).toBeGreaterThan(10)
  })
})

describe('api-diff：Markdown 渲染', () => {
  const changes = diffMeta(readFixture('base.json'), readFixture('head.json'))

  /** 按未转义的竖线切分表格行 */
  function cellsOf(row) {
    const out = []
    let cur = ''
    let escaped = false
    for (const ch of row) {
      if (escaped) {
        cur += ch
        escaped = false
        continue
      }
      if (ch === '\\') {
        cur += ch
        escaped = true
        continue
      }
      if (ch === '|') {
        out.push(cur)
        cur = ''
        continue
      }
      cur += ch
    }
    out.push(cur)
    return out.slice(1, -1)
  }

  it('默认不含文档变更，--include-docs 才显示', () => {
    const plain = renderMarkdown(changes, { base: 'b', head: 'h' })
    const withDocs = renderMarkdown(changes, { base: 'b', head: 'h' }, { includeDocs: true })
    expect(plain).not.toContain('prop-description-changed')
    expect(withDocs).toContain('prop-description-changed')
    expect(plain).toContain('共 17 项')
    expect(withDocs).toContain('共 18 项')
  })

  it('所有表格行与表头列数一致（竖线已转义）', () => {
    const md = renderMarkdown(changes, { base: 'b', head: 'h' }, { includeDocs: true })
    const lines = md.split('\n')
    let checked = 0
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('|')) continue
      const header = cellsOf(lines[i]).length
      let j = i + 1
      while (j < lines.length && lines[j].startsWith('|')) {
        if (!/^\|\s*-/.test(lines[j])) {
          expect(cellsOf(lines[j])).toHaveLength(header)
          checked++
        }
        j++
      }
      i = j
    }
    expect(checked).toBeGreaterThan(10)
  })

  it('无变更时给出明确文案而不是空表', () => {
    const md = renderMarkdown([], { base: 'b', head: 'h' })
    expect(md).toContain('无 API 变更')
    expect(md).not.toContain('| 组件 |')
  })

  it('只有描述变更时说明「另有 N 项描述变更」，不笼统说无变更', () => {
    const base = { 'wd-x': { name: 'wd-x', layer: 'components', props: [{ name: 'a', type: 'string', description: '旧' }] } }
    const head = { 'wd-x': { name: 'wd-x', layer: 'components', props: [{ name: 'a', type: 'string', description: '新' }] } }
    const changes = diffMeta(base, head)
    expect(changes).toHaveLength(1)
    const md = renderMarkdown(changes, { base: 'b', head: 'h' })
    expect(md).toContain('无契约变更')
    expect(md).toContain('1 项描述变更')
  })
})
