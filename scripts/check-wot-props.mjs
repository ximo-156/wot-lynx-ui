#!/usr/bin/env node
/**
 * Runtime prop parity against the trusted, offline wot-ui 2.3.2 sources.
 *
 * node scripts/check-wot-props.mjs                 # fixture -> local audit
 * node scripts/check-wot-props.mjs --update-fixture # official -> fixture -> audit
 * node scripts/check-wot-props.mjs --json          # machine-readable audit
 *
 * TypeScript runs in a per-audit VM with a scoped CommonJS loader, NOT a global
 * require hook. Only trusted .ts modules inside the selected source tree can
 * load; Vue runtime helpers are explicit, inert mocks. This is not a sandbox
 * for arbitrary untrusted code. No component setup/render code is executed.
 *
 * Runtime constructor order matters (especially Boolean/String casting).
 * An absent default is different from an explicit undefined default. Factories
 * retain both their result and canonical function source; Function-typed
 * defaults and validators retain source without being invoked.
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const REFERENCE = join(ROOT, '.wot-ref/src-2.3.2')
export const LOCAL = join(ROOT, 'packages/ui/src')
export const FIXTURE = join(ROOT, 'packages/ui/test/fixtures/wot-ui-2.3.2-props.json')
export const CLOCK = '2024-07-15T12:00:00.000Z'
const require = createRequire(join(ROOT, 'packages/ui/package.json'))
const ts = require('typescript')
const own = (value, name) => Object.prototype.hasOwnProperty.call(value, name)
const slash = (value) => value.split(sep).join('/')
const typeNames = new Map([String, Number, Boolean, Array, Object, Function, Date, Symbol, BigInt, RegExp].map((type) => [type, type.name]))

// Local-calendar constructors/getters are deliberately UTC so fixtures are
// stable across machines/time zones. No host Date or global clock is patched.
function fixedDate(clock) {
  const epoch = Date.parse(clock)
  if (!Number.isFinite(epoch)) throw new Error(`Invalid audit clock: ${clock}`)
  return class AuditDate extends Date {
    constructor(...args) {
      if (!args.length) super(epoch)
      else if (args.length > 1) super(Date.UTC(...args))
      else super(args[0])
    }
    static now() { return epoch }
    getFullYear() { return this.getUTCFullYear() }
    getMonth() { return this.getUTCMonth() }
    getDate() { return this.getUTCDate() }
    getDay() { return this.getUTCDay() }
    getHours() { return this.getUTCHours() }
    getMinutes() { return this.getUTCMinutes() }
    getSeconds() { return this.getUTCSeconds() }
    getMilliseconds() { return this.getUTCMilliseconds() }
    getTimezoneOffset() { return 0 }
  }
}

function vueMock() {
  const ref = (value) => ({ value })
  const helpers = {
    ref, shallowRef: ref, reactive: (value) => value, shallowReactive: (value) => value,
    readonly: (value) => value, shallowReadonly: (value) => value, toRaw: (value) => value,
    markRaw: (value) => value, unref: (value) => value && own(value, 'value') ? value.value : value,
    computed: (getter) => ({ get value() { return typeof getter === 'function' ? getter() : getter.get() } }),
    inject: (_key, fallback) => fallback, provide: () => {},
    getCurrentInstance: () => null, defineComponent: (options) => options,
    onMounted: () => {}, onBeforeMount: () => {}, onUnmounted: () => {}, onBeforeUnmount: () => {},
    onActivated: () => {}, onDeactivated: () => {}, watch: () => () => {}, watchEffect: () => () => {},
    nextTick: (callback) => Promise.resolve().then(callback),
    isRef: (value) => Boolean(value && own(value, 'value')), isVNode: () => false
  }
  return new Proxy(helpers, {
    get(target, key) {
      if (key === '__esModule') return true
      if (!own(target, key)) throw new Error(`Unverified Vue helper requested by prop dependency: ${String(key)}`)
      return target[key]
    }
  })
}

export function canonicalFunction(fn) {
  const source = typeof fn === 'string' ? fn : Function.prototype.toString.call(fn)
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, source)
  const tokens = []
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token === ts.SyntaxKind.GreaterThanToken) token = scanner.reScanGreaterToken()
    tokens.push(token === ts.SyntaxKind.StringLiteral ? JSON.stringify(scanner.getTokenValue()) : scanner.getTokenText())
  }
  return tokens.join(' ')
}

export function createScopedLoader(sourceRoot, { clock = CLOCK } = {}) {
  const scope = realpathSync(sourceRoot)
  const DateType = fixedDate(clock)
  typeNames.set(DateType, 'Date')
  const context = vm.createContext({
    String, Number, Boolean, Array, Object, Function, Date: DateType, Symbol, BigInt, RegExp,
    Map, Set, WeakMap, WeakSet, Promise, Math, JSON, console
  })
  const cache = new Map()
  const vue = vueMock()
  function checked(file) {
    const absolute = realpathSync(file)
    const rel = relative(scope, absolute)
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) || extname(absolute) !== '.ts') {
      throw new Error(`Prop loader refused a module outside its .ts scope: ${absolute}`)
    }
    return absolute
  }
  function scopedRequire(specifier, parent) {
    if (specifier === 'vue' || specifier === 'vue-lynx') return vue
    if (!specifier.startsWith('.')) throw new Error(`Prop loader refused external dependency ${specifier} in ${parent}`)
    const base = resolve(dirname(parent), specifier)
    const candidates = extname(base) ? [base] : [base + '.ts', join(base, 'index.ts')]
    const file = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
    if (!file) throw new Error(`Cannot resolve prop dependency ${specifier} in ${parent}`)
    return load(file)
  }
  function evaluate(source, file) {
    const { outputText, diagnostics } = ts.transpileModule(source, {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, verbatimModuleSyntax: false }
    })
    const errors = diagnostics?.filter((item) => item.category === ts.DiagnosticCategory.Error) || []
    if (errors.length) throw new Error(`${file}: ${errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('; ')}`)
    const module = { exports: {} }
    // Passing scoped require into the wrapper does not touch Node's loader.
    const wrapper = new vm.Script(`(function(exports, require, module) {\n${outputText}\n})`, { filename: file })
      .runInContext(context, { timeout: 5000 })
    wrapper(module.exports, (specifier) => scopedRequire(specifier, file), module)
    return module.exports
  }
  function load(file) {
    const absolute = checked(file)
    if (cache.has(absolute)) return cache.get(absolute)
    // Prop dependency graphs should be acyclic. Do not silently return partial
    // exports on a cycle and pretend the affected props were covered.
    cache.set(absolute, new Proxy({}, { get() { throw new Error(`Cyclic prop dependency: ${absolute}`) } }))
    try {
      const exports = evaluate(readFileSync(absolute, 'utf8'), absolute)
      cache.set(absolute, exports)
      return exports
    } catch (error) { cache.delete(absolute); throw error }
  }
  return { load, evaluate, scope }
}

function valueSnapshot(value, seen = new Set()) {
  if (value === undefined) return { $type: 'undefined' }
  if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0))) return { $type: 'number', value: Object.is(value, -0) ? '-0' : String(value) }
  if (typeof value === 'bigint') return { $type: 'bigint', value: String(value) }
  if (typeof value === 'symbol') return { $type: 'symbol', value: value.description ?? null }
  if (typeof value === 'function') return { $type: 'function', source: canonicalFunction(value) }
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) throw new Error('Cyclic default value is unverified')
  seen.add(value)
  try {
    if (Array.isArray(value)) return value.map((item) => valueSnapshot(item, seen))
    if (Object.prototype.toString.call(value) === '[object Date]') return { $type: 'Date', value: value.toISOString() }
    if (Object.prototype.toString.call(value) === '[object RegExp]') return { $type: 'RegExp', source: value.source, flags: value.flags }
    if (Object.prototype.toString.call(value) !== '[object Object]') throw new Error(`Unverified default value: ${Object.prototype.toString.call(value)}`)
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, valueSnapshot(value[key], seen)]))
  } finally { seen.delete(value) }
}

function constructorSnapshot(type) {
  if (type == null) return null // Vue's unrestricted/unspecified runtime type.
  const types = Array.isArray(type) ? type : [type]
  return types.map((constructor) => {
    if (constructor === null) return null // Nullable union, distinct from unrestricted type: null.
    const name = typeNames.get(constructor)
    if (!name) throw new Error(`Unverified runtime prop constructor: ${String(constructor)}`)
    return name
  })
}

export function snapshotProps(props) {
  if (!props || typeof props !== 'object' || Array.isArray(props)) throw new Error('Expected a runtime props object')
  return Object.fromEntries(Object.keys(props).sort().map((name) => {
    const raw = props[name]
    const options = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { type: raw }
    const type = constructorSnapshot(options.type)
    let defaultValue = { kind: 'absent' }
    if (own(options, 'default')) {
      const value = options.default
      if (typeof value !== 'function') defaultValue = { kind: 'value', value: valueSnapshot(value) }
      else if (options.type === Function || options.skipFactory === true) defaultValue = { kind: 'function', source: canonicalFunction(value) }
      else defaultValue = { kind: 'factory', source: canonicalFunction(value), value: valueSnapshot(value(Object.create(null))) }
    }
    if (options.validator != null && typeof options.validator !== 'function') throw new Error(`${name}: non-function validator is unverified`)
    return [name, {
      type, required: options.required === true, default: defaultValue,
      validator: options.validator == null ? null : canonicalFunction(options.validator)
    }]
  }))
}

function propsModule(directory, loader) {
  for (const basename of ['types.ts', 'type.ts']) {
    const file = join(directory, basename)
    if (!existsSync(file)) continue
    const exports = Object.entries(loader.load(file)).filter(([name, value]) => /props$/i.test(name) && value && typeof value === 'object')
    if (exports.length > 1) throw new Error(`${file}: ambiguous runtime props exports: ${exports.map(([name]) => name).join(', ')}`)
    if (exports.length) return { source: slash(relative(loader.scope, file)), exportName: exports[0][0], props: snapshotProps(exports[0][1]) }
  }
  return null
}

// SFC fallback evaluates ONLY the prop expression and its dependency closure,
// not component setup. This covers baseProps users with no exported props (e.g.
// sticky-box), missing type files (root-portal), and the truly prop-less wot-ui.
function sfcProps(file, loader) {
  const { parse } = require('vue/compiler-sfc')
  const source = readFileSync(file, 'utf8').replace(/<script\b[^>]*\bmodule\s*=\s*['"][^'"]+['"][^>]*>[\s\S]*?<\/script>/g, '')
  const { descriptor, errors } = parse(source, { filename: file })
  if (errors.length) throw new Error(`${file}: ${errors.map(String).join('; ')}`)
  const script = [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join('\n')
  const ast = ts.createSourceFile(file + '.ts', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const definitions = new Map()
  const imports = new Map()
  const expressions = []
  function walk(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'defineProps') {
      if (!node.arguments.length) throw new Error(`${file}: type-only defineProps requires a compiler-derived runtime contract; unverified`)
      expressions.push(node.arguments[0])
    }
    if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) && node.name.text === 'props') expressions.push(node.initializer)
    ts.forEachChild(node, walk)
  }
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause
      if (clause?.name) imports.set(clause.name.text, statement)
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) clause.namedBindings.elements.forEach((item) => imports.set(item.name.text, statement))
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) imports.set(clause.namedBindings.name.text, statement)
    }
    if (ts.isVariableStatement(statement)) statement.declarationList.declarations.forEach((item) => { if (ts.isIdentifier(item.name)) definitions.set(item.name.text, statement) })
    if (ts.isFunctionDeclaration(statement) && statement.name) definitions.set(statement.name.text, statement)
    walk(statement)
  }
  if (!expressions.length) return { source: slash(relative(loader.scope, file)), exportName: null, props: {} }
  if (expressions.length !== 1) throw new Error(`${file}: ambiguous SFC props expressions; unverified`)
  const needed = new Set()
  function dependencies(node) {
    if (ts.isTypeNode(node)) return
    if (ts.isIdentifier(node)) {
      const statement = imports.get(node.text) || definitions.get(node.text)
      if (statement && !needed.has(statement)) { needed.add(statement); dependencies(statement) }
    }
    ts.forEachChild(node, dependencies)
  }
  dependencies(expressions[0])
  const declarations = [...needed].sort((a, b) => a.pos - b.pos).map((node) => node.getText(ast)).join('\n')
  const exports = loader.evaluate(`${declarations}\nexport const auditProps = ${expressions[0].getText(ast)};`, file + '.ts')
  return { source: slash(relative(loader.scope, file)), exportName: 'defineProps/SFC', props: snapshotProps(exports.auditProps) }
}

export function componentContract(directory, loader, name = directory.split(sep).at(-1)) {
  const fromTypes = propsModule(directory, loader)
  if (fromTypes) return fromTypes
  const file = join(directory, `${name}.vue`)
  if (!existsSync(file)) throw new Error(`No runtime prop definition or SFC in ${directory}`)
  return sfcProps(file, loader)
}

function directories(path) {
  return readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
}

export function buildOfficialFixture({ reference = REFERENCE, clock = CLOCK } = {}) {
  const loader = createScopedLoader(reference, { clock })
  const components = {}
  const internals = {}
  const unverified = []
  const componentRoot = join(reference, 'components')
  const names = directories(componentRoot)
  for (const name of names) {
    try { components[name] = componentContract(join(componentRoot, name), loader, name) }
    catch (error) { unverified.push({ component: name, reason: error.message }) }
    function internalTypes(directory, prefix) {
      for (const child of directories(directory)) {
        const path = join(directory, child)
        const key = `${prefix}/${child}`
        if (existsSync(join(path, 'types.ts')) || existsSync(join(path, 'type.ts'))) {
          try {
            const contract = propsModule(path, loader)
            if (!contract) throw new Error('No exported runtime props in internal type module')
            internals[key] = contract
          } catch (error) { unverified.push({ component: key, reason: error.message }) }
        }
        internalTypes(path, key)
      }
    }
    internalTypes(join(componentRoot, name), name)
  }
  const fromTypeFiles = Object.values(components).filter((contract) => /\/types?\.ts$/.test(contract.source)).length
  return {
    schemaVersion: 1, version: '2.3.2',
    source: { path: '.wot-ref/src-2.3.2', description: 'Official offline release; runtime type.ts/types.ts exports, with SFC fallback. Never generated from local props.' },
    evaluation: { clock, timeZone: 'UTC', functionSource: 'TypeScript token stream; trivia stripped, string quotes normalized' },
    coverage: { officialComponents: names.length, verifiedComponents: Object.keys(components).length, fromTypeFiles, fromSFC: Object.keys(components).length - fromTypeFiles, verifiedInternals: Object.keys(internals).length, unverifiedCount: unverified.length },
    components, internals, unverified
  }
}

export const EXCEPTIONS = Object.freeze([
  { component: '*', prop: 'customStyle', field: 'type', official: ['String'], local: ['String', 'Object'], reason: 'CONVENTIONS §19: accept Lynx object styles as well as official strings.' },
  { component: 'wd-circle', prop: 'color', field: 'default', official: { kind: 'value', value: '#1C64FD' }, local: { kind: 'value', value: '#755FFE' }, reason: 'Explicit local branding color exception.' }
])
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export function compareProps(component, official, actual) {
  const differences = []
  const additions = Object.keys(actual).filter((prop) => !own(official, prop)).sort()
  for (const [prop, expected] of Object.entries(official)) {
    if (!own(actual, prop)) { differences.push({ component, prop, field: 'name', official: 'present', local: 'missing' }); continue }
    for (const field of ['type', 'required', 'default', 'validator']) {
      if (equal(expected[field], actual[prop][field])) continue
      const excepted = EXCEPTIONS.some((exception) => (exception.component === '*' || exception.component === component) && exception.prop === prop && exception.field === field && equal(exception.official, expected[field]) && equal(exception.local, actual[prop][field]))
      if (!excepted) differences.push({ component, prop, field, official: expected[field], local: actual[prop][field] })
    }
  }
  // Additive local APIs do not remove the official migration contract. They are
  // reported, not hidden or copied into the official fixture as expectations.
  return { differences, additions }
}

export function auditProps(expected, { local = LOCAL } = {}) {
  if (expected.version !== '2.3.2' || expected.schemaVersion !== 1) throw new Error('Unsupported official prop fixture')
  const loader = createScopedLoader(local, { clock: expected.evaluation.clock })
  const differences = []
  const additions = []
  const unverified = [...expected.unverified]
  let verifiedComponents = 0
  let verifiedInternals = 0
  for (const [kind, contracts] of [['components', expected.components], ['internals', expected.internals]]) {
    for (const [component, official] of Object.entries(contracts)) {
      try {
        const actual = componentContract(join(local, 'components', component), loader)
        const result = compareProps(component, official.props, actual.props)
        differences.push(...result.differences)
        if (result.additions.length) additions.push({ component, props: result.additions })
        if (kind === 'components') verifiedComponents++
        else verifiedInternals++
      } catch (error) { unverified.push({ component, reason: error.message }) }
    }
  }
  const localOnly = directories(join(local, 'components')).filter((name) => !own(expected.components, name) && !expected.unverified.some((item) => item.component === name))
  return { version: expected.version, coverage: expected.coverage, verifiedComponents, verifiedInternals, differences, additions, unverified, localOnly: localOnly.map((component) => ({ component, reason: 'No component in the offline official 2.3.2 archive; official props unverified.' })), exceptions: EXCEPTIONS }
}

export function formatDifference(difference) {
  return `${difference.component}.${difference.prop} ${difference.field}: official=${JSON.stringify(difference.official)} local=${JSON.stringify(difference.local)}`
}

export function main(args = process.argv.slice(2)) {
  if (args.some((arg) => !['--update-fixture', '--json'].includes(arg))) throw new Error('Usage: node scripts/check-wot-props.mjs [--update-fixture] [--json]')
  let expected
  if (args.includes('--update-fixture')) {
    expected = buildOfficialFixture()
    // Do not silently replace a good fixture with partial/failed extraction.
    if (expected.unverified.length) throw new Error(`Official extraction incomplete:\n${expected.unverified.map((item) => `${item.component}: ${item.reason}`).join('\n')}`)
    if (existsSync(FIXTURE)) readFileSync(FIXTURE, 'utf8')
    writeFileSync(FIXTURE, JSON.stringify(expected, null, 2) + '\n')
  } else expected = JSON.parse(readFileSync(FIXTURE, 'utf8'))
  const result = auditProps(expected)
  if (args.includes('--json')) console.log(JSON.stringify(result, null, 2))
  else {
    console.log(`Official 2.3.2 props: ${result.verifiedComponents}/${expected.coverage.officialComponents} components (${expected.coverage.fromTypeFiles} type modules + ${expected.coverage.fromSFC} SFCs), ${result.verifiedInternals} internal modules.`)
    for (const difference of result.differences) console.log(formatDifference(difference))
    for (const item of result.unverified) console.log(`UNVERIFIED ${item.component}: ${item.reason}`)
    for (const item of result.additions) console.log(`ADDITIVE ${item.component}: ${item.props.join(', ')}`)
    for (const item of result.localOnly) console.log(`UNVERIFIED LOCAL-ONLY ${item.component}: absent from official archive`)
    console.log(`Differences: ${result.differences.length}; unverified official contracts: ${result.unverified.length}; local-only unverified components: ${result.localOnly.length}.`)
  }
  if (result.differences.length || result.unverified.length) process.exitCode = 1
  return result
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
