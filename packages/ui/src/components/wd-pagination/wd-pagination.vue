/*
 * wd-pagination — 分页器
 *
 * Lynx 实现说明：上一页 / 页码 / 下一页三段式；
 * 按钮经 wd-button（text 变体），边界禁用。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import { paginationProps } from './types'
import { useTranslate } from '../../composables/useTranslate'

const props = defineProps(paginationProps)
const emit = defineEmits(['change', 'update:modelValue'])

const { translate } = useTranslate('pagination')

const totalPageNum = computed(() => Math.max(1, Number(props.totalPage) || 1))

function sub() {
  if (props.modelValue <= 1) return
  const value = props.modelValue - 1
  emit('update:modelValue', value)
  emit('change', { current: value })
}

function add() {
  if (props.modelValue >= totalPageNum.value) return
  const value = props.modelValue + 1
  emit('update:modelValue', value)
  emit('change', { current: value })
}
</script>

<template>
  <view v-if="!(hideIfOnePage && totalPageNum === 1)" :class="`wd-pagination ${customClass}`" :style="customStyle">
    <view class="wd-pagination__content">
      <slot name="prev" :modelValue="modelValue" :totalPageNum="totalPageNum" :total="total" :pageSize="pageSize">
        <wd-button
          :plain="modelValue > 1"
          type="info"
          :variant="buttonVariant"
          size="small"
          :disabled="modelValue <= 1"
          custom-class="wd-pagination__nav"
          :icon="showIcon ? 'left' : ''"
          :text="showIcon ? '' : prevText || translate('prev')"
          @click="sub"
        />
      </slot>
      <slot name="size" :modelValue="modelValue" :totalPageNum="totalPageNum" :total="total" :pageSize="pageSize">
        <view class="wd-pagination__size">
          <text class="wd-pagination__current">{{ modelValue }}</text>
          <text class="wd-pagination__separator">/</text>
          <text class="wd-pagination__total">{{ totalPageNum }}</text>
        </view>
      </slot>
      <slot name="next" :modelValue="modelValue" :totalPageNum="totalPageNum" :total="total" :pageSize="pageSize">
        <wd-button
          :plain="modelValue < totalPageNum"
          type="primary"
          :variant="buttonVariant"
          size="small"
          :disabled="modelValue >= totalPageNum"
          custom-class="wd-pagination__nav"
          :icon="showIcon ? 'right' : ''"
          :text="showIcon ? '' : nextText || translate('next')"
          @click="add"
        />
      </slot>
    </view>
    <slot name="message" :modelValue="modelValue" :totalPageNum="totalPageNum" :total="total" :pageSize="pageSize" v-if="showMessage">
      <view class="wd-pagination__message">
        <text>{{ translate('page', modelValue) }}</text>
      </view>
    </slot>
  </view>
</template>
