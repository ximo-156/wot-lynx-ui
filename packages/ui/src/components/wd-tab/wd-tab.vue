<template>
  <view :class="`wd-tab ${customClass}`" :style="styleToObject(customStyle)">
    <view :class="['wd-tab__body', { 'wd-tab__body--inactive': !active }]" v-if="shouldBeRender" :style="styleToObject(tabBodyStyle)">
      <slot />
    </view>
  </view>
</template>
<script setup lang="ts">
import './index.css'
import {ref, watch} from 'vue-lynx'
import { styleToObject, type CSSProperties, isDef, isNumber, isString, objToStyle } from '../../common/util'
import { useParent } from '../../composables/useParent'
import { TABS_KEY } from '../wd-tabs/types'
import {computed} from 'vue-lynx'
import { tabProps } from './types'

const props = defineProps(tabProps)

const { parent: tabs, index } = useParent(TABS_KEY)

/**
 * 激活项下标
 */
const active = computed(() => {
  return isDef(tabs.value) ? tabs.value.state.activeIndex === index.value : false
})

/** 初始状态tab不会渲染，必须通过tabs来设置painted使tab渲染 */
const painted = ref<boolean>(active.value)

/**
 * tab body 样式
 */
const tabBodyStyle = computed(() => {
  const style: CSSProperties = {}
  if (!active.value && (!isDef(tabs.value) || !tabs.value.props.animated)) {
    style.display = 'none'
  }
  return objToStyle(style)
})

/**
 * 是否应该渲染
 */
const shouldBeRender = computed(() => !props.lazy || painted.value || active.value)

watch(active, (val) => {
  if (val) painted.value = true
})

watch(
  () => props.name,
  (newValue) => {
    if (isDef(newValue) && !isNumber(newValue) && !isString(newValue)) {
      console.error('[wot ui] error(wd-tab): the type of name should be number or string')
      return
    }
  },
  {
    deep: true,
    immediate: true
  }
)
</script>
