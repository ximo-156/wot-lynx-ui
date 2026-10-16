import { baseProps, makeStringProp, numericProp } from '../../common/props'
import type { ExtractPropTypes } from 'vue-lynx'

export const iconProps = {
  ...baseProps,
  /**
   * 图标名称，支持使用图片链接。
   * 内置图标经图标注册表（icons/registry.ts）解析：wot 集 302 个 +
   * iconfont 集 180 个；不带前缀按注册顺序回退（wot 优先），与 wot 集重名的
   * iconfont 字形用 `iconfont:名称` 寻址（如 `iconfont:menu`）。
   * name 含 '/' 时按图片链接渲染原生 image 元素。
   * 类型: string
   */
  name: makeStringProp(''),
  /**
   * 图标颜色（svg content 不继承 CSS 变量，未传时按主题取 --wd-icon-1 对应值）
   * 类型: string
   */
  color: String,
  /**
   * 图标大小，默认单位为 px
   * 类型: string | number
   */
  size: numericProp,
  /**
   * 类名前缀，用于使用自定义图标
   * 类型: string
   * 默认值: wd-icon
   */
  classPrefix: makeStringProp('wd-icon'),
  /**
   * CSS 图标，为 true 时 name 直接作为 CSS class 而不会拼接 class-prefix 前缀，也可以直接传图标类名
   * 类型: boolean | string
   * 默认值: false
   */
  cssIcon: {
    type: [Boolean, String],
    default: false
  }
}

export type IconProps = ExtractPropTypes<typeof iconProps>
