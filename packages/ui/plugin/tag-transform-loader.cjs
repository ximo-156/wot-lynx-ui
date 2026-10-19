/**
 * wot-lynx-ui 标签转换 loader。
 *
 * Vue Lynx 的编译器配置了 `isNativeTag: () => true`，所有 kebab-case 标签
 * （如 <wd-button>）都会被判定为 Lynx 原生元素而非组件。本 loader 在
 * rspack-vue-loader 之前运行，将模板中的 wd-* 标签改写为 PascalCase，
 * 使业务代码可以沿用 wot-ui 的 <wd-button> 写法。
 *
 * 仅改写 template 块内的组件标签，不影响属性名、事件名与文本内容。
 *
 * 为什么不用「尖括号深度计数」定位模板块（历史实现）：
 * - 模板里的 HTML 注释、文本、代码示例都可能出现 template 字面量；
 * - 嵌套的 `<template v-if>` 也会被计入深度；
 * - 一旦深度无法归零，历史实现会**静默返回原文件**——wd-* 标签未被转换，
 *   带 v-model 的组件直接构建失败；不带 v-model 的则在真机退化为原生元素，
 *   报 603 sub_code 60301 "Can't find ui tag" 并白屏。
 *
 * 现在的做法与 @vue/compiler-sfc 一致：SFC 顶层块以**行首** `<template ...>`
 * 开始；随后用轻量标签扫描器找配对的 `</template>`（跳过 HTML 注释、
 * 识别自闭合与嵌套 template）。解析失败时直接抛错让构建失败（fail-fast），
 * 而不是产出会崩真机的产物。
 */

const WD_TAG_RE = /<(wd-[\w-]+)/g
const WD_CLOSE_RE = /<\/(wd-[\w-]+)>/g
const TAG_NAME_RE = /^<(\/?)([a-zA-Z][\w-]*)/

/**
 * wd-xxx-yyy → WdXxxYyy
 *
 * 注意：正则保证入参以 `wd-` 开头，首段即 'wd'，直接逐段首字母大写即可，
 * 不能再额外拼接 'Wd' 前缀（否则会产出 WdWdXxx 这种错误标签名）。
 */
function pascal(tag) {
  return tag
    .split('-')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('')
}

/**
 * 从 `<` 开始找到标签结束的 `>`（跳过引号内的 `>`）。
 * 返回 `>` 的下标；找不到返回 -1。
 */
function findTagEnd(source, start) {
  let quote = ''
  for (let i = start + 1; i < source.length; i++) {
    const ch = source[i]
    if (quote) {
      if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === '>') return i
  }
  return -1
}

/**
 * 判断某个下标是否位于 HTML 注释内（用于排除顶层注释里的 template 字面量）。
 */
function isInsideComment(source, index) {
  let inComment = false
  let i = 0
  while (i < index) {
    if (!inComment && source.startsWith('<!--', i)) {
      inComment = true
      i += 4
      continue
    }
    if (inComment && source.startsWith('-->', i)) {
      inComment = false
      i += 3
      continue
    }
    i++
  }
  return inComment
}

/**
 * 定位顶层 template 块。
 *
 * 1. 顶层块的起点只认**行首** `<template ...>`（与 @vue/compiler-sfc 口径
 *    一致），因此缩进的嵌套 template 不会被误判为块起点；顶层注释里的
 *    template 字面量也会跳过；
 * 2. 进入模板内容后用一个标签扫描器找配对 `</template>`：
 *    - 跳过 HTML 注释；
 *    - 跳过引号内的 `>`；
 *    - 统计嵌套的 `<template>` / `</template>` 深度。
 */
function resolveTemplateBlock(source) {
  const openRE = /^<template(?:\s+[^>]*)?>/gm
  let openMatch = null
  let match
  while ((match = openRE.exec(source)) !== null) {
    if (!isInsideComment(source, match.index)) {
      openMatch = match
      break
    }
  }
  if (!openMatch) return null

  const contentStart = openMatch.index + openMatch[0].length
  let depth = 1
  let i = contentStart

  while (i < source.length) {
    const lt = source.indexOf('<', i)
    if (lt === -1) break

    // HTML 注释：整段跳过（注释里的 template / wd-* 字面量不参与配对）
    if (source.startsWith('<!--', lt)) {
      const commentEnd = source.indexOf('-->', lt + 4)
      if (commentEnd === -1) break
      i = commentEnd + 3
      continue
    }

    const tagEnd = findTagEnd(source, lt)
    if (tagEnd === -1) break

    const nameMatch = TAG_NAME_RE.exec(source.slice(lt, tagEnd + 1))
    if (!nameMatch) {
      i = lt + 1
      continue
    }

    const isClosing = nameMatch[1] === '/'
    const tagName = nameMatch[2].toLowerCase()
    const isSelfClosing = !isClosing && source[tagEnd - 1] === '/'

    if (tagName === 'template') {
      if (isClosing) {
        depth--
        if (depth === 0) {
          return { contentStart, contentEnd: lt }
        }
      } else if (!isSelfClosing) {
        depth++
      }
    }

    i = tagEnd + 1
  }

  throw new Error(
    '[wot-lynx-ui] tag-transform-loader: 找到顶层 <template> 但未找到配对的 </template>。' +
      '请检查 SFC 结构；该错误会使构建失败，避免未转换的 wd-* 标签在真机触发 603 "Can\'t find ui tag"。'
  )
}

module.exports = function wotLynxTagTransformLoader(source) {
  this.cacheable(true)

  // 仅处理 .vue 文件
  if (!this.resourcePath || !this.resourcePath.endsWith('.vue')) {
    return source
  }

  const block = resolveTemplateBlock(source)
  // 没有 template 块（纯 script / 纯样式 SFC）：无需转换
  if (!block) return source

  const before = source.slice(0, block.contentStart)
  const template = source.slice(block.contentStart, block.contentEnd)
  const after = source.slice(block.contentEnd)

  const transformed = template
    .replace(WD_TAG_RE, (_, tag) => '<' + pascal(tag))
    .replace(WD_CLOSE_RE, (_, tag) => '</' + pascal(tag) + '>')

  // 安全网：模板内不允许残留 wd-* 标签。残留意味着标签写法超出了转换正则
  // （例如换行/非法字符），继续构建只会把 603 崩溃推迟到真机。
  if (/<\/?wd-[\w-]*/.test(transformed)) {
    throw new Error(
      '[wot-lynx-ui] tag-transform-loader: 模板中仍有未转换的 wd-* 标签。' +
        '请检查标签写法（应为 <wd-xxx> / </wd-xxx>），构建已中止以避免真机 603 "Can\'t find ui tag"。'
    )
  }

  if (transformed === template) {
    return source
  }
  return before + transformed + after
}
