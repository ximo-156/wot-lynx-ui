/**
 * 内置图标集合的数据结构。
 *
 * 图标集把「统一 viewBox 的 SVG path 数据」或「字体码点映射」按名字组织起来，
 * 经 registry 注册后即可通过 `<wd-icon name="xxx" />` 使用。新增一套图标
 * （另一个 iconfont 导出、或手写 path）只需实现本接口并调用 `registerIconSet`，
 * 无需改动 wd-icon。
 */

/** 单个图标的 path 数据：单路径为字符串，多路径为数组（渲染时统一注入 fill） */
export type IconPaths = string | readonly string[]

interface IconSetBase {
  /** 集合键。寻址规则 `key:name`（如 `iconfont:menu`）时按本键精确命中 */
  key: string
}

/** SVG path 图标集（扩展用：运行时可注册自定义 SVG 字形） */
export interface SvgIconSet extends IconSetBase {
  type: 'svg'
  /** 该集合统一的 SVG viewBox（如 '0 0 1024 1024'） */
  viewBox: string
  /** 图标名 -> path 数据 */
  paths: Record<string, IconPaths>
}

/** 字体图标集（内置 iconfont 集：经 .ttf 字体渲染） */
export interface FontIconSet extends IconSetBase {
  type: 'font'
  /** @font-face 声明的字体族名（见 src/icons/fonts/iconfont.css） */
  fontFamily: string
  /** 图标名 -> unicode 码点（hex 字符串，如 'e6a3'） */
  unicodes: Record<string, string>
}

export type IconSet = SvgIconSet | FontIconSet

/** registry 解析结果：命中的集合与渲染所需数据 */
export type ResolvedIcon =
  | { type: 'svg'; setKey: string; viewBox: string; paths: readonly string[] }
  | { type: 'font'; setKey: string; fontFamily: string; unicode: string }
