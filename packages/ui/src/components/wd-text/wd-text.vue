/*
 * wd-text — 文本。
 * 官方格式/前后缀/主题保留；正文和默认前后缀使用显式继承规则而非隐式 Lynx CSS 继承。
 * 原生 tap 转发 click/tap；已支持的 call 功能仅委托真实宿主（官方声明但未执行）。
 * 每个元素独立 Style Funnel 保证 customStyle/字体/装饰的动态移除不残留。
 */
<script lang="ts" setup>
import './index.css'

import { computed, watch } from 'vue-lynx'
import { isDef, parseStyle } from '../../common/util'
import { createStyleResolver } from '../../common/style'
import { textProps } from './types'
import { formatDate } from '../../common/formatDate'
import { hasUniAdapter, uni } from '../../common/uni'

const props = defineProps(textProps)
const emit = defineEmits(['click', 'tap'])
watch(() => props.type, (type) => {
  const types = ['primary', 'error', 'warning', 'success', 'default']
  if (type && !types.includes(type)) console.error(`type must be one of ${types.toString()}`)
}, { immediate: true })
const rootClass = computed(() => [
  'wd-text', props.customClass, !props.color ? `is-${props.type}` : '',
  props.bold ? 'is-bold' : '', isDef(props.lines) ? `is-lines-${props.lines}` : ''
])
const resolveRootStyle = createStyleResolver({ color: '', fontSize: '', lineHeight: '', textDecoration: 'none' })
const rootStyle = computed(() => resolveRootStyle({
  color: props.color, fontSize: props.size, lineHeight: props.lineHeight, textDecoration: props.decoration
}, parseStyle(props.customStyle)))
const textKeys = new Set(['color', 'fontSize', 'font-size', 'lineHeight', 'line-height', 'fontWeight', 'font-weight', 'fontStyle', 'font-style', 'fontFamily', 'font-family', 'textAlign', 'text-align', 'textDecoration', 'text-decoration', 'letterSpacing', 'letter-spacing', 'wordSpacing', 'word-spacing', 'textShadow', 'text-shadow'])
const resolveBodyStyle = createStyleResolver()
const bodyStyle = computed(() => resolveBodyStyle(Object.fromEntries(Object.entries(rootStyle.value).filter(([key]) => textKeys.has(key)))))
const formattedText = computed(() => {
  const text = `${props.text}`
  if (props.mode === 'date') return formatDate(Number(props.text), 'YYYY-MM-DD')
  if (props.mode === 'price') {
    const [integer, fraction] = Number(props.text).toFixed(2).split('.')
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : '.' + fraction)
  }
  if (props.format) {
    if (props.mode === 'phone') return text.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
    if (props.mode === 'name') return text.replace(/^(.).*(.)$/, '$1**$2')
    throw new Error('mode must be one of phone or name for encryption')
  }
  return text
})
function handleClick(event: any) {
  if (props.mode === 'phone' && props.call && hasUniAdapter('makePhoneCall')) uni.makePhoneCall({ phoneNumber: `${props.text}` })
  emit('click', event)
  emit('tap', event)
}
</script>

<template>
  <text @tap="handleClick" :class="rootClass" :style="rootStyle" :text-maxline="lines">
    <slot v-if="$slots.prefix || prefix" name="prefix"><text class="wd-text__prefix">{{ prefix }}</text></slot>
    <text class="wd-text__body" :style="bodyStyle">{{ formattedText }}</text>
    <slot v-if="$slots.suffix || suffix" name="suffix"><text class="wd-text__suffix">{{ suffix }}</text></slot>
  </text>
</template>
