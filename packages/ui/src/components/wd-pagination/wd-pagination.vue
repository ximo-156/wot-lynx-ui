/*
 * wd-pagination — 分页器
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 结构：prev / size / next / message 四个插槽 + 默认内容，节点层级、类名、
 *   分支顺序与参考源一致；翻页按钮经 wd-button（variant 由 buttonVariant 下发），
 *   边界禁用与参考源相同；
 * - 事件：@click → @tap（CONVENTIONS §6；wd-button 的 emits 同时声明
 *   click / tap 并转发）；
 * - 图标：参考源传 name="left" / "right"，本地内置图标集无该字形，映射到
 *   arrow-left-bold / arrow-right-bold（CONVENTIONS §8）；
 * - customStyle 经 parseStyle 归一为对象后绑定（CONVENTIONS §19）；
 * - 【总页数计算的边界修正】参考源 updateTotalPage 无条件写
 *   totalPageNum = ceil(total / pageSize)：未传 total（默认 0）时结果为 0，
 *   连同 totalPage 一起被覆盖（两个 immediate watch 依次执行），表现为
 *   「2 / 0」且两个按钮全部禁用——与文档「未传 total 时用 totalPage」的语义
 *   相悖。此处仅在 total > 0 时按 total 计算，total 缺省时保留 totalPage
 *   （传入 total 时仍然优先按 total 计算，文档语义不变）。
 */
<script lang="ts" setup>
import './index.css'

import { ref, watch } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import { paginationProps } from './types'
import { useTranslate } from '../../composables/useTranslate'
import { parseStyle } from '../../common/util'

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
  // 见文件头：total 缺省（0）时不覆盖 totalPage，否则总页数被清成 0
  if (total > 0) {
    totalPageNum.value = Math.ceil(total / pageSize)
  }
}
</script>

<template>
  <view :class="`wd-pagination ${customClass}`" :style="parseStyle(customStyle)" v-if="!(hideIfOnePage && totalPageNum === 1)">
    <view class="wd-pagination__content">
      <slot name="prev" :modelValue="modelValue" :totalPageNum="totalPageNum" :total="total" :pageSize="pageSize">
        <wd-button
          :plain="modelValue > 1"
          type="info"
          :variant="buttonVariant"
          size="small"
          :disabled="modelValue <= 1"
          :custom-class="`wd-pagination__nav`"
          :icon="showIcon ? 'arrow-left-bold' : ''"
          :text="showIcon ? '' : prevText || translate('prev')"
          @tap="sub"
        ></wd-button>
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
          :custom-class="`wd-pagination__nav`"
          :icon="showIcon ? 'arrow-right-bold' : ''"
          :text="showIcon ? '' : nextText || translate('next')"
          @tap="add"
        ></wd-button>
      </slot>
    </view>
    <slot name="message" :modelValue="modelValue" :totalPageNum="totalPageNum" :total="total" :pageSize="pageSize" v-if="showMessage">
      <view class="wd-pagination__message">
        <text>{{ translate('page', modelValue) }}，</text>
        <text v-if="total">{{ translate('total', total) }}，</text>
        <text>{{ translate('size', pageSize) }}</text>
      </view>
    </slot>
  </view>
</template>
