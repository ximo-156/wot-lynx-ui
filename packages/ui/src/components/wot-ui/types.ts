import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps } from '../../common/props'

/** 内部占位组件（对齐 wot-ui 的目录结构，无公开 API） */
export const wotUiProps = {
  ...baseProps
}

export type WotUiProps = ExtractPropTypes<typeof wotUiProps>
