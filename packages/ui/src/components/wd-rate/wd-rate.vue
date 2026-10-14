/*
 * wd-rate — 评分
 *
 * Lynx 实现说明：
 * - 星星经 wd-icon 渲染（star-fill），半星用左半裁剪容器叠加；
 * - 滑动评分：星星矩形一次性度量并缓存（num/space 变化时失效），
 *   touchmove 热路径只读缓存（CONVENTIONS §16）；
 * - 横向排列容器显式 display: flex。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { rateProps } from './types'
import { addUnit, getRect, isDef } from '../../common/util'
import { useFormDisabled } from '../../composables/useFormDisabled'

const props = defineProps(rateProps)
const emit = defineEmits(['update:modelValue', 'change'])
const isDisabled = useFormDisabled(props)
const { proxy } = getCurrentInstance() as any

const rateList = ref<Array<string>>([])

/** 星星矩形缓存（left/right/width），挂载后与 num/space 变化时刷新 */
let itemRects: Array<{ left: number; right: number; width: number }> = []

const iconStyle = computed(() => {
  if (!props.color) return ''
  return `color: ${props.color};`
})

const iconSize = computed(() => {
  if (isDef(props.size)) {
    return `font-size: ${addUnit(props.size)};`
  }
  return ''
})

const iconActiveStyle = computed(() => {
  const { activeColor, modelValue, num } = props
  let color = ''
  if (Array.isArray(activeColor)) {
    if (activeColor.length === 0) {
      console.error('activeColor cannot be an empty array')
    } else {
      color = Number(modelValue) <= num * 0.6 || !activeColor[1] ? activeColor[0] : activeColor[1]
    }
  } else {
    color = activeColor as string
  }
  return color ? `color: ${color};` : ''
})

watch(
  [() => props.num, () => props.modelValue],
  () => {
    computeRateList()
  },
  { immediate: true, deep: true }
)

watch([() => props.num, () => props.space], () => {
  refreshRects()
})

onMounted(() => {
  refreshRects()
})

const isActive = (rate: string) => rate !== '0'

const rootClass = computed(() => {
  const classes = ['wd-rate']
  if (isDisabled.value) classes.push('is-disabled')
  if (props.block) classes.push('is-block')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

function computeRateList() {
  const { modelValue, num, allowHalf } = props
  if (modelValue === null || !num) return
  if (typeof modelValue !== 'number') {
    console.error('[wot-lynx-ui] error(wd-rate): the value of wd-rate should be a number')
    return
  }
  const tempRateList: string[] = []
  const fullLength = Math.floor(modelValue)
  for (let i = 0; i < num; i++) {
    if (i < fullLength) {
      tempRateList.push('100%')
    } else if (i === fullLength && allowHalf && modelValue % 1 !== 0) {
      tempRateList.push('50%')
    } else {
      tempRateList.push('0')
    }
  }
  rateList.value = tempRateList
}

async function refreshRects() {
  itemRects = await getRect('.wd-rate__item', true, proxy)
}

function handleClick(index: number, isHalf: boolean) {
  const { readonly, clearable, allowHalf, modelValue } = props
  if (readonly || isDisabled.value) return
  let value = isHalf ? index + 0.5 : index + 1
  if (clearable) {
    const minValue = allowHalf ? 0.5 : 1
    if (value === modelValue && value === minValue) {
      value = 0
    }
  }
  updateValue(value)
}

function updateValue(value: number) {
  emit('update:modelValue', value)
  emit('change', { value })
}

async function onTouchMove(event: any) {
  if (props.readonly || isDisabled.value) return
  const clientX = Number(event.touches?.[0]?.clientX ?? event.detail?.x ?? 0)
  if (!itemRects.length) {
    await refreshRects()
  }
  const targetIndex = itemRects.findIndex((rect) => clientX >= rect.left && clientX <= rect.right)
  if (targetIndex !== -1) {
    const target = itemRects[targetIndex]
    const isHalf = props.allowHalf && clientX - target.left < target.width / 2
    updateValue(isHalf ? targetIndex + 0.5 : targetIndex + 1)
  }
}
</script>

<template>
  <view :class="rootClass" :style="customStyle" @touchmove="onTouchMove">
    <view
      v-for="(rate, index) in rateList"
      :key="index"
      class="wd-rate__item"
      :style="isDef(space) ? `margin-right: ${index == rateList.length - 1 ? 0 : addUnit(space)}` : ''"
    >
      <wd-icon
        :custom-class="`wd-rate__item-star ${rate === '100%' ? 'wd-rate__item-star--active' : ''}`"
        :name="isActive(rate) ? activeIcon : icon"
        :class-prefix="iconPrefix"
        :css-icon="cssIcon"
        :custom-style="`${rate === '100%' ? iconActiveStyle : iconStyle} ${iconSize}`"
        @tap="handleClick(index, false)"
      />
      <view v-if="allowHalf" class="wd-rate__item-half" @tap.stop="handleClick(index, true)">
        <wd-icon
          :custom-class="`wd-rate__item-star ${rate !== '0' ? 'wd-rate__item-star--active' : ''}`"
          :name="isActive(rate) ? activeIcon : icon"
          :class-prefix="iconPrefix"
          :css-icon="cssIcon"
          :custom-style="`${rate !== '0' ? iconActiveStyle : iconStyle} ${iconSize}`"
        />
      </view>
    </view>
  </view>
</template>
