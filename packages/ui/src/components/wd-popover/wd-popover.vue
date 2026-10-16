/*
 * wd-popover — 气泡弹出
 *
 * Lynx 实现说明：经 usePopover 计算气泡定位（placement + offset），
 * 目标元素度量后定位；normal / menu 两种内容模式。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { computed, onMounted, ref, useSlots, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdTransition from '../wd-transition/wd-transition.vue'
import { popoverProps, type PopoverExpose, type PopoverMenuItem } from './types'
import { usePopover } from '../../composables/usePopover'

const props = defineProps(popoverProps)
const emit = defineEmits(['change', 'update:modelValue', 'menuclick', 'tap'])

const slots = useSlots()
const showPopover = ref<boolean>(false)

const popover = usePopover(props.visibleArrow)

/** wot-ui 位置名 → floating-ui 位置名（usePopover 约定） */
function toFloatingPlacement(placement: string): any {
  const map: Record<string, string> = {
    top: 'top',
    'top-left': 'top-start',
    'top-right': 'top-end',
    bottom: 'bottom',
    'bottom-left': 'bottom-start',
    'bottom-right': 'bottom-end',
    left: 'left',
    'left-top': 'left-start',
    'left-bottom': 'left-end',
    right: 'right',
    'right-top': 'right-start',
    'right-bottom': 'right-end'
  }
  return map[placement] || placement
}


// 按 placement/offset 初始化与更新定位。
// 第三个参数为 BEM 类名前缀（popover），节点度量走 usePopover 生成的实例唯一 id
// （静态 id 在同页多实例下会撞引擎 id 注册表，见 usePopover.ids 注释）。
//
// ① 初始化定位移到 onMounted：setup 同步执行时目标节点尚未渲染，getRect 取不到
//    尺寸（width/height=0），此前在 setup 里同步算一次导致定位恒为 0 且之后无
//    重算。onMounted 时 DOM 就绪，度量可拿到真实尺寸。
const placement = computed(() => toFloatingPlacement(props.placement))

function controlPosition() {
  popover.control(placement.value, props.offset as any)
}

/** 重新度量目标/气泡尺寸并重算定位 */
function refreshPosition() {
  popover.init(placement.value, props.visibleArrow, 'popover')
  controlPosition()
}

onMounted(() => {
  refreshPosition()
})

// ② / ⑥ 打开时重新定位：normal 模式下隐藏副本与真实内容同尺寸，updatePosition
//    的尺寸比对不会触发重算，故打开时显式 control 一次强制重算。
watch(showPopover, (val) => {
  if (val) {
    refreshPosition()
  }
})

// ③ placement 变化时重新定位。
watch(
  () => props.placement,
  () => {
    controlPosition()
  }
)

const showStyle = computed(() => popover.showStyle.value)

const rootClass = computed(() => {
  const classes = ['wd-popover']
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

function toggle() {
  if (props.disabled) return
  showPopover.value = !showPopover.value
  emit('update:modelValue', showPopover.value)
  emit('change', { show: showPopover.value })
  emit('tap')
}

function open() {
  showPopover.value = true
  emit('update:modelValue', true)
}

function close() {
  showPopover.value = false
  emit('update:modelValue', false)
}

function menuClick(index: number) {
  emit('menuclick', { index, item: (props.content as PopoverMenuItem[])[index] })
  // 选中菜单项后关闭气泡（同步内部状态与 v-model）
  close()
}

function updatePosition() {
  popover.updatePosition(toFloatingPlacement(props.placement), props.offset as any)
}

defineExpose<PopoverExpose>({ open, close, updatePosition })
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)" :id="popover.ids.root" @tap.stop="toggle">
    <view class="wd-popover__pos wd-popover__hidden" :id="popover.ids.pos">
      <view :class="`wd-popover__container ${customPop}`">
        <view v-if="!slots.content && mode === 'normal'" class="wd-popover__inner">
          <text>{{ content }}</text>
        </view>
      </view>
    </view>
    <!-- ⑤ 点击空白关闭：透明全屏 backdrop 捕获气泡外 tap（Lynx 无全局 click，
         module 级 clickoutside/useQueue 队列未接全局监听，故用自包含 backdrop） -->
    <view v-if="showPopover" class="wd-popover__backdrop" @tap.stop="close" />
    <wd-transition
      custom-class="wd-popover__pos"
      :custom-style="popover.popStyle.value"
      :show="showPopover"
      name="fade"
      @after-enter="updatePosition()"
    >
      <view :class="`wd-popover__container ${customPop}`" :id="popover.ids.content">
        <view
          v-if="visibleArrow"
          :class="`wd-popover__arrow ${popover.arrowClass.value} ${customArrow}`"
          :style="popover.arrowStyle.value"
        />
        <slot name="content">
          <view v-if="mode === 'normal'" class="wd-popover__inner">
            <text>{{ content }}</text>
          </view>
          <view v-if="mode === 'menu'" class="wd-popover__menu">
            <view
              v-for="(item, index) in (content as PopoverMenuItem[])"
              :key="index"
              :class="['wd-popover__menu-inner', index === 0 ? 'is-first' : '']"
              @tap.stop="menuClick(index)"
            >
              <wd-icon v-if="item.iconClass" :name="item.iconClass" custom-class="wd-popover__icon" />
              <text class="wd-popover__text">{{ item.content }}</text>
            </view>
          </view>
        </slot>
        <wd-icon v-if="showClose" name="close" custom-class="wd-popover__close-icon" @tap.stop="close" />
      </view>
    </wd-transition>
    <view class="wd-popover__target" :id="popover.ids.target">
      <slot />
    </view>
  </view>
</template>
