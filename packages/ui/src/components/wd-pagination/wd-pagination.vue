<template>
  <view :class="`wd-pagination ${customClass}`" :style="styleToObject(customStyle)" v-if="!(hideIfOnePage && totalPageNum === 1)">
    <view class="wd-pagination__content">
      <slot name="prev" :modelValue="modelValue" :totalPageNum="totalPageNum" :total="total" :pageSize="pageSize">
        <WdButton
          :plain="modelValue > 1"
          type="info"
          :variant="buttonVariant"
          size="small"
          :disabled="modelValue <= 1"
          :custom-class="`wd-pagination__nav`"
          :icon="showIcon ? 'left' : ''"
          :text="showIcon ? '' : prevText || translate('prev')"
          @click="sub"
        ></WdButton>
      </slot>
      <slot name="size" :modelValue="modelValue" :totalPageNum="totalPageNum" :total="total" :pageSize="pageSize">
        <view class="wd-pagination__size">
          <text class="wd-pagination__current"><text>{{ modelValue }}</text></text>
          <text class="wd-pagination__separator"><text>/</text></text>
          <text class="wd-pagination__total"><text>{{ totalPageNum }}</text></text>
        </view>
      </slot>
      <slot name="next" :modelValue="modelValue" :totalPageNum="totalPageNum" :total="total" :pageSize="pageSize">
        <WdButton
          :plain="modelValue < totalPageNum"
          type="primary"
          :variant="buttonVariant"
          size="small"
          :disabled="modelValue >= totalPageNum"
          :custom-class="`wd-pagination__nav`"
          :icon="showIcon ? 'right' : ''"
          :text="showIcon ? '' : nextText || translate('next')"
          @click="add"
        ></WdButton>
      </slot>
    </view>
    <slot name="message" :modelValue="modelValue" :totalPageNum="totalPageNum" :total="total" :pageSize="pageSize" v-if="showMessage">
      <view class="wd-pagination__message">
        <text>{{ translate('page', modelValue) }}，</text>
        <text v-if="total"><text>{{ translate('total', total) }}，</text></text>
        <text>{{ translate('size', pageSize) }}</text>
      </view>
    </slot>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import { styleToObject } from '../../common/util'
import WdButton from '../wd-button/wd-button.vue'
import { ref, watch } from 'vue-lynx'
import { useTranslate } from '../../composables/useTranslate'
import { paginationProps } from './types'

const { translate } = useTranslate('pagination')

const props = defineProps(paginationProps)
const emit = defineEmits(['change', 'update:modelValue'])

const totalPageNum = ref<number>(0) // 总页数

watch(
  () => props.totalPage,
  (newValue) => {
    if (!totalPageNum.value && newValue) {
      totalPageNum.value = newValue
    }
  },
  { immediate: true, deep: true }
)

watch(
  () => props.total,
  () => {
    updateTotalPage()
  },
  { immediate: true, deep: true }
)

function add() {
  const { modelValue } = props
  if (modelValue > totalPageNum.value - 1) {
    return
  }
  emit('change', { value: modelValue + 1 })
  emit('update:modelValue', modelValue + 1)
}

function sub() {
  const { modelValue } = props
  if (modelValue < 2) {
    return
  }
  emit('change', { value: modelValue - 1 })
  emit('update:modelValue', modelValue - 1)
}

function updateTotalPage() {
  const { total, pageSize } = props
  // pageSize 为 0 / 非有限数时 Math.ceil 得到 Infinity/NaN，
  // 会让禁用判断与 "x/NaN" 展示错乱，降级为 1 页
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    totalPageNum.value = 1
    return
  }
  totalPageNum.value = Math.ceil(total / pageSize)
}
</script>

