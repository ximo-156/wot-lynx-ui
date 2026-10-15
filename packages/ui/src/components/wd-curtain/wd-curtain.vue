/*
 * wd-curtain — 幕帘
 *
 * Lynx 实现说明：基于 wd-popup（center）的全屏幕帘广告位；
 * 关闭按钮支持 inset / bottom / top 三位置。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { curtainProps, type ClosePosition } from './types'
import { addUnit, isDef, objToStyle } from '../../common/util'
import { uni } from '../../common/uni'

const props = defineProps(curtainProps)
const emit = defineEmits(['update:modelValue', 'close', 'click', 'tap'])

const show = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const closeStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.closePosition === 'bottom') {
    style.bottom = '-60px'
  } else if (props.closePosition === 'top') {
    style.top = '-60px'
  }
  return objToStyle(style)
})

const imgStyle = computed(() => {
  const style: Record<string, string> = {}
  if (isDef(props.width)) style.width = addUnit(props.width)
  return objToStyle(style)
})

function handleClose() {
  emit('update:modelValue', false)
  emit('close')
}

function handleClick() {
  emit('click')
  emit('tap')
  if (props.to) {
    uni.navigateTo({ url: props.to })
  }
}
</script>

<template>
  <wd-popup v-model="show" position="center" :close-on-click-modal="closeOnClickModal" :hide-when-close="hideWhenClose" custom-style="background-color: transparent;">
    <view class="wd-curtain" @tap="handleClick">
      <image v-if="src" class="wd-curtain__img" :src="src" mode="widthFix" :style="imgStyle" />
      <view class="wd-curtain__close" :style="closeStyle" @tap.stop="handleClose">
        <wd-icon name="close" custom-class="wd-curtain__close-icon" />
      </view>
    </view>
  </wd-popup>
</template>
