/* wd-submit-bar — 本地扩展；wot-ui 2.3.2 不包含此组件。 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdButton from '../../primitives/wd-button/wd-button.vue'
import { submitBarProps } from './types'
import { addUnit, parseStyle } from '../../common/util'

const props = defineProps(submitBarProps)
const emit = defineEmits(['submit'])
const priceParts = computed(() => {
  const price = String(props.price ?? '')
  const dot = price.indexOf('.')
  return dot === -1 ? { integer: price, decimal: '' } : { integer: price.slice(0, dot), decimal: price.slice(dot) }
})
const rootStyle = computed(() => ({
  paddingBottom: props.safeAreaInsetBottom ? 'calc(8px + env(safe-area-inset-bottom))' : '8px',
  ...parseStyle(props.customStyle)
}))
function onSubmit() {
  if (!props.buttonDisabled && !props.buttonLoading) emit('submit')
}
</script>

<template>
  <view class="wd-submit-bar" :class="customClass" :style="rootStyle">
    <view class="wd-submit-bar__left">
      <view v-if="label" class="wd-submit-bar__label"><text class="wd-submit-bar__label-text">{{ label }}</text></view>
      <view v-if="price !== '' && price != null" class="wd-submit-bar__price">
        <text v-if="pricePrefix" class="wd-submit-bar__price-prefix" :style="{ fontSize: addUnit(priceSize) }">{{ pricePrefix }}</text>
        <text class="wd-submit-bar__price-integer" :style="{ fontSize: addUnit(priceIntegerSize) }">{{ priceParts.integer }}</text>
        <text v-if="priceParts.decimal" class="wd-submit-bar__price-decimal" :style="{ fontSize: addUnit(priceDecimalSize) }">{{ priceParts.decimal }}</text>
        <text v-if="priceSuffix" class="wd-submit-bar__price-suffix" :style="{ fontSize: addUnit(priceSize) }">{{ priceSuffix }}</text>
      </view>
      <slot name="left" />
    </view>
    <view class="wd-submit-bar__right">
      <slot />
      <WdButton v-if="showButton" :type="buttonType" :disabled="buttonDisabled" :loading="buttonLoading" custom-class="wd-submit-bar__button" @tap="onSubmit"><text>{{ buttonText }}</text></WdButton>
    </view>
  </view>
</template>
