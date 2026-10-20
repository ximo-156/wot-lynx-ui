/*
 * wd-submit-bar — 提交订单栏
 *
 * Lynx 实现说明：
 * - 结构：view.wd-submit-bar > 左侧价格区 + 右侧按钮区；
 * - 价格支持前缀/整数/小数分段展示，小数部分自动解析；
 * - 根节点三件套：display: flex + flex-direction: row；
 * - Style Funnel：rootStyle 经 defineStyleKeys + resolveStyle 输出完整键集；
 * - 按钮点击 @click → @tap（CONVENTIONS §6）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import { submitBarProps } from './types'
import { addUnit, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(submitBarProps)
const emit = defineEmits(['submit'])

const priceParts = computed(() => {
  const priceStr = String(props.price || '')
  const dotIndex = priceStr.indexOf('.')
  if (dotIndex === -1) {
    return { integer: priceStr, decimal: '' }
  }
  return {
    integer: priceStr.slice(0, dotIndex),
    decimal: priceStr.slice(dotIndex)
  }
})

const BAR_STYLE = defineStyleKeys({
  paddingBottom: '0px'
})

const rootStyle = computed(() => {
  return {
    ...resolveStyle(BAR_STYLE, {
      paddingBottom: props.safeAreaInsetBottom ? 'env(safe-area-inset-bottom)' : '0px'
    }),
    ...parseStyle(props.customStyle)
  }
})

function onSubmit() {
  if (props.buttonDisabled || props.buttonLoading) return
  emit('submit')
}
</script>

<template>
  <view class="wd-submit-bar" :class="customClass" :style="rootStyle">
    <view class="wd-submit-bar__left">
      <view v-if="label" class="wd-submit-bar__label">
        <text class="wd-submit-bar__label-text">{{ label }}</text>
      </view>
      <view v-if="price" class="wd-submit-bar__price">
        <text v-if="pricePrefix" class="wd-submit-bar__price-prefix" :style="{ fontSize: addUnit(priceSize) }">{{ pricePrefix }}</text>
        <text class="wd-submit-bar__price-integer" :style="{ fontSize: addUnit(priceIntegerSize) }">{{ priceParts.integer }}</text>
        <text v-if="priceParts.decimal" class="wd-submit-bar__price-decimal" :style="{ fontSize: addUnit(priceDecimalSize) }">{{ priceParts.decimal }}</text>
        <text v-if="priceSuffix" class="wd-submit-bar__price-suffix" :style="{ fontSize: addUnit(priceSize) }">{{ priceSuffix }}</text>
      </view>
      <slot name="left" />
    </view>
    <view class="wd-submit-bar__right">
      <slot name="default" />
      <wd-button
        v-if="showButton"
        :type="buttonType"
        :disabled="buttonDisabled"
        :loading="buttonLoading"
        custom-class="wd-submit-bar__button"
        @tap="onSubmit"
      >
        {{ buttonText }}
      </wd-button>
    </view>
  </view>
</template>
