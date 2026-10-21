import type { ComponentInternalInstance, ExtractPropTypes, InjectionKey } from 'vue-lynx'
import { baseProps } from '../../common/props'

export type stickyBoxProvide = {
  boxStyle: {
    height: number // 高度
    width: number // 宽度
  }
  observerForChild: (child: ComponentInternalInstance) => void // 监听子组件
  updateChildPosition?: (child: ComponentInternalInstance) => void // 用缓存底边位置协调两个 observer
  unobserveChild?: (child: ComponentInternalInstance) => void
}

export const STICKY_BOX_KEY: InjectionKey<stickyBoxProvide> = Symbol('wd-sticky-box')

/**
 * 本地导出面兼容：参考源直接 defineProps(baseProps)（无 props 导出），
 * 此处保留 stickyBoxProps / StickyBoxProps 供 components/index.ts 的类型导出
 * 与历史深度导入使用；属性集合即 baseProps（customClass / customStyle）。
 */
export const stickyBoxProps = {
  ...baseProps
}

export type StickyBoxProps = ExtractPropTypes<typeof stickyBoxProps>
