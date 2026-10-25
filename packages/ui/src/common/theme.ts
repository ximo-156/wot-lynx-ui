/**
 * 设计令牌的 JS 侧镜像（与 styles/theme/base/color.scss 的 --wot-* 色阶一致）。
 *
 * SCSS 主题变量无法在 JS 中读取，少数需要"用 JS 算出颜色"的场景
 * （如 Lynx 的 svg content / 字体字形不继承 CSS currentColor，
 * wd-icon 默认色、button 内嵌 loading 颜色等）使用此处的常量。
 * 修改色板时需同步更新；原始刻度保留官方值，BRAND 为项目品牌色。
 */

/** 项目品牌紫色色阶（与 --wot-brand-* 对应） */
export const BRAND = {
  1: '#F8F6FFFF',
  2: '#EEEBFFFF',
  3: '#D8D1FFFF',
  4: '#BEB3FFFF',
  5: '#9A89FFFF',
  6: '#755FFEFF',
  7: '#5F48D9FF',
  8: '#4935B5FF',
  9: '#36268AFF',
  10: '#251A60FF'
} as const

export const PRIMARY_COLOR = BRAND[6]
export const SECONDARY_COLOR = BRAND[5]
export const TEXT_MAIN_COLOR = '#2D273DFF'
export const TEXT_SECONDARY_COLOR = '#6B7085FF'

/** 蓝色色阶（与 --wot-blue-* 对应） */
export const BLUE = {
  1: '#F5F8FFFF',
  2: '#E5EDFFFF',
  3: '#B8CFFFFF',
  4: '#7CA4FFFF',
  5: '#4480FFFF',
  6: '#1C64FDFF',
  7: '#164ED1FF',
  8: '#1341ADFF',
  9: '#0F3285FF',
  10: '#0A235CFF',
} as const

/** 亮蓝色阶（与 --wot-lightblue-* 对应） */
export const LIGHTBLUE = {
  1: '#E8FBFFFF',
  2: '#BFF2FFFF',
  3: '#96E7FFFF',
  4: '#6ED8FFFF',
  5: '#45C7FFFF',
  6: '#1CB2FDFF',
  7: '#0D8CD6FF',
  8: '#026AB0FF',
  9: '#004E8AFF',
  10: '#003563FF',
} as const

/** 粉色色阶（与 --wot-pink-* 对应） */
export const PINK = {
  1: '#FFF0F6FF',
  2: '#FFDEEBFF',
  3: '#FCC2D7FF',
  4: '#FAA2C1FF',
  5: '#F783ACFF',
  6: '#FF357CFF',
  7: '#FF0A60FF',
  8: '#E0004FFF',
  9: '#B80040FF',
  10: '#8F0032FF',
} as const

/** 红色色阶（与 --wot-red-* 对应） */
export const RED = {
  1: '#FFF5F5FF',
  2: '#FFE3E3FF',
  3: '#FFC9C9FF',
  4: '#FFA8A8FF',
  5: '#FB7C7CFF',
  6: '#F14646FF',
  7: '#DC2C2CFF',
  8: '#BC2626FF',
  9: '#A01515FF',
  10: '#790909FF',
} as const

/** 橘红色阶（与 --wot-volcano-* 对应） */
export const VOLCANO = {
  1: '#FFF2E8FF',
  2: '#FFDABFFF',
  3: '#FFBF96FF',
  4: '#FFA16EFF',
  5: '#FF8045FF',
  6: '#FD5C1CFF',
  7: '#D63F0DFF',
  8: '#B02802FF',
  9: '#8A1900FF',
  10: '#630F00FF',
} as const

/** 橙色色阶（与 --wot-orange-* 对应） */
export const ORANGE = {
  1: '#FFF6EBFF',
  2: '#FFE8CCFF',
  3: '#FFD8A8FF',
  4: '#FFC078FF',
  5: '#FFA94DFF',
  6: '#F57F00FF',
  7: '#D05706FF',
  8: '#A94605FF',
  9: '#813604FF',
  10: '#592503FF',
} as const

/** 黄色色阶（与 --wot-yellow-* 对应） */
export const YELLOW = {
  1: '#FFFAF1FF',
  2: '#FDE5B4FF',
  3: '#FDD78CFF',
  4: '#FCC964FF',
  5: '#FBBB3CFF',
  6: '#FAAD14FF',
  7: '#E19705FF',
  8: '#B97C04FF',
  9: '#916103FF',
  10: '#694702FF',
} as const

/** 绿色色阶（与 --wot-green-* 对应） */
export const GREEN = {
  1: '#F3FBF9FF',
  2: '#E7F8F3FF',
  3: '#B8EADBFF',
  4: '#88DBC3FF',
  5: '#59CDAAFF',
  6: '#12B886FF',
  7: '#0F956CFF',
  8: '#0B6F51FF',
  9: '#074A36FF',
  10: '#04251BFF',
} as const

/** 青色色阶（与 --wot-cyan-* 对应） */
export const CYAN = {
  1: '#F4FBFDFF',
  2: '#E9F8FAFF',
  3: '#BDEAF1FF',
  4: '#90DBE7FF',
  5: '#64CDDDFF',
  6: '#22B8CFFF',
  7: '#1C98ABFF',
  8: '#167988FF',
  9: '#115A65FF',
  10: '#0B3A42FF',
} as const

/** 靛色色阶（与 --wot-grape-* 对应） */
export const GRAPE = {
  1: '#FBF6FDFF',
  2: '#F3D9FAFF',
  3: '#EEBEFAFF',
  4: '#E599F7FF',
  5: '#DA77F2FF',
  6: '#AE3EC9FF',
  7: '#9731AFFF',
  8: '#7B288FFF',
  9: '#601F70FF',
  10: '#451650FF',
} as const

/** 紫色色阶（与 --wot-purple-* 对应） */
export const PURPLE = {
  1: '#F9F8FFFF',
  2: '#E5DBFFFF',
  3: '#D0BFFFFF',
  4: '#B197FCFF',
  5: '#9775FAFF',
  6: '#8059F3FF',
  7: '#5B29EFFF',
  8: '#4511DFFF',
  9: '#390EB9FF',
  10: '#2D0B93FF',
} as const

/** 冷灰（中性色基准）色阶（与 --wot-coolgrey-* 对应） */
export const COOLGREY = {
  1: '#F7F8FAFF',
  2: '#F2F3F5FF',
  3: '#E5E6EBFF',
  4: '#C9CBD4FF',
  5: '#A9ACB8FF',
  6: '#868A9CFF',
  7: '#6B7085FF',
  8: '#4E5369FF',
  9: '#272B3BFF',
  10: '#1D1F29FF',
} as const

/** 中性灰色阶（与 --wot-neutralgrey-* 对应） */
export const NEUTRALGREY = {
  1: '#FAFAFAFF',
  2: '#F5F5F5FF',
  3: '#EBEBEBFF',
  4: '#D4D4D4FF',
  5: '#B8B8B8FF',
  6: '#9C9C9CFF',
  7: '#858585FF',
  8: '#696969FF',
  9: '#3D3D3DFF',
  10: '#292929FF',
} as const

/** 暖灰色阶（与 --wot-warmgrey-* 对应） */
export const WARMGREY = {
  1: '#FAF8F7FF',
  2: '#F5F3F2FF',
  3: '#EBE7E5FF',
  4: '#D4CECCFF',
  5: '#B8B0ADFF',
  6: '#9C918CFF',
  7: '#857A75FF',
  8: '#695E5AFF',
  9: '#3B332FFF',
  10: '#292321FF',
} as const

/**
 * 语义色的 JS 镜像：svg content / 字体字形不继承 CSS 变量 / currentColor，
 * 需要"用 JS 算颜色"的场景（wd-icon 默认色等）按主题从此处取与
 * --wot-icon-main 一致的值。
 */
export const THEME_ICON_COLOR = {
  light: TEXT_MAIN_COLOR,
  dark: '#F7F8FAFF'
} as const

export const THEME_TEXT_COLOR = {
  light: TEXT_MAIN_COLOR,
  dark: '#F7F8FAFF'
} as const
