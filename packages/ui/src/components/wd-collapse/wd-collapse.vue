<template>
  <view :class="`wd-collapse ${viewmore ? 'is-viewmore' : ''} ${customClass}`" :style="styleToObject(customStyle)">
    <!-- 普通或手风琴 -->
    <template v-if="!viewmore">
      <slot></slot>
    </template>
    <!-- 查看更多模式 -->
    <view v-else>
      <!-- Lynx 适配：-webkit-line-clamp 在 Lynx 不支持，多行截断改用 <text> 的
           text-maxline 属性；展开态直接渲染插槽内容（view 容器）。 -->
      <text v-if="!currentValue" :class="`wd-collapse__content is-retract`" :text-maxline="contentLineNum">
        <slot></slot>
      </text>
      <view v-else :class="`wd-collapse__content`">
        <slot></slot>
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
            <WdIcon name="down"></WdIcon>
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import WdIcon from '../wd-icon/wd-icon.vue'
import { computed, ref, watch } from 'vue-lynx'
import { COLLAPSE_KEY, collapseProps, type CollapseExpose, type CollapseToggleAllOptions, type CollapseValue } from './types'
import { useChildren } from '../../composables/useChildren'
import { styleToObject, isArray, isBoolean, isDef } from '../../common/util'
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
    // 子项可能尚未暴露 exposed（时序竞争），非空断言会抛错中断命令式调用
    const getExpanded = () => (item.$ && item.$.exposed && typeof item.$.exposed.getExpanded === 'function' ? item.$.exposed.getExpanded() : false)
    if (item.disabled && skipDisabled) {
      if (getExpanded()) {
        names.push(item.name || index)
      }
    } else if (isDef(expanded) ? expanded : !getExpanded()) {
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

