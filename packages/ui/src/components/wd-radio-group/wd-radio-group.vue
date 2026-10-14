<template>
  <view :class="`wd-radio-group  ${customClass}`" :style="styleToObject(customStyle)">
    <slot />
  </view>
</template>
<script setup lang="ts">
import './index.css'
import { styleToObject } from '../../common/util'
import { watch } from 'vue-lynx'
import { useChildren } from '../../composables/useChildren'
import { RADIO_GROUP_KEY, radioGroupProps } from './types'

const props = defineProps(radioGroupProps)
const emit = defineEmits(['change', 'update:modelValue'])

const { linkChildren, children } = useChildren(RADIO_GROUP_KEY)

// Lynx 适配：暴露 children 供子组件判断 is-last（Lynx 不支持 :last-child）
  linkChildren({ props, updateValue, children })

watch(
  () => props.type,
  (newValue) => {
    // type: 'dot', 'button', 'circle', 'square'
    const type = ['circle', 'dot', 'button', 'square']
    if (type.indexOf(newValue) === -1) console.error(`type must be one of ${type.toString()}`)
  },
  { deep: true, immediate: true }
)

/**
 * @description 处理radio子节点通知
 */
function updateValue(value: string | number | boolean | null) {
  emit('update:modelValue', value)
  emit('change', {
    value
  })
}
</script>
