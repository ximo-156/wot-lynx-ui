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
 * - 根 text 绑 @tap 并在 emits 声明转发 click/tap（CONVENTIONS §6/§14）；
 *   mode=phone 且 call 时点击拨号，经 common/uni 兼容层下发，
 *   宿主未注入适配器时降级为 warning。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import { isDef, parseStyle, type CSSProperties } from '../../common/util'
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

// 计算根元素的样式
const rootStyle = computed(() => {
  const style: CSSProperties = {}
  if (props.color) {
    style.color = props.color
  }
  if (props.size) {
    style.fontSize = `${props.size}`
  }
  if (props.lineHeight) {
    style.lineHeight = `${props.lineHeight}`
  }
  if (props.decoration) {
    style.textDecoration = `${props.decoration}`
  }
  return { ...style, ...parseStyle(props.customStyle) }
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
