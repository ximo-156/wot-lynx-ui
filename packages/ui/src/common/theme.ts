/**
 * 设计令牌的 JS 侧镜像。
 *
 * SCSS 主题变量（--wd-*）无法在 JS 中读取，少数需要"用 JS 算出颜色"的场景
 * （如 wd-button 给内嵌 loading 下发显式颜色 —— Lynx 的 svg content 不继承
 * CSS currentColor）使用此处的常量。数值与 styles/tokens/_primitive.scss
 * 保持一致，修改色板时需同步更新。
 */

/** 品牌紫阶（与 --wd-purple-* 对应） */
export const PURPLE = {
  1: '#F1EDFF',
  2: '#E4DBFF',
  3: '#C7B8FF',
  4: '#A98FFF',
  5: '#9279FF',
  6: '#7F5CFF',
  7: '#6B47E8',
  8: '#5533C7',
  9: '#4326A0',
  10: '#2F1B6E'
} as const

/** 中性灰阶（与 --wd-gray-* 对应） */
export const GRAY = {
  1: '#F7F8FA',
  2: '#EFF1F5',
  3: '#E4E7ED',
  4: '#D3D7E0',
  5: '#B4BAC7',
  6: '#8B93A3',
  7: '#667085',
  8: '#4A5568',
  9: '#2D3442',
  10: '#171B26'
} as const

/** 成功色阶（与 --wd-green-* 对应） */
export const GREEN = {
  1: '#E8F7F0',
  2: '#C6EBD8',
  3: '#8FD9B7',
  4: '#54C495',
  5: '#22B583',
  6: '#00A06D',
  7: '#00855A',
  8: '#006B48',
  9: '#004A32',
  10: '#00301F'
} as const

/** 警告色阶（与 --wd-amber-* 对应） */
export const AMBER = {
  1: '#FDF6E9',
  2: '#F9E7C2',
  3: '#F2D08F',
  4: '#E9B45A',
  5: '#DF9A2B',
  6: '#C97F10',
  7: '#A5670C',
  8: '#7F5009',
  9: '#593906',
  10: '#382403'
} as const

/** 危险色阶（与 --wd-red-* 对应） */
export const RED = {
  1: '#FDECEC',
  2: '#FBD6D4',
  3: '#F5AFAE',
  4: '#EE8583',
  5: '#E65A57',
  6: '#DC4038',
  7: '#B6302A',
  8: '#8F2620',
  9: '#661B17',
  10: '#451210'
} as const

export const WHITE = '#FFFFFF'

/**
 * 兼容别名（过渡期保留）：
 *
 * 设计令牌重构将冷灰阶/橙色阶更名为 GRAY/AMBER（数值为新令牌），组件侧的
 * import 尚在批量迁移中。此处保留旧名导出，避免迁移期间组件因
 * `COOLGREY[6]` / `ORANGE[6]` 读到 undefined 而抛
 * "Cannot read properties of undefined"。
 * 组件全部迁移到新名后，可移除本段。
 */
export const COOLGREY = GRAY
export const ORANGE = AMBER

/**
 * 语义色的 JS 镜像：svg content 不继承 CSS 变量 / currentColor，
 * 需要"用 JS 算颜色"的场景（wd-icon 默认色、button 内嵌 loading 颜色等）
 * 按主题从此处取与 --wd-icon-1 / --wd-text-1 一致的值。
 */
export const THEME_ICON_COLOR = {
  light: GRAY[10],
  dark: '#F4F6FA'
} as const

export const THEME_TEXT_COLOR = {
  light: GRAY[10],
  dark: '#F4F6FA'
} as const
