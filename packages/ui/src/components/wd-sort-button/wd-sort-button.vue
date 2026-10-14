<template>
  <view :class="`wd-sort-button ${line ? 'wd-sort-button--line' : ''} ${customClass}`" :style="styleToObject(customStyle)" @tap="handleClick">
    <view class="wd-sort-button__wrapper">
      <view :class="`wd-sort-button__left ${modelValue !== 0 ? 'is-active' : ''}`">
        <text>{{ title }}</text>
        <!-- Lynx 适配：wot-ui 用 ::after 绘制激活态下划线，Lynx 无伪元素，
             改为真实元素（样式见 index.scss 的 .wd-sort-button__line）。 -->
        <view v-if="line" class="wd-sort-button__line" />
      </view>
      <view class="wd-sort-button__right">
        <WdIcon name="caret-up" :custom-class="`wd-sort-button__icon-up ${modelValue === -1 ? 'wd-sort-button__icon-up--active' : ''}`" />
        <WdIcon name="caret-down" :custom-class="`wd-sort-button__icon-down  ${modelValue === 1 ? 'wd-sort-button__icon-down--active' : ''}`" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import { styleToObject } from '../../common/util'
import WdIcon from '../wd-icon/wd-icon.vue'
import { sortButtonProps, type SortButtonEmits, type SortButtonValue } from './types'

const props = defineProps(sortButtonProps)

const emit = defineEmits<SortButtonEmits>()

/**
 * 处理点击事件，按排序循环切换排序方向
 * descFirst 开启时循环：0 → -1 → 1 → (0 或 -1)
 * descFirst 关闭时循环：0 → 1 → -1 → (0 或 1)
 */
function handleClick() {
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
}
</script>
