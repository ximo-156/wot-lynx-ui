import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps } from '@wot-lynx/core/common/props'

/**
 * 导航栏胶囊属性
 */
export const navbarCapsuleProps = {
  ...baseProps
}

export type NavbarCapsuleProps = ExtractPropTypes<typeof navbarCapsuleProps>
