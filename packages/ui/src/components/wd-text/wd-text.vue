<template>
  <text @tap="handleClick" :class="rootClass" :style="styleToObject(rootStyle)">
    <slot v-if="$slots.prefix || prefix" name="prefix"><text>{{ prefix }}</text></slot>
    <text>{{ formattedText }}</text>
    <slot v-if="$slots.suffix || suffix" name="suffix"><text>{{ suffix }}</text></slot>
  </text>
</template>

<script setup lang="ts">
import './index.css'
import { computed, ref, watch } from 'vue-lynx'
import { styleToObject, isDef, objToStyle, addUnit } from '../../common/util'
import { textProps } from './types'
import { formatDate } from '../../common/formatDate'

// 获取组件的 props 和 emit 函数
const props = defineProps(textProps)
const emit = defineEmits(['click'])

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
  const rootStyle: Record<string, any> = {}
  if (props.color) {
    rootStyle['color'] = props.color
  }
  if (props.size) {
    // Lynx 的 font-size 等长度属性必须带单位（0 除外），数字经 addUnit 补 px，
    // 否则运行时抛 "CSS length need units (except 0)"（错误码 1303）
    rootStyle['font-size'] = addUnit(props.size)
  }
  if (props.lineHeight) {
    rootStyle['line-height'] = addUnit(props.lineHeight)
  }
  if (props.decoration) {
    rootStyle['text-decoration'] = `${props.decoration}`
  }
  return `${objToStyle(rootStyle)}${props.customStyle}`
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
      // 降级而非抛错：formatText 由 formattedText computed 在渲染路径调用，
      // 抛错会崩掉整张卡片（Sentry USER_RUNTIME_ERROR）。mode 非法时按不脱敏展示原文。
      console.warn('[wot-lynx-ui] wd-text: format 仅在 mode 为 phone / name 时生效，当前 mode 非法，按原文展示')
      return text
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
function handleClick(event: Event) {
  emit('click', event)
}
</script>

