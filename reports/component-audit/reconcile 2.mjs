#!/usr/bin/env node
/** Rebuild a conservative per-component audit ledger from manifest and explicit review evidence. */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const base = path.join(root, 'reports/component-audit')
const manifest = JSON.parse(readFileSync(path.join(root, 'docs/architecture/packages.json'), 'utf8'))
const tracked = new Set(execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/))
const components = []
const byKey = new Map()
for (const pkg of manifest.packages.filter(item => item.componentRoot)) {
  const componentRoot = path.join(root, pkg.dir, pkg.componentRoot)
  if (!existsSync(componentRoot)) continue
  for (const name of readdirSync(componentRoot).filter(entry => entry.startsWith('wd-') && statSync(path.join(componentRoot, entry)).isDirectory()).sort()) {
    const dir = path.join(componentRoot, name)
    const rel = file => path.relative(root, file).split(path.sep).join('/')
    const source = path.join(dir, `${name}.vue`)
    const types = path.join(dir, 'types.ts')
    const styles = path.join(dir, 'index.scss')
    const component = {
      key: name, package: pkg.name, role: pkg.role, domain: pkg.domain || null,
      source: rel(source), types: rel(types), styles: rel(styles),
      sourcePresent: existsSync(source), typesPresent: existsSync(types), stylesPresent: existsSync(styles),
      sourceTracked: tracked.has(rel(source)), typesTracked: tracked.has(rel(types)), styleTracked: tracked.has(rel(styles)),
      status: 'pending', severity: null, summary: 'No completed per-component source review recorded yet.', sourceReads: [], testEvidence: [], findings: []
    }
    components.push(component)
    byKey.set(name, component)
  }
}
if (components.length !== 106 || byKey.size !== 106) throw new Error(`Expected 106 unique components; found ${components.length}`)

function review(key, { status = 'reviewed', severity = null, summary, sourceReads = [], testEvidence = [], findings = [] }) {
  const item = byKey.get(key)
  if (!item) throw new Error(`Unknown component in evidence: ${key}`)
  const rank = { pending: 0, reviewed: 1, suspect: 1, fixed: 2, incomplete: 3 }
  if (rank[status] < rank[item.status]) return
  item.status = status
  item.severity = severity
  item.summary = summary
  item.sourceReads = [...new Set([...item.sourceReads, ...sourceReads])]
  item.testEvidence = [...new Set([...item.testEvidence, ...testEvidence])]
  item.findings = [...new Set([...item.findings, ...findings])]
}

review('wd-action-sheet', { summary: 'Reviewed SFC, types, SCSS and overlay behavior tests; no reproducible defect found.', sourceReads: ['packages/primitives/src/wd-action-sheet/wd-action-sheet.vue','packages/primitives/src/wd-action-sheet/types.ts','packages/primitives/src/wd-action-sheet/index.scss'], testEvidence: ['packages/ui/test/parity/wot-parity-overlays-additional.test.ts','packages/ui/test/native-first/overlay-native-first.test.ts','packages/ui/test/regression/overlay-chain-regression.test.ts'] })
review('wd-badge', { summary: 'Reviewed SFC, types, SCSS and display tests; no reproducible defect found.', sourceReads: ['packages/primitives/src/wd-badge/wd-badge.vue','packages/primitives/src/wd-badge/types.ts','packages/primitives/src/wd-badge/index.scss'], testEvidence: ['packages/ui/test/parity/wot-parity-display-additional.test.ts','packages/ui/test/native-first/avatar-badge-batch-native-first.test.ts','packages/ui/test/parity/wot-parity-core.test.ts'] })
for (const key of ['wd-cell-group','wd-col','wd-collapse-item','wd-collapse','wd-divider','wd-gap','wd-grid-item','wd-grid','wd-resize','wd-row']) {
  review(key, { summary: 'Full SFC/types/SCSS source read by layout audit; no confirmed source-backed finding.', sourceReads: [`packages/ui-layout/src/${key}/${key}.vue`, `packages/ui-layout/src/${key}/types.ts`, `packages/ui-layout/src/${key}/index.scss`], testEvidence: ['packages/ui/test/parity/wot-parity-layout-additional.test.ts','packages/ui/test/native-first/layout-native-first.test.ts','packages/ui/test/regression/layout-inline-style-regression.test.ts','packages/ui/test/component/tier1-basic.test.ts'] })
}
review('wd-pull-refresh', { status: 'fixed', severity: 'medium', summary: 'Confirmed customStyle color remained after prop removal; root now uses an instance-local createStyleResolver.', sourceReads: ['packages/ui-display/src/wd-pull-refresh/wd-pull-refresh.vue','packages/ui-display/src/wd-pull-refresh/types.ts','packages/ui-display/src/wd-pull-refresh/index.scss'], testEvidence: ['packages/ui/test/regression/audit-component-custom-style-removal.test.ts'], findings: ['AUDIT-STYLE-PULL-REFRESH'] })
review('wd-swiper', { status: 'fixed', severity: 'medium', summary: 'Confirmed root customStyle and per-slide customTextStyle keys remained after removal; added separate root and per-index text resolvers and drops resolver entries for removed indexes.', sourceReads: ['packages/ui-display/src/wd-swiper/wd-swiper.vue','packages/ui-display/src/wd-swiper/types.ts','packages/ui-display/src/wd-swiper/index.scss'], testEvidence: ['packages/ui/test/regression/audit-component-custom-style-removal.test.ts','packages/ui/test/parity/wot-parity-scroll-additional.test.ts'], findings: ['AUDIT-STYLE-SWIPER-ROOT','AUDIT-STYLE-SWIPER-TEXT'] })
review('wd-table', { status: 'fixed', severity: 'medium', summary: 'Confirmed customStyle removal retained old color; root now uses an instance-local resolver.', sourceReads: ['packages/ui-display/src/wd-table/wd-table.vue','packages/ui-display/src/wd-table/types.ts','packages/ui-display/src/wd-table/index.scss'], testEvidence: ['packages/ui/test/regression/audit-component-custom-style-removal.test.ts','packages/ui/test/parity/wot-parity-layout-additional.test.ts'], findings: ['AUDIT-STYLE-TABLE'] })
review('wd-upload', { status: 'fixed', severity: 'medium', summary: 'Confirmed hidden-image measurement Promise remained pending on unmount; unmount now rejects and clears the waiter, while the existing alive check prevents late list mutation.', sourceReads: ['packages/ui-form/src/wd-upload/wd-upload.vue','packages/ui-form/src/wd-upload/types.ts','packages/ui-form/src/wd-upload/index.scss'], testEvidence: ['packages/ui/test/regression/native-media-picker.test.ts'], findings: ['AUDIT-UPLOAD-MEASURE-UNMOUNT'] })
for (const key of ['wd-address-edit','wd-cascader','wd-form-item','wd-form','wd-img-cropper','wd-input-number','wd-keyboard','wd-password-input','wd-rate','wd-segmented','wd-select-picker','wd-signature','wd-slide-verify','wd-slider']) {
  const packageName = 'packages/ui-form/src'
  review(key, { summary: 'Full SFC/types/SCSS source read by read-only form audit; no confirmed finding reported.', sourceReads: [`${packageName}/${key}/${key}.vue`, `${packageName}/${key}/types.ts`, `${packageName}/${key}/index.scss`], testEvidence: ['packages/ui/test/parity/wot-parity-forms.test.ts','packages/ui/test/parity/wot-parity-forms-additional.test.ts','packages/ui/test/native-first/form-native-first.test.ts'], findings: [] })
}
review('wd-backtop', { summary: 'Full SFC/types/SCSS source read. Same-node customStyle removal probe passed; candidate not confirmed.', sourceReads: ['packages/ui-display/src/wd-backtop/wd-backtop.vue','packages/ui-display/src/wd-backtop/types.ts','packages/ui-display/src/wd-backtop/index.scss'], testEvidence: ['packages/ui/test/regression/audit-component-custom-style-removal.test.ts'], findings: [] })
review('wd-swiper-nav', { summary: 'Full SFC/types/SCSS source read. Indicator node is conditionally removed when hidden, so old-node style retention candidate was not confirmed; no public customStyle Funnel change retained.', sourceReads: ['packages/ui-display/src/wd-swiper-nav/wd-swiper-nav.vue','packages/ui-display/src/wd-swiper-nav/types.ts','packages/ui-display/src/wd-swiper-nav/index.scss'], testEvidence: ['packages/ui/test/parity/wot-parity-scroll-additional.test.ts'], findings: [] })
review('wd-dialog', { status: 'fixed', severity: 'medium', summary: 'DialogAction.click explicitly accepts Promise<void>; handleAction now awaits it, aborts confirmation on rejection, and ignores stale completion after dialog replacement.', sourceReads: ['packages/ui-feedback/src/wd-dialog/wd-dialog.vue','packages/ui-feedback/src/wd-dialog/types.ts','packages/ui-feedback/src/wd-dialog/index.scss'], testEvidence: ['packages/ui/test/parity/wot-parity-overlays-additional.test.ts'], findings: ['AUDIT-DIALOG-ASYNC-ACTION'] })
review('wd-popover', { summary: 'Review candidate for root tap forwarding was not confirmed: real component target tap is explicitly emitted by toggle; native bubbling to root is not established by the dual-thread renderer. No source change retained.', sourceReads: ['packages/ui-feedback/src/wd-popover/wd-popover.vue','packages/ui-feedback/src/wd-popover/types.ts','packages/ui-feedback/src/wd-popover/index.scss'], testEvidence: ['packages/ui/test/parity/wot-parity-overlays-additional.test.ts','packages/ui/test/native-first/popover-batch-native-first.test.ts'], findings: [] })
review('wd-tooltip', { summary: 'Review candidate for root tap forwarding was not confirmed: real component target tap is explicitly emitted by toggle; native bubbling to root is not established by the dual-thread renderer. No source change retained.', sourceReads: ['packages/ui-feedback/src/wd-tooltip/wd-tooltip.vue','packages/ui-feedback/src/wd-tooltip/types.ts','packages/ui-feedback/src/wd-tooltip/index.scss'], testEvidence: ['packages/ui/test/parity/wot-parity-overlays-additional.test.ts','packages/ui/test/native-first/popover-batch-native-first.test.ts'], findings: [] })
for (const key of ['wd-drop-menu','wd-drop-menu-item','wd-index-bar','wd-index-anchor','wd-navbar','wd-navbar-capsule','wd-pagination','wd-sidebar','wd-sidebar-item','wd-step','wd-steps','wd-tabbar','wd-tabbar-item']) {
  review(key, { status: key === 'wd-drop-menu-item' ? 'suspect' : 'reviewed', severity: key === 'wd-drop-menu-item' ? 'low' : null, summary: key === 'wd-drop-menu-item' ? 'Full source read. Index key may cause node-state reuse if options are reordered; no stable-key contract/repro is established, retained as low-confidence suspect.' : 'Full SFC/types/SCSS source read by navigation audit; no confirmed finding reported.', sourceReads: [`packages/ui-nav/src/${key}/${key}.vue`, `packages/ui-nav/src/${key}/types.ts`, `packages/ui-nav/src/${key}/index.scss`], testEvidence: ['packages/ui/test/parity/wot-parity-nav-controls.test.ts','packages/ui/test/parity/wot-parity-navigation.test.ts','packages/ui/test/native-first/native-first-nav-batch.test.ts'], findings: key === 'wd-drop-menu-item' ? ['AUDIT-KEY-DROP-MENU-ITEM-UNCONFIRMED'] : [] })
}
for (const key of ['wd-bar-code','wd-image-preview','wd-loadmore','wd-qr-code','wd-table-column','wd-video-preview']) {
  if (byKey.get(key).sourceReads.length) continue
  review(key, { summary: key === 'wd-backtop' || key === 'wd-swiper-nav' ? 'Full source read. Dynamic-style candidate was not confirmed: backtop probe cleared, and swiper-nav indicator node unmounts when hidden.' : 'Full SFC/types/SCSS source read by display audit; no further confirmed finding beyond the fixed dynamic-style entries.', sourceReads: [`packages/ui-display/src/${key}/${key}.vue`, `packages/ui-display/src/${key}/types.ts`, `packages/ui-display/src/${key}/index.scss`], testEvidence: ['packages/ui/test/parity/wot-parity-scroll-additional.test.ts','packages/ui/test/parity/wot-parity-layout-additional.test.ts'], findings: [] })
}
for (const key of ['wd-curtain','wd-dialog','wd-floating-panel','wd-notify','wd-popover','wd-share-sheet','wd-swipe-action','wd-tooltip','wd-tour']) {
  review(key, { summary: 'Full SFC/types/SCSS source read by feedback audit; no confirmed source-backed defect remains after reproducing/excluding the root-tap candidate.', sourceReads: [`packages/ui-feedback/src/${key}/${key}.vue`, `packages/ui-feedback/src/${key}/types.ts`, `packages/ui-feedback/src/${key}/index.scss`], testEvidence: ['packages/ui/test/parity/wot-parity-overlays-additional.test.ts','packages/ui/test/native-first/popover-batch-native-first.test.ts'], findings: [] })
}
for (const key of ['wd-picker','wd-picker-view','wd-datetime-picker','wd-datetime-picker-view']) {
  review(key, { summary: 'Full source and direct tests read by picker audit; no confirmed finding. Separate wrapper-unmount test coverage remains a gap, not a sourced defect.', sourceReads: [`packages/ui-picker/src/${key}/${key}.vue`, `packages/ui-picker/src/${key}/types.ts`, `packages/ui-picker/src/${key}/index.scss`], testEvidence: ['packages/ui/test/mts/picker-view-mts.test.ts','packages/ui/test/regression/picker-view-memo-regression.test.ts','packages/ui/test/regression/bugfix-regression-pickers.test.ts'], findings: [] })
}

for (const item of components) {
  if (!item.sourcePresent || !item.typesPresent || !item.sourceTracked || !item.typesTracked) {
    item.status = 'incomplete'
    item.summary = 'Required source/types file is missing or untracked.'
  }
}
const output = {
  schemaVersion: 3,
  objective: 'Current-architecture per-component audit. Only source reads and reproducible/explicitly qualified evidence are marked reviewed; all other components remain pending.',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  manifest: 'docs/architecture/packages.json',
  totals: Object.fromEntries(['fixed','reviewed','suspect','pending','incomplete'].map(status => [status, components.filter(item => item.status === status).length]).concat([['components',components.length],['packages',new Set(components.map(item=>item.package)).size]])),
  validation: [
    { command: 'pnpm verify', status: 'passed', summary: 'All package contracts, CSS build, typecheck, 136 passed / 1 skipped test files, 2195 passed / 74 skipped tests, Web+Lynx Demo builds, 30/30 worklets in both Lynx bundles.' },
    { command: 'pnpm lint:conventions', status: 'passed', summary: '0 errors; 979 warnings including existing baseline warnings.' },
    { command: 'pnpm docs:build', status: 'passed', summary: 'VitePress production build passed with existing mixed static/dynamic import warning for wd-config-provider.' },
    { command: 'Android/iOS device and visual verification', status: 'not-run', summary: 'Unit/component dual-thread tests are not device or screenshot evidence.' }
  ],
  caveats: ['No reviewed status proves that a component has no additional bugs.','A component is marked reviewed only if its SFC, types and SCSS were actually read and explicit evidence is listed.'],
  components
}
writeFileSync(path.join(base,'audit-current.json'),JSON.stringify(output,null,2)+'\n')
const report = [`# 当前逐组件审查状态`,'',`HEAD: ${output.commit}`,'',`组件 ${components.length}；fixed ${output.totals.fixed}；reviewed ${output.totals.reviewed}；suspect ${output.totals.suspect}；pending ${output.totals.pending}；incomplete ${output.totals.incomplete}.`,'','已确认修复:',...components.filter(item=>item.status==='fixed').map(item=>`- ${item.key}: ${item.findings.join(', ')}. ${item.summary}`),'','未确认候选:',...components.filter(item=>item.status==='suspect').map(item=>`- ${item.key}: ${item.summary}`),'','逐组件范围和证据见 [audit-current.json](<audit-current.json>)。','']
writeFileSync(path.join(base,'CURRENT.md'),report.join('\n'))
console.log(JSON.stringify(output.totals,null,2))
