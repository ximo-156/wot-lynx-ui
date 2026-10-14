/**
 * wot-lynx-ui 标签转换 loader。
 *
 * Vue Lynx 的编译器配置了 `isNativeTag: () => true`，所有 kebab-case 标签
 * （如 <wd-button>）都会被判定为 Lynx 原生元素而非组件。本 loader 在
 * rspack-vue-loader 之前运行，将模板中的 wd-* 标签改写为 PascalCase，
 * 使业务代码可以沿用 wot-ui 的 <wd-button> 写法。
 *
 * 仅改写 template 块内的组件标签，不影响属性名、事件名与文本内容。
 */

const WD_TAG_RE = /<(wd-[\w-]+)/g
const WD_CLOSE_RE = /<\/(wd-[\w-]+)>/g

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

module.exports = function wotLynxTagTransformLoader(source) {
  this.cacheable(true)

  // 仅处理 .vue 文件
  if (!this.resourcePath || !this.resourcePath.endsWith('.vue')) {
    return source
  }

  const templateStart = source.indexOf('<template>')
  if (templateStart === -1) {
    return source
  }

  // 找到 template 块的结束位置（顶层 </template>）
  let depth = 0
  let templateEnd = -1
  const tagRe = /<(\/?)(template[\s>])/gi
  let m
  while ((m = tagRe.exec(source)) !== null) {
    if (m[2] === 'template>' || m[2] === 'template ') {
      // 自闭合 <template ... /> 不改变深度
      const after = source.slice(m.index, source.indexOf('>', m.index) + 1)
      if (after.endsWith('/>')) continue
      if (m[1] === '/') {
        depth--
        if (depth === 0) {
          templateEnd = source.indexOf('>', m.index) + 1
          break
        }
      } else {
        depth++
      }
    }
  }
  if (templateEnd === -1) {
    return source
  }

  const before = source.slice(0, templateStart)
  const template = source.slice(templateStart, templateEnd)
  const after = source.slice(templateEnd)

  const transformed = template
    .replace(WD_TAG_RE, (_, tag) => '<' + pascal(tag))
    .replace(WD_CLOSE_RE, (_, tag) => '</' + pascal(tag) + '>')

  if (transformed === template) {
    return source
  }
  return before + transformed + after
}
