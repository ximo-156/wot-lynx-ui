/*
 * wd-sort-button — 排序按钮
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 参考源根 view 绑 @click，Lynx view 不存在 click 事件（只派发 tap，
 *   CONVENTIONS §14 订正），改绑 @tap；同时按 §14 在 emits 声明 'tap' 并在
 *   处理器里转发，消费方在组件上绑 @tap 才不会落入 mergeProps 合并崩溃；
 * - 参考源根 view 直接绑定 customStyle 字符串，Lynx 的 patchProp 对字符串
 *   style 会静默丢弃（CONVENTIONS §19），改为 parseStyle(customStyle) 归一
 *   的对象语法；
 * - __left 内的 title 为裸文本，Lynx 要求所有文本包在 text 元素中
 *   （PORTING §3.2），改写为 text 包裹；
 * - line 变体的下划线：参考源为 __left 的 ::after 伪元素（opacity 过渡），
 *   Lynx 无伪元素（PORTING §4.4），改为模板真实元素 wd-sort-button__underline
 *   （line 开启时常驻，is-active 控制 opacity，过渡保留）；
 * - 内部图标按 CONVENTIONS §8 从内置 180 图标集选取最接近字形：参考源
 *   caret-up / caret-down 不在内置集中，取 arrow-up-filling / arrow-down-filling
 *   （实心箭头，与 caret 的实心三角形态最接近）。
 */
<script lang="ts" setup>
import './index.css'

import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import { sortButtonProps, type SortButtonEmits, type SortButtonValue } from './types'
import { parseStyle } from '../../common/util'

const props = defineProps(sortButtonProps)

// CONVENTIONS §14：根 view 绑 @tap 的交互组件必须转发原生 tap 事件
const emit = defineEmits<SortButtonEmits & { tap: [event: any] }>()

/**
 * 处理点击事件，按排序循环切换排序方向
 * descFirst 开启时循环：0 → -1 → 1 → (0 或 -1)
 * descFirst 关闭时循环：0 → 1 → -1 → (0 或 1)
 */
function handleClick(event: any) {
  let { modelValue: value, allowReset, descFirst } = props
  let next: SortButtonValue
  if (descFirst) {
    if (value === 0) {
      next = -1
    } else if (value === -1) {
      next = 1
    } else {
      next = allowReset ? 0 : -1
    }
  } else {
    if (value === 0) {
      next = 1
    } else if (value === 1) {
      next = -1
    } else {
      next = allowReset ? 0 : 1
    }
  }
  emit('update:modelValue', next)
  emit('change', { value: next })
  emit('tap', event)
}
</script>

<template>
  <view :class="`wd-sort-button ${line ? 'wd-sort-button--line' : ''} ${customClass}`" :style="parseStyle(customStyle)" @tap="handleClick">
    <view class="wd-sort-button__wrapper">
      <view :class="`wd-sort-button__left ${modelValue !== 0 ? 'is-active' : ''}`">
        <text>{{ title }}</text>
        <!-- Lynx 适配：参考源下划线为 __left 的 ::after 伪元素，改为真实元素 -->
        <view v-if="line" :class="`wd-sort-button__underline ${modelValue !== 0 ? 'is-active' : ''}`" />
      </view>
      <view class="wd-sort-button__right">
        <WdIcon name="caret-up" :custom-class="`wd-sort-button__icon-up ${modelValue === -1 ? 'wd-sort-button__icon-up--active' : ''}`" />
        <WdIcon name="caret-down" :custom-class="`wd-sort-button__icon-down  ${modelValue === 1 ? 'wd-sort-button__icon-down--active' : ''}`" />
      </view>
    </view>
  </view>
</template>
