#!/usr/bin/env node
/**
 * review-lint.mjs — wot-lynx-ui 规范静态检查
 *
 * 把 CONVENTIONS.md 中「可静态判断」的硬规则自动化，避免 102 个组件靠人肉记忆遵守 19 节规范。
 *
 * 用法：
 *   node scripts/review-lint.mjs                        # 全量检查
 *   node scripts/review-lint.mjs --changed origin/main  # 只检查本次改动涉及的文件
 *   node scripts/review-lint.mjs --errors-only          # 忽略警告
 *   node scripts/review-lint.mjs --summary              # 只输出按规则的统计（用于评估存量）
 *   node scripts/review-lint.mjs --update-baseline      # 生成存量豁免清单
 *   node scripts/review-lint.mjs --help
 *
 * 退出码：0 = 无错误；1 = 存在 error 级问题
 *
 * 设计原则：
 *   1. 规则必须「零误报」—— 宁可漏报交由人工，也不要制造噪音让人绕过门禁。
 *   2. 注释内容一律不参与检查（先把注释替换为等长空白，保持行号不变）。
 *   3. 与现状大面积冲突的规则降级为 warn，先决策再收紧。
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import process from 'node:process'

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const ROOT = process.cwd()
const SCAN_DIRS = ['packages/ui/src', 'packages/demo/src', 'packages/ui/test']
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.rspeedy', 'coverage', '.vitepress', '.preview'])
const SKIP_FILE_RE = /(^|\/)index\.css$/ // 生成物，不检查
const BASELINE_FILE = 'review-lint.baseline.json'

/** Lynx 原生标签（小写标签名视为原生元素） */
const LYNX_NATIVE_TAGS = new Set([
  'view', 'text', 'image', 'scroll-view', 'list', 'list-item',
  'swiper', 'swiper-item', 'input', 'textarea', 'svg', 'video', 'canvas'
])

// ---------------------------------------------------------------------------
// 命令行参数
// ---------------------------------------------------------------------------

const opts = {
  changed: null,
  errorsOnly: false,
  summary: false,
  updateBaseline: false,
  github: !!process.env.GITHUB_ACTIONS
}

for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a === '--changed') opts.changed = process.argv[++i] || 'origin/main'
  else if (a === '--errors-only') opts.errorsOnly = true
  else if (a === '--summary') opts.summary = true
  else if (a === '--update-baseline') opts.updateBaseline = true
  else if (a === '--github') opts.github = true
  else if (a === '--help' || a === '-h') { printHelp(); process.exit(0) }
}

function printHelp() {
  console.log(`
review-lint — wot-lynx-ui 规范静态检查

选项：
  --changed <ref>      只检查相对于 <ref> 改动的文件（默认 origin/main）
  --errors-only        只输出 error 级问题
  --summary            只输出按规则分组的统计
  --update-baseline    把当前所有问题写入 ${BASELINE_FILE} 作为存量豁免
  --github             额外输出 GitHub Actions 注解格式
  -h, --help           显示本帮助

规则来源：CONVENTIONS.md
检查清单：contributing/code-review/03-组件库专项检查清单.md
`)
}

// ---------------------------------------------------------------------------
// 规则定义
// ---------------------------------------------------------------------------

/**
 * 规则结构：
 *   id / ref（CONVENTIONS 出处）/ severity / message
 *   ext        适用的扩展名数组
 *   dirs       （可选）路径必须包含其中之一
 *   notDirs    （可选）路径不得包含其中任一
 *   kind       'line' | 'tag' | 'scss-block' | 'vue-header'
 *   pattern    kind === 'line' 时使用（逐行测试）
 */
const RULES = [
  // ================= §4 .vue 文件结构 =================
  {
    id: 'vue/import-from-vue',
    ref: '§4',
    severity: 'error',
    ext: ['.vue', '.ts'],
    kind: 'line',
    pattern: /from\s+['"]vue['"]/,
    message: "必须从 'vue-lynx' 导入，而非 'vue'（Lynx 运行时不同，会静默失效）"
  },
  {
    id: 'vue/no-style-block',
    ref: '§4',
    severity: 'error',
    ext: ['.vue'],
    // §4 是针对「组件库组件」的规定（packages/ui/src/components/<component>/）。
    // demo 是普通 Lynx 应用，由 rspeedy 编译，<style scoped> 属正常用法。
    dirs: ['packages/ui/src'],
    kind: 'line',
    pattern: /<style[\s>]/,
    message: "禁止 <style> 块 —— 样式须经 index.scss 构建后 import './index.css'"
  },
  {
    id: 'vue/no-conditional-compile',
    ref: '§4',
    severity: 'error',
    ext: ['.vue', '.ts'],
    kind: 'line',
    pattern: /^\s*\/\/\s*#(?:ifdef|ifndef|endif)/,
    message: '禁止 uni-app 条件编译残留（// #ifdef / #ifndef / #endif）'
  },
  {
    id: 'vue/string-style',
    ref: '§19',
    severity: 'error',
    ext: ['.vue'],
    kind: 'line',
    // 仅命中「绑定表达式本身是字符串字面量」的写法：
    //   :style="'top: 1px'"   :style="`height: ${h}px`"
    // 不命中 :style="parseStyle(x)" / :style="{...}" / :style="unitStyle"
    pattern: /:style=(?:"['`]|'["`])/,
    message: '字符串 :style 会被静默替换为 {}（样式全部消失）—— 必须用对象语法'
  },
  {
    id: 'js/mts',
    ref: '§10',
    severity: 'error',
    ext: ['.vue', '.ts'],
    notDirs: ['packages/ui/test'], // 回归测试本身会引用这些标识符
    kind: 'line',
    pattern: /main-thread-bind|useMainThreadRef|runOnMainThread|lynxWorkletImpl/,
    message: '禁止 Main Thread Script（可用性检测不可靠 + 跨线程注水时序竞争会导致崩溃）'
  },
  {
    id: 'js/no-debugger',
    ref: '§6',
    severity: 'error',
    ext: ['.vue', '.ts'],
    kind: 'line',
    pattern: /\bdebugger\b/,
    message: '残留调试代码：debugger'
  },
  {
    id: 'js/no-console',
    ref: '§6',
    severity: 'error',
    ext: ['.vue', '.ts'],
    // 仅约束组件库源码。demo 中 console.log 是刻意的「事件回显」演示手法，不属调试残留。
    dirs: ['packages/ui/src'],
    kind: 'line',
    pattern: /\bconsole\.(?:log|debug)\s*\(/,
    message: '残留调试代码：console.log / console.debug'
  },
  {
    id: 'js/ts-suppress',
    ref: '§F',
    severity: 'warn',
    ext: ['.vue', '.ts'],
    kind: 'line',
    pattern: /@ts-(?:ignore|expect-error|nocheck)/,
    message: '类型抑制指令必须附注释说明原因'
  },
  {
    id: 'js/any-type',
    ref: '§F',
    severity: 'warn',
    ext: ['.ts'],
    kind: 'line',
    pattern: /:\s*any\b/,
    message: '避免 any（本库 props 契约应精确表达）'
  },
  {
    id: 'perf/getrect-in-touchmove',
    ref: '§16',
    severity: 'warn',
    ext: ['.vue', '.ts'],
    kind: 'line',
    pattern: /(?:onTouchMove|handleTouchMove|onTouchmove)[\s\S]{0,600}?getRect\s*\(/,
    message: 'touchmove 热路径禁止 getRect（异步跨线程查询会摧毁跟手性）—— 应一次性度量并缓存'
  },

  // ================= §20 样式出口唯一（Style Funnel） =================
  //
  // 这两条规则检测的是缺陷的**必要条件**而非充分条件：`if (a) { style.top = … } else
  // if (b) { style.top = … }` 这类「各分支都写同一个键」的写法是安全的，但同样会被命中。
  // 全库约 5/59 属此类（wd-toast 的 position 分支、wd-transition 的 v-show display）。
  //
  // 按本脚本的设计原则「宁可漏报交由人工，也不要制造噪音让人绕过门禁」，故定级 warn：
  // 存量按 baseline 登记、增量在 PR 中可见。待存量组件全部迁移到 Style Funnel
  // （Phase 1，需先有视觉回归兜底）后，再收紧为 error。
  {
    id: 'style/conditional-key-write',
    ref: '§20',
    severity: 'warn',
    ext: ['.vue', '.ts'],
    dirs: ['packages/ui/src'],
    kind: 'line',
    // `if (cond) {` / `} else if (cond) {`，且紧随其后（下一个非空行）就是样式键写入
    pattern: /^\s*\}?\s*(?:else\s+)?if\s*\(.*\)\s*\{?\s*$/,
    lookahead: /(?:^|[^.\w$])(?:style|styles)\s*(?:\[[^\]]*\]|\.[A-Za-z_$][\w$]*)\s*=/,
    message:
      '条件写样式：Lynx 的 SetStyle 是逐属性合并语义，省略的键不会清除已应用的内联属性 → 条件由真转假时旧值残留（已致 wd-segmented / wd-picker-view / wd-toast / wd-fab / wd-transition / wd-swipe-action 六处缺陷）。改用 common/style.ts 的 resolveStyle + defineStyleKeys 输出完整键集'
  },
  {
    id: 'style/conditional-key-write-inline',
    ref: '§20',
    severity: 'warn',
    ext: ['.vue', '.ts'],
    dirs: ['packages/ui/src'],
    kind: 'line',
    // 单行内联写法：`if (cond) style.x = …`
    pattern: /^\s*(?:else\s+)?if\s*\([^)]*\)\s+(?:style|styles)\s*(?:\[[^\]]*\]|\.[A-Za-z_$][\w$]*)\s*=/,
    message:
      '条件写样式（内联形式）：同上，省略键不会清除旧内联值。改用 resolveStyle + defineStyleKeys'
  },

  // ================= §7 依赖方向（INV-1） =================
  //
  // ARCHITECTURE §2.3 / §3.1：依赖只能向上（components → composables → common → styles），
  // 下层不得 import 上层。历史上 `useSelection`（L3）曾 import
  // `components/wd-picker-view/types`（L4），把组件契约耦合进组合式层，
  // 导致 picker 类型无法在非组件场景复用。本规则把「文档约定」升级为机器约束。
  //
  // 只检查跨层 import：同层（如 common 内部）与相对工具模块不受影响。
  {
    id: 'dep-direction',
    ref: '§7',
    severity: 'error',
    ext: ['.ts', '.vue'],
    dirs: ['packages/ui/src/composables'],
    kind: 'line',
    pattern: /^\s*(?:import|export)\b[^\n]*\bfrom\s+['"][^'"]*\/components\//,
    message:
      '依赖方向反转：composables（L3）不得 import 组件（L4）。共享契约请下沉到 common（L2），再由组件侧 re-export（INV-1 / ARCHITECTURE §3.1）'
  },
  {
    id: 'dep-direction',
    ref: '§7',
    severity: 'error',
    ext: ['.ts', '.vue'],
    dirs: ['packages/ui/src/common', 'packages/ui/src/icons', 'packages/ui/src/locale'],
    kind: 'line',
    pattern: /^\s*(?:import|export)\b[^\n]*\bfrom\s+['"][^'"]*\/(?:components|composables)\//,
    message:
      '依赖方向反转：基础能力层（L2）不得 import 组件（L4）或组合式（L3）。需要共享的契约请留在本层（INV-1 / ARCHITECTURE §3.1）'
  },

  // ================= §5 SCSS =================
  {
    id: 'scss/no-pseudo-element',
    ref: '§5.4',
    severity: 'error',
    ext: ['.scss'],
    kind: 'line',
    pattern: /::(?:before|after)\b/,
    message: 'Lynx 不支持 ::before/::after —— 改用模板中的真实元素 + 类名（如 __bar / __hairline）'
  },
  {
    id: 'scss/no-important',
    ref: '§5.4',
    severity: 'error',
    ext: ['.scss'],
    kind: 'line',
    pattern: /!important/,
    message: 'Lynx 默认不支持 !important'
  },
  {
    id: 'scss/no-deep',
    ref: '§5.4',
    severity: 'error',
    ext: ['.scss'],
    kind: 'line',
    pattern: /(?::deep\(|::v-deep)/,
    message: '去掉 :deep()/::v-deep —— 全局样式直接写后代选择器'
  },
  {
    id: 'scss/no-structural-pseudo',
    ref: '§5.4',
    severity: 'error',
    ext: ['.scss'],
    kind: 'line',
    pattern: /:(?:nth-child|nth-of-type|first-child|last-child|first-of-type|last-of-type)\b/,
    message: 'Lynx 不支持结构伪类 —— 改用 v-for 索引生成类名或内联样式'
  },
  {
    id: 'scss/no-inline-display',
    ref: '§5.4 / §15',
    severity: 'error',
    ext: ['.scss'],
    kind: 'line',
    pattern: /display\s*:\s*(?:inline-flex|inline-block)\b/,
    message: 'Lynx 只认 flex/none/linear —— 改为 display: flex + flex-direction: row'
  },
  {
    id: 'scss/no-unsupported-css',
    ref: '§5.4',
    severity: 'error',
    ext: ['.scss'],
    kind: 'line',
    pattern: /(?:conic-gradient|-webkit-line-clamp|-webkit-box)/,
    message: 'Lynx 不支持该 CSS 特性 —— 需要替换方案'
  },
  {
    id: 'scss/no-box-shadow',
    ref: '§3',
    severity: 'error',
    ext: ['.scss'],
    kind: 'line',
    // 仅匹配「声明」形式，避免命中 @mixin 参数名
    pattern: /^\s*(?:box-shadow|-webkit-box-shadow)\s*:/,
    message: '禁用 box-shadow（Lynx 各端表现不一致）—— 层级用表面色 + --wd-border-1/2 描边'
  },
  {
    id: 'scss/no-wot-token',
    ref: '§5.1',
    severity: 'error',
    ext: ['.scss'],
    kind: 'line',
    pattern: /--wot-/,
    message: '禁止引用已删除的 --wot-* 体系 —— 改用 --wd-* 语义令牌'
  },
  {
    id: 'scss/flex-direction-without-display',
    ref: '§15',
    severity: 'warn',
    ext: ['.scss'],
    kind: 'scss-block',
    message: '使用了 flex-direction 但当前规则与祖先规则均未声明 display: flex（Lynx 3.x 默认 linear 布局，声明会被静默丢弃）'
  },

  // ================= §8 SVG 白名单 =================
  {
    id: 'svg/whitelist',
    ref: '§8',
    severity: 'error',
    ext: ['.vue', '.ts'],
    kind: 'line',
    pattern: /<(?:defs|linearGradient|radialGradient|stop|clipPath|mask|pattern|filter|use)\b/,
    message: 'SVG 白名单外元素 —— 真机会抛 9902 致命异常且 JS 不可捕获。仅允许 svg/g/path/rect/circle/polyline'
  },

  // ================= 标签级检查 =================
  {
    id: 'vue/native-tag-click',
    ref: '§14',
    severity: 'error',
    ext: ['.vue'],
    kind: 'tag',
    message: '@click 绑在原生 view 上是死事件（Lynx 只派发 tap）—— 改用 @tap'
  },
  {
    id: 'vue/native-tag-vhtml',
    ref: '§19',
    severity: 'error',
    ext: ['.vue'],
    kind: 'tag',
    message: 'v-html 有 XSS 风险，且 Lynx 下行为不确定 —— 确认输入已净化'
  },
  {
    id: 'vue/kebab-component-tag',
    ref: '§4',
    severity: 'warn', // ⚠️ 见下方注释：与现状 100% 冲突，暂降级为 warn
    ext: ['.vue'],
    kind: 'tag',
    message: '模板内组件用了 kebab-case（CONVENTIONS §4 要求 PascalCase）。注意：实测全仓 44 个 .vue 均如此、0 个用 PascalCase —— 需先确认该规范条目是否已过期，再决定是否收紧为 error'
  },

  // ================= SFC 顶层注释 =================
  {
    id: 'vue/header-tag-in-comment',
    ref: '§4',
    severity: 'error',
    ext: ['.vue'],
    kind: 'vue-header',
    message: 'SFC 顶层注释中禁止出现 <xxx> 标签形式（Vue 解析器会识别为自定义块导致编译失败）—— 写成 "view 元素"'
  }
]

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function lineOf(content, index) {
  let line = 1
  for (let i = 0; i < index && i < content.length; i++) if (content[i] === '\n') line++
  return line
}

function walk(dir, acc) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) walk(p, acc)
    else if (!SKIP_FILE_RE.test(p)) acc.push(p)
  }
  return acc
}

function getChangedFiles(ref) {
  try {
    const out = execSync(`git diff --name-only --diff-filter=ACMR ${ref}...HEAD`, {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    })
    return out.split('\n').map(s => s.trim()).filter(Boolean).map(f => join(ROOT, f))
  } catch {
    console.warn(`⚠️  无法获取相对 ${ref} 的改动文件（git 失败或 ref 不存在），回退为全量检查`)
    return null
  }
}

/**
 * 把注释替换为等长空白（保持换行，从而行号不变）。
 * 这样逐行规则不会命中注释里的示例代码。
 */
function stripComments(src, ext) {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  if (ext === '.vue') s = s.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))
  // 行注释：前面不能是 ':'（避免破坏 https://）或引号/标识符字符
  s = s.replace(/(^|[^:\w"'`])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
  return s
}

/** 递归解析 SCSS 规则块，携带祖先声明 */
function parseScssRules(src, baseOffset, out, ancestorDecls) {
  let i = 0
  while (i < src.length) {
    const open = src.indexOf('{', i)
    if (open === -1) break
    const sel = src.slice(i, open).trim().split('\n').pop().trim()
    let depth = 1, j = open + 1
    while (j < src.length && depth > 0) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') depth--
      j++
    }
    const body = src.slice(open + 1, j - 1)
    const firstBrace = body.indexOf('{')
    const decls = firstBrace === -1 ? body : body.slice(0, firstBrace)
    out.push({ sel, decls, offset: baseOffset + open, ancestorDecls })

    if (firstBrace !== -1) {
      const nestedStart = body.lastIndexOf('}', firstBrace) + 1
      parseScssRules(body.slice(nestedStart), baseOffset + open + 1 + nestedStart, out, [...ancestorDecls, decls])
    }
    i = j
  }
}

/** 解析标签，返回 [{tag, attrs, index}] */
function parseTags(content) {
  const tags = []
  const re = /<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/gs
  let m
  while ((m = re.exec(content))) tags.push({ tag: m[1], attrs: m[2], index: m.index })
  return tags
}

// ---------------------------------------------------------------------------
// 检查执行
// ---------------------------------------------------------------------------

function checkFile(file, raw) {
  const findings = []
  const ext = extname(file)
  const rel = relative(ROOT, file)
  const code = stripComments(raw, ext)
  const rawLines = raw.split('\n')

  const applicable = RULES.filter(r => {
    if (!r.ext.includes(ext)) return false
    if (r.dirs && !r.dirs.some(d => rel.startsWith(d))) return false
    if (r.notDirs && r.notDirs.some(d => rel.startsWith(d))) return false
    return true
  })

  for (const rule of applicable) {
    const push = (line, snippet) => findings.push({
      ruleId: rule.id, ref: rule.ref, severity: rule.severity,
      message: rule.message, file: rel, line,
      snippet: (snippet !== undefined ? snippet : (rawLines[line - 1] || '')).trim().slice(0, 120)
    })

    if (rule.kind === 'line') {
      const codeLines = code.split('\n')
      // lookahead：命中 pattern 后，再要求「下一个非空代码行」命中该正则。
      // 用于识别跨行的 `if (cond) {` + 紧邻的 `style.x = …` 组合（§20）。
      const nextNonEmpty = (from) => {
        for (let j = from + 1; j < codeLines.length; j++) {
          if (codeLines[j].trim() !== '') return codeLines[j]
        }
        return ''
      }
      codeLines.forEach((text, idx) => {
        rule.pattern.lastIndex = 0
        if (!rule.pattern.test(text)) return
        if (rule.lookahead) {
          rule.lookahead.lastIndex = 0
          if (!rule.lookahead.test(nextNonEmpty(idx))) return
        }
        push(idx + 1)
      })
    } else if (rule.kind === 'tag') {
      for (const { tag, attrs, index } of parseTags(code)) {
        const isNative = LYNX_NATIVE_TAGS.has(tag)
        if (rule.id === 'vue/native-tag-click' && isNative && /@click\b/.test(attrs)) push(lineOf(code, index), `<${tag} … @click>`)
        if (rule.id === 'vue/native-tag-vhtml' && isNative && /\bv-html\b/.test(attrs)) push(lineOf(code, index), `<${tag} … v-html>`)
        if (rule.id === 'vue/kebab-component-tag' && /^wd-[a-z0-9-]+$/.test(tag)) push(lineOf(code, index), `<${tag}>`)
      }
    } else if (rule.kind === 'scss-block') {
      const blocks = []
      parseScssRules(code, 0, blocks, [])
      for (const b of blocks) {
        if (!/flex-direction\s*:/.test(b.decls)) continue
        const selfHasFlex = /display\s*:\s*flex/.test(b.decls)
        const ancestorHasFlex = b.ancestorDecls.some(d => /display\s*:\s*flex/.test(d))
        if (!selfHasFlex && !ancestorHasFlex) push(lineOf(code, b.offset), `${b.sel || '(嵌套规则)'} { flex-direction: … }`)
      }
    } else if (rule.kind === 'vue-header') {
      // 顶层注释在原始内容里找（注释已被 strip 掉）
      const m = raw.match(/^\s*\/\*([\s\S]*?)\*\//)
      if (m && /<[a-z][a-z0-9-]*>/.test(m[1])) {
        push(1, `顶层注释含标签形式：${m[1].match(/<[a-z][a-z0-9-]*>/)[0]}`)
      }
    }
  }

  return findings
}

function hashFinding(f) {
  return createHash('sha1').update(`${f.ruleId}|${f.file}|${f.snippet}`).digest('hex').slice(0, 16)
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function main() {
  let files
  if (opts.changed) {
    const changed = getChangedFiles(opts.changed)
    if (changed) {
      const set = new Set(changed)
      files = SCAN_DIRS.flatMap(d => walk(join(ROOT, d), [])).filter(f => set.has(f))
      console.log(`🔍 增量检查：相对 ${opts.changed} 的 ${files.length} 个文件`)
    }
  }
  if (!files) {
    files = SCAN_DIRS.flatMap(d => walk(join(ROOT, d), []))
    console.log(`🔍 全量检查：${files.length} 个文件`)
  }

  if (files.length === 0) {
    console.log('✅ 没有需要检查的文件')
    process.exit(0)
  }

  let findings = []
  for (const f of files) {
    let content
    try { content = readFileSync(f, 'utf8') } catch { continue }
    findings.push(...checkFile(f, content))
  }

  // baseline
  const baselinePath = join(ROOT, BASELINE_FILE)
  let baseline = {}
  if (existsSync(baselinePath)) {
    try { baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) } catch { baseline = {} }
  }

  if (opts.updateBaseline) {
    const next = {}
    for (const f of findings) next[hashFinding(f)] = true
    writeFileSync(baselinePath, JSON.stringify(next, null, 2) + '\n')
    console.log(`📝 已写入 ${BASELINE_FILE}：${findings.length} 条存量问题已豁免`)
    process.exit(0)
  }

  const newFindings = findings.filter(f => !baseline[hashFinding(f)])
  const exempted = findings.length - newFindings.length

  // ---- summary 模式 ----
  if (opts.summary) {
    const byRule = new Map()
    for (const f of newFindings) {
      if (!byRule.has(f.ruleId)) byRule.set(f.ruleId, { error: 0, warn: 0, ref: f.ref })
      byRule.get(f.ruleId)[f.severity]++
    }
    console.log('\n按规则统计（存量）：\n')
    const rows = [...byRule.entries()].sort((a, b) => (b[1].error + b[1].warn) - (a[1].error + a[1].warn))
    for (const [id, c] of rows) {
      const total = c.error + c.warn
      console.log(`  ${String(total).padStart(5)}  ${c.error ? `\x1b[31m${c.error} err\x1b[0m` : '      '}  ${c.warn ? `\x1b[33m${c.warn} warn\x1b[0m` : '        '}  [${id}]  (${c.ref})`)
    }
    const e = newFindings.filter(f => f.severity === 'error').length
    const w = newFindings.filter(f => f.severity === 'warn').length
    console.log(`\n  合计：${e} errors, ${w} warnings${exempted ? `（另有 ${exempted} 条已豁免）` : ''}`)
    process.exit(0)
  }

  // ---- 明细输出 ----
  const shown = opts.errorsOnly ? newFindings.filter(f => f.severity === 'error') : newFindings
  const byFile = new Map()
  for (const f of shown) {
    if (!byFile.has(f.file)) byFile.set(f.file, [])
    byFile.get(f.file).push(f)
  }

  for (const [file, list] of [...byFile.entries()].sort()) {
    console.log(`\n\x1b[1m${file}\x1b[0m`)
    for (const f of list.sort((a, b) => a.line - b.line)) {
      const badge = f.severity === 'error' ? '\x1b[31merror\x1b[0m' : '\x1b[33mwarn \x1b[0m'
      console.log(`  ${String(f.line).padStart(4)}  ${badge}  [${f.ruleId}] ${f.message}  (CONVENTIONS ${f.ref})`)
      if (f.snippet) console.log(`        \x1b[2m${f.snippet}\x1b[0m`)
      if (opts.github) {
        console.log(`::${f.severity === 'error' ? 'error' : 'warning'} file=${f.file},line=${f.line},title=${f.ruleId}::${f.message} (CONVENTIONS ${f.ref})`)
      }
    }
  }

  const errors = shown.filter(f => f.severity === 'error').length
  const warns = shown.filter(f => f.severity === 'warn').length

  console.log('')
  if (exempted > 0) console.log(`ℹ️  ${exempted} 条存量问题已按 ${BASELINE_FILE} 豁免`)
  if (errors === 0 && warns === 0) {
    console.log('✅ 未发现规范问题')
  } else {
    console.log(`${errors > 0 ? '\x1b[31m✖' : '\x1b[33m⚠'} ${errors} errors, ${warns} warnings\x1b[0m`)
    console.log('   规则出处见 CONVENTIONS.md；检查清单见 contributing/code-review/03-组件库专项检查清单.md')
  }

  process.exit(errors > 0 ? 1 : 0)
}

main()
