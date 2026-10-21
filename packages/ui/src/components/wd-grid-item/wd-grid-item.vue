/*
 * wd-grid-item — 宫格子项
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 根 view 绑 @tap 并在 emits 声明转发 click/tap（CONVENTIONS §6/§14）；
 *   参考源 @click 在 Lynx view 上是死事件，统一改 @tap；
 * - 按压反馈：参考源在内容 view 上绑 :hover-class（uni-app 平台属性），
 *   Lynx 无该属性，hover 类名改为常驻 + CSS :active（CONVENTIONS §17）；
 * - bgColor：参考源以 background 简写内联下发，会压过 m(hover) 的按压背景
 *   （故参考源用了 !important）；Lynx 不支持 !important，改经 CSS 变量
 *   --wot-grid-item-bg 下发，按压背景由更具特异性的 :active 规则胜出
 *   （PORTING §4.6 的 CSS 自定义属性驱动方案）；
 * - rootStyle / contentStyle 由参考源的「objToStyle 拼字符串 +
 *   customStyle 拼接」改为对象语法（parseStyle 归一，CONVENTIONS §19）；
 * - **Style Funnel**（CONVENTIONS §20）：rootStyle 的全部可切换键
 *   （宽度 / 正方形 padding / gutter 右内边距与上边距）经 defineStyleKeys +
 *   resolveStyle 每帧输出完整键集——gutter 由有值变 0 时旧 padding-right /
 *   margin-top 不会残留；contentStyle 的 right/bottom/height 同样完整输出，
 *   以 SCSS 的 height: 100% 和无偏移作为中性值；
 * - url 跳转：参考源调用全局 uni.navigateTo 等，改为 common/uni 兼容层
 *   下发（宿主可注入路由，未注入时降级 warning）；
 * - 列数兜底：参考源 columnNum 为 0（无父级 grid 的独立使用场景）时会算出
 *   Infinity% 宽度，此处兜底为 1（grid 内使用时 column/childCount 恒 ≥ 1，
 *   行为不变）；
 * - 文字兜底裸文本包 text 元素（Lynx view 内裸文本不渲染）；
 * - **图标 + 文字行居中**（NATIVE-REWRITE §3.2）：__wrapper 显式
 *   display: flex + flex-direction: row + align-items/justify-content 成对；
 *   __text 自身显式 text-align: center（父级 text-align 不经继承）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdBadge from '../wd-badge/wd-badge.vue'
import { useParent } from '../../composables/useParent'
import { GRID_KEY } from '../wd-grid/types'
import { addUnit, deepAssign, isDef, isString, isUndefined, omitBy, parseStyle, type CSSProperties } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { gridItemProps } from './types'
import { uni } from '../../common/uni'
import type { BadgeProps } from '../wd-badge/types'

/** GridItem 组件 Props 定义 */
const props = defineProps(gridItemProps)
/** GridItem 组件事件定义 */
const emit = defineEmits<{
  (e: 'click', event?: any): void
  (e: 'tap', event?: any): void
}>()

/** 获取父级 Grid 组件实例及当前项在子组件中的索引 */
const { parent: grid, index } = useParent(GRID_KEY)

/** 格子间距（从父级 Grid 组件继承） */
const gutter = computed(() => Number(grid.value?.props.gutter || 0))
/** 是否为正方形（从父级 Grid 组件继承） */
const square = computed(() => Boolean(grid.value?.props.square))
/** 是否显示边框（从父级 Grid 组件继承） */
const border = computed(() => Boolean(grid.value?.props.border))
/** 背景颜色（从父级 Grid 组件继承） */
const bgColor = computed(() => grid.value?.props.bgColor || '')
/** 列数（从父级 Grid 组件继承，0 表示自动计算） */
const column = computed(() => grid.value?.props.column || 0)
/** 子组件总数 */
const childCount = computed(() => grid.value?.children?.length || 0)

/** 图标大小（从父级 Grid 组件继承） */
const iconSize = computed(() => grid.value?.props.iconSize)
/** 是否渲染图标，cssIcon 字符串可作为图标类名独立渲染 */
const hasIcon = computed(() => Boolean(props.icon || (isString(props.cssIcon) && props.cssIcon)))

/**
 * 边框 CSS 类名计算
 * 根据当前项的位置和列数计算是否需要应用边框相关的类名
 * @returns {string} 包含边框相关的 CSS 类名，多个类名间使用空格分隔
 */
const borderClass = computed(() => {
  if (!border.value || gutter.value) return ''
  const classes: string[] = []
  const col = column.value
  const idx = index.value
  const total = childCount.value

  if (col) {
    const isRightItem = total - 1 === idx || (idx + 1) % col === 0
    const isFirstLine = idx + 1 <= col
    if (isFirstLine) classes.push('is-first')
    if (isRightItem) classes.push('is-right')
    if (!isFirstLine) classes.push('is-border')
  } else {
    classes.push('is-first')
  }

  if (total - 1 === idx) classes.push('is-last')

  return classes.join(' ')
})

/**
 * 根节点可切换样式键 + 中性值（CONVENTIONS §20：每帧输出完整键集）。
 * 中性值取「视觉上等同于不设置」：无 gutter 即无右内边距与上边距；
 * 非 square 即无 padding-top 撑高（padding-bottom 恒 0）。
 */
const GRID_ITEM_ROOT_STYLE = defineStyleKeys({
  flexBasis: 'auto',
  width: 'auto',
  paddingTop: '0px',
  paddingBottom: '0px',
  paddingRight: '0px',
  marginTop: '0px'
})

/**
 * 根节点样式计算
 * 计算当前格子的宽度、flex 属性及额外样式（如正方形、间距）
 * @returns {CSSProperties} 组合后的 CSS 样式对象
 */
const rootStyle = computed<CSSProperties>(() => {
  const columnNum = column.value || childCount.value || 1
  const percent = `${100 / columnNum}%`

  return {
    ...resolveStyle(GRID_ITEM_ROOT_STYLE, {
      flexBasis: percent,
      width: percent,
      // 正方形格子：以 padding-top 百分比撑高（配合内容区绝对定位）
      paddingTop: square.value ? percent : '',
      paddingBottom: square.value ? '0' : '',
      // gutter 时 square / 非 square 两种模式都以右内边距承担列间距（对齐参考源）
      paddingRight: gutter.value ? addUnit(gutter.value) : '',
      // 非正方形 + 第二行及以后：上边距承担行间距
      marginTop: !square.value && gutter.value && index.value >= columnNum ? addUnit(gutter.value) : ''
    }),
    ...parseStyle(props.customStyle)
  }
})

/**
 * 内容区默认 height 与 SCSS 一致；right=0 / bottom=auto 对非 square
 * 相对定位无额外位移，square + gutter 则按参考源缩进右边和底边。
 * 完整键集防止 gutter / square 动态切回时残留旧 right、bottom、height。
 */
const GRID_ITEM_CONTENT_STYLE = defineStyleKeys({
  right: '0px',
  bottom: 'auto',
  height: '100%',
  '--wot-grid-item-bg': ''
})

const contentStyle = computed<CSSProperties>(() => {
  const inset = square.value && gutter.value ? addUnit(gutter.value) : ''
  return resolveStyle(GRID_ITEM_CONTENT_STYLE, {
    right: inset,
    bottom: inset,
    height: inset ? 'auto' : '',
    '--wot-grid-item-bg': bgColor.value
  })
})

/**
 * 根节点 CSS 类名计算
 * 包含边框、正方形、自定义类名等样式类
 * @returns {string} 组合后的 CSS 类名字符串
 */
const rootClass = computed(() => {
  const classes = ['wd-grid-item']
  if (borderClass.value) {
    classes.push(borderClass.value)
  }
  if (square.value) {
    classes.push('is-square')
  }
  if (props.customClass) {
    classes.push(props.customClass)
  }
  return classes.join(' ')
})

/**
 * 内容区域 CSS 类名计算
 * 根据是否为正方形、是否有圆角、排列方向等计算类名
 * @returns {string} 组合后的 CSS 类名字符串
 */
const contentClass = computed(() => {
  const classes = ['wd-grid-item__content']
  if (square.value) {
    classes.push('is-square')
  }
  if (border.value && gutter.value > 0) {
    classes.push('is-around')
  }
  if (grid.value) {
    const { center, direction, reverse } = grid.value.props
    if (center) {
      classes.push('is-center')
    }
    if (direction === 'horizontal') {
      classes.push('is-horizontal')
    }
    if (reverse) {
      classes.push('is-reverse')
    }
  }
  // Lynx 适配：参考源 :hover-class 绑定的按压类名常驻（按压反馈由 :active 触发）
  if (hoverClass.value) {
    classes.push(hoverClass.value)
  }
  return classes.join(' ')
})

/**
 * Badge 组件属性计算
 * 合并用户传入的徽标属性与从 GridItem Props 中提取的值
 * @returns {Partial<BadgeProps>} 最终的 Badge 组件属性对象
 */
const customBadgeProps = computed(() => {
  const badgeProps: Partial<BadgeProps> = deepAssign(
    isDef(props.badgeProps) ? omitBy(props.badgeProps, isUndefined) : {},
    omitBy(
      {
        max: props.max,
        isDot: props.isDot,
        value: props.value
      },
      isUndefined
    )
  )
  if (!isDef(badgeProps.max)) {
    badgeProps.max = 99
  }
  return badgeProps
})

/**
 * hover 类名计算
 * 仅当格子启用点击反馈时才返回对应的 hover 类名
 * @returns {string} hover 类名，如果不启用点击反馈则返回空字符串
 */
const hoverClass = computed(() => {
  if (grid.value?.props.clickable) {
    return grid.value.props.hoverClass ? grid.value.props.hoverClass : 'wd-grid-item__content--hover'
  }
  return ''
})

/**
 * 处理格子点击事件
 * 1. 检查父级 Grid 组件是否启用了点击反馈
 * 2. 触发 click 事件
 * 3. 如果绑定了 url，则根据 linkType 进行路由跳转
 */
function click(event: any) {
  if (grid.value && !grid.value.props.clickable) return
  emit('click')
  emit('tap', event)
  const { url, linkType } = props
  if (url) {
    switch (linkType) {
      case 'navigateTo':
        uni.navigateTo({ url })
        break
      case 'reLaunch':
        uni.reLaunch({ url })
        break
      case 'redirectTo':
        uni.redirectTo({ url })
        break
      case 'switchTab':
        uni.switchTab({ url })
        break
      default:
        console.error(`[wot-design] warning(wd-grid-item): linkType can not be ${linkType}`)
        break
    }
  }
}
</script>

<template>
  <view :class="rootClass" @tap="click" :style="rootStyle">
    <view :class="contentClass" :style="contentStyle">
      <slot>
        <view class="wd-grid-item__wrapper" v-if="hasIcon || $slots.icon">
          <WdBadge v-bind="customBadgeProps" custom-class="wd-grid-item__badge">
            <slot name="icon">
              <WdIcon
                :name="icon"
                :size="iconSize"
                :color="iconColor"
                :class-prefix="iconPrefix"
                :css-icon="cssIcon"
                :custom-class="`wd-grid-item__icon ${customIcon}`"
              />
            </slot>
          </WdBadge>
        </view>
        <slot name="text">
          <text v-if="text" :class="['wd-grid-item__text', { 'is-ellipsis': ellipsis, 'is-spaced': hasIcon || $slots.icon }, customText]" :text-maxline="ellipsis ? 1 : undefined">{{ text }}</text>
        </slot>
      </slot>
    </view>
  </view>
</template>
