#!/usr/bin/env node
/**
 * Audit the public event / slot / exposed-method contract against the offline
 * wot-ui 2.3.2 reference. It does not compare or modify theme colors.
 *
 * node scripts/check-wot-parity.mjs [--update-fixture]
 */
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'packages/ui/package.json'))
const { parse, compileScript } = require('vue/compiler-sfc')
const ts = require('typescript')
const reference = join(root, '.wot-ref/src-2.3.2/components')
const local = join(root, 'packages/ui/src/components')
const fixture = join(root, 'packages/ui/test/fixtures/wot-ui-2.3.2-api.json')

function contract(file) {
  const source = readFileSync(file, 'utf8').replace(/<script\b[^>]*\bmodule\s*=\s*['"][^'"]+['"][^>]*>[\s\S]*?<\/script>/g, '')
  const { descriptor, errors } = parse(source, { filename: file })
  if (errors.length) throw new Error(`${file}: ${errors.join(', ')}`)
  const script = descriptor.scriptSetup ? compileScript(descriptor, { id: 'wot-parity' }).content : descriptor.script?.content || ''
  const ast = ts.createSourceFile(file + '.ts', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const events = new Set()
  const methods = new Set()
  const propertyName = (name) => name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined
  function walk(node) {
    if (ts.isPropertyAssignment(node) && propertyName(node.name) === 'emits' && ts.isArrayLiteralExpression(node.initializer)) {
      node.initializer.elements.forEach((item) => { if (ts.isStringLiteral(item)) events.add(item.text) })
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['defineExpose', '__expose'].includes(node.expression.text)) {
      const value = node.arguments[0]
      if (value && ts.isObjectLiteralExpression(value)) {
        value.properties.forEach((item) => { const name = propertyName(item.name); if (name) methods.add(name) })
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(ast)
  const slots = new Set()
  const template = (descriptor.template?.content || '').replace(/<!--[\s\S]*?-->/g, '')
  for (const match of template.matchAll(/<slot\b([^>]*?)(?:\/?>)/g)) {
    const name = match[1].match(/(?:^|\s)name\s*=\s*['"]([^'"]+)['"]/)?.[1]
    slots.add(name || 'default')
  }
  return { events: [...events].sort(), slots: [...slots].sort(), methods: [...methods].sort() }
}

let expected
if (process.argv.includes('--update-fixture')) {
  if (!existsSync(reference)) throw new Error('Offline wot-ui 2.3.2 source reference is required to update the fixture')
  const components = {}
  for (const entry of readdirSync(reference).sort()) {
    const file = join(reference, entry, `${entry}.vue`)
    if (existsSync(file)) components[entry] = contract(file)
  }
  expected = { version: '2.3.2', source: 'https://wot-ui.cn/', components }
  mkdirSync(dirname(fixture), { recursive: true })
  writeFileSync(fixture, JSON.stringify(expected, null, 2) + '\n')
  console.log(`Generated API fixture: ${Object.keys(components).length} official components`)
} else {
  expected = JSON.parse(readFileSync(fixture, 'utf8'))
}

const differences = []
for (const [name, official] of Object.entries(expected.components)) {
  const file = join(local, name, `${name}.vue`)
  if (!existsSync(file)) { differences.push(`${name}: missing component`); continue }
  const actual = contract(file)
  for (const kind of ['events', 'slots', 'methods']) {
    for (const item of official[kind]) {
      if (!actual[kind].includes(item)) differences.push(`${name}: missing ${kind.slice(0, -1)} ${item}`)
    }
  }
}
console.log(differences.join('\n') || 'All official public contracts are declared locally.')
console.log(`Components: ${Object.keys(expected.components).length}; differences: ${differences.length}`)
if (differences.length) process.exitCode = 1
