/*
 * wd-text — 文本
 *
 * Lynx 实现说明：
 * - 根元素为原生 text 元素（Lynx 文本容器），前后缀经 slot 嵌入；
 * - 行数限制用 text-maxline 属性（Lynx 多行省略机制）；
 * - mode=phone 且 call 时点击拨号，经 common/uni 兼容层下发，
 *   宿主未注入适配器时降级为 warning。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import { isDef, objToStyle } from '../../common/util'
import { textProps } from './types'
import { formatDate } from '../../common/formatDate'
import { uni } from '../../common/uni'

const props = defineProps(textProps)
const emit = defineEmits(['click', 'tap'])

const textClass = ref<string>('')

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
    const types = ['primary', 'error', 'warning', 'success', 'default']
    if (type && !types.includes(type)) {
      console.error(`type must be one of ${types.toString()}`)
    }
    computeTextClass()
  },
  { deep: true, immediate: true }
)

const rootClass = computed(() => {
  return `wd-text ${props.customClass} ${textClass.value}`
})

const rootStyle = computed(() => {
  const style: Record<string, any> = {}
  if (props.color) {
    style['color'] = props.color
  }
  if (props.size) {
    style['font-size'] = props.size
  }
  if (props.lineHeight) {
    style['line-height'] = props.lineHeight
  }
  if (props.decoration) {
    style['text-decoration'] = props.decoration
  }
  return `${objToStyle(style)}${props.customStyle}`
})

function computeTextClass() {
  const { type, color, bold, lines } = props
  const classList: string[] = []
  if (!color) {
    classList.push(`is-${type}`)
  }
  if (isDef(lines)) {
    classList.push(`is-lines-${lines}`)
  }
  bold && classList.push('is-bold')
  textClass.value = classList.join(' ')
}

/** 脱敏 */
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

/** 千分位价格 */
function formatNumber(num: number | string): string {
  const fixed = Number(num).toFixed(2)
  const parts = fixed.split('.')
  let intPart = parts[0]
  const decimalPart = parts.length > 1 ? `.${parts[1]}` : ''
  const rgx = /(\d+)(\d{3})/
  while (rgx.test(intPart)) {
    intPart = intPart.replace(rgx, '$1,$2')
  }
  return intPart + decimalPart
}

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

function handleClick(event: any) {
  if (props.mode === 'phone' && props.call) {
    uni.makePhoneCall({ phoneNumber: `${props.text}` })
  }
  emit('click', event)
  emit('tap', event)
}
</script>

<template>
  <text @tap="handleClick" :class="rootClass" :style="rootStyle">
    <text v-if="$slots.prefix || prefix" class="wd-text__prefix">
      <slot name="prefix">{{ prefix }}</slot>
    </text>
    <text :text-maxline="lines">{{ formattedText }}</text>
    <text v-if="$slots.suffix || suffix" class="wd-text__suffix">
      <slot name="suffix">{{ suffix }}</slot>
    </text>
  </text>
</template>
