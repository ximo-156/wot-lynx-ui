/*
 * wd-drop-menu-item — 下拉菜单项
 *
 * Lynx 实现说明：经 useParent 读取 offset；展开时选项列表
 * 经绝对定位浮层展示，点击选项后收起。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { dropMenuItemProps } from './types'
import { useParent } from '../../composables/useParent'
import { DROP_MENU_KEY } from '../wd-drop-menu/types'
import { isObj, parseStyle } from '../../common/util'

const props = defineProps(dropMenuItemProps)
const emit = defineEmits(['change', 'update:modelValue', 'open', 'close'])

const { parent: dropMenu } = useParent(DROP_MENU_KEY)

const expanded = computed(() => Boolean(props.modelValue))

const activeLabel = computed(() => {
  const options = (props.options || []) as Record<string, any>[]
  const found = options.find((opt) => String(isObj(opt) ? opt[props.valueKey] : opt) === String(props.modelValue))
  if (!found) return props.title
  return isObj(found) ? String(found[props.labelKey] ?? '') : String(found)
})

const listStyle = computed(() => {
  const offset = dropMenu?.value?.offset.value || 0
  return { top: `${offset}px` }
})

function toggle() {
  if (props.disabled) return
  if (expanded.value) {
    emit('update:modelValue', '')
    emit('close')
  } else {
    emit('update:modelValue', '__open__')
    emit('open')
  }
}

function select(option: Record<string, any>) {
  const value = isObj(option) ? option[props.valueKey] : option
  emit('update:modelValue', value)
  emit('change', { value })
  emit('update:modelValue', value)
  emit('close')
}
</script>

<template>
  <view :class="`wd-drop-menu-item ${expanded ? 'is-expanded' : ''} ${disabled ? 'is-disabled' : ''} ${customClass}`" :style="parseStyle(customStyle)">
    <view class="wd-drop-menu-item__title" @tap="toggle">
      <text :class="`wd-drop-menu-item__title-text ${expanded ? 'is-active' : ''}`">{{ expanded && modelValue !== '__open__' ? activeLabel : title }}</text>
    </view>
    <view v-if="expanded" class="wd-drop-menu-item__list" :style="listStyle">
      <view
        v-for="(option, index) in options"
        :key="index"
        :class="['wd-drop-menu-item__option', String(isObj(option) ? option[valueKey] : option) === String(modelValue) ? 'is-active' : '']"
        @tap="select(option)"
      >
        <text class="wd-drop-menu-item__option-text">{{ isObj(option) ? option[labelKey] : option }}</text>
      </view>
    </view>
  </view>
</template>
