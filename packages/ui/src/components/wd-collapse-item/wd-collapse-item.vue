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
import { useAlive } from '../../composables/useAlive'

const collapseId = ref<string>(`collapseId${uuid()}`)

const props = defineProps(collapseItemProps)
const isAlive = useAlive()
let rectRequest = 0
let clickRequest = 0
let approvedSelection = false

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
    height: expanded.value ? 'auto' : '0px'
  }
  if (expanded.value && height.value !== '' && Number(height.value) > 0) {
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
    ++clickRequest
    const shouldIntercept = newVal && !approvedSelection
    approvedSelection = false
    void updateExpand(shouldIntercept)
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
  const request = ++rectRequest
  if (!isAlive()) return
  if (useBeforeExpand && isSelected.value && !(await handleBeforeExpand())) return
  if (!isAlive() || request !== rectRequest) return
  await initRect(request)
}

/** 一次性度量并只应用仍与当前选择一致的结果。 */
async function initRect(request: number) {
  const selected = isSelected.value
  const rect = await getRect(`#${collapseId.value}`, false, proxy)
  if (!isAlive() || request !== rectRequest || selected !== isSelected.value) return
  const rectHeight = Number(rect && rect.height) || 0
  height.value = rectHeight > 0 ? rectHeight : ''
  await pause()
  if (!isAlive() || request !== rectRequest || selected !== isSelected.value) return
  expanded.value = selected
  inited.value = true
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
  if (!isAlive() || props.disabled || !collapse.value) return
  const request = ++clickRequest
  const nextExpanded = !isSelected.value
  if (nextExpanded && !(await handleBeforeExpand())) return
  if (!isAlive() || props.disabled || request !== clickRequest || !collapse.value) return
  // 受控回写随后触发选择 watcher，同一次点击不得重复调用 beforeExpend。
  approvedSelection = nextExpanded
  collapse.value.toggle(props.name, nextExpanded)
}

/** 拒绝或抛错都返回 false，不能被吞掉后继续 toggle。 */
function handleBeforeExpand() {
  return new Promise<boolean>((resolve) => {
    callInterceptor(props.beforeExpend, {
      args: [props.name],
      done: () => resolve(true),
      canceled: () => resolve(false),
      error: () => resolve(false)
    })
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
        <WdIcon name="arrow-down-bold" :custom-class="`wd-collapse-item__arrow ${expanded ? 'is-retract' : ''}`" />
      </slot>
    </view>
    <view class="wd-collapse-item__wrapper" :style="contentStyle" @transitionend="handleTransitionEnd">
      <view class="wd-collapse-item__body" :class="customBodyClass" :style="parseStyle(customBodyStyle)" :id="collapseId">
        <slot />
      </view>
    </view>
  </view>
</template>
