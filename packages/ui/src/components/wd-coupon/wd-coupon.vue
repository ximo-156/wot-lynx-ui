/* wd-coupon — 本地扩展；wot-ui 2.3.2 不包含此组件。 */
<script lang="ts" setup>
import './index.css'

import { ref } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import WdInput from '../wd-input/wd-input.vue'
import { couponProps, type Coupon } from './types'
import { parseStyle } from '../../common/util'

const props = defineProps(couponProps)
const emit = defineEmits(['change', 'exchange'])
const exchangeCode = ref('')
function isChosen(coupon: Coupon, index: number) { return props.chosenCoupon >= 0 ? props.chosenCoupon === index : Boolean(coupon.chosen) }
function validity(coupon: Coupon) {
  const format = (time: number) => {
    const date = new Date(time < 1e12 ? time * 1000 : time)
    return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  }
  return coupon.startAt != null && coupon.endAt != null ? `${format(coupon.startAt)} - ${format(coupon.endAt)}` : ''
}
function onCouponTap(coupon: Coupon, index: number) { if (!coupon.disabled && !props.disabledCoupons) emit('change', { coupon, index }) }
function onExchange() {
  if (exchangeCode.value.length < props.exchangeMinLength) return
  emit('exchange', exchangeCode.value)
  exchangeCode.value = ''
}
</script>

<template>
  <view class="wd-coupon" :class="customClass" :style="parseStyle(customStyle)">
    <view class="wd-coupon__list">
      <view v-for="(coupon, index) in coupons" :key="coupon.id" :class="['wd-coupon__item', { 'wd-coupon__item--chosen': isChosen(coupon, index), 'wd-coupon__item--disabled': coupon.disabled || disabledCoupons }]" @tap="onCouponTap(coupon, index)">
        <view class="wd-coupon__left">
          <view class="wd-coupon__value">
            <text v-if="coupon.unit !== 'discount' && !coupon.unitDesc" class="wd-coupon__value-prefix">¥</text>
            <text class="wd-coupon__value-num">{{ coupon.valueDesc ?? coupon.value }}</text>
            <text v-if="coupon.unitDesc || coupon.unit === 'discount'" class="wd-coupon__value-suffix">{{ coupon.unitDesc || '折' }}</text>
          </view>
          <text v-if="coupon.condition" class="wd-coupon__condition">{{ coupon.condition }}</text>
        </view>
        <view class="wd-coupon__divider" />
        <view class="wd-coupon__right">
          <text class="wd-coupon__name">{{ coupon.name }}</text>
          <text v-if="coupon.reason || validity(coupon)" class="wd-coupon__reason">{{ coupon.reason || validity(coupon) }}</text>
          <view v-if="isChosen(coupon, index)" class="wd-coupon__chosen-tag"><text class="wd-coupon__chosen-text">已选</text></view>
        </view>
      </view>
    </view>
    <view v-if="showExchangeBar" class="wd-coupon__exchange">
      <WdInput v-model="exchangeCode" :placeholder="exchangePlaceholder" custom-class="wd-coupon__exchange-input" />
      <WdButton type="primary" size="small" :disabled="exchangeCode.length < exchangeMinLength" custom-class="wd-coupon__exchange-btn" @tap="onExchange"><text>{{ exchangeButtonText }}</text></WdButton>
    </view>
  </view>
</template>
