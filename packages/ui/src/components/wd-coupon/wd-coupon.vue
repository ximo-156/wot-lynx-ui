/*
 * wd-coupon — 优惠券
 *
 * Lynx 实现说明：
 * - 结构：view.wd-coupon > 优惠券列表 + 可选兑换栏；
 * - 优惠券卡片：左侧面值区 + 右侧信息区，中间虚线分隔；
 * - 根节点三件套：display: flex + flex-direction: column；
 * - Style Funnel：rootStyle 经 defineStyleKeys + resolveStyle 输出完整键集；
 * - 优惠券点击 @click → @tap（CONVENTIONS §6）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import WdInput from '../wd-input/wd-input.vue'
import { couponProps, type Coupon } from './types'
import { parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(couponProps)
const emit = defineEmits(['change', 'exchange'])

const exchangeCode = ref('')

const COUPON_STYLE = defineStyleKeys({})

const rootStyle = computed(() => {
  return {
    ...resolveStyle(COUPON_STYLE, {}),
    ...parseStyle(props.customStyle)
  }
})

function onCouponTap(coupon: Coupon, index: number) {
  if (coupon.disabled || props.disabledCoupons) return
  emit('change', { coupon, index })
}

function onExchange() {
  if (exchangeCode.value.length >= props.exchangeMinLength) {
    emit('exchange', exchangeCode.value)
    exchangeCode.value = ''
  }
}
</script>

<template>
  <view class="wd-coupon" :class="customClass" :style="rootStyle">
    <view class="wd-coupon__list">
      <view
        v-for="(coupon, index) in coupons"
        :key="coupon.id"
        :class="`wd-coupon__item ${coupon.chosen ? 'wd-coupon__item--chosen' : ''} ${coupon.disabled ? 'wd-coupon__item--disabled' : ''}`"
        @tap="onCouponTap(coupon, index)"
      >
        <view class="wd-coupon__left">
          <view class="wd-coupon__value">
            <text v-if="coupon.unit !== 'discount'" class="wd-coupon__value-prefix">¥</text>
            <text class="wd-coupon__value-num">{{ coupon.value }}</text>
            <text v-if="coupon.unit === 'discount'" class="wd-coupon__value-suffix">折</text>
          </view>
          <text v-if="coupon.condition" class="wd-coupon__condition">{{ coupon.condition }}</text>
        </view>
        <view class="wd-coupon__divider" />
        <view class="wd-coupon__right">
          <text class="wd-coupon__name">{{ coupon.name }}</text>
          <text v-if="coupon.reason" class="wd-coupon__reason">{{ coupon.reason }}</text>
          <view v-if="coupon.chosen" class="wd-coupon__chosen-tag">
            <text class="wd-coupon__chosen-text">已选</text>
          </view>
        </view>
      </view>
    </view>
    <view v-if="showExchangeBar" class="wd-coupon__exchange">
      <WdInput
        v-model="exchangeCode"
        :placeholder="exchangePlaceholder"
        custom-class="wd-coupon__exchange-input"
      />
      <WdButton
        type="primary"
        size="small"
        custom-class="wd-coupon__exchange-btn"
        @tap="onExchange"
      >
        {{ exchangeButtonText }}
      </WdButton>
    </view>
  </view>
</template>
