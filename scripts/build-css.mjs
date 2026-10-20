#!/usr/bin/env node
/**
 * 将组件库中的 SCSS 源码编译为预编译 CSS。
 *
 * 组件库面向 Vue Lynx 应用分发，Rsbuild/Rspeedy 默认不包含 sass-loader，
 * 因此库内发布预编译 CSS，消费者无需安装 Sass 工具链；
 * SCSS 源码一并发布，供需要深度定制的使用者自行编译。
 *
 * 用法：node scripts/build-css.mjs [组件名...]
 * 不带参数时编译全部；带参数时只编译指定组件（如 wd-button wd-cell）。
 */
import { createRequire } from 'node:module'
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const uiSrc = path.join(root, 'packages/ui/src')

const require = createRequire(path.join(root, 'packages/ui/package.json'))
const sass = require('sass')
const postcss = require('postcss')

const only = process.argv.slice(2)
let failed = 0

/**
 * Lynx CSS 序列化器（@lynx-js/css-serializer 的 transformDeclaration）会将
 * 常规属性中 var() 的 fallback 链剥掉，只保留 var(--name) 引用，且不把
 * fallback 写回产物。若该变量未在主题或组件中定义，属性即为无效值，
 * 导致 web 预览 / 真机上样式丢失（如按钮无背景色）。
 *
 * 修复：将含 fallback 的 var() 提取为同规则内的自定义属性（--csslib-*），
 * 常规属性改为引用该自定义属性。自定义属性经 transformVariables 处理，
 * toString 保留完整值（含嵌套 var() fallback），浏览器原生 CSS 引擎
 * 在插入 CSSStyleSheet 后按标准 var() 解析链求值。
 */
function fixNestedVarFallbacks(css) {
  return postcss([
    (cssRoot) => {
      let counter = 0
      cssRoot.walkRules((rule) => {
        const toAdd = []
        rule.walkDecls((decl) => {
          if (decl.prop.startsWith('--')) return
          const val = decl.value
          // 匹配 var(--name, fallback) 且 fallback 中含嵌套 var()
          const m = val.match(/^var\((--[\w-]+),\s*(.+)\)$/)
          if (!m) return
          const [, varName, fallback] = m
          if (!fallback.includes('var(')) return
          const localName = `--csslib-${decl.prop}-${counter++}`
          toAdd.push({ prop: localName, value: `var(${varName}, ${fallback})` })
          decl.value = `var(${localName})`
        })
        for (const d of toAdd) {
          rule.prepend(postcss.decl({ prop: d.prop, value: d.value }))
        }
      })
    },
  ]).process(css, { from: undefined }).css
}

function compile(scssPath, cssPath) {
  try {
    const result = sass.compile(scssPath, { style: 'compressed' })
    const fixed = fixNestedVarFallbacks(result.css)
    writeFileSync(cssPath, fixed)
    console.log(`compiled ${path.relative(root, scssPath)}`)
  } catch (e) {
    failed++
    console.error(`FAILED ${path.relative(root, scssPath)}: ${e.message.split('\n')[0]}`)
  }
}

// 1. 主题（仅在全量构建时）
if (only.length === 0) {
  compile(path.join(uiSrc, 'styles/theme/index.scss'), path.join(uiSrc, 'styles/theme/index.css'))
}

// 2. 组件（含子目录，如 wd-calendar-view/year、wd-keyboard/key）
// 重写期间 components 目录可能不存在或只有部分组件，容错跳过
const componentsDir = path.join(uiSrc, 'components')
const scssFiles = []
const collectScss = (dir) => {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      collectScss(full)
    } else if (name === 'index.scss') {
      scssFiles.push(full)
    }
  }
}
collectScss(componentsDir)

for (const scss of scssFiles) {
  if (only.length) {
    // 指定组件时，匹配目录名（支持 wd-xxx 或其任意子目录）
    const rel = path.relative(componentsDir, scss)
    const top = rel.split(path.sep)[0]
    const sub = rel.split(path.sep)[1] || ''
    if (!only.some((o) => top === o || sub === o)) continue
  }
  compile(scss, scss.replace(/\.scss$/, '.css'))
}

if (failed) {
  console.error(`${failed} file(s) failed`)
  process.exitCode = 1
} else {
  console.log('done')
}
