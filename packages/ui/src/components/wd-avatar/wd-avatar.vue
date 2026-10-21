/*
 * wd-avatar — 头像
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 内容优先级与参考源一致：默认插槽 > 图片（wd-img）> 文本 > 图标；
 * - 尺寸 / 形状：预设尺寸（large/medium/normal/small）经尺寸修饰类
 *   （wd-avatar--large 等）由 CSS 承担，自定义数值 / 单位字符串经内联
 *   width/height/font-size 下发（参考源行为，对象语法 —— 字符串 :style
 *   会被 vue-lynx 静默丢弃，CONVENTIONS §19）；自定义尺寸经 parseStyle
 *   归一 customStyle；
 * - 居中（NATIVE-REWRITE §3）：根 view 显式 display: flex +
 *   flex-direction: row + justify-content / align-items 成对居中，文本
 *   元素（__text）另写 text-align: center（Lynx text 不依赖继承）；
 * - avatar-group 内的层叠间距：参考源以 `:first-child` 与相邻兄弟选择器
 *   （`& + &`）表达「首项无叠层、其余项负边距」，Lynx 不支持结构伪类与
 *   兄弟选择器（CONVENTIONS §5），改由组件按 useParent 索引推 `is-first`
 *   类名 + SCSS margin 表达，语义等价；
 * - z-index 层叠方向（left-up / right-up）经内联 z-index 下发，与参考源
 *   一致；折叠头像（avatar-group 内部以 _internal 标记）跳过父级注册；
 * - 根 view 交互：@click → @tap，并在 emits 声明 'tap' 转发原生事件
 *   （CONVENTIONS §14：消费方在组件上绑 @tap 不会落入合并崩溃）；
 *   wot-ui 的 click 事件按官方文档不带载荷，保持 emit('click')；
 * - Web 专有属性（user-select / vertical-align）按 PORTING §4.5 删除；
 * - alt 为 uni-app 小程序专有 props（参考源亦未在模板消费），保留声明
 *   不生效；mode 取值沿用 uni-app image 的 mode 语义。
 */
<script lang="ts" setup>
import './index.css'

import { computed, useSlots } from 'vue-lynx'
import WdImg from '../wd-img/wd-img.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { avatarProps, type AvatarShape, type AvatarSize } from './types'
import { useParent } from '../../composables/useParent'
import { AVATAR_GROUP_KEY } from '../wd-avatar-group/types'
import { addUnit, getPropByPath, isDef, isString, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(avatarProps)

/**
 * Avatar 组件事件定义
 * - error: 图片加载失败时触发
 * - click: 点击头像时触发
 * - tap: 根 view 原生 tap 事件转发（CONVENTIONS §14）
 */
const emit = defineEmits(['error', 'click', 'tap'])
const slots = useSlots()

const hasIcon = computed(() => Boolean(props.icon || (isString(props.cssIcon) && props.cssIcon)))

// 父组件上下文：_internal 用于 avatar-group 内部的溢出计数头像，跳过父组件上下文
const parentLink = props._internal ? null : useParent(AVATAR_GROUP_KEY)
const avatarGroup = computed(() => (parentLink ? parentLink.parent.value : null))
const index = computed(() => (parentLink ? parentLink.index.value : -1))

/**
 * 计算头像是否应该显示
 * 在 avatar-group 中根据 maxCount 判断是否超出数量限制
 */
const isShow = computed(() => {
  if (!avatarGroup.value) {
    return true
  }
  // 在 avatar-group 中，根据 maxCount 判断
  const maxCount = avatarGroup.value.props.maxCount
  if (!isDef(maxCount)) {
    return true
  }
  const count = typeof maxCount === 'number' ? maxCount : parseInt(maxCount, 10)
  // 检查 count 是否为有效数字
  if (isNaN(count) || count <= 0) {
    return true
  }
  return index.value < count
})

/**
 * 获取头像尺寸
 * 优先级: Props > avatarGroup Props > 默认值
 */
const sizeValue = computed(() => {
  return props.size || (getPropByPath(avatarGroup.value, 'props.size') as string | number | AvatarSize) || 'normal'
})

/**
 * 判断是否使用内置尺寸(large/medium/normal/small)
 */
const isBuiltInSize = computed(() => {
  return isString(sizeValue.value) && ['large', 'medium', 'normal', 'small'].includes(sizeValue.value)
})

/**
 * 获取头像形状
 * 优先级: Props > avatarGroup Props > 默认值
 */
const shapeValue = computed(() => {
  return props.shape || (getPropByPath(avatarGroup.value, 'props.shape') as AvatarShape) || 'round'
})

/**
 * 判断是否存在默认插槽
 */
const hasDefaultSlot = computed(() => !!slots.default)

const rootClass = computed(() => {
  const classes = ['wd-avatar', props.customClass]
  classes.push(`is-${shapeValue.value}`)

  // 尺寸类仅预设尺寸
  if (isBuiltInSize.value) {
    classes.push(`wd-avatar--${sizeValue.value}`)
  }
  // 在 avatar-group 中时，添加 item 类
  if (avatarGroup.value) {
    classes.push('wd-avatar__group-item')
    // Lynx 适配：参考源以 :first-child 表达首项不叠层，改为索引类名
    if (index.value === 0) {
      classes.push('is-first')
    }
    if (avatarGroup.value.props.vertical) {
      classes.push('wd-avatar__group-item--vertical')
    }
  }
  return classes.join(' ')
})

/**
 * 根节点样式
 */
const AVATAR_STYLE = defineStyleKeys({
  width: '', height: '', 'font-size': '', '--wot-avatar-overlap': '',
  'z-index': '', color: '', background: ''
})
const rootStyle = computed(() => {
  const style: Record<string, string> = { ...AVATAR_STYLE }
  if (isDef(sizeValue.value) && !isBuiltInSize.value) {
    style.width = addUnit(sizeValue.value)
    style.height = addUnit(sizeValue.value)
    style['font-size'] = `calc(${addUnit(sizeValue.value)} * 0.45)`
    if (avatarGroup.value) {
      style['--wot-avatar-overlap'] = `calc(${addUnit(sizeValue.value)} * -0.25)`
    }
  }

  // 处理层叠效果的 z-index
  if (avatarGroup.value) {
    const cascading = avatarGroup.value.props.cascading
    if (cascading === 'left-up') {
      // 左侧在上，越后面越大
      style['z-index'] = String(index.value + 1)
    } else if (cascading === 'right-up') {
      // 右侧在上，越前面越大
      const maxCount = avatarGroup.value.props.maxCount
      let count = avatarGroup.value.children ? avatarGroup.value.children.length : 0

      if (isDef(maxCount)) {
        const parsedCount = typeof maxCount === 'number' ? maxCount : parseInt(maxCount, 10)
        if (!isNaN(parsedCount) && parsedCount > 0) {
          count = parsedCount
        }
      }
      style['z-index'] = String(count - index.value)
    }
  }

  if (props.color) {
    style.color = props.color
  }

  if (props.bgColor) {
    style.background = props.bgColor
    // 有背景色但无文字色时，默认白色
    if (!props.color) {
      style.color = '#ffffffff'
    }
  }

  return resolveStyle(AVATAR_STYLE, style, parseStyle(props.customStyle))
})

/**
 * 处理图片加载失败事件
 * @param {Event} event 失败事件对象
 */
const handleError = (event: Event) => {
  emit('error', event)
}

/**
 * 处理点击事件
 */
const handleClick = (event: any) => {
  emit('click')
  emit('tap', event)
}
</script>

<template>
  <view v-if="isShow" :class="rootClass" :style="rootStyle" @tap="handleClick">
    <!-- 默认插槽优先 -->
    <slot v-if="hasDefaultSlot"></slot>
    <!-- 图片 -->
    <WdImg v-else-if="src" :src="src" :mode="mode" custom-class="wd-avatar__img" @error="handleError" />
    <!-- 文本 -->
    <text v-else-if="text" class="wd-avatar__text">{{ text }}</text>
    <!-- 图标 -->
    <WdIcon v-else-if="hasIcon" :name="icon" :class-prefix="iconPrefix" :css-icon="cssIcon" custom-class="wd-avatar__icon" />
  </view>
</template>
