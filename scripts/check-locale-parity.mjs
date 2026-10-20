#!/usr/bin/env node
/**
 * check-locale-parity.mjs — 校验所有语言包的 key 集合与 zh-CN 完全一致。
 *
 * 用法：
 *   node scripts/check-locale-parity.mjs
 *
 * 退出码：0 = 全部一致；1 = 存在缺失或多余的 key
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LANG_DIR = join(ROOT, 'packages/ui/src/locale/lang')

/** 递归提取对象的所有 key 路径 */
function extractKeys(obj, prefix = '') {
  const keys = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...extractKeys(value, path))
    } else {
      keys.push(path)
    }
  }
  return keys.sort()
}

/** 从 TS 文件中提取 default export 对象的 key（简单解析） */
function parseLocaleFile(filePath) {
  const content = readFileSync(filePath, 'utf8')
  // 提取 export default { ... } 中的内容
  const match = content.match(/export default \{([\s\S]*)\}/)
  if (!match) return null

  const body = match[1]
  const keys = []

  // 解析嵌套 key（简单实现，不支持函数值中的 key）
  let depth = 0
  let currentPath = []
  let currentKey = ''

  for (let i = 0; i < body.length; i++) {
    const char = body[i]

    if (char === '{') {
      depth++
      if (depth === 1 && currentKey) {
        currentPath.push(currentKey)
        currentKey = ''
      }
    } else if (char === '}') {
      depth--
      if (depth === 0 && currentPath.length > 0) {
        currentPath.pop()
      }
    } else if (depth === 1 && /[a-zA-Z]/.test(char)) {
      currentKey += char
    } else if (depth === 1 && char === ':') {
      if (currentKey) {
        keys.push([...currentPath, currentKey].join('.'))
        currentKey = ''
      }
    } else if (depth === 1 && char === ',') {
      currentKey = ''
    }
  }

  return keys.sort()
}

const files = readdirSync(LANG_DIR).filter((f) => f.endsWith('.ts'))
const reference = 'zh-CN.ts'

if (!files.includes(reference)) {
  console.error(`Reference file ${reference} not found`)
  process.exit(1)
}

const refKeys = parseLocaleFile(join(LANG_DIR, reference))
if (!refKeys) {
  console.error(`Failed to parse ${reference}`)
  process.exit(1)
}

console.log(`Reference (${reference}): ${refKeys.length} keys`)
console.log('')

let hasErrors = false

for (const file of files) {
  if (file === reference) continue

  const keys = parseLocaleFile(join(LANG_DIR, file))
  if (!keys) {
    console.error(`  ${file}: FAILED to parse`)
    hasErrors = true
    continue
  }

  const missing = refKeys.filter((k) => !keys.includes(k))
  const extra = keys.filter((k) => !refKeys.includes(k))

  if (missing.length === 0 && extra.length === 0) {
    console.log(`  ${file}: OK (${keys.length} keys)`)
  } else {
    hasErrors = true
    console.log(`  ${file}: MISMATCH`)
    if (missing.length > 0) {
      console.log(`    Missing (${missing.length}): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`)
    }
    if (extra.length > 0) {
      console.log(`    Extra (${extra.length}): ${extra.slice(0, 5).join(', ')}${extra.length > 5 ? '...' : ''}`)
    }
  }
}

console.log('')
if (hasErrors) {
  console.error('Locale parity check FAILED')
  process.exit(1)
} else {
  console.log('Locale parity check PASSED')
}
