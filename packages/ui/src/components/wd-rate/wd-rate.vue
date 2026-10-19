/*
 * wd-rate — 评分
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 星星经 wd-icon 渲染；wot-ui 默认图标 star-fill 在本地 iconfont 集中无
 *   对应字形，解析不到时回退到同语义的 favorite-filling（实心星），
 *   props 默认值仍保持 'star-fill' 与参考源一致；
 * - wot-ui 用 `-webkit-background-clip: text` + `background`（渐变）给字体
 *   图标上色，Lynx 不支持该属性且不支持 conic/linear 渐变文字，改为普通
 *   `color`（activeColor 传渐变串时由浏览器/引擎忽略，取纯色场景）；
 * - `:not(:last-child)` 的项间距无 Lynx 兄弟选择器等价物，改为按索引输出的
 *   内联 margin-right（末项为 0），默认值经 var(--wot-rate-item-space, 4px)
 *   表达以保留 CSS 变量定制能力；
 * - `display: inline-block` → display: flex + row；`touch-action` /
 *   `cursor` 等 Web 专有属性删除；
 * - 半星用左半裁剪容器叠加（overflow: hidden + width: 50%）；
 * - 滑动评分：星星矩形一次性度量并缓存（num/space 变化时失效），
 *   touchmove 热路径只读缓存（CONVENTIONS §16）；根 view 的 touchmove 经
 *   emits 声明转发（CONVENTIONS §14）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { rateProps } from './types'
import { addUnit, getRect, isDef, parseStyle } from '../../common/util'
import { resolveIcon } from '../../icons/registry'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(rateProps)
const emit = defineEmits(['update:modelValue', 'change', 'touchmove'])
const isDisabled = useFormDisabled(props)
const isAlive = useAlive()
const { proxy } = getCurrentInstance() as any

/**
 * wot-ui 默认图标 star-fill 在本地 iconfont 集中无对应字形，
 * 解析不到时回退到同语义的 favorite-filling（实心星）。
 * css-icon 模式下 name 是 CSS 类名而非注册表名字，不做回退。
 */
const ICON_FALLBACK = 'favorite-filling'

function resolveIconName(name: string): string {
  if (!name || props.cssIcon) return name
  return resolveIcon(name) ? name : ICON_FALLBACK
}

const rateList = ref<Array<string>>([])

/** 星星矩形缓存（left/right/width），挂载后与 num/space 变化时刷新 */
let itemRects: Array<{ left: number; right: number; width: number }> = []

/**
 * 是否已在当前「几何代次」内发起过度量。
 * 度量不可用（宿主无 createSelectorQuery / 节点未渲染 / all 模式返回 []）时
 * itemRects 恒为空数组，若无该标志，onTouchMove 会在**每个 touchmove** 都发起
 * 一次跨线程 SelectorQuery（CONVENTIONS §16 明令禁止）。num/space 变化会
 * 重置该标志（几何失效，需重新度量）。
 */
let rectsRequested = false

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
  {
    immediate: true,
    deep: true
  }
)

watch([() => props.num, () => props.space], () => {
  refreshRects(true)
})

onMounted(() => {
  refreshRects(true)
})

// 当前选项是否为激活状态
const isActive = (rate: string) => {
  return rate !== '0'
}

const rootClass = computed(() => {
  const classes = ['wd-rate']
  if (isDisabled.value) classes.push('is-disabled')
  if (props.block) classes.push('is-block')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

/**
 * 项间距：wot-ui 用 `.wd-rate__item:not(:last-child) { margin-right }`，
 * Lynx 无兄弟/伪类选择器，改为按索引输出内联 margin-right（末项为 0）。
 * 未传 space 时取 var(--wot-rate-item-space, 4px)，与 SCSS 令牌默认值等价，
 * 消费者经 CSS 变量定制依然生效。
 */
function itemStyle(index: number): Record<string, string> {
  const isLast = index === rateList.value.length - 1
  const space = isDef(props.space) ? addUnit(props.space) : 'var(--wot-rate-item-space, 4px)'
  return { 'margin-right': isLast ? '0' : space }
}

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
 * 刷新星星矩形缓存。
 * @param force 几何失效（num/space 变化、挂载）时强制重新度量；
 *   缺省为非强制——touchmove 热路径下每个代次最多尝试一次，
 *   避免度量不可用时每个 touchmove 都发起跨线程查询。
 */
async function refreshRects(force = false) {
  if (force) rectsRequested = false
  if (rectsRequested) return
  rectsRequested = true
  const rects = await getRect('.wd-rate__item', true, proxy)
  // 回调晚于卸载落地时丢弃：在已销毁树上写模块级缓存会触发晚到 patch（9902）
  if (!isAlive()) return
  itemRects = rects
}

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
 * 设置评分值并触发事件
 */
function updateValue(value: number) {
  emit('update:modelValue', value)
  emit('change', {
    value
  })
}

async function onTouchMove(event: any) {
  // 转发原生 touchmove（Lynx 事件惯用法：父级 @touchmove 消费为 emit，
  // 不再穿透 $attrs 与根元素监听合并成数组击穿事件注册表，CONVENTIONS §14）
  emit('touchmove', event)
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
  <view :class="rootClass" :style="parseStyle(customStyle)" @touchmove="onTouchMove">
    <view v-for="(rate, index) in rateList" :key="index" class="wd-rate__item" :style="itemStyle(index)">
      <wd-icon
        :custom-class="`wd-rate__item-star ${rate === '100%' ? 'wd-rate__item-star--active' : ''}`"
        :name="resolveIconName(isActive(rate) ? activeIcon : icon)"
        :class-prefix="iconPrefix"
        :css-icon="cssIcon"
        :custom-style="`${rate === '100%' ? iconActiveStyle : iconStyle} ${iconSize}`"
        @tap="handleClick(index, false)"
      />
      <view v-if="allowHalf" class="wd-rate__item-half" @tap.stop="handleClick(index, true)">
        <wd-icon
          :custom-class="`wd-rate__item-star ${rate !== '0' ? 'wd-rate__item-star--active' : ''}`"
          :name="resolveIconName(isActive(rate) ? activeIcon : icon)"
          :class-prefix="iconPrefix"
          :css-icon="cssIcon"
          :custom-style="`${rate !== '0' ? iconActiveStyle : iconStyle} ${iconSize}`"
        />
      </view>
    </view>
  </view>
</template>
