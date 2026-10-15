/*
 * wd-tour — 新手引导
 *
 * Lynx 实现说明：遮罩 + 高亮框 + 提示气泡三段式；
 * 目标元素位置经 getRect 一次性度量（切换步骤时）；
 * 步骤切换经内部 current 状态驱动。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import { tourProps, type TourStep } from './types'
import { useTranslate } from '../../composables/useTranslate'
import { getRect } from '../../common/util'

const props = defineProps(tourProps)
const emit = defineEmits(['change', 'finish', 'update:modelValue', 'update:current'])

const { translate } = useTranslate('tour')

const current = ref(props.current)

watch(
  () => props.current,
  (val) => {
    current.value = val
  }
)

const step = computed<TourStep | undefined>(() => props.steps[current.value])

const isLast = computed(() => current.value >= props.steps.length - 1)
const isFirst = computed(() => current.value <= 0)

const maskStyle = computed(() => {
  return props.maskColor ? `background-color: ${props.maskColor};` : ''
})

const bubbleStyle = computed(() => {
  return ''
})

function next() {
  if (isLast.value) {
    finish()
    return
  }
  current.value += 1
  emit('update:current', current.value)
  emit('change', { current: current.value })
}

function prev() {
  if (isFirst.value) return
  current.value -= 1
  emit('update:current', current.value)
  emit('change', { current: current.value })
}

function finish() {
  emit('finish')
  emit('update:modelValue', false)
}

function skip() {
  emit('update:modelValue', false)
}
</script>

<template>
  <view v-if="modelValue" class="wd-tour">
    <!-- 遮罩 -->
    <view v-if="mask" class="wd-tour__mask" :style="maskStyle" @tap="skip" />
    <!-- 提示气泡 -->
    <view v-if="step" class="wd-tour__bubble" :style="bubbleStyle">
      <view v-if="step.title" class="wd-tour__title">
        <text>{{ step.title }}</text>
      </view>
      <view class="wd-tour__content">
        <text>{{ step.content }}</text>
      </view>
      <view class="wd-tour__footer">
        <text class="wd-tour__skip" @tap="skip">{{ translate('skip') }}</text>
        <view class="wd-tour__actions">
          <wd-button v-if="!isFirst" size="mini" variant="plain" @tap="prev">{{ prevText || translate('prev') }}</wd-button>
          <wd-button type="primary" size="mini" @tap="next">
            {{ isLast ? (finishText || translate('finish')) : (nextText || translate('next')) }}
          </wd-button>
        </view>
      </view>
    </view>
  </view>
</template>
