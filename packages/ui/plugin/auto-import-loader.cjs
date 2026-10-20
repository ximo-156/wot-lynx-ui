/**
 * auto-import-loader.cjs — 自动导入 wd-* 组件并注入主题 CSS。
 *
 * 扫描 .vue 文件中的 <wd-xxx> 标签使用，自动在 <script setup> 中生成
 * import 语句，并在文件顶部注入 import 'wot-lynx-ui/theme'。
 *
 * 设计原则：
 * 1. 只处理业务代码（src/ 下的 .vue），不处理组件库自身代码。
 * 2. 已有 import 的组件不重复导入。
 * 3. 主题 CSS 只在入口文件（App.vue / main.ts）注入一次。
 */
const path = require('node:path')
const fs = require('node:fs')

module.exports = function autoImportLoader(source) {
  const options = this.getOptions()
  const { root, dirs, prefix, injectTheme } = options

  // 检查是否在业务目录下
  const filePath = this.resourcePath
  const relativePath = path.relative(root, filePath)
  const isBusinessCode = dirs.some((dir) => relativePath.startsWith(dir))

  if (!isBusinessCode) {
    return source
  }

  // 提取使用的 wd-* 组件标签
  const usedTags = new Set()
  const tagRegex = new RegExp(`<(${prefix}[a-z][a-z0-9-]*)`, 'g')
  let match
  while ((match = tagRegex.exec(source)) !== null) {
    usedTags.add(match[1])
  }

  if (usedTags.size === 0 && !injectTheme) {
    return source
  }

  // 检查已有 import
  const existingImports = new Set()
  const importRegex = /import\s+(?:\w+|\{[^}]*\})\s+from\s+['"]wot-lynx-ui['"]/g
  while ((match = importRegex.exec(source)) !== null) {
    // 提取已导入的组件名
    const namedMatch = match[0].match(/\{([^}]*)\}/)
    if (namedMatch) {
      namedMatch[1].split(',').forEach((name) => {
        existingImports.add(name.trim())
      })
    }
  }

  // 生成 import 语句
  const componentsToImport = []
  for (const tag of usedTags) {
    // wd-button → WdButton
    const pascalName = tag
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')

    if (!existingImports.has(pascalName)) {
      componentsToImport.push(pascalName)
    }
  }

  let result = source

  // 注入组件 import
  if (componentsToImport.length > 0) {
    const importStatement = `import { ${componentsToImport.join(', ')} } from 'wot-lynx-ui'\n`

    // 在 <script setup> 后插入
    const scriptSetupMatch = result.match(/<script[^>]*setup[^>]*>/)
    if (scriptSetupMatch) {
      const insertPos = scriptSetupMatch.index + scriptSetupMatch[0].length
      result = result.slice(0, insertPos) + '\n' + importStatement + result.slice(insertPos)
    }
  }

  // 注入主题 CSS（仅在入口文件）
  if (injectTheme) {
    const isEntry = /App\.vue$|main\.ts$/.test(filePath)
    const hasThemeImport = /import\s+['"]wot-lynx-ui\/theme['"]/.test(result)

    if (isEntry && !hasThemeImport) {
      const themeImport = `import 'wot-lynx-ui/theme'\n`
      const scriptSetupMatch = result.match(/<script[^>]*setup[^>]*>/)
      if (scriptSetupMatch) {
        const insertPos = scriptSetupMatch.index + scriptSetupMatch[0].length
        result = result.slice(0, insertPos) + '\n' + themeImport + result.slice(insertPos)
      }
    }
  }

  return result
}
