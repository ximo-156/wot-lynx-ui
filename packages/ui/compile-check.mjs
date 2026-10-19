import { readFileSync, writeFileSync } from 'node:fs'
const req = (p) => import(p)
const { parse, compileScript } = await req('/Users/abc/Documents/deepseek-harness/default-workspace/wot-lynx-ui/node_modules/.pnpm/@vue+compiler-sfc@3.5.43/node_modules/@vue/compiler-sfc/dist/compiler-sfc.cjs.js')
const file = process.argv[2]
const src = readFileSync(file, 'utf8')
const { descriptor, errors } = parse(src, { filename: file })
if (errors.length) { console.log('PARSE ERRORS:', errors.map(e => e.message)); process.exit(1) }
try {
  const compiled = compileScript(descriptor, { id: 'x', isProd: false })
  console.log('compileScript OK, content length', compiled.content.length)
} catch (e) {
  console.log('compileScript ERROR:', e.message)
}
