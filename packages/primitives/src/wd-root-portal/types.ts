import { baseProps } from '@wot-lynx/core/common/props'
import type { ExtractPropTypes } from 'vue-lynx'

export const rootPortalProps = {
  ...baseProps
}

export type RootPortalProps = ExtractPropTypes<typeof rootPortalProps>
