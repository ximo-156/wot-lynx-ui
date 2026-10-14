<template>
  <view :class="`wd-collapse-item ${disabled ? 'is-disabled' : ''} ${border ? 'is-border' : ''} ${customClass}`" :style="styleToObject(customStyle)">
    <view
      :class="`wd-collapse-item__header ${expanded ? 'is-expanded' : ''} ${isFirst ? 'wd-collapse-item__header-first' : ''} ${
        $slots.title ? 'is-custom' : ''
      }`"
      @tap="handleClick"
    >
      <slot name="title" :expanded="expanded" :disabled="disabled" :isFirst="isFirst">
        <text class="wd-collapse-item__title"><text>{{ title }}</text></text>
        <WdIcon name="down" :custom-class="`wd-collapse-item__arrow ${expanded ? 'is-retract' : ''}`" />
      </slot>
    </view>
    <view class="wd-collapse-item__wrapper" :style="styleToObject(contentStyle)" @transitionend="handleTransitionEnd">
      <view class="wd-collapse-item__body" :class="customBodyClass" :style="styleToObject(customBodyStyle)" :id="collapseId">
        <slot />
      </view>
    </view>
  </view>
</template>
<script setup lang="ts">
import './index.css'
import WdIcon from '../wd-icon/wd-icon.vue'
import {computed, getCurrentInstance, onMounted, ref, watch} from 'vue-lynx'
import { styleToObject, type CSSProperties, addUnit, getRect, isArray, isDef, isString, objToStyle, pause, uuid } from '../../common/util'
import { callInterceptor } from '../../common/interceptor'
import { useParent } from '../../composables/useParent'
import { COLLAPSE_KEY } from '../wd-collapse/types'
import { collapseItemProps, type CollapseItemExpose } from './types'

const collapseId = ref<string>(`collapseId${uuid()}`)

const props = defineProps(collapseItemProps)

const { parent: collapse, index } = useParent(COLLAPSE_KEY)

const height = ref<string | number>('')
const inited = ref<boolean>(false)
const expanded = ref<boolean>(false)
const { proxy } = getCurrentInstance() as any

/**
 * 容器样式，(动画)
 */
const isFirst = computed(() => {
  return index.value === 0
})

/**
 * 容器样式，(动画)
 */
const contentStyle = computed(() => {
  const style: CSSProperties = {}
  if (inited.value) {
    style.transition = 'height 0.3s ease-in-out'
  }
  if (!expanded.value) {
    style.height = '0px'
  } else if (height.value) {
    style.height = addUnit(height.value)
  }
  return objToStyle(style)
})

/**
 * 是否选中
 */
const isSelected = computed(() => {
  const modelValue = collapse.value && collapse.value.currentValue ? collapse.value.currentValue.value : []
  const { name } = props
  return (isString(modelValue) && modelValue === name) || (isArray(modelValue) && modelValue.indexOf(name as string) >= 0)
})

watch(
  () => isSelected.value,
  (newVal) => {
    updateExpand(newVal)
  }
)

onMounted(() => {
  updateExpand(isSelected.value)
})

/**
 * 更新展开状态
 * @param useBeforeExpand 是否使用展开前钩子
 */
async function updateExpand(useBeforeExpand: boolean = true) {
  try {
    if (useBeforeExpand) {
      await handleBeforeExpand()
    }
    await initRect()
  } catch (error) {
    /* empty */
  }
}

/**
 * 初始化内容高度
 */
async function initRect() {
  try {
    const rect = await getRect(`#${collapseId.value}`, false, proxy)
    const { height: rectHeight } = rect
    height.value = isDef(rectHeight) ? Number(rectHeight) : ''
    await pause()
    if (isSelected.value) {
      expanded.value = true
    } else {
      expanded.value = false
    }
    if (!inited.value) {
      inited.value = true
    }
  } catch (error) {
    // 节点度量失败（无匹配节点 / 宿主不支持 SelectorQuery）时保持折叠状态，
    // 避免未处理的 Promise 拒绝被 Sentry 上报为 USER_RUNTIME_ERROR。
  }
}

/**
 * 动画结束回调
 */
function handleTransitionEnd() {
  if (expanded.value) {
    height.value = ''
  }
}

/**
 * 点击子项
 */
async function handleClick() {
  if (props.disabled) return
  try {
    await updateExpand()
    const { name } = props
    collapse.value && collapse.value.toggle(name, !expanded.value)
  } catch (error) {
    /* empty */
  }
}

/**
 * 展开前钩子
 */
function handleBeforeExpand() {
  return new Promise<void>((resolve, reject) => {
    const { name } = props
    const nextexpanded = !expanded.value
    if (nextexpanded) {
      callInterceptor(props.beforeExpend as any, {
        args: [name],
        done: resolve,
        canceled: reject,
        error: reject
      })
    } else {
      resolve()
    }
  })
}

/**
 * 获取展开状态
 */
function getExpanded() {
  return expanded.value
}

defineExpose<CollapseItemExpose>({ getExpanded, updateExpand })
</script>

