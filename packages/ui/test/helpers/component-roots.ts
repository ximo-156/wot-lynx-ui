/**
 * component-roots.ts — 双组件根解析（ADR-012）。
 *
 * 背景：L3.5 基础件层（src/primitives）与 L4 业务组件层（src/components）
 * 是**两个平级的组件根**。历史上测试统一写 `src/components`，primitives
 * 迁移后有 8 个测试因读不到 `wd-cell/index.css` 之类的产物而失败。
 *
 * 约定：任何需要「按组件名定位目录/读产物」的测试，一律走本模块，
 * 不要再硬编码 `src/components`。新增组件根时只需改 COMPONENT_ROOTS。
 *
 * 用法：
 *   import { compCss, compDir, listComponents } from './helpers/component-roots'
 *
 *   const css = compCss('wd-cell')                    // 读 wd-cell/index.css
 *   const css = compCss('wd-cell', 'monthPanel/index.css')
 *   const dir = compDir('wd-button')                  // 组件目录绝对路径
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..', '..', 'src')

/** L3.5 基础件根（高频叶子组件，见 ADR-012） */
export const PRIMITIVES_DIR = join(SRC, 'primitives')
/** L4 业务组件根 */
export const COMPONENTS_DIR = join(SRC, 'components')
/** 全部组件根。顺序即优先级（基础件在前），新增根必须加在这里 */
export const COMPONENT_ROOTS = [PRIMITIVES_DIR, COMPONENTS_DIR]

/** 组件目录是否存在（任一根本命中即为 true） */
export function hasComponent(name: string): boolean {
  return COMPONENT_ROOTS.some((root) => existsSync(join(root, name)))
}

/**
 * 定位组件目录；找不到返回 null。
 * 调用方应自行决定是跳过用例还是断言失败——参考副本缺失（.wot-ref）
 * 与真实回归要用不同的失败语义。
 */
export function findComponentDir(name: string): string | null {
  for (const root of COMPONENT_ROOTS) {
    const dir = join(root, name)
    if (existsSync(dir)) return dir
  }
  return null
}

/** 定位组件目录；找不到直接抛错（断言路径拼错的场景） */
export function compDir(name: string): string {
  const dir = findComponentDir(name)
  if (!dir) {
    throw new Error(
      `组件目录不存在：${name}。已搜索：${COMPONENT_ROOTS.map((r) => r.replace(SRC, 'src')).join(' / ')}`
    )
  }
  return dir
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

/** 列出两个根下的全部组件名（wd-*），按字典序 */
export function listComponents(): string[] {
  const names = new Set<string>()
  for (const root of COMPONENT_ROOTS) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root)) {
      if (entry.startsWith('wd-') && existsSync(join(root, entry))) names.add(entry)
    }
  }
  return [...names].sort()
}
