import { baseProps } from '../../common/props'
import type { ExtractPropTypes } from 'vue-lynx'

export const rootPortalProps = {
  ...baseProps
}

export type RootPortalProps = ExtractPropTypes<typeof rootPortalProps>
