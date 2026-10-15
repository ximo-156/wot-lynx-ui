/**
 * 设计令牌的 JS 侧镜像。
 *
 * SCSS 主题变量（--wd-*）无法在 JS 中读取，少数需要"用 JS 算出颜色"的场景
 * （如 wd-button 给内嵌 loading 下发显式颜色 —— Lynx 的 svg content 不继承
 * CSS currentColor）使用此处的常量。数值与 styles/tokens/_primitive.scss
 * 保持一致，修改色板时需同步更新。
 */

/** 品牌紫阶（与 --wd-purple-* 对应，基准 6 档 = 品牌紫 #7F5CFF） */
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
  1: '#F5F5F7',
  2: '#EFEFF2',
  3: '#E4E4E8',
  4: '#D1D1D6',
  5: '#AEAEB2',
  6: '#8E8E93',
  7: '#6E6E73',
  8: '#48484A',
  9: '#2C2C2E',
  10: '#1D1D1F'
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

/** 警告色阶（与 --wd-amber-* 对应，黄相，与品牌橙拉开色相） */
export const AMBER = {
  1: '#FFFAEB',
  2: '#FFF1C2',
  3: '#FDE38A',
  4: '#FAC73F',
  5: '#F5A623',
  6: '#D97E04',
  7: '#B46306',
  8: '#8F4D05',
  9: '#6B3A04',
  10: '#472703'
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

/** 兼容别名（过渡期保留）：历史导出名，组件迁移完成后可移除 */
export const COOLGREY = GRAY

/**
 * 语义色的 JS 镜像：svg content 不继承 CSS 变量 / currentColor，
 * 需要"用 JS 算颜色"的场景（wd-icon 默认色、button 内嵌 loading 颜色等）
 * 按主题从此处取与 --wd-icon-1 / --wd-text-1 一致的值。
 */
export const THEME_ICON_COLOR = {
  light: GRAY[10],
  dark: '#F5F5F7'
} as const

export const THEME_TEXT_COLOR = {
  light: GRAY[10],
  dark: '#F5F5F7'
} as const
