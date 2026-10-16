/*
 * wd-drop-menu-item — 下拉菜单项
 *
 * Lynx 实现说明：经 useParent 读取 offset；展开时选项列表
 * 经绝对定位浮层展示，点击选项后收起。
 *
 * 展开态用组件内部 showPop 承载（与 wot-ui 一致）：modelValue 只表示
 * "选中值"，不再兼任展开哨兵。此前的设计把两者揉在 modelValue 里
 * （'__open__' 哨兵），导致选中选项后浮层不收起、父级遮罩常驻、
 * 再次打开还会把已选值覆盖成哨兵。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, ref } from 'vue-lynx'
import { dropMenuItemProps } from './types'
import { useParent } from '../../composables/useParent'
import { DROP_MENU_KEY } from '../wd-drop-menu/types'
import { isObj, parseStyle } from '../../common/util'

const props = defineProps(dropMenuItemProps)
const emit = defineEmits(['change', 'update:modelValue', 'open', 'close'])

// setup 时捕获实例代理：展开前需把自身代理交给父级 fold 做身份比对
// （事件处理器里 getCurrentInstance() 为 null）
const instance = getCurrentInstance()!

const { parent: dropMenu } = useParent(DROP_MENU_KEY)

/** 浮层展开态（内部状态，父级遮罩经 expose 的 getShowPop 读取） */
const showPop = ref<boolean>(false)

const expanded = computed(() => showPop.value)

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
    close()
  } else {
    // 手风琴：展开前先收起其他展开项（父级经 expose 的 close 逐个调用）
    dropMenu?.value?.fold(instance.proxy)
    showPop.value = true
    emit('open')
  }
}

/** 收起自身（父级 fold / 遮罩点击经 expose 调用；自身 toggle 也走这里） */
function close() {
  if (!showPop.value) return
  showPop.value = false
  emit('close')
}

function select(option: Record<string, any>) {
  if (props.disabled) return
  const value = isObj(option) ? option[props.valueKey] : option
  // 曾连续 emit 两次 update:modelValue（v-model 双写、change 双触发）
  emit('update:modelValue', value)
  emit('change', { value })
  // 选中后收起浮层（此前只 emit 'close' 事件，浮层仍展开）
  close()
}

defineExpose({
  close,
  getShowPop: () => showPop.value
})
</script>

<template>
  <view :class="`wd-drop-menu-item ${expanded ? 'is-expanded' : ''} ${disabled ? 'is-disabled' : ''} ${customClass}`" :style="parseStyle(customStyle)">
    <view class="wd-drop-menu-item__title" @tap="toggle">
      <text :class="`wd-drop-menu-item__title-text ${expanded ? 'is-active' : ''}`">{{ expanded && modelValue ? activeLabel : title }}</text>
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
