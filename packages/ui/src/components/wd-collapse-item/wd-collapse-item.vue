/*
 * wd-collapse-item — 折叠面板项
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 经 useParent 读取父级 collapse 的 currentValue 并调用 toggle；
 * - 展开动画：参考源以内容真实高度（getRect 一次性度量）+ height 过渡实现，
 *   过渡结束把 height 置空（自适应内容），本移植保持一致；contentStyle 由
 *   参考源的 objToStyle 字符串改为对象语法（CONVENTIONS §19），且
 *   transition / height 两个键恒写（CONVENTIONS §20 Style Funnel）；
 * - @click → @tap；@transitionend 为 Lynx 原生支持事件；
 * - 标题箭头图标取内置图标集的 arrow-down-bold（参考源的 down 字形不在
 *   内置集中，CONVENTIONS §8），经 custom-class 穿透到 wd-icon 根视图；
 * - customBodyStyle 经 parseStyle 归一为对象语法（CONVENTIONS §19）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { addUnit, getRect, isArray, isDef, isString, parseStyle, pause, uuid } from '../../common/util'
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
 * 是否为第一项
 */
const isFirst = computed(() => {
  return index.value === 0
})

/**
 * 容器样式，(动画)
 * 键集合恒定（CONVENTIONS §20）：未初始化时不写 transition（无过渡），
 * 收起态恒写 height: 0px，展开态有度量值时写真实高度。
 */
const contentStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = {
    transition: inited.value ? 'height 0.3s ease-in-out' : 'none',
    height: '0px'
  }
  if (expanded.value && height.value) {
    style.height = addUnit(height.value)
  }
  return style
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
    initRect()
  } catch (error) {
    /* empty */
  }
}

/**
 * 初始化内容高度
 */
function initRect() {
  getRect(`#${collapseId.value}`, false, proxy).then(async (rect) => {
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
  })
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

<template>
  <view :class="`wd-collapse-item ${disabled ? 'is-disabled' : ''} ${border ? 'is-border' : ''} ${customClass}`" :style="parseStyle(customStyle)">
    <view
      :class="`wd-collapse-item__header ${expanded ? 'is-expanded' : ''} ${isFirst ? 'wd-collapse-item__header-first' : ''} ${
        $slots.title ? 'is-custom' : ''
      }`"
      @tap="handleClick"
    >
      <slot name="title" :expanded="expanded" :disabled="disabled" :isFirst="isFirst">
        <text class="wd-collapse-item__title">{{ title }}</text>
        <wd-icon name="arrow-down-bold" :custom-class="`wd-collapse-item__arrow ${expanded ? 'is-retract' : ''}`" />
      </slot>
    </view>
    <view class="wd-collapse-item__wrapper" :style="contentStyle" @transitionend="handleTransitionEnd">
      <view class="wd-collapse-item__body" :class="customBodyClass" :style="parseStyle(customBodyStyle)" :id="collapseId">
        <slot />
      </view>
    </view>
  </view>
</template>
