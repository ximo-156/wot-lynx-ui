/*
 * wd-empty — 空状态
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 结构与参考源一致：image 插槽（默认 wd-icon）+ 提示文字 + bottom 插槽；
 * - iconSize 经 wd-icon 的 size prop 下发——字体字形自带内联 font-size，
 *   Lynx text 不依赖继承，挂在 wd-icon 根 view 上的 font-size 到不了字形
 *   （CONVENTIONS §8）；
 * - 图标名兜底：内置 iconfont 集无 'empty' 字形（props 默认值保持与
 *   wot-ui 一致的 'empty'），解析不到时回退到同语义的 'folder-close'；
 *   css-icon 模式不回退（类名由消费方提供）；
 * - 文本包 text 元素（Lynx view 内裸文本不渲染）；
 * - customStyle 经 parseStyle 归一对象（CONVENTIONS §19）。
 */
<script lang="ts" setup>
import './index.css'

import WdIcon from '../wd-icon/wd-icon.vue'
import { emptyProps } from './types'
import { parseStyle } from '../../common/util'
import { resolveIcon } from '../../icons/registry'

const props = defineProps(emptyProps)

/** 图标名兜底：注册表解析不到时回退 folder-close（内置集无 empty 字形） */
function resolveIconName(name: string): string {
  if (!name || props.cssIcon || name.includes('/')) return name
  return resolveIcon(name) ? name : 'folder-close'
}
</script>

<template>
  <view :class="`wd-empty ${customClass}`" :style="parseStyle(customStyle)">
    <slot name="image">
      <wd-icon
        :name="resolveIconName(icon)"
        :class-prefix="iconPrefix"
        :css-icon="cssIcon"
        custom-class="wd-empty__icon"
        :size="iconSize"
      />
    </slot>
    <view v-if="tip" class="wd-empty__text">
      <text>{{ tip }}</text>
    </view>
    <slot name="bottom" />
  </view>
</template>
