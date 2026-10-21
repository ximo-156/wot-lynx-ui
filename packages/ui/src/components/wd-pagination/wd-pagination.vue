/*
 * wd-pagination — 分页器
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - prev / size / next / message 插槽与按钮配置保持参考源契约；
 * - @click → @tap；wd-button 声明 click / tap，避免原生监听合并；
 * - 内置箭头映射为 arrow-left-bold / arrow-right-bold；
 * - customStyle 经 parseStyle 归一为对象后绑定（CONVENTIONS §19）；
 * - 页码区显式 flex 行；辅助文案在单个 text 排版边界内连续排版，
 *   避免默认 linear 布局把参考源的行内文本堆叠成三行；
 * - total > 0 时优先按条数计算；缺省时使用 totalPage（修正参考源两个
 *   immediate watch 把 totalPage 覆盖成 0 的边界缺陷）。computed 同时
 *   跟踪 total / pageSize / totalPage，防止更新后总页数与禁用状态残留。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import { paginationProps } from './types'
import { useTranslate } from '../../composables/useTranslate'
import { parseStyle } from '../../common/util'
import { createStyleResolver } from '../../common/style'

const { translate } = useTranslate('pagination')

const props = defineProps(paginationProps)
const emit = defineEmits(['change', 'update:modelValue'])

/** total 优先；未提供条数时使用 totalPage，所有依赖均保持响应式。 */
const totalPageNum = computed(() => props.total > 0 ? Math.ceil(props.total / props.pageSize) : props.totalPage)

/** Lynx text 是文本排版边界：辅助文案合并为与参考源相同的连续文本。 */
const message = computed(() => [
  translate('page', props.modelValue),
  ...(props.total ? [translate('total', props.total)] : []),
  translate('size', props.pageSize)
].join('，'))

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
</script>

<template>
  <view :class="`wd-pagination ${customClass}`" :style="parseStyle(customStyle)" v-if="!(hideIfOnePage && totalPageNum === 1)">
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
          @tap="sub"
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
        <WdButton
          :plain="modelValue < totalPageNum"
          type="primary"
          :variant="buttonVariant"
          size="small"
          :disabled="modelValue >= totalPageNum"
          :custom-class="`wd-pagination__nav`"
          :icon="showIcon ? 'right' : ''"
          :text="showIcon ? '' : nextText || translate('next')"
          @tap="add"
        />
      </slot>
    </view>
    <slot name="message" :modelValue="modelValue" :totalPageNum="totalPageNum" :total="total" :pageSize="pageSize" v-if="showMessage">
      <view class="wd-pagination__message">
        <text class="wd-pagination__message-text">{{ message }}</text>
      </view>
    </slot>
  </view>
</template>
