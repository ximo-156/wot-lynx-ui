/*
 * wd-tab — 选项卡面板
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 经 useParent 向 wd-tabs 注册自身（TABS_KEY），激活态读父级
 *   state.activeIndex（与参考源一致）；懒渲染语义：非激活且未渲染过时不
 *   挂载内容（painted 机制与参考源相同）；
 * - tabBodyStyle：参考源以 objToStyle 输出字符串（display:none），Lynx 的
 *   字符串 :style 会被静默丢弃（CONVENTIONS §19），改为对象语法并经
 *   Style Funnel 输出完整键集——非激活且父级未开 animated 时写
 *   display:none，其余状态显式写回 linear（Lynx view 默认布局），避免
 *   上一帧的 none 残留（§20）；
 * - name 类型校验（number / string）与重名检测逻辑与参考源一致；
 * - customStyle 经 parseStyle 归一为对象后绑定。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, ref, watch } from 'vue-lynx'
import { tabProps } from './types'
import { useParent } from '../../composables/useParent'
import { TABS_KEY } from '../wd-tabs/types'
import { isDef, isNumber, isString, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(tabProps)

const { proxy } = getCurrentInstance() as any
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
 * tab body 可切换的全部样式键 + 中性值（CONVENTIONS §20）
 */
const TAB_BODY_STYLE = defineStyleKeys({ display: 'linear' })

/**
 * tab body 样式
 */
const tabBodyStyle = computed(() =>
  resolveStyle(TAB_BODY_STYLE, {
    // 非激活且父级未开切换动画时收起内容；激活或 animated 下保持参与布局
    // （animated 由 left 位移驱动，见 wd-tabs 的 bodyStyle）
    display: !active.value && (!isDef(tabs.value) || !tabs.value.props.animated) ? 'none' : 'linear'
  })
)

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
    if (tabs.value) {
      checkName(proxy)
    }
  },
  {
    deep: true,
    immediate: true
  }
)

/**
 * 检测 tab 绑定的 name 是否和其它 tab 的 name 冲突
 * @param self 自身
 */
function checkName(self: any) {
  const { name: myName } = props
  if (myName === undefined || myName === null || myName === '') {
    return
  }
  tabs.value &&
    tabs.value.children.forEach((child: any) => {
      if (child.$.uid !== self.$.uid && child.name === myName) {
        console.error(`The tab's bound value: ${myName} has been used`)
      }
    })
}
</script>

<template>
  <view :class="`wd-tab ${customClass}`" :style="parseStyle(customStyle)">
    <view :class="['wd-tab__body', { 'wd-tab__body--inactive': !active }]" v-if="shouldBeRender" :style="tabBodyStyle">
      <slot />
    </view>
  </view>
</template>
