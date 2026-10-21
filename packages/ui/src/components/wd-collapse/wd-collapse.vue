/*
 * wd-collapse — 折叠面板
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 经 useChildren 向 collapse-item 提供 props / currentValue / toggle；
 *   accordion 模式只允许展开一项，viewmore 模式为布尔值；
 * - @click → @tap（CONVENTIONS §14：Lynx view 只派发 tap）；
 * - 参考源的 block 元素（uni-app 专有）改为 template v-if / v-else；
 * - 查看更多模式的收起行数限制：参考源经 -webkit-line-clamp +
 *   -webkit-box-orient 实现（PORTING §4.5：Lynx 不支持该 Web 盒模型），
 *   此处插槽内容为任意节点、无法套 text-maxline，改用 max-height 按
 *   lineNum × 1.4em 近似截断（收起态由 is-retract 类的 overflow 裁剪），
 *   行高与参考源的 -webkit-box 行高计算存在细微差异；
 * - span 元素改为 text 元素（Lynx 要求所有文本包在 text 中）；
 * - 自定义样式经 parseStyle 归一为对象语法（CONVENTIONS §19）。
 */
<script lang="ts" setup>
import './index.css'

import { cloneVNode, computed, defineComponent, ref, watch, type VNode } from 'vue-lynx'

/** Native text nodes can clamp exactly; arbitrary component trees keep clipping fallback. */
const ViewmoreContent = defineComponent({
  props: { lineNum: { type: Number, default: 0 } },
  setup(clampProps, { slots }) {
    const clamp = (vnode: VNode): VNode => {
      const copy = cloneVNode(vnode, vnode.type === 'text' ? { 'text-maxline': clampProps.lineNum } : undefined)
      if (Array.isArray(vnode.children)) copy.children = vnode.children.map((child: any) => child?.__v_isVNode ? clamp(child) : child)
      return copy
    }
    return () => (slots.default?.() || []).map(clamp)
  }
})
import WdIcon from '../wd-icon/wd-icon.vue'
import { COLLAPSE_KEY, collapseProps, type CollapseExpose, type CollapseToggleAllOptions, type CollapseValue } from './types'
import { useChildren } from '../../composables/useChildren'
import { isArray, isBoolean, isDef, parseStyle } from '../../common/util'
import { useTranslate } from '../../composables/useTranslate'

const props = defineProps(collapseProps)
const emit = defineEmits<{
  (e: 'change', value: { value: CollapseValue }): void
  (e: 'update:modelValue', value: CollapseValue): void
}>()

const { translate } = useTranslate('collapse')
const innerValue = ref<CollapseValue>(getDefaultValue())
const currentValue = computed<CollapseValue>(() => (isDef(props.modelValue) ? props.modelValue : innerValue.value))
const contentLineNum = computed<number>(() => (props.viewmore && !currentValue.value ? props.lineNum : 0))

const { linkChildren, children } = useChildren(COLLAPSE_KEY)

linkChildren({ props, currentValue, toggle })

function getDefaultValue(): CollapseValue {
  if (props.viewmore) {
    return false
  }
  return props.accordion ? '' : []
}

watch(
  () => props.modelValue,
  (newVal) => {
    const { viewmore, accordion } = props
    if (!isDef(newVal)) {
      return
    }
    // 手风琴状态下 value 类型只能为 string
    if (accordion && typeof newVal !== 'string') {
      console.error('accordion value must be string')
    } else if (!accordion && !viewmore && !isArray(newVal)) {
      console.error('value must be Array')
    }
  },
  { deep: true }
)

watch(
  () => [props.accordion, props.viewmore],
  () => {
    if (!isDef(props.modelValue)) {
      innerValue.value = getDefaultValue()
    }
  }
)

watch(
  () => props.lineNum,
  (newVal) => {
    if (newVal <= 0) {
      console.error('lineNum must greater than 0')
    }
  },
  { deep: true, immediate: true }
)

/**
 * 更新绑定值
 * @param activeNames 选中的值
 */
function updateChange(activeNames: CollapseValue) {
  if (!isDef(props.modelValue)) {
    innerValue.value = activeNames
  }
  emit('update:modelValue', activeNames)
  emit('change', {
    value: activeNames
  })
}

/**
 * 切换选中状态
 * @param name 唯一标识符
 * @param expanded 是否展开
 */
function toggle(name: string, expanded: boolean) {
  const { accordion } = props
  const modelValue = currentValue.value
  if (accordion) {
    updateChange(name === modelValue ? '' : name)
  } else if (expanded) {
    const activeNames = isArray(modelValue) ? modelValue : []
    updateChange(activeNames.concat(name))
  } else {
    const activeNames = isArray(modelValue) ? modelValue : []
    updateChange(activeNames.filter((activeName) => activeName !== name))
  }
}

/**
 * 切换所有面板展开状态，传 true 为全部展开，false 为全部收起，不传参为全部切换
 * @param options 面板状态
 */
const toggleAll = (options: CollapseToggleAllOptions = {}) => {
  if (props.accordion) {
    return
  }
  if (isBoolean(options)) {
    options = { expanded: options }
  }

  const { expanded, skipDisabled } = options
  const names: string[] = []
  children.forEach((item, index) => {
    if (item.disabled && skipDisabled) {
      if (item.$.exposed?.getExpanded?.()) {
        names.push(item.name || index)
      }
    } else if (isDef(expanded) ? expanded : !item.$.exposed?.getExpanded?.()) {
      names.push(item.name || index)
    }
  })
  updateChange(names)
}

/**
 * 查看更多点击
 */
function handleMore() {
  updateChange(!currentValue.value)
}

defineExpose<CollapseExpose>({
  toggleAll
})
</script>

<template>
  <view :class="`wd-collapse ${viewmore ? 'is-viewmore' : ''} ${customClass}`" :style="parseStyle(customStyle)">
    <!-- 普通或手风琴 -->
    <template v-if="!viewmore">
      <slot></slot>
    </template>
    <!-- 查看更多模式 -->
    <view v-else>
      <view :class="`wd-collapse__content ${!currentValue ? 'is-retract' : ''} `" :style="{ 'max-height': contentLineNum ? `${contentLineNum * 1.4}em` : 'none' }">
        <ViewmoreContent :line-num="contentLineNum"><slot /></ViewmoreContent>
      </view>
      <view class="wd-collapse__more" @tap="handleMore">
        <!-- 自定义展开按钮 -->
        <view v-if="useMoreSlot" :class="customMoreSlotClass">
          <slot name="more"></slot>
        </view>
        <!-- 显示展开或折叠按钮 -->
        <template v-else>
          <text class="wd-collapse__more-txt">{{ !currentValue ? translate('expand') : translate('retract') }}</text>
          <view :class="`wd-collapse__arrow ${currentValue ? 'is-retract' : ''}`">
            <WdIcon name="down" />
          </view>
        </template>
      </view>
    </view>
  </view>
</template>
