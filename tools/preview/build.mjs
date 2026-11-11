#!/usr/bin/env node
/**
 * 设计预览构建脚本（仅开发用，不参与组件库发布）。
 *
 * 将主题 SCSS 与全部组件 SCSS 编译为单个 CSS，并生成一个静态 HTML 预览页，
 * 用与 Lynx 渲染一致的类名结构还原 demo 页，便于在浏览器中核对 HyperOS 4 设计稿。
 *
 * 用法：node tools/preview/build.mjs [输出目录]
 */
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = path.resolve(root, process.argv[2] || '.preview')

const require = createRequire(path.join(root, 'packages/ui/package.json'))
const sass = require('sass')

/**
 * 组件包划分（ADR-023）：主题住在 @wot-lynx/core，组件 SCSS 分布在多个包，
 * 且用 load-path 式 `@use 'styles/...'` 引主题——编译必须带 loadPaths。
 */
const MANIFEST = JSON.parse(readFileSync(path.join(root, 'docs/architecture/packages.json'), 'utf8'))
const CORE_SRC = path.join(root, 'packages/core/src')
const LOAD_PATHS = [CORE_SRC]

function compile(scssPath) {
  return sass.compile(scssPath, { style: 'expanded', loadPaths: LOAD_PATHS }).css
}

// 1. 主题 + 全部组件样式合并为 preview.css
const parts = [compile(path.join(CORE_SRC, 'styles/theme/index.scss'))]
const componentDirs = MANIFEST.packages
  .filter((p) => p.componentRoot)
  .map((p) => path.join(root, p.dir, p.componentRoot))
  .filter((dir) => existsSync(dir))
const collect = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) collect(full)
    else if (name === 'index.scss') parts.push(compile(full))
  }
}
for (const dir of componentDirs) collect(dir)

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
writeFileSync(path.join(outDir, 'preview.css'), parts.join('\n'))
console.log(`preview.css written (${(parts.join('').length / 1024).toFixed(1)} kB)`)

// 2. 图标 path 数据导出为 JSON（浏览器无法 import .ts）
// 数据住在 icons/sets/ 的两个图标集里（registry 的查找来源）
const iconPaths = {}
for (const setName of ['wot-icons', 'iconfont']) {
  const setTs = readFileSync(path.join(CORE_SRC, `icons/sets/${setName}.ts`), 'utf-8')
  for (const m of setTs.matchAll(/'([a-z0-9-]+)': '([^']+)'/g)) iconPaths[m[1]] = m[2]
}
writeFileSync(path.join(outDir, 'icons.json'), JSON.stringify(iconPaths))
console.log(`icons.json written (${Object.keys(iconPaths).length} icons)`)

// 3. 图标数据以 script 形式内联（file:// 下 fetch 受限）
writeFileSync(path.join(outDir, 'icons-data.js'), `window.ICON_PATHS = ${JSON.stringify(iconPaths)};\n`)
console.log('icons-data.js written')
