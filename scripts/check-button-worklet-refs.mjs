#!/usr/bin/env node
// Execute actual SWC-generated button worklets; Vitest's lexical closures do not
// reproduce native hydration replacing an uninitialized conditional ref with undefined.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const root = fileURLToPath(new URL('../', import.meta.url))
const target = process.argv[2]
if (!target) throw new Error('Usage: node scripts/check-button-worklet-refs.mjs <compiled main-thread.js path or URL>')
const source = /^https?:\/\//.test(target)
  ? await fetch(target).then(response => {
      if (!response.ok) throw new Error(`Cannot fetch compiled worklets: ${response.status}`)
      return response.text()
    })
  : readFileSync(resolve(root, target), 'utf8')
const callbacks = []
const frames = []
const sandbox = { registerWorkletInternal: (_type, _id, fn) => callbacks.push(fn), requestAnimationFrame: fn => frames.push(fn) }
for (const match of source.matchAll(/registerWorkletInternal\("main-thread", /g)) {
  const end = source.indexOf('\n});', match.index)
  if (end < 0) throw new Error('Cannot locate worklet registration end')
  const registration = source.slice(match.index, end + 4)
  if (registration.includes('pressRef') && (registration.includes('hover-') || registration.includes('press.released'))) {
    vm.runInNewContext(registration, sandbox)
  }
}
const start = callbacks.find(fn => fn.toString().includes('hover-start-time'))
const cancel = callbacks.find(fn => fn.toString().includes('hover-foreground') && !fn.toString().includes('hover-start-time'))
const end = callbacks.find(fn => fn.toString().includes('press.released') && !fn.toString().includes('hover-start-time'))
assert.ok(start && end && cancel, 'Build must contain button start/end/cancel worklets')
function element() {
  const styles = {}
  return { styles, getAttribute: key => ({ 'hover-disabled': 'false', 'hover-start-time': '0', 'hover-stay-time': '0', 'hover-version': '1' })[key] || '', setStyleProperty: (key, value) => { styles[key] = value }, querySelectorAll: () => [] }
}
const conditionalRefs = ['borderRef', 'labelRef', 'iconRef']
for (let mask = 0; mask < 8; mask++) {
  const available = conditionalRefs.filter((_name, index) => mask & (1 << index))
  const button = element()
  const ctx = { buttonRef: { current: button }, pressRef: { current: null }, nativeTextSelector: 'text' }
  for (const name of ['borderRef','labelRef','iconRef']) ctx[name] = available.includes(name) ? { current: element() } : undefined
  assert.doesNotThrow(() => start.call({ _c: ctx }), `start with refs: ${available}`)
  assert.ok(ctx.pressRef.current?.active, 'Normal button still enters pressed state')
  assert.doesNotThrow(() => end.call({ _c: ctx }))
  ctx.pressRef.current && (ctx.pressRef.current.released = 0)
  assert.doesNotThrow(() => ctx.pressRef.current?.step())
  assert.equal(ctx.pressRef.current, null, 'Released press retires normally')
  assert.doesNotThrow(() => cancel.call({ _c: ctx }))
  assert.equal(button.styles['background-color'], '')
}
assert.doesNotThrow(() => start.call({ _c: {} }), 'Unready root refs do not crash')
assert.doesNotThrow(() => end.call({ _c: {} }), 'Unready end refs do not crash')
assert.doesNotThrow(() => cancel.call({ _c: {} }), 'Unready cancel refs do not crash')
console.log('✅ Compiled button worklets tolerate missing conditional refs and preserve press/release/cancel')
