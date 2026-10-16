#!/usr/bin/env node
/**
 * 为组件文档页注入 H5 预览标记。
 *
 * 在每个 docs/components/<slug>.md 的「介绍」与「## API」之间插入：
 *
 *     <h5-preview name="<slug>" />
 *
 * 幂等：已含 <h5-preview 的页面跳过。用法：
 *     node scripts/inject-h5-preview.mjs [组件slug...]
 * 不带参数时处理全部组件文档。
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = path.join(root, 'docs/components')

const only = process.argv.slice(2)
let injected = 0
let skipped = 0

for (const entry of readdirSync(docsDir)) {
  if (!entry.endsWith('.md')) continue
  const slug = entry.replace(/\.md$/, '')
  if (only.length > 0 && !only.includes(slug)) continue
  const file = path.join(docsDir, entry)
  if (!statSync(file).isFile()) continue

  const content = readFileSync(file, 'utf8')
  if (content.includes('<h5-preview')) {
    skipped++
    continue
  }

  const marker = `\n<h5-preview name="${slug}" />\n`
  const apiIndex = content.indexOf('\n## API')
  const introHeading = content.indexOf('## 介绍')

  let next
  if (apiIndex !== -1) {
    next = content.slice(0, apiIndex) + marker + content.slice(apiIndex)
  } else if (introHeading !== -1) {
    // 无 API 小节时，插入到介绍小节第一个段落之后
    const rest = content.slice(introHeading)
    const paraEnd = rest.indexOf('\n\n', rest.indexOf('\n\n') + 2)
    if (paraEnd !== -1) {
      const at = introHeading + paraEnd
      next = content.slice(0, at) + '\n' + marker.trimStart() + content.slice(at)
    } else {
      next = content.trimEnd() + '\n' + marker
    }
  } else {
    next = content.trimEnd() + '\n' + marker
  }

  writeFileSync(file, next, 'utf8')
  injected++
}

console.log(`h5-preview 注入完成：${injected} 篇新增，${skipped} 篇已存在`)
