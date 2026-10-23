/*
 * wd-step — 步骤条子项
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - rootStyle：参考源以 objToStyle 字符串拼接 customStyle 后绑定，Lynx 的
 *   patchProp 对字符串 style 会静默丢弃（CONVENTIONS §19），改为对象语法；
 *   width/height 两个可切换键经 Style Funnel（defineStyleKeys + resolveStyle）
 *   输出完整键集（CONVENTIONS §20），中性值 auto 与「不设置」视觉等价；
 * - 经 useParent 从 wd-steps 读取 active/vertical/dot/space/alignCenter 与
 *   children 长度，按 index 与 active 的关系推导 finished/process/wait 状态，
 *   status prop 优先；
 * - 默认标题/描述文案经 useTranslate('steps') 走 locale（zh-CN：未开始/
 *   已完成/进行中/失败）；
 * - 内部图标按 CONVENTIONS §8 从内置 180 图标集选取：参考源 finished 态
 *   的 check 不在内置集中，取配对的 check-item（与 close 同批码点，
 *   形态为对勾）；
 * - 模板结构与参考源逐节点对齐（header/indicator/circle|dot|icon/line/content），
 *   文本均在 text 元素中；icon/title/description 三个插槽保留；
 * - 原生优先重写（NATIVE-REWRITE §3）：根节点由 inline-block 适配值 linear 改
 *   为显式 display: flex + flex-direction: column 三件套（__content 显式
 *   flex-shrink: 0，纵向 space 定高时内容不按比例压缩）；__header 显式 flex
 *   row，is-center 态指示器经容器 justify-content: center 水平居中（参考源
 *   依赖 Web 行内盒 + text-align，Lynx 无行内盒），标题/描述在 is-center 态
 *   显式 text-align: center（Lynx text 不保证继承）——几何与连接线
 *   left: calc(50% + ...) 配套，详见 index.scss。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import { isDef, parseStyle } from '../../common/util'
import { useParent } from '../../composables/useParent'
import { useTranslate } from '../../composables/useTranslate'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { STEPS_KEY } from '../wd-steps/types'
import { stepProps, type StepStatus } from './types'

const props = defineProps(stepProps)

const { parent: steps, index } = useParent(STEPS_KEY)

const { translate } = useTranslate('steps')

/** width/height 中性值：auto 与不设置视觉等价；保证任何一帧键集完整 */
const STEP_ROOT_STYLE = defineStyleKeys({ width: 'auto', height: 'auto' })

/**
 * 根节点样式
 */
const rootStyle = computed(() => {
  if (!steps.value) {
    return resolveStyle(STEP_ROOT_STYLE)
  }
  const { vertical, space } = steps.value.props
  if (vertical) {
    return resolveStyle(STEP_ROOT_STYLE, { height: space && space !== '' ? space : '' })
  }
  return resolveStyle(STEP_ROOT_STYLE, { width: space && space !== '' ? space : (100 / steps.value.children.length) + '%' })
})

/**
 * 获取当前步骤的状态
 */
const currentStatus = computed<StepStatus | ''>(() => {
  return getCurrentStatus(index.value)
})

/**
 * 获取当前步骤的标题
 */
const currentTitle = computed<string>(() => {
  return getCurrentTitle(currentStatus.value)
})

/**
 * 是否居中对齐
 */
const canAlignCenter = computed<boolean>(() => {
  if (isDef(steps.value)) {
    const { vertical, alignCenter } = steps.value.props
    return Boolean(!vertical && alignCenter)
  } else {
    return false
  }
})

/**
 * 是否垂直布局
 */
const vertical = computed<boolean>(() => {
  if (isDef(steps.value)) {
    return Boolean(steps.value.props.vertical)
  } else {
    return false
  }
})

/**
 * 是否使用点状指示器
 */
const dot = computed<boolean>(() => {
  if (isDef(steps.value)) {
    return Boolean(steps.value.props.dot)
  } else {
    return false
  }
})

/**
 * 步骤总数量
 */
const childrenLength = computed<number>(() => {
  if (isDef(steps.value)) {
    return Number(steps.value.children.length)
  } else {
    return 0
  }
})

/**
 * 获取状态
 * @param index 索引
 */
function getCurrentStatus(index: number): StepStatus | '' {
  if (props.status) {
    return props.status
  }

  if (steps.value) {
    const { active } = steps.value.props
    if (Number(active) > index) {
      return 'finished'
    } else if (Number(active) === index) {
      return 'process'
    } else {
      return 'wait'
    }
  } else {
    return 'wait' // 默认如果不在Steps中，直接渲染等待
  }
}

/**
 * 获取默认标题
 * @param currentStatus 当前状态
 */
function getCurrentTitle(currentStatus: string): string {
  if (props.title) return props.title

  switch (currentStatus) {
    case 'finished':
      return translate('finished')
    case 'error':
      return translate('failed')
    case 'process':
      return translate('process')
    case 'wait':
    default:
      return translate('wait')
  }
}
</script>

<template>
  <view
    v-if="currentStatus"
    :class="`wd-step wd-step--${currentStatus} ${customClass} ${canAlignCenter ? 'is-center' : ''}  ${vertical ? 'is-vertical' : ''}`"
    :style="{ ...rootStyle, ...parseStyle(customStyle) }"
  >
    <view :class="`wd-step__header ${dot ? 'is-dot' : ''}`">
      <view :class="`wd-step__indicator  ${dot ? 'is-dot' : !!icon || $slots.icon ? 'is-icon' : 'is-text'}`">
        <view v-if="dot" class="wd-step__dot"></view>
        <slot v-else-if="$slots.icon || icon" name="icon">
          <WdIcon v-if="icon" custom-class="wd-step__icon" :name="icon" />
        </slot>
        <view v-else class="wd-step__circle">
          <WdIcon custom-class="wd-step__finished-icon" v-if="currentStatus === 'finished'" name="check" />
          <WdIcon custom-class="wd-step__error-icon" v-else-if="currentStatus === 'error'" name="close" />
          <text class="wd-step__circle-text" v-else>{{ index + 1 }}</text>
        </view>
      </view>
      <view v-if="index < childrenLength - 1" class="wd-step__line"></view>
    </view>
    <view class="wd-step__content" v-if="$slots.title || currentTitle || $slots.description || description">
      <slot name="title" v-if="$slots.title || currentTitle">
        <text class="wd-step__title">{{ currentTitle }}</text>
      </slot>
      <slot name="description" v-if="$slots.description || description">
        <text class="wd-step__description">{{ description }}</text>
      </slot>
    </view>
  </view>
</template>
