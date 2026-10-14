/**
 * 设计令牌的 JS 侧常量。
 *
 * SCSS 主题变量（--wot-*）无法在 JS 中读取，少数需要"用 JS 算出颜色"的场景
 * （如 wd-button 给内嵌 loading 下发显式颜色 —— Lynx 的 svg content 不继承
 * CSS currentColor）使用此处的常量。数值与 styles/theme/base/color.scss 保持一致，
 * 修改主题色时需同步更新。
 */

/** HyperOS 品牌蓝阶（与 --wot-blue-* 对应） */
export const BLUE = {
  1: '#EFF5FF',
  2: '#DFEAFF',
  3: '#B9D2FF',
  4: '#8AB0FF',
  5: '#5C99FF',
  6: '#3482FF',
  7: '#2A6FE0',
  8: '#2059BC',
  9: '#174494',
  10: '#0F2F66'
} as const

export const GREEN = {
  1: '#ECFAEF',
  2: '#D6F5DF',
  3: '#A8E9BB',
  4: '#6FD98E',
  5: '#4ECB73',
  6: '#34C759',
  7: '#2AA64A',
  8: '#20853C',
  9: '#17652E',
  10: '#0E4520'
} as const

export const RED = {
  1: '#FFF1F0',
  2: '#FFDCDA',
  3: '#FFB3B2',
  4: '#FF8483',
  5: '#FF6563',
  6: '#FF4D4F',
  7: '#DB3B3D',
  8: '#B72C2E',
  9: '#931F21',
  10: '#661415'
} as const

export const ORANGE = {
  1: '#FFF4E6',
  2: '#FFE3BF',
  3: '#FFC98C',
  4: '#FFAE57',
  5: '#FF9626',
  6: '#FF8800',
  7: '#DB7300',
  8: '#B75E00',
  9: '#934B00',
  10: '#663300'
} as const

/** HyperOS 冷灰阶（与 --wot-coolgrey-* 对应） */
export const COOLGREY = {
  1: '#F7F8FA',
  2: '#F1F2F5',
  3: '#E7E8ED',
  4: '#D5D7DE',
  5: '#AFB2BB',
  6: '#868A93',
  7: '#5F636C',
  8: '#454851',
  9: '#2B2D33',
  10: '#191A1F'
} as const

export const WHITE = '#FFFFFF'
