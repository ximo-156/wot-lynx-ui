/*
 * 内置图标注册表。
 *
 * 设计动机：
 * - 内置图标以两种形态注册（CONVENTIONS §8）：
 *   - wot 集（src/icons/data.ts，302 个）：SVG path 数据，经原生 svg 元素的
 *     content 渲染——与 wot-ui 对齐的通用图标，组件内部图标默认取此；
 *   - iconfont 集（src/icons/sets/iconfont.ts，180 个）：.ttf 字体图标
 *     （src/icons/fonts/iconfont.ttf + @font-face），经 <text> 字形渲染。
 * - 寻址规则：
 *   - `name` 带 `集合键:` 前缀（如 `iconfont:menu`）时精确命中该集合，
 *     用于取用与既有图标重名的字形；
 *   - 不带前缀时按注册顺序回退查找（wot 优先，保证存量图标行为不变），
 *     因此非重名的新图标可直接 `<wd-icon name="pdf" />` 使用；
 *   - name 含 `/` 由 wd-icon 判定为图片，不进入本表。
 */
import { ICON_VIEW_BOX, iconPaths } from './data'
import { iconfontSet } from './sets/iconfont'
import type { IconPaths, IconSet, ResolvedIcon } from './types'

/** 注册顺序即回退查找顺序：wot 集必须首位，保证存量名字命中旧字形 */
const iconSets = new Map<string, IconSet>()

/** 集合键分隔符：`key:name` */
const SET_KEY_SEPARATOR = ':'

registerIconSet({ key: 'wot', type: 'svg', viewBox: ICON_VIEW_BOX, paths: iconPaths })
registerIconSet(iconfontSet)

/**
 * 注册一套图标集（扩展入口）。
 *
 * 同名集合键重复注册时整体覆盖（热更新场景）；
 * 为避免歧义，非 wot 集合之间若图标重名，按注册顺序先到先得。
 */
export function registerIconSet(set: IconSet): void {
  if (!set || !set.key || (set.type !== 'svg' && set.type !== 'font')) {
    console.warn('[wd-icon] registerIconSet 收到非法的图标集，已忽略')
    return
  }
  if (set.type === 'svg' && !set.paths) {
    console.warn('[wd-icon] registerIconSet 收到非法的图标集（缺少 paths），已忽略')
    return
  }
  if (set.type === 'font' && (!set.unicodes || !set.fontFamily)) {
    console.warn('[wd-icon] registerIconSet 收到非法的图标集（缺少 unicodes/fontFamily），已忽略')
    return
  }
  iconSets.set(set.key, set)
}

/** 归一化 path 数据为数组（渲染侧统一注入 fill） */
function toPaths(paths: IconPaths): readonly string[] {
  return typeof paths === 'string' ? [paths] : paths
}

/** 在指定集合内解析单个图标名，未命中返回 null */
function resolveFromSet(setKey: string, set: IconSet, iconName: string): ResolvedIcon | null {
  if (set.type === 'font') {
    const unicode = set.unicodes[iconName]
    if (!unicode) return null
    return { type: 'font', setKey, fontFamily: set.fontFamily, unicode }
  }
  const paths = set.paths[iconName]
  if (!paths) return null
  return { type: 'svg', setKey, viewBox: set.viewBox, paths: toPaths(paths) }
}

/**
 * 解析图标名，返回命中的集合与渲染所需数据；未命中返回 null。
 *
 * @param name 图标名，支持 `集合键:图标名` 形式
 */
export function resolveIcon(name: string): ResolvedIcon | null {
  if (!name) return null

  const separatorIndex = name.indexOf(SET_KEY_SEPARATOR)
  if (separatorIndex > 0) {
    // 带前缀：只认指定集合，取不到不静默回退（避免误渲染另一套字形）
    const setKey = name.slice(0, separatorIndex)
    const iconName = name.slice(separatorIndex + 1)
    const set = iconSets.get(setKey)
    if (!set) return null
    return resolveFromSet(setKey, set, iconName)
  }

  // 不带前缀：按注册顺序回退（wot 优先）
  for (const [setKey, set] of iconSets) {
    const resolved = resolveFromSet(setKey, set, name)
    if (resolved) return resolved
  }
  return null
}

/** 图标名是否命中任一内置集合（wd-icon 判定走内置渲染的依据） */
export function hasIcon(name: string): boolean {
  return resolveIcon(name) !== null
}

/** 列出全部已注册集合的键与图标数（调试 / 文档用） */
export function listIconSets(): Array<{ key: string; count: number }> {
  return [...iconSets].map(([key, set]) => ({
    key,
    count: Object.keys(set.type === 'font' ? set.unicodes : set.paths).length
  }))
}

/**
 * 列出图标名。不带 setKey 时返回全部集合的图标名（重名去重，
 * 即只保留回退查找会命中的那个）；带 setKey 时返回该集合全部图标名。
 */
export function listIcons(setKey?: string): string[] {
  if (setKey) {
    const set = iconSets.get(setKey)
    if (!set) return []
    return Object.keys(set.type === 'font' ? set.unicodes : set.paths)
  }
  const names: string[] = []
  const seen = new Set<string>()
  for (const [, set] of iconSets) {
    for (const name of Object.keys(set.type === 'font' ? set.unicodes : set.paths)) {
      if (!seen.has(name)) {
        seen.add(name)
        names.push(name)
      }
    }
  }
  return names
}
