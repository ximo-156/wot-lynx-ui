/**
 * component-roots.ts — 多包组件根解析（ADR-023 域包拆分后）。
 *
 * 背景：组件曾集中在 `packages/ui/src/{primitives,components}` 两个根；
 * 2026-11-11 域包拆分后，组件分布在多个包的 `src/wd-*` 下（基础件包 +
 * 六个域包 + 门面）。包边界声明于 `docs/architecture/packages.json`，
 * 本模块只读该清单，不再硬编码任何包的路径。
 *
 * 约定：任何需要「按组件名定位目录/读产物」的测试，一律走本模块，
 * 不要拼 `../../src/components/...` 这类相对路径——组件迁移包时测试零改动。
 *
 * 用法：
 *   import { compCss, compDir, compPath, compRead, listComponents } from './helpers/component-roots'
 *
 *   const css = compCss('wd-cell')                    // 读 wd-cell/index.css
 *   const css = compCss('wd-cell', 'monthPanel')
 *   const dir = compDir('wd-button')                  // 组件目录绝对路径
 *   const src = compRead('wd-button', 'wd-button.vue')
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '..', '..', '..', '..')
const MANIFEST = join(REPO_ROOT, 'docs', 'architecture', 'packages.json')

interface ManifestPackage {
  name: string
  dir: string
  role: string
  domain?: string
  componentRoot: string | null
  layer?: string
}

interface ComponentRoot {
  /**  npm 包名（如 @wot-lynx/ui-form） */
  pkg: string
  /**  包目录绝对路径（package.json 所在目录） */
  pkgDir: string
  /**  包角色（infra / primitives / domain / umbrella） */
  role: string
  /**  组件根绝对路径 */
  dir: string
}

function loadRoots(): ComponentRoot[] {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as { packages: ManifestPackage[] }
  return manifest.packages
    .filter((p) => p.componentRoot)
    .map((p) => ({
      pkg: p.name,
      pkgDir: join(REPO_ROOT, p.dir),
      role: p.role,
      dir: join(REPO_ROOT, p.dir, p.componentRoot)
    }))
}

/** 全部组件根。顺序即优先级（基础件在前），新增包只需改 packages.json */
export const COMPONENT_ROOTS: ComponentRoot[] = loadRoots()

/** 清单里的全部包（含 infra 等无组件根的包），供跨包校验使用 */
export const ALL_PACKAGES: Array<{ pkg: string; pkgDir: string; role: string }> = (
  JSON.parse(readFileSync(MANIFEST, 'utf8')) as { packages: ManifestPackage[] }
).packages.map((p) => ({ pkg: p.name, pkgDir: join(REPO_ROOT, p.dir), role: p.role }))

/** 组件目录是否存在（任一根本命中即为 true） */
export function hasComponent(name: string): boolean {
  return COMPONENT_ROOTS.some((root) => existsSync(join(root.dir, name)))
}

/**
 * 定位组件目录；找不到返回 null。
 * 调用方应自行决定是跳过用例还是断言失败——参考副本缺失（.wot-ref）
 * 与真实回归要用不同的失败语义。
 */
export function findComponentDir(name: string): string | null {
  for (const root of COMPONENT_ROOTS) {
    const dir = join(root.dir, name)
    if (existsSync(dir)) return dir
  }
  return null
}

/** 定位组件目录；找不到直接抛错（断言路径拼错的场景） */
export function compDir(name: string): string {
  const dir = findComponentDir(name)
  if (!dir) {
    throw new Error(
      `组件目录不存在：${name}。已搜索：${COMPONENT_ROOTS.map((r) => r.pkg).join(' / ')}`
    )
  }
  return dir
}

/** 组件所在包名（找不到抛错） */
export function compPackage(name: string): string {
  for (const root of COMPONENT_ROOTS) {
    if (existsSync(join(root.dir, name))) return root.pkg
  }
  throw new Error(`组件不存在：${name}`)
}

/** 组件目录内某文件的绝对路径 */
export function compPath(name: string, ...segments: string[]): string {
  return join(compDir(name), ...segments)
}

/** 读取组件目录内的文件（utf8） */
export function compRead(name: string, ...segments: string[]): string {
  return readFileSync(compPath(name, ...segments), 'utf8')
}

/** 读取组件编译产物 index.css（默认根级，可传子目录） */
export function compCss(name: string, ...segments: string[]): string {
  return compRead(name, ...segments, 'index.css')
}

/** 列出全部组件名（wd-*），按字典序 */
export function listComponents(): string[] {
  const names = new Set<string>()
  for (const root of COMPONENT_ROOTS) {
    if (!existsSync(root.dir)) continue
    for (const entry of readdirSync(root.dir)) {
      if (entry.startsWith('wd-') && existsSync(join(root.dir, entry))) names.add(entry)
    }
  }
  return [...names].sort()
}
