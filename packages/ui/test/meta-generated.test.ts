/**
 * meta.json 契约一致性 — P3.1（ADR-017）。
 *
 * 这些断言**不验证「内容对不对」**（内容由源码决定，人改不了），而是防止
 * 推导器**静默失效**。gen-meta 的解析器按写法形态匹配，遇到没覆盖的写法时
 * 会安静地返回空数组，产出一份「看起来正常、实际缺字段」的契约——下游
 * 文档生成、API 变更检测都会跟着错，而且不会有任何报错。
 *
 * 历史证据（本轮实现中实际发生的三次）：
 *   - 首版漏 10 个组件的 events：`defineEmits<{ open: [] }>` 键元组写法
 *   - 次版漏 4 个：类型字面量成员**只用换行分隔、不写逗号/分号**
 *   - 三版漏 2 个：`defineEmits<Foo & { tap: [any] }>()` 交叉类型
 * 三次都没有报错，全部靠「源码里有 emit 调用，meta 里必须有该事件」发现。
 *
 * 因此这里的检测逻辑**独立实现**，不 import gen-meta 里的函数：复用会让
 * 同一个 bug 同时污染生产者和校验者，测试就失去意义了。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compRead, findComponentDir, listComponents } from './helpers/component-roots'

interface MetaProp {
  name: string
  type?: string
  default?: string
  required?: boolean
  options?: string
  description?: string
}

interface MetaComponent {
  name: string
  layer: 'primitives' | 'components'
  family: string | null
  modelValue: boolean
  props: MetaProp[]
  events: string[]
  slots: string[]
}

const META_PATH = join(__dirname, '..', 'meta.json')
const meta = JSON.parse(readFileSync(META_PATH, 'utf8')) as Record<string, MetaComponent>
const componentNames = Object.keys(meta)

/** 源码里 `emit('x')` / `emit("x")` 的全部事件名 */
function emitCallsOf(src: string): string[] {
  const names: string[] = []
  // 排除 `_emit(` / `myemit(` / `$emit(` 之类的成员调用
  for (const m of src.matchAll(/(?<![\w$.])emit\(\s*['"]([^'"]+)['"]/g)) names.push(m[1])
  return [...new Set(names)]
}

/** 模板段里的插槽名（未命名记为 default） */
function slotNamesOf(src: string): string[] {
  const start = src.indexOf('<template>')
  const body = start >= 0 ? src.slice(start) : src
  const names: string[] = []
  for (const m of body.matchAll(/<slot\b([^>]*)>/g)) {
    const named = /\bname\s*=\s*"([^"]+)"/.exec(m[1])
    names.push(named ? named[1] : 'default')
  }
  return [...new Set(names)]
}

/**
 * 从 `types.ts` 里扫出 props 对象的顶层键。
 *
 * 刻意用与 gen-meta **不同的实现**（行首 2 空格缩进的启发式，而不是状态机）：
 * 两条独立路径得出同一答案才算验证，复用同一份逻辑只能证明「代码跑过了」。
 * 仓库的 props 对象顶层键统一 2 空格缩进，JSDoc 行是 `   * ` 或 `  /**`，
 * 第三个字符不是标识符，不会被误抓。
 */
function topLevelPropNames(typesSrc: string): string[] {
  const head = /export\s+const\s+[A-Za-z_$][\w$]*Props\s*=\s*\{/.exec(typesSrc)
  if (!head) return []
  const open = head.index + head[0].length - 1

  let depth = 0
  let close = -1
  for (let i = open; i < typesSrc.length; i++) {
    const ch = typesSrc[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch
      i++
      while (i < typesSrc.length && typesSrc[i] !== quote) {
        if (typesSrc[i] === '\\') i++
        i++
      }
      continue
    }
    if (ch === '{' || ch === '(' || ch === '[') depth++
    else if (ch === '}' || ch === ')' || ch === ']') {
      depth--
      if (depth === 0) {
        close = i
        break
      }
    }
  }
  if (close < 0) return []

  const body = typesSrc.slice(open + 1, close)
  const names: string[] = []
  for (const m of body.matchAll(/^ {2}([A-Za-z_$][\w$]*)\s*:/gm)) names.push(m[1])
  return [...new Set(names)]
}

describe('meta.json 覆盖范围', () => {
  it('组件集合与源码目录一致', () => {
    expect(componentNames.sort()).toEqual(listComponents())
  })

  it('每个组件都有完整的顶层字段', () => {
    for (const name of componentNames) {
      const c = meta[name]
      expect(c.name, `${name}.name`).toBe(name)
      expect(['primitives', 'components'], `${name}.layer`).toContain(c.layer)
      expect(Array.isArray(c.props), `${name}.props`).toBe(true)
      expect(Array.isArray(c.events), `${name}.events`).toBe(true)
      expect(Array.isArray(c.slots), `${name}.slots`).toBe(true)
    }
  })

  it('layer 与所在目录一致', () => {
    for (const name of componentNames) {
      const dir = findComponentDir(name)
      expect(dir, `${name} 目录`).not.toBeNull()
      const layer = dir!.includes(`${'primitives'}`) ? 'primitives' : 'components'
      expect(meta[name].layer, `${name}.layer`).toBe(layer)
    }
  })
})

describe('meta.json 解析完整性（防静默失效）', () => {
  it('源码里有 emit 调用的事件必须出现在 events 里', () => {
    const failures: string[] = []
    for (const name of componentNames) {
      const src = compRead(name, `${name}.vue`)
      const calls = emitCallsOf(src)
      const missing = calls.filter((e) => !meta[name].events.includes(e))
      if (missing.length) failures.push(`${name}: 缺 ${missing.join(', ')}`)
    }
    expect(failures, '解析器漏掉了这些 emit 调用').toEqual([])
  })

  it('源码里有 <slot> 的组件，slots 必须非空', () => {
    const failures: string[] = []
    for (const name of componentNames) {
      const src = compRead(name, `${name}.vue`)
      const expected = slotNamesOf(src)
      if (expected.length === 0) continue
      const missing = expected.filter((s) => !meta[name].slots.includes(s))
      if (missing.length) failures.push(`${name}: 缺 ${missing.join(', ')}`)
    }
    expect(failures, '解析器漏掉了这些插槽').toEqual([])
  })

  it('源码里定义的 prop 必须出现在 props 里', () => {
    // 反向缺口：上面几条只查「meta 里的值对不对」，查不出「源码有、meta 没有」。
    // 实测把 wd-text.size 从 meta 删掉后，其余断言全绿——所以这条必须独立存在。
    // 只做子集断言：meta 会多出 baseProps 展开的键（customStyle/customClass），
    // 那些不在组件自己的 types.ts 里。
    const failures: string[] = []
    for (const name of componentNames) {
      const dir = findComponentDir(name)
      if (!dir) continue
      let typesSrc: string
      try {
        typesSrc = compRead(name, 'types.ts')
      } catch {
        continue // 没有 types.ts 的组件，props 只能来自别处
      }
      const expected = topLevelPropNames(typesSrc)
      const actual = meta[name].props.map((p) => p.name)
      const missing = expected.filter((p) => !actual.includes(p))
      if (missing.length) failures.push(`${name}: 缺 ${missing.join(', ')}`)
    }
    expect(failures, '解析器漏掉了这些 prop').toEqual([])
  })

  it('每个 prop 都有类型与描述', () => {
    const noType: string[] = []
    const noDesc: string[] = []
    for (const name of componentNames) {
      for (const p of meta[name].props) {
        if (!p.type) noType.push(`${name}.${p.name}`)
        if (!p.description) noDesc.push(`${name}.${p.name}`)
      }
    }
    expect(noType, '无类型会让文档表格出现空格').toEqual([])
    expect(noDesc, '无描述会让文档表格出现空格').toEqual([])
  })

  it('prop 的默认值不能是人话（`继承自 xxx` / `-`）', () => {
    // JSDoc 里的 `默认值:` 行混有人类描述，被误当成字面量写进契约后，
    // 文档会显示「默认值 = 继承自 wd-checkbox-group」这种错误。
    const bad: string[] = []
    for (const name of componentNames) {
      for (const p of meta[name].props) {
        if (p.default === undefined) continue
        if (/继承|默认|见 |同 |参考/.test(p.default)) bad.push(`${name}.${p.name} = ${p.default}`)
        if (p.default === '-') bad.push(`${name}.${p.name} = -`)
      }
    }
    expect(bad).toEqual([])
  })
})

describe('meta.json 语义自洽', () => {
  it('families.json 的每个成员都能在 meta 里找到对应族', () => {
    const raw = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', 'docs', 'architecture', 'families.json'), 'utf8')
    ) as { families: { id: string; members?: string[] }[] }

    const failures: string[] = []
    for (const family of raw.families) {
      for (const member of family.members ?? []) {
        if (!meta[member]) {
          failures.push(`${member}（族 ${family.id}）不在 meta 里`)
        } else if (meta[member].family !== family.id) {
          failures.push(`${member} 的 family 是 ${meta[member].family}，families.json 写的是 ${family.id}`)
        }
      }
    }
    expect(failures).toEqual([])
  })

  it('modelValue 标记与 props/events 一致', () => {
    for (const name of componentNames) {
      const c = meta[name]
      const expected = c.props.some((p) => p.name === 'modelValue') && c.events.includes('update:modelValue')
      expect(c.modelValue, `${name}.modelValue`).toBe(expected)
    }
  })

  it('events / slots 无重复项', () => {
    for (const name of componentNames) {
      expect(new Set(meta[name].events).size, `${name}.events 有重复`).toBe(meta[name].events.length)
      expect(new Set(meta[name].slots).size, `${name}.slots 有重复`).toBe(meta[name].slots.length)
      const propNames = meta[name].props.map((p) => p.name)
      expect(new Set(propNames).size, `${name}.props 有重复`).toBe(propNames.length)
    }
  })
})
