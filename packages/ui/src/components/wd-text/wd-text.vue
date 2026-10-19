/*
 * wd-text — 文本
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 根元素为原生 text 元素（Lynx 文本容器），前后缀经同名 slot 直接嵌入
 *   （与参考源结构一致，不加包装元素/类名）；
 * - 多行省略：参考源以 -webkit-line-clamp/-webkit-box 实现，Lynx 不支持，
 *   CSS 仅保留 overflow/text-overflow 裁剪，行数由根 text 的 text-maxline
 *   属性承担（CONVENTIONS §5.6）；
 * - rootStyle 由参考源的「objToStyle 拼字符串 + customStyle 拼接」改为对象语法
 *   （parseStyle 归一，CONVENTIONS §19）；
 * - **根元素为原生 text 元素**（Lynx 文本容器）：text 不是 view，不走
 *   display: flex 布局体系（NATIVE-REWRITE §3.1 的「根节点三件套」针对 view；
 *   text 上写 flex 声明无意义），文本的水平/垂直对齐由 text-align 与
 *   line-height 表达——需要居中时由使用方容器 flex 居中 + 本元素
 *   text-align: center 共同完成（§3.2）；
 * - 内层正文 text 同样不继承父级 text-align（Lynx 默认不开 CSS 继承），
 *   故 rootStyle 的 text-align 与 color / font-size 一并通过内联下发到
 *   根 text，内层 text 由根 text 的样式经内联继承覆盖；
 * - **Style Funnel**（CONVENTIONS §20）：rootStyle 的四个可切换键
 *   （color / font-size / line-height / text-decoration）经 defineStyleKeys +
 *   resolveStyle 每帧输出完整键集——decoration 由 underline 切回 none 时
 *   旧值不会残留；
 * - 根 text 绑 @tap 并在 emits 声明转发 click/tap（CONVENTIONS §6/§14）；
 *   mode=phone 且 call 时点击拨号，经 common/uni 兼容层下发，
 *   宿主未注入适配器时降级为 warning。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import { isDef, parseStyle, type CSSProperties } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { textProps } from './types'
import { formatDate } from '../../common/formatDate'
import { uni } from '../../common/uni'

const props = defineProps(textProps)
const emit = defineEmits<{
  (e: 'click', event: any): void
  (e: 'tap', event: any): void
}>()

// 存储文本类名的响应式变量
const textClass = ref<string>('')

// 监听 props 变化，合并 watch 逻辑
watch(
  () => ({
    type: props.type,
    text: props.text,
    mode: props.mode,
    color: props.color,
    bold: props.bold,
    lines: props.lines,
    format: props.format
  }),
  ({ type }) => {
    // 验证 type 属性
    const types = ['primary', 'error', 'warning', 'success', 'default']
    if (type && !types.includes(type)) {
      console.error(`type must be one of ${types.toString()}`)
    }
    computeTextClass()
  },
  { deep: true, immediate: true }
)

// 计算根元素的类名
const rootClass = computed(() => {
  return `wd-text ${props.customClass} ${textClass.value}`
})

/**
 * 可切换样式键 + 中性值（CONVENTIONS §20：每帧输出完整键集）。
 * 中性值取「视觉上等同于不设置」：不传 color 时由 is-{type} 类承担配色；
 * font-size / line-height 回落类上的令牌声明；text-decoration 回落 none。
 */
const TEXT_STYLE = defineStyleKeys({
  color: '',
  fontSize: '',
  lineHeight: '',
  textDecoration: 'none'
})

// 计算根元素的样式
const rootStyle = computed<CSSProperties>(() => {
  return {
    ...resolveStyle(TEXT_STYLE, {
      color: props.color,
      fontSize: props.size ? `${props.size}` : '',
      lineHeight: props.lineHeight ? `${props.lineHeight}` : '',
      textDecoration: props.decoration ? `${props.decoration}` : ''
    }),
    ...parseStyle(props.customStyle)
  }
})

// 计算文本类名的函数
function computeTextClass() {
  const { type, color, bold, lines } = props
  const textClassList: string[] = []
  if (!color) {
    textClassList.push(`is-${type}`)
  }
  if (isDef(lines)) {
    textClassList.push(`is-lines-${lines}`)
  }
  bold && textClassList.push('is-bold')
  textClass.value = textClassList.join(' ')
}

// 格式化文本的函数
function formatText(text: string, format: boolean, mode: string): string {
  if (format) {
    if (mode === 'phone') {
      return text.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
    } else if (mode === 'name') {
      return text.replace(/^(.).*(.)$/, '$1**$2')
    } else {
      throw new Error('mode must be one of phone or name for encryption')
    }
  }
  return text
}

// 格式化数字的函数
function formatNumber(num: number | string): string {
  num = Number(num).toFixed(2)
  const x = num.split('.')
  let x1 = x[0]
  const x2 = x.length > 1 ? '.' + x[1] : ''
  const rgx = /(\d+)(\d{3})/
  while (rgx.test(x1)) {
    x1 = x1.replace(rgx, '$1,$2')
  }
  return x1 + x2
}

// 计算格式化后的文本
const formattedText = computed(() => {
  const { text, mode, format } = props
  if (mode === 'date') {
    return formatDate(Number(text), 'YYYY-MM-DD')
  }
  if (mode === 'price') {
    return formatNumber(text)
  }
  return formatText(`${text}`, format, mode)
})

// 处理点击事件
function handleClick(event: any) {
  if (props.mode === 'phone' && props.call) {
    uni.makePhoneCall({ phoneNumber: `${props.text}` })
  }
  emit('click', event)
  emit('tap', event)
}
</script>

<template>
  <text @tap="handleClick" :class="rootClass" :style="rootStyle" :text-maxline="lines">
    <slot v-if="$slots.prefix || prefix" name="prefix">{{ prefix }}</slot>
    <text>{{ formattedText }}</text>
    <slot v-if="$slots.suffix || suffix" name="suffix">{{ suffix }}</slot>
  </text>
</template>
