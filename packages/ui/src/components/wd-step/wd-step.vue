/*
 * wd-step — 步骤条子项
 *
 * Lynx 实现说明：经 useParent 从 steps 读取激活索引，
 * 按 index 与 active 的关系计算 finished / process / wait 状态；
 * dot 模式（steps 的 dot）下指示器缩为小圆点，不渲染序号/图标。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { stepProps, type StepStatus } from './types'
import { useParent } from '../../composables/useParent'
import { STEPS_KEY } from '../wd-steps/types'

const props = defineProps(stepProps)

const { parent: steps, index } = useParent(STEPS_KEY)

const active = computed(() => steps.value?.props.active ?? 0)

const status = computed<StepStatus>(() => {
  if (props.status) return props.status
  if (index.value < active.value) return 'finished'
  if (index.value === active.value) return 'process'
  return 'wait'
})

/** 点状模式（steps 的 dot）：指示器缩为小圆点，不渲染序号/图标 */
const isDot = computed(() => Boolean(steps.value?.props.dot))

const rootClass = computed(() => {
  const classes = ['wd-step', `is-${status.value}`]
  if (isDot.value) classes.push('is-dot')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)">
    <view class="wd-step__header">
      <view class="wd-step__icon">
        <wd-icon v-if="icon && !isDot" :name="icon" custom-class="wd-step__icon-img" />
        <text v-else-if="!isDot" class="wd-step__icon-text">{{ index + 1 }}</text>
      </view>
      <view v-if="title || $slots.default" class="wd-step__title">
        <text>{{ title }}</text>
        <slot />
      </view>
    </view>
    <view v-if="description" class="wd-step__description">
      <text>{{ description }}</text>
    </view>
  </view>
</template>
