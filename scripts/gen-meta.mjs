#!/usr/bin/env node
/**
 * gen-meta.mjs — 从源码**推导**组件契约，产出 `packages/ui/meta.json`。
 *
 * ## 为什么是「推导」而不是「人工维护」
 *
 * ADR-006 的结论：契约字段里只有 5 个需要人判断（domain / tier / status /
 * a11y / wotCompat），其余全部可从代码得到。若靠人工写 106 份骨架，成本是
 * 「106 × 20 分钟」，而且**写的时候就会与代码不一致**——那正是本仓库反复
 * 出现的文档漂移问题。
 *
 * 因此本脚本只推导「代码里已经存在的事实」：
 *
 * | 字段 | 来源 |
 * |---|---|
 * | `name` / `layer` | 目录结构（primitives / components） |
 * | `family` | `docs/architecture/families.json`（ADR-013 的单一来源） |
 * | `props` | `types.ts` 里唯一的 `<x>Props` 对象字面量 + 前置 JSDoc |
 * | `events` | `.vue` 的 `defineEmits([...])` |
 * | `slots` | `.vue` 模板里的 `<slot>` / `<slot name="x">` |
 * | `modelValue` | props 含 `modelValue` 且 events 含 `update:modelValue` |
 *
 * 不推导任何「语义判断」（是否废弃、可访问性等级等）：那类信息代码里没有，
 * 猜出来的 meta 比没有 meta 更糟。
 *
 * ## 产物是 JSON 而不是 .ts
 *
 * ADR-006 原计划 `meta.generated.ts`。实测 106 个组件约 1300 个 prop，写成
 * 字面量类型后会被 `vue-tsc` 全量类型检查（拖慢 typecheck），并且把 100+ KB
 * 的类型面暴露给消费者，而**当前没有任何 TS 消费者**。JSON 更诚实：它是数据，
 * 不是类型；脚本直接读，AI/IDE 也能直接消费。将来真出现 TS 消费者，
 * 再加一个薄 `.d.ts` 或 typed accessor 即可。
 *
 * ## 用法
 *
 *   node scripts/gen-meta.mjs           # 重新生成
 *   node scripts/gen-meta.mjs --check   # CI：与代码不一致则 exit 1
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const UI_SRC = path.join(ROOT, 'packages/ui/src')
const OUT_FILE = path.join(ROOT, 'packages/ui/meta.json')
const FAMILIES_FILE = path.join(ROOT, 'docs/architecture/families.json')

/** 两个组件根，顺序决定产物顺序（基础件在前） */
const ROOTS = [
  { dir: 'primitives', layer: 'primitives' },
  { dir: 'components', layer: 'components' }
]

const checkMode = process.argv.includes('--check')

// ---------------------------------------------------------------------------
// 通用扫描工具
// ---------------------------------------------------------------------------

/**
 * 从 `openIndex`（指向 `{`）起找到配对的 `}`，返回其索引。
 * 跳过行注释、块注释与字符串，避免 `}` 出现在它们内部时误判。
 */
function findMatchingBrace(src, openIndex) {
  let depth = 0
  for (let i = openIndex; i < src.length; i++) {
    const ch = src[i]
    if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i)
      if (nl < 0) return -1
      i = nl
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      if (end < 0) return -1
      i = end + 1
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(src, i)
      if (i < 0) return -1
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** 返回字符串字面量结束引号的索引（含转义处理） */
function skipString(src, start) {
  const quote = src[start]
  for (let i = start + 1; i < src.length; i++) {
    if (src[i] === '\\') {
      i++
      continue
    }
    if (src[i] === quote) return i
  }
  return -1
}

/**
 * 在对象字面量内部（depth 1）收集顶层键名与展开项。
 * 返回 { keys: [{name, index}], spreads: [name] }
 *
 * 用状态机而不是「向前看前一个非空字符」：键前面可能是 JSDoc 块、行注释、
 * 逗号或对象起始花括号，用 lookback 判断会把 JSDoc 之后的第一个键全部漏掉
 * （首版实现就漏了全部 1300 个 prop）。
 */
function collectTopLevelKeys(src, openIndex, closeIndex) {
  const keys = []
  const spreads = []
  let depth = 0
  /** 当前位置是否「可以是一个键」：对象起始、逗号之后、注释之后 */
  let canBeKey = false

  for (let i = openIndex; i <= closeIndex; i++) {
    const ch = src[i]

    if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i)
      if (nl < 0) break
      i = nl
      if (depth === 1) canBeKey = true
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      if (end < 0) break
      i = end + 1
      if (depth === 1) canBeKey = true
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(src, i)
      if (i < 0) break
      canBeKey = false
      continue
    }
    if (ch === '{' || ch === '(' || ch === '[') {
      depth++
      canBeKey = depth === 1
      continue
    }
    if (ch === '}' || ch === ')' || ch === ']') {
      depth--
      canBeKey = false
      continue
    }
    if (depth !== 1) continue

    if (ch === ',') {
      canBeKey = true
      continue
    }
    if (ch === '.' && src.startsWith('...', i)) {
      const m = /^\.\.\.\s*([A-Za-z_$][\w$]*)/.exec(src.slice(i, i + 64))
      if (m) {
        spreads.push(m[1])
        i += m[0].length - 1
        canBeKey = false
      }
      continue
    }
    if (/\s/.test(ch)) continue

    if (canBeKey && /[A-Za-z_$]/.test(ch)) {
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(src.slice(i, i + 128))
      if (m) {
        keys.push({ name: m[1], index: i })
        i += m[1].length
      }
      canBeKey = false
      continue
    }
    canBeKey = false
  }
  return { keys, spreads }
}

/** 取紧邻 `index` 之前的 `/** ... *\/` 块内容；没有则返回 null */
function jsdocBefore(src, index) {
  let i = index - 1
  while (i >= 0 && /\s/.test(src[i])) i--
  if (i < 1 || src[i] !== '/' || src[i - 1] !== '*') return null
  const end = i - 1 // 指向 '*'
  const start = src.lastIndexOf('/**', end)
  if (start < 0) return null
  return src.slice(start + 3, end - 1)
}

/**
 * JSDoc 的 `默认值:` 行只在「看起来是字面量」时才可信。
 *
 * 实际出现的非字面量写法：`-`（27 处，表示「无默认值」）、`继承自
 * wd-checkbox-group`（8 处）、`空字符串`、`国际化文案`——这些是**人话**，
 * 直接写进契约会让文档表格出现「默认值 = 继承自 xxx」这种错误。
 */
function isLiteralDefault(text) {
  const t = text.trim()
  if (/^(?:true|false|null|undefined|\[\]|\{\})$/.test(t)) return true
  if (/^-?\d+(?:\.\d+)?$/.test(t)) return true
  return /^'[^']*'$/.test(t) || /^"[^"]*"$/.test(t)
}

/** JSDoc 的 `类型:` 行：含中文的是描述（`number 或 string（…）`），不是类型 */
function isTypeExpression(text) {
  const t = text.trim()
  if (!t || t === '-' || /[\u4e00-\u9fa5]/.test(t)) return false
  return /^[A-Za-z_$[(]/.test(t)
}

/** JSDoc → { description, type?, default?, options? } */
function parseJsdoc(raw) {
  if (!raw) return { description: '' }
  const desc = []
  const meta = {}
  for (const line of raw.split('\n')) {
    const text = line.replace(/^\s*\*?\s?/, '').trim()
    if (!text) continue
    const m = /^(类型|默认值|可选值)[:：]\s*(.+)$/.exec(text)
    if (m) {
      const value = m[2].trim()
      if (m[1] === '类型') {
        if (isTypeExpression(value)) meta.type = value
      } else if (m[1] === '默认值') {
        // `undefined` 与代码里的 `void 0` 同义：都表示「没有默认值」
        if (isLiteralDefault(value) && value !== 'undefined') meta.default = value
      } else if (value !== '-') {
        meta.options = value
      }
      continue
    }
    desc.push(text)
  }
  return { description: desc.join(' ').replace(/\s+/g, ' ').trim(), ...meta }
}

// ---------------------------------------------------------------------------
// props
// ---------------------------------------------------------------------------

/** Vue 简写类型的归一化映射 */
const SIMPLE_PROP_TYPES = {
  Boolean: 'boolean',
  String: 'string',
  Number: 'number',
  Array: 'array',
  Object: 'object',
  Function: 'function',
  Date: 'date'
}

/** `makeXxxProp` 工厂 → 运行时类型（定义见 common/props.ts） */
const MAKE_PROP_TYPES = {
  makeBooleanProp: 'boolean',
  makeStringProp: 'string',
  makeNumberProp: 'number',
  makeNumericProp: 'number | string',
  makeArrayProp: 'array'
}

/**
 * `common/props.ts` 里导出的共享 prop 常量。它们是**值**不是类型，
 * 不能靠 `SIMPLE_PROP_TYPES` 的简写规则识别，必须按定义展开：
 * `numericProp = [Number, String]`、`truthProp = { type: Boolean, default: true }`。
 */
const SHARED_PROP_CONSTS = {
  numericProp: { type: 'number | string' },
  truthProp: { type: 'boolean', default: 'true' },
  unknownProp: { type: 'unknown' }
}

/**
 * 取某个键的**值文本**：从键名后的 `:` 起，到下一个 depth 0 的 `,` 或外层
 * `}` 止。跳过字符串与注释，避免把字符串里的逗号当成分隔符。
 */
function propValueText(src, keyIndex) {
  let i = keyIndex
  while (i < src.length && src[i] !== ':') i++
  if (i >= src.length) return ''
  const start = ++i

  let depth = 0
  for (; i < src.length; i++) {
    const ch = src[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      const end = skipString(src, i)
      if (end < 0) break
      i = end
      continue
    }
    if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i)
      if (nl < 0) break
      i = nl
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      if (end < 0) break
      i = end + 1
      continue
    }
    if (ch === '<') {
      // 泛型参数整体跳过：`makeArrayProp<Record<string, any>>()` 里的逗号
      // 在尖括号内，不跳过会把值截断成 `makeArrayProp<Record<string`。
      let d = 1
      let j = i + 1
      while (j < src.length && d > 0) {
        const c = src[j]
        if (c === "'" || c === '"' || c === '`') {
          const e2 = skipString(src, j)
          if (e2 < 0) break
          j = e2 + 1
          continue
        }
        if (c === '<') d++
        else if (c === '>') d--
        j++
      }
      if (d === 0) {
        i = j - 1
        continue
      }
    }
    if (ch === '{' || ch === '(' || ch === '[') depth++
    else if (ch === '}' || ch === ')' || ch === ']') {
      if (depth === 0) break
      depth--
    } else if (ch === ',' && depth === 0) break
  }
  return src.slice(start, i).trim()
}

/**
 * 类型表达式 → 展示用类型名。
 *
 * `String as PropType<ButtonType>` 取 `ButtonType` 而不是 `string`：前者是
 * 消费者在 IDE 里看到的类型，后者只是运行时校验器。运行时校验信息在这里
 * 没有增量价值（boolean/string 之类的简写已经足够表达）。
 */
function unwrapPropType(raw) {
  const text = raw.trim()
  if (!text) return undefined

  const asPropType = /^[\s\S]*?\bas\s+(?:unknown\s+as\s+)?PropType\s*<\s*([\s\S]+?)\s*>$/.exec(text)
  if (asPropType) return asPropType[1].trim()

  if (text.startsWith('[')) {
    const inner = text.slice(1, text.lastIndexOf(']'))
    const parts = inner
      .split(',')
      .map((s) => SIMPLE_PROP_TYPES[s.trim()] ?? s.trim())
      .filter(Boolean)
    return parts.length ? parts.join(' | ') : undefined
  }

  return SIMPLE_PROP_TYPES[text] ?? text
}

/**
 * 默认值表达式 → 展示用文本。`void 0` 视作「无默认值」而不是字符串
 * `undefined`：文档里那一格应该留空。
 */
function unwrapPropDefault(raw) {
  let text = raw.trim()
  if (!text || text === 'void 0' || text === 'undefined') return undefined

  const arrow = /^\(\s*\)\s*=>\s*([\s\S]+)$/.exec(text)
  if (arrow) text = arrow[1].trim()
  if (text.startsWith('(') && text.endsWith(')')) text = text.slice(1, -1).trim()
  // 对象/数组默认值展示成骨架即可，展开写会把文档表格撑坏
  if (text.startsWith('{')) return '{}'
  return text
}

/**
 * 一个 prop 的值文本 → { type, default, required }。
 *
 * 覆盖全仓实际出现的四种形态：
 *   1. 工厂：`makeBooleanProp(false)` / `makeArrayProp()`
 *   2. 字面量：`{ type: String, default: 'x' }`
 *   3. 简写：`foo: Boolean`
 *   4. 必填：`makeRequiredProp(String)`
 *
 * 认不出时返回空对象（不猜）。JSDoc 里的 `类型:` / `默认值:` 会兜底，
 * 两者都没有则该字段不出现。
 */
/** 跳过空白，返回第一个非空白字符索引 */
function skipWs(text, i) {
  while (i < text.length && /\s/.test(text[i])) i++
  return i
}

function normalizePropValue(valueText) {
  const text = valueText.trim()
  if (!text) return {}

  // 工厂形态手动解析而不是一条正则：`makeArrayProp<Record<string, any>>()`
  // 有两个连续的 `>`，`(?:<[^>]*>)?` 只能吃到第一个，导致整条匹配失败。
  const factoryHead = /^(make[A-Za-z]+Prop)\b/.exec(text)
  if (factoryHead) {
    const fn = factoryHead[1]
    let i = skipWs(text, factoryHead[0].length)

    if (text[i] === '<') {
      let d = 1
      i++
      while (i < text.length && d > 0) {
        const c = text[i]
        if (c === "'" || c === '"' || c === '`') {
          const end = skipString(text, i)
          if (end < 0) break
          i = end + 1
          continue
        }
        if (c === '<') d++
        else if (c === '>') d--
        i++
      }
      i = skipWs(text, i)
    }

    if (text[i] === '(' && text.endsWith(')')) {
      const args = text.slice(i + 1, -1).trim()
      if (fn === 'makeRequiredProp') return { type: unwrapPropType(args), required: true }
      const type = MAKE_PROP_TYPES[fn]
      const def = fn === 'makeArrayProp' ? '[]' : unwrapPropDefault(args)
      return { ...(type ? { type } : {}), ...(def === undefined ? {} : { default: def }) }
    }
  }

  // 对象字面量：{ type: X, default: Y, required: true }
  if (text.startsWith('{')) {
    const out = {}
    const typeM = /\btype\s*:\s*([\s\S]+?)(?=,\s*(?:default|required|validator)\b|\s*\}$)/.exec(text)
    if (typeM) out.type = unwrapPropType(typeM[1])
    const defM = /\bdefault\s*:\s*([\s\S]+?)(?=,\s*(?:required|validator|type)\b|\s*\}$)/.exec(text)
    if (defM) {
      const d = unwrapPropDefault(defM[1])
      if (d !== undefined) out.default = d
    }
    if (/\brequired\s*:\s*true\b/.test(text)) out.required = true
    return out
  }

  // 共享常量：`numericProp` / `truthProp` / `unknownProp`
  if (SHARED_PROP_CONSTS[text]) return { ...SHARED_PROP_CONSTS[text] }

  // 简写：`foo: Boolean`
  const short = SIMPLE_PROP_TYPES[text]
  if (short) return { type: short }

  // 裸类型表达式：`String as PropType<CardType>` / `ButtonType` / `[String, Number]`
  // 只认「首字母大写」或「以已知构造器开头的元组」——其余形态（函数签名等）
  // 不是合法的 Vue prop 声明，猜了只会污染契约。
  if (/^(?:[A-Z]|\[(?:String|Number|Boolean|Array|Object|Function|Date)\b)/.test(text)) {
    return { type: unwrapPropType(text) }
  }

  return {}
}

/** 解析某个 props 常量对象；递归展开 baseProps */
function parsePropsObject(src, constName, seen = new Set()) {
  if (seen.has(constName)) return []
  seen.add(constName)

  const re = new RegExp(`export\\s+const\\s+${constName}\\s*=\\s*\\{`)
  const m = re.exec(src)
  if (!m) return []
  const openIndex = m.index + m[0].length - 1
  const closeIndex = findMatchingBrace(src, openIndex)
  if (closeIndex < 0) return []

  const { keys, spreads } = collectTopLevelKeys(src, openIndex, closeIndex)
  /**
   * 按 JS 的对象展开语义去重：`{ ...baseProps, customStyle: X }` 里后写的
   * 覆盖先写的，但**键位置不变**。`wd-text` 就重新定义了 baseProps 的
   * `customStyle` / `customClass`，不去重会产出同名 prop 两次。
   */
  const byName = new Map()

  for (const spread of spreads) {
    // 目前只有 ...baseProps 一种展开（106 个组件里 104 个用它），
    // 其定义在 common/props.ts，用同一个解析器展开，避免硬编码字段。
    if (spread === 'baseProps') {
      const baseSrc = readFileSync(path.join(UI_SRC, 'common/props.ts'), 'utf8')
      for (const prop of parsePropsObject(baseSrc, 'baseProps', seen)) byName.set(prop.name, prop)
    }
  }

  for (const key of keys) {
    const doc = parseJsdoc(jsdocBefore(src, key.index))
    // 代码优先、JSDoc 兜底：JSDoc 是人写的会漂移，代码不会。
    const derived = normalizePropValue(propValueText(src, key.index))
    const merged = { ...doc }
    for (const [k, v] of Object.entries(derived)) {
      if (v !== undefined) merged[k] = v
    }
    byName.set(key.name, { name: key.name, ...merged })
  }

  return [...byName.values()]
}

// ---------------------------------------------------------------------------
// events / slots
// ---------------------------------------------------------------------------

/**
 * 从「事件类型体」里抽事件名。类型体有两种成员形态，都会出现在本仓库：
 *
 *   1. 调用签名：`(e: 'click', ev: any): void`
 *   2. 键元组：  `click: [{ index: number }]`（Vue 3.3+，全仓 10 个组件用）
 *
 * 两种形态可以混写，所以不能「先试 A 再试 B」，必须在一次扫描里同时识别。
 * 键名可能是引号包裹的（`'long-press'` / `'update:modelValue'`），也可能
 * 是裸标识符；嵌套层里的参数名（`{ index: number }` 的 `index`）**不是**
 * 事件名，因此只认 depth 1。
 *
 * 调用签名里的类型位置可以是联合字面量（`(e: 'a' | 'b', …)`），所以要把
 * `e:` 后面的类型表达式整段取出，再从中抓所有字符串字面量。
 */
function eventNamesFromTypeBody(src, openIndex, closeIndex) {
  const names = []
  let depth = 0
  /** 当前位置是否「可以是一个键」：类型体起始、`;` 或 `,` 之后、注释之后 */
  let canBeKey = false

  for (let i = openIndex; i <= closeIndex; i++) {
    const ch = src[i]

    if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i)
      if (nl < 0) break
      i = nl
      if (depth === 1) canBeKey = true
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      if (end < 0) break
      i = end + 1
      if (depth === 1) canBeKey = true
      continue
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      const end = skipString(src, i)
      if (end < 0) break
      // 引号键：后面必须紧跟 `:` 才算键，否则是某个类型的字面量
      if (depth === 1 && canBeKey && /^\s*:/.test(src.slice(end + 1, end + 8))) {
        names.push(src.slice(i + 1, end))
        i = end
        canBeKey = false
        continue
      }
      i = end
      canBeKey = false
      continue
    }

    // 调用签名：depth 1 的 `(` 只可能出现在这里（键元组的 `[` 已把 depth 推到 2）
    if (ch === '(') {
      if (depth === 1) {
        let d = 1
        let j = i + 1
        while (j <= closeIndex && d > 0) {
          const c = src[j]
          if (c === "'" || c === '"' || c === '`') {
            const e2 = skipString(src, j)
            if (e2 < 0) break
            j = e2 + 1
            continue
          }
          if (c === '(') d++
          else if (c === ')') d--
          j++
        }
        const sig = /^\s*e\s*:\s*([\s\S]+)$/.exec(src.slice(i + 1, j - 1))
        if (sig) {
          for (const lit of sig[1].matchAll(/['"]([^'"]+)['"]/g)) names.push(lit[1])
        }
        i = j - 1
        canBeKey = false
        continue
      }
      depth++
      canBeKey = false
      continue
    }

    if (ch === '{' || ch === '[') {
      depth++
      canBeKey = depth === 1
      continue
    }
    if (ch === '}' || ch === ']' || ch === ')') {
      depth--
      // 回到 depth 1 意味着上一个成员结束了。TS 类型字面量的成员**可以只用
      // 换行分隔、不写逗号或分号**（`open: []` 换行 `close: []`），只认
      // `,`/`;` 会把这类写法除第一个键外全部漏掉。
      canBeKey = depth === 1
      continue
    }
    if (depth !== 1) continue

    if (ch === ',' || ch === ';') {
      canBeKey = true
      continue
    }
    if (/\s/.test(ch)) continue

    if (canBeKey && /[A-Za-z_$]/.test(ch)) {
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(src.slice(i, i + 128))
      if (m) {
        names.push(m[1])
        i += m[1].length
        canBeKey = false
        continue
      }
    }
    canBeKey = false
  }
  return [...new Set(names)]
}

/**
 * 解析类型别名引用：`defineEmits<SliderEmits>()` 的 `SliderEmits` 定义在
 * 同目录的 `types.ts`（或 `common/types.ts`）里。
 *
 * 只在这两个位置找：事件类型别名没有理由散落到别处；找不到就返回 null，
 * 由调用方决定是报错还是留空——**不猜**。
 */
function resolveEventTypeAlias(alias, compDir) {
  const candidates = []
  try {
    for (const file of readdirSync(compDir)) {
      if (file.endsWith('.ts')) candidates.push(path.join(compDir, file))
    }
  } catch {
    /* 目录不存在则只试 common */
  }
  candidates.push(path.join(UI_SRC, 'common', 'types.ts'))

  for (const file of candidates) {
    if (!existsSync(file)) continue
    const src = readFileSync(file, 'utf8')
    const patterns = [
      new RegExp(`export\\s+type\\s+${alias}\\s*=\\s*\\{`),
      new RegExp(`export\\s+interface\\s+${alias}\\s*(?:extends[^{]*)?\\{`)
    ]
    for (const re of patterns) {
      const m = re.exec(src)
      if (!m) continue
      const openIndex = m.index + m[0].length - 1
      const closeIndex = findMatchingBrace(src, openIndex)
      if (closeIndex > openIndex) return { src, openIndex, closeIndex }
    }
  }
  return null
}

/**
 * 按顶层 `&` 切分交叉类型。`Foo & { tap: [any] }` 要拆成两项分别解析：
 * 只认第一项会把内联那半丢掉（`wd-sort-button` / `wd-swipe-action` 就是这种）。
 * 只切 depth 0 的 `&`，`{ a: X & Y }` 里的不切。
 */
function splitTopLevelAmp(expr) {
  const parts = []
  let depth = 0
  let start = 0
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      const end = skipString(expr, i)
      if (end < 0) break
      i = end
      continue
    }
    if (ch === '{' || ch === '[' || ch === '(' || ch === '<') depth++
    else if (ch === '}' || ch === ']' || ch === ')') depth--
    else if (ch === '>' && depth > 0) depth--
    else if (ch === '&' && depth === 0) {
      parts.push(expr.slice(start, i))
      start = i + 1
    }
  }
  parts.push(expr.slice(start))
  return parts
}

/**
 * `defineEmits` → 事件名数组。支持五种写法：
 *
 *   1. 数组：      `defineEmits(['click', 'tap'])`
 *   2. 内联签名：  `defineEmits<{ (e: 'click', ev: any): void }>()`
 *   3. 内联键元组：`defineEmits<{ open: []; 'long-press': [{ image: string }] }>()`
 *   4. 类型别名：  `defineEmits<SliderEmits>()`（别名在同目录 types.ts）
 *   5. 交叉类型：  `defineEmits<SliderEmits & { tap: [any] }>()`（2/3/4 的任意组合）
 *
 * 2–4 交给 `eventNamesFromTypeBody` 一次扫描完成；5 先按顶层 `&` 拆开，每项
 * 再按「以 `{` 开头 → 内联体 / 否则 → 类型别名」分流。
 *
 * 都匹配不到时返回空数组——比猜错安全。`test/meta-generated.test.ts` 会断言
 * 「`.vue` 里有 `emit(` 调用的组件，events 必须非空」，防止解析器静默失效后
 * 产出空契约（首版实现漏了 10 个组件、次版漏了 4 个、三版漏了 2 个，都是
 * 这条断言要防的情况）。
 */
function parseEvents(vueSrc, compDir) {
  const arrayForm = /defineEmits\s*\(\s*\[([\s\S]*?)\]\s*\)/.exec(vueSrc)
  if (arrayForm) {
    return [...new Set([...arrayForm[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]))]
  }

  // 非贪婪 + 要求紧跟 `>()`：嵌套泛型（`Record<string, X>>()`）里的 `>` 后面
  // 不是 `(`，正则引擎会自动跳到真正闭合的那个。
  const generic = /defineEmits\s*<([\s\S]*?)>\s*\(\s*\)/.exec(vueSrc)
  if (!generic) return []

  const names = []
  for (const rawPart of splitTopLevelAmp(generic[1])) {
    const part = rawPart.trim()
    if (!part) continue

    if (part.startsWith('{')) {
      const close = findMatchingBrace(part, 0)
      if (close > 0) names.push(...eventNamesFromTypeBody(part, 0, close))
      continue
    }

    const resolved = resolveEventTypeAlias(part, compDir)
    if (resolved) {
      names.push(...eventNamesFromTypeBody(resolved.src, resolved.openIndex, resolved.closeIndex))
    } else {
      console.warn(`⚠ ${path.basename(compDir)}：defineEmits 里的 ${part} 找不到类型定义，该部分 events 留空`)
    }
  }
  return [...new Set(names)]
}

/** 模板里的 `<slot>` → 插槽名数组（默认插槽记为 'default'） */
function parseSlots(vueSrc) {
  // 只看 <template> 段，避免把脚本里的字符串误判成插槽
  const start = vueSrc.indexOf('<template>')
  const body = start >= 0 ? vueSrc.slice(start) : vueSrc
  const names = []
  for (const m of body.matchAll(/<slot\b([^>]*)>/g)) {
    const nameAttr = /\bname\s*=\s*"([^"]+)"/.exec(m[1])
    names.push(nameAttr ? nameAttr[1] : 'default')
  }
  return [...new Set(names)]
}

// ---------------------------------------------------------------------------
// 组件族（单一来源：families.json）
// ---------------------------------------------------------------------------
function loadFamilyMap() {
  const map = new Map()
  if (!existsSync(FAMILIES_FILE)) return map
  const raw = JSON.parse(readFileSync(FAMILIES_FILE, 'utf8'))
  for (const family of raw.families || []) {
    for (const member of family.members || []) map.set(member, family.id)
  }
  return map
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
const familyMap = loadFamilyMap()
const meta = {}

for (const { dir, layer } of ROOTS) {
  const baseDir = path.join(UI_SRC, dir)
  if (!existsSync(baseDir)) continue

  for (const name of readdirSync(baseDir).sort()) {
    if (!/^wd-/.test(name)) continue
    if (!statSync(path.join(baseDir, name)).isDirectory()) continue

    const typesPath = path.join(baseDir, name, 'types.ts')
    const vuePath = path.join(baseDir, name, `${name}.vue`)
    if (!existsSync(vuePath)) {
      console.error(`✖ ${name}：缺少 ${name}.vue，无法推导契约`)
      process.exit(1)
    }

    const vueSrc = readFileSync(vuePath, 'utf8')
    let props = []
    if (existsSync(typesPath)) {
      const typesSrc = readFileSync(typesPath, 'utf8')
      const constName = /export\s+const\s+([A-Za-z_$][\w$]*Props)\s*=\s*\{/.exec(typesSrc)?.[1]
      if (constName) props = parsePropsObject(typesSrc, constName)
    }

    const events = parseEvents(vueSrc, path.join(baseDir, name))
    const slots = parseSlots(vueSrc)

    meta[name] = {
      name,
      layer,
      family: familyMap.get(name) ?? null,
      modelValue: props.some((p) => p.name === 'modelValue') && events.includes('update:modelValue'),
      props,
      events,
      slots
    }
  }
}

/**
 * prop 字段的固定顺序。
 *
 * 对象键序取决于「JSDoc 给了什么 + 代码推出了什么」的组合，同一份数据可能
 * 排出两种键序，diff 里就会出现「整行变了但内容没变」。固定顺序后，diff
 * 只反映真实变更。
 */
const PROP_FIELD_ORDER = ['name', 'type', 'default', 'required', 'options', 'description']

function orderedProp(prop) {
  const out = {}
  for (const key of PROP_FIELD_ORDER) {
    if (prop[key] !== undefined) out[key] = prop[key]
  }
  // 未知字段也保留：宁可多出一个字段，也不要静默丢数据
  for (const [key, value] of Object.entries(prop)) {
    if (!(key in out) && value !== undefined) out[key] = value
  }
  return out
}

/**
 * 序列化。
 *
 * 不用 `JSON.stringify(meta, null, 2)`：106 个组件 × 平均 14 个 prop 时，
 * 逐层缩进产生的结构开销比数据本身还大（实测 258 KB，其中描述只占 77 KB）。
 *
 * 改为「结构缩进、每个 prop 一行」：
 *   - 体积接近紧凑 JSON；
 *   - diff 粒度落到**单个 prop**，API 变更清单可读（这正是 meta 的核心用途）。
 */
function serialize(allMeta) {
  const names = Object.keys(allMeta)
  const lines = ['{']
  names.forEach((name, index) => {
    const c = allMeta[name]
    lines.push(`  ${JSON.stringify(name)}: {`)
    const head = { name: c.name, layer: c.layer, family: c.family, modelValue: c.modelValue }
    for (const [key, value] of Object.entries(head)) {
      lines.push(`    ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
    }
    lines.push(`    "events": ${JSON.stringify(c.events)},`)
    lines.push(`    "slots": ${JSON.stringify(c.slots)},`)
    if (c.props.length === 0) {
      lines.push('    "props": []')
    } else {
      lines.push('    "props": [')
      c.props.forEach((prop, i) => {
        lines.push(`      ${JSON.stringify(orderedProp(prop))}${i === c.props.length - 1 ? '' : ','}`)
      })
      lines.push('    ]')
    }
    lines.push(`  }${index === names.length - 1 ? '' : ','}`)
  })
  lines.push('}')
  return lines.join('\n') + '\n'
}

const serialized = serialize(meta)

if (checkMode) {
  if (!existsSync(OUT_FILE)) {
    console.error('✖ packages/ui/meta.json 不存在。运行 node scripts/gen-meta.mjs 生成。')
    process.exit(1)
  }
  const current = readFileSync(OUT_FILE, 'utf8')
  if (current !== serialized) {
    const count = Object.keys(meta).length
    console.error(
      `✖ packages/ui/meta.json 与源码不一致（推导出 ${count} 个组件）。\n` +
        '  运行 node scripts/gen-meta.mjs 重新生成后提交。\n' +
        '  若这是有意变更，重新生成即可；meta.json 的 diff 就是 API 变更清单。'
    )
    process.exit(1)
  }
  console.log(`✅ meta.json 与源码一致（${Object.keys(meta).length} 个组件）`)
} else {
  writeFileSync(OUT_FILE, serialized)
  const bytes = Buffer.byteLength(serialized)
  const propCount = Object.values(meta).reduce((n, c) => n + c.props.length, 0)
  console.log(
    `generated packages/ui/meta.json — ${Object.keys(meta).length} 个组件 / ${propCount} 个 prop / ${(bytes / 1024).toFixed(1)} KB`
  )
}
