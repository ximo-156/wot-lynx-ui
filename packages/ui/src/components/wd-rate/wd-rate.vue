<template>
  <view :class="`wd-rate ${isDisabled ? 'is-disabled' : ''} ${block ? 'is-block' : ''} ${customClass}`" :style="styleToObject(customStyle)" @touchmove="onTouchMove">
    <!-- Lynx 适配：wot-ui 的 :data-index 在小程序中用于 dataset 读取，本组件未使用，已移除（Lynx __SetAttribute 不支持任意 data-* 属性）。 -->
    <view
      v-for="(rate, index) in rateList"
      :key="index"
      :class="`wd-rate__item${index === rateList.length - 1 ? ' is-last' : ''}`"
      :style="styleToObject(`${isDef(space) ? `margin-right: ${index == rateList.length - 1 ? 0 : addUnit(space)}` : ''}`)"
    >
      <WdIcon
        :custom-class="`wd-rate__item-star ${rate === '100%' ? 'wd-rate__item-star--active' : ''}`"
        :name="isActive(rate) ? activeIcon : icon"
        :class-prefix="iconPrefix"
        :css-icon="cssIcon"
        :color="isActive(rate) ? iconActiveColor : iconColor"
        :custom-style="iconSize"
        @click="handleClick(index, false)"
      />
      <view v-if="props.allowHalf" class="wd-rate__item-half" @tap.stop="handleClick(index, true)">
        <WdIcon
          :custom-class="`wd-rate__item-star ${rate !== '0' ? 'wd-rate__item-star--active' : ''}`"
          :name="isActive(rate) ? activeIcon : icon"
          :class-prefix="iconPrefix"
          :css-icon="cssIcon"
          :color="isActive(rate) ? iconActiveColor : iconColor"
          :custom-style="iconSize"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import WdIcon from '../wd-icon/wd-icon.vue'
import { computed, getCurrentInstance, ref, watch } from 'vue-lynx'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { rateProps } from './types'
import { styleToObject, addUnit, getRect, isDef } from '../../common/util'
const { proxy } = getCurrentInstance() as any

const props = defineProps(rateProps)
const emit = defineEmits(['update:modelValue', 'change'])
const isDisabled = useFormDisabled(props)

const rateList = ref<Array<string>>([])
// Lynx 适配：wot-ui 用 iconfont + CSS color 控制星标颜色；本组件库用 SVG 图标，
// 颜色需通过 wd-icon 的 color  prop 控制 fill，因此额外提供颜色计算。
const iconColor = computed(() => {
  return props.color || ''
})

const iconSize = computed(() => {
  if (isDef(props.size)) {
    return `font-size:${addUnit(props.size)};`
  }
  return ''
})

const iconActiveColor = computed(() => {
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
  return color
})

watch(
  [() => props.num, () => props.modelValue],
  () => {
    computeRateList()
  },
  {
    immediate: true,
    deep: true
  }
)

// 评分项数量 / 间距变化时节点位置改变，失效触摸度量缓存（见 measureRateItems 注释）
watch([() => props.num, () => props.space], () => {
  invalidateRateRects()
})

// 当前选项是否为激活状态
const isActive = (rate: string) => {
  return rate !== '0'
}

/**
 * @description 计算当前应当展示的rate数量
 */
function computeRateList() {
  const { modelValue, num, allowHalf } = props
  // value和num都准备好才能计算
  if (modelValue === null || !num) return
  if (typeof modelValue !== 'number') {
    console.error('[wot ui] error(wd-rate): the value of wd-rate should be a number')
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

/**
 * @description 处理点击事件
 * @param index 点击的索引
 * @param isHalf 是否为半星
 */
function handleClick(index: number, isHalf: boolean) {
  const { readonly, clearable, allowHalf, modelValue } = props
  if (readonly || isDisabled.value) return
  let value = isHalf ? index + 0.5 : index + 1
  // 点击清空逻辑：当点击的值与当前modelValue相等且等于最小值时允许清空
  if (clearable) {
    const minValue = allowHalf ? 0.5 : 1
    if (value === modelValue && value === minValue) {
      value = 0
    }
  }
  updateValue(value)
}

/**
 * @description 设置评分值并触发事件
 */
function updateValue(value: number) {
  emit('update:modelValue', value)
  emit('change', {
    value
  })
}

/**
 * 评分项节点矩形缓存。
 *
 * Lynx 适配（性能）：getRect 是经 createSelectorQuery 的异步节点查询，早前
 * onTouchMove 每帧查询全部评分项位置，拖动跟手性被跨线程查询链路拖慢。
 * 评分项位置是静态的（仅 num / space 变化时改变），按 CONVENTIONS §9 改为
 * 首次拖到时一次性度量并缓存，num / space 变化时失效。
 */
let rateItemRects: any[] = []
let rateRectsMeasured = false

function invalidateRateRects() {
  rateRectsMeasured = false
  rateItemRects = []
}

async function measureRateItems(): Promise<any[]> {
  if (rateRectsMeasured) return rateItemRects
  try {
    rateItemRects = (await getRect('.wd-rate__item', true, proxy)) || []
  } catch (error) {
    // 节点度量失败（无匹配节点 / 宿主不支持 SelectorQuery）时放弃本次拖动计算，
    // 避免未处理的 Promise 拒绝被 Sentry 上报为 USER_RUNTIME_ERROR。
    return []
  }
  rateRectsMeasured = true
  return rateItemRects
}

async function onTouchMove(event: TouchEvent) {
  if (props.readonly || isDisabled.value) return
  const { clientX } = event.touches[0]
  const rateItems = await measureRateItems()
  if (!rateItems.length) return
  const targetIndex = Array.from(rateItems).findIndex((rect: any) => {
    return clientX >= rect.left! && clientX <= rect.right!
  })
  if (targetIndex !== -1) {
    const target = rateItems[targetIndex]
    const itemWidth = target.width!
    const isHalf = props.allowHalf && clientX - target.left! < itemWidth / 2
    const value = isHalf ? targetIndex + 0.5 : targetIndex + 1
    if (value >= 0.5) {
      const value = isHalf ? targetIndex + 0.5 : targetIndex + 1
      updateValue(value)
    }
  }
}
</script>
