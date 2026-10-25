import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import {
import { compDir } from './helpers/component-roots'
  CLOCK, FIXTURE, LOCAL, REFERENCE,
  EXCEPTIONS, auditProps, buildOfficialFixture, canonicalFunction,
  compareProps, componentContract, createScopedLoader, formatDifference, snapshotProps
} from '../../../../scripts/check-wot-props.mjs'
import { compDir } from '../helpers/component-roots'

// No source reference is required in CI: expected values are pinned from the
// official archive, never inferred from the implementation being tested.
const official = JSON.parse(readFileSync(FIXTURE, 'utf8'))
const loader = createScopedLoader(LOCAL, { clock: official.evaluation.clock })
const contracts = [...Object.entries(official.components), ...Object.entries(official.internals)] as [string, any][]
const sourcePresent = existsSync(join(REFERENCE, 'components'))

function localProps(component: string) {
  return componentContract(compDir(component), loader).props
}

function synthetic(source: string) {
  return loader.evaluate(source, join(LOCAL, 'common/prop-audit-synthetic.ts'))
}

describe('official wot-ui 2.3.2 runtime prop parity', () => {
  it('pins honest component, type-module, SFC and internal coverage', () => {
    expect(official.version).toBe('2.3.2')
    expect(official.schemaVersion).toBe(1)
    expect(official.evaluation).toMatchObject({ clock: CLOCK, timeZone: 'UTC' })
    expect(official.coverage).toEqual({
      officialComponents: 101, verifiedComponents: 101,
      fromTypeFiles: 98, fromSFC: 3, verifiedInternals: 5, unverifiedCount: 0
    })
    expect(Object.keys(official.components)).toHaveLength(official.coverage.verifiedComponents)
    expect(Object.keys(official.internals)).toHaveLength(official.coverage.verifiedInternals)
    expect(official.unverified).toEqual([])
    expect(official.components['wd-index-bar'].source).toBe('components/wd-index-bar/type.ts')
    expect(official.components['wd-index-anchor'].source).toBe('components/wd-index-anchor/type.ts')
    expect(official.components['wd-floating-panel'].source).toBe('components/wd-floating-panel/type.ts')
    expect(official.components['wd-sticky-box'].source).toBe('components/wd-sticky-box/wd-sticky-box.vue')
    expect(official.components['wd-root-portal'].source).toBe('components/wd-root-portal/wd-root-portal.vue')
    expect(official.components['wot-ui'].source).toBe('components/wot-ui/wot-ui.vue')
    expect(official.components['wot-ui'].props).toEqual({})
  })

  it.each(contracts)('%s preserves official prop names, constructors, required, defaults and validators', (component, expected) => {
    const result = compareProps(component, expected.props, localProps(component))
    expect(result.differences.map(formatDifference), 'Only the two explicit style/branding exceptions are permitted').toEqual([])
  })

  it('does not silently count unsupported or local-only components as official coverage', () => {
    const audit = auditProps(official)
    expect(audit.verifiedComponents).toBe(official.coverage.verifiedComponents)
    expect(audit.verifiedInternals).toBe(official.coverage.verifiedInternals)
    expect(audit.unverified).toEqual([])
    expect(audit.differences.map(formatDifference)).toEqual([])
    expect(audit.localOnly.map((item: any) => item.component)).toEqual([
      'wd-address-edit', 'wd-bar-code', 'wd-coupon', 'wd-pull-refresh', 'wd-share-sheet', 'wd-submit-bar'
    ])
    expect(audit.localOnly.every((item: any) => item.reason.includes('unverified'))).toBe(true)
    expect(audit.additions).toEqual([{ component: 'wot-ui', props: ['customClass', 'customStyle'] }])
    // 这里要跑完 101 个组件的运行时 prop 提取（TS VM 逐个求值），空载 ~2s、
    // 并行高负载实测 10.4s，会撞默认 5s 上限。放宽的是这一条的重活预算。
  }, 60_000)

  it.skipIf(!sourcePresent)('reproduces the pinned fixture from the official offline archive alone', () => {
    expect(buildOfficialFixture()).toEqual(official)
    // 同上：重建 fixture 要再跑一遍全部官方源码。
  }, 60_000)
})

describe('runtime prop extractor guardrails', () => {
  it('expands real shared helpers/spreads and preserves Boolean/String order and null unions', () => {
    const exports = synthetic(`
      import { baseProps, makeArrayProp, makeRequiredProp, numericProp, truthProp, unknownProp } from './props'
      export const props = {
        ...baseProps, rows: makeArrayProp<string>(), value: makeRequiredProp(numericProp),
        enabled: truthProp, unknown: unknownProp,
        ordered: { type: [Boolean, String], default: false },
        nullable: { type: [Number, Array, null], required: true }
      }
    `)
    const actual = snapshotProps(exports.props)
    expect(actual.customStyle.type).toEqual(['String', 'Object'])
    expect(actual.customClass.default).toEqual({ kind: 'value', value: '' })
    expect(actual.value).toMatchObject({ type: ['Number', 'String'], required: true, default: { kind: 'absent' } })
    expect(actual.enabled.default).toEqual({ kind: 'value', value: true })
    expect(actual.unknown.type).toBeNull()
    expect(actual.rows.default).toEqual({ kind: 'factory', source: '( ) => [ ]', value: [] })
    expect(actual.ordered.type).toEqual(['Boolean', 'String'])
    expect(actual.nullable.type).toEqual(['Number', 'Array', null])
    const changed = JSON.parse(JSON.stringify(actual))
    changed.ordered.type.reverse()
    expect(compareProps('sample', actual, changed).differences).toMatchObject([{ prop: 'ordered', field: 'type' }])
  })

  it('distinguishes missing, undefined, null and factory defaults; records functions without invoking them', () => {
    const exports = synthetic(`
      export const props = {
        absent: String, undef: { type: String, default: undefined }, nil: { type: String, default: null },
        record: { type: Object, default: () => ({ align: 'right', type: 'outer' }) },
        callback: { type: Function, default: () => { throw new Error('must not be called') } },
        checked: { type: Number, default: 0, validator(value: number) { return value >= 0 } }
      }
    `)
    const actual = snapshotProps(exports.props)
    expect(actual.absent.default).toEqual({ kind: 'absent' })
    expect(actual.undef.default).toEqual({ kind: 'value', value: { $type: 'undefined' } })
    expect(actual.nil.default).toEqual({ kind: 'value', value: null })
    expect(actual.record.default).toEqual({
      kind: 'factory', source: '( ) => ( { align : "right" , type : "outer" } )', value: { align: 'right', type: 'outer' }
    })
    expect(actual.callback.default.kind).toBe('function')
    expect(actual.callback.default.source).toContain('must not be called')
    expect(actual.checked.validator).toBe('validator ( value ) { return value >= 0 ; }')
    expect(canonicalFunction("() => ['album', 'camera']")).toBe(canonicalFunction('() => [ "album", /* trivia */ "camera" ]'))
  })

  it('detects factory-source and validator drift even when a sampled default value matches', () => {
    const first = snapshotProps(synthetic(`export const props = {
      rows: { type: Array, default: () => [] },
      count: { type: Number, validator(value: number) { return value >= 0 } }
    }`).props)
    const second = snapshotProps(synthetic(`export const props = {
      rows: { type: Array, default: () => { return [] } },
      count: { type: Number, validator(value: number) { return value > 0 } }
    }`).props)
    expect(first.rows.default.value).toEqual(second.rows.default.value)
    expect(compareProps('sample', first, second).differences.map((item: any) => [item.prop, item.field])).toEqual([
      ['count', 'validator'], ['rows', 'default']
    ])
  })

  it('uses an isolated fixed UTC clock for date defaults, without changing Node global Date', () => {
    const date = Date
    const snapshot = snapshotProps(synthetic(`export const props = {
      date: { type: Number, default: new Date().getTime() },
      min: { type: Number, default: new Date(new Date().getFullYear() - 10, 0, 1).getTime() },
      max: { type: Number, default: new Date(new Date().getFullYear() + 10, 11, 31, 23, 59, 59).getTime() }
    }`).props)
    expect(snapshot.date.default.value).toBe(Date.parse(CLOCK))
    expect(snapshot.min.default.value).toBe(Date.UTC(2014, 0, 1))
    expect(snapshot.max.default.value).toBe(Date.UTC(2034, 11, 31, 23, 59, 59))
    expect(Date).toBe(date)
    expect(official.components['wd-datetime-picker'].props.maxDate.default.value).toBe(Date.UTC(2034, 11, 31, 23, 59, 59))
    // This distinction is official: picker-view's max is midnight, not 23:59:59.
    expect(official.components['wd-datetime-picker-view'].props.maxDate.default.value).toBe(Date.UTC(2034, 11, 31))
  })

  it('restricts runtime loading to source-tree TS and does not install global require hooks', () => {
    const nodeRequire = createRequire(join(LOCAL, '../package.json'))
    const extensions = { ...nodeRequire.extensions }
    expect(() => loader.load(join(LOCAL, '../vitest.config.ts'))).toThrow('outside its .ts scope')
    expect(() => synthetic(`import { readFileSync } from 'node:fs'; export const props = { read: readFileSync }`)).toThrow('refused external dependency')
    expect(() => synthetic(`import { unsupportedPropHelper } from 'vue'; export const props = unsupportedPropHelper()`)).toThrow('Unverified Vue helper')
    expect(() => snapshotProps({ unsupported: new Map() as any })).not.toThrow() // Empty options are unrestricted in Vue.
    expect(() => snapshotProps({ custom: { type: Map } })).toThrow('Unverified runtime prop constructor')
    expect(nodeRequire.extensions).toEqual(extensions)
  })

  it('limits exceptions to their exact expected pairs and keeps other defaults strict', () => {
    expect(EXCEPTIONS).toHaveLength(2)
    const style = official.components['wd-button'].props.customStyle
    const localStyle = localProps('wd-button').customStyle
    expect(compareProps('wd-button', { customStyle: style }, { customStyle: localStyle }).differences).toEqual([])
    const wrongStyle = { ...localStyle, type: ['String', 'Object', 'Array'] }
    expect(compareProps('wd-button', { customStyle: style }, { customStyle: wrongStyle }).differences[0].field).toBe('type')
    const changedDefault = { ...localStyle, default: { kind: 'value', value: {} } }
    expect(compareProps('wd-button', { customStyle: style }, { customStyle: changedDefault }).differences[0].field).toBe('default')
    const color = official.components['wd-circle'].props.color
    const branded = localProps('wd-circle').color
    expect(color.default).toEqual({ kind: 'value', value: '#1C64FD' })
    expect(branded.default).toEqual({ kind: 'value', value: '#755FFE' })
    expect(compareProps('wd-circle', { color }, { color: branded }).differences).toEqual([])
    expect(compareProps('wd-other', { color }, { color: branded }).differences[0].field).toBe('default')
    expect(compareProps('wd-circle', { color }, { color: { ...branded, required: !color.required } }).differences[0].field).toBe('required')
    expect(compareProps('wd-circle', { color }, {}).differences[0].field).toBe('name')
  })
})
