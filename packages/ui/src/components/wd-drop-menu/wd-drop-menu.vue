/*
 * wd-drop-menu — 下拉菜单
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 结构对齐参考源：菜单条（wd-drop-menu__list + wd-drop-menu__option）由本组件
 *   经 useChildren 收集的 drop-menu-item 渲染，各 item 只负责自己的浮层
 *   （wd-drop-item + wd-popup）；
 * - @click → @tap；根 view 的 @tap.stop.prevent 吞咽点击按 Lynx 语义改写为
 *   @tap.stop.prevent，并在 emits 声明 'tap' 转发（CONVENTIONS §14：不在
 *   emits 声明的同名监听会落入 $attrs 与原生绑定合并成数组 handler，
 *   事件派发即抛注册表 TypeError）；
 * - 蒙层不再补绑 @touchmove="noop"：锁滚走 wd-overlay 的 lock-scroll →
 *   disable-touch-move 链路（CONVENTIONS §14 明令禁止包裹层补绑裸
 *   @touchmove，会与 overlay 根 view 的同名绑定合并崩溃）；
 * - 蒙层与浮层定位的 var(--window-top) / var(--window-bottom) 为 uni-app
 *   内置 CSS 变量（状态栏/导航栏高度），Lynx 无该变量，按 PORTING §4.5 以
 *   var(--window-top, 0px) 回退取 0（蒙层从页面顶部开始，语义降级）；
 * - 读子组件 props 走 toRaw 非跟踪读取（CONVENTIONS §13：渲染路径直接读
 *   子组件 props 会触发 Maximum recursive updates）；
 * - 参考源模板中 MP-DINGTALK 条件编译的包裹 view 已移除；
 * - 箭头图标：内置 180 图标集无 caret-down 字形（CONVENTIONS §8），模板内映射到
 *   arrow-down-bold（与 wd-cell / wd-sort-button 同方案），icon prop 默认值保持与
 *   参考源一致，消费方传名透传；
 * - 子组件 exposed 调用前判空（§13：渲染路径 / Promise 回调里的非空断言）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, inject, onBeforeMount, ref, toRaw, watch } from 'vue-lynx'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { closeOther } from '../../common/clickoutside'
import { type Queue, queueKey } from '../../composables/useQueue'
import { getRect, getSystemInfo, parseStyle, uuid } from '../../common/util'
import { useChildren } from '../../composables/useChildren'
import { useAlive } from '../../composables/useAlive'
import { DROP_MENU_KEY, dropMenuProps } from './types'

const props = defineProps(dropMenuProps)
const emit = defineEmits(['tap'])

const isAlive = useAlive()
const queue = inject<Queue | null>(queueKey, null)
const dropMenuId = ref<string>(`dropMenuId${uuid()}`)
const offset = ref<number>(0)
const windowHeight = ref<number>(0)
const modalStyle = computed(() => {
  return props.direction === 'down'
    ? `top: calc(var(--window-top, 0px) + ${offset.value}px); bottom: 0;`
    : `top: 0; bottom: calc(var(--window-bottom, 0px) + ${offset.value}px)`
})

const { proxy } = getCurrentInstance() as any

const { linkChildren, children } = useChildren(DROP_MENU_KEY)

const showOverlay = computed(() => {
  return children.some((child) => {
    const exposed = child.$ && child.$.exposed
    return exposed && typeof exposed.getShowPop === 'function' ? exposed.getShowPop() : false
  })
})

const overlayVisible = ref(false)
let overlayTimer: ReturnType<typeof setTimeout> | null

// 延迟关闭遮罩层，避免闪烁
// 小程序中，即使先 fold 再 closeOther 也会有闪烁，使用延迟关闭遮罩层处理
watch(showOverlay, (newVal) => {
  if (overlayTimer) {
    clearTimeout(overlayTimer)
  }
  if (newVal) {
    overlayVisible.value = true
  } else {
    overlayTimer = setTimeout(() => {
      // 定时器晚于组件卸载落地时丢弃（真机 9902 晚到 patch 家族）
      if (!isAlive()) return
      overlayVisible.value = false
      overlayTimer = null
    }, 16)
  }
})

linkChildren({ props, fold, offset })

watch(
  () => props.direction,
  (newValue) => {
    if (!['up', 'down'].includes(newValue)) {
      console.error("[wot ui] warning(wd-drop-menu): direction must be 'up' or 'down'")
    }
  },
  { deep: true, immediate: true }
)

onBeforeMount(() => {
  windowHeight.value = getSystemInfo().windowHeight
})

/** 根 view 的 tap 吞咽 + 原生事件转发（CONVENTIONS §14） */
function handleRootTap(event: any) {
  emit('tap', event)
}

/** 箭头图标名映射：内置集无 caret-down 字形，取 arrow-down-bold（CONVENTIONS §8） */
function arrowIcon(icon: string): string {
  return icon === 'caret-down' ? 'arrow-down-bold' : icon
}

/** 子项浮层是否展开（读 expose，调用前判空，CONVENTIONS §13） */
function isChildActive(child: any): boolean {
  const exposed = child.$ && child.$.exposed
  return Boolean(exposed && typeof exposed.getShowPop === 'function' && exposed.getShowPop())
}

function getDisplayTitle(child: any) {
  // toRaw 非跟踪读取（CONVENTIONS §13）
  const { title, modelValue, options, valueKey, labelKey } = (child.$ && toRaw(child.$.props)) || {}

  if (title) {
    return title
  }
  for (let i = 0, len = options.length; i < len; i++) {
    if (modelValue === options[i][valueKey]) {
      return options[i][labelKey]
    }
  }
  console.error('[wot-design] warning(wd-drop-menu-item): no value is matched in the options option.')
}

function toggle(child: any) {
  // 点击当前 menu, 关闭其他 menu
  if (child && !child.disabled) {
    if (queue && queue.closeOther) {
      queue.closeOther(child)
    } else {
      closeOther(child)
    }
    fold(child)
  }
}

/**
 * 控制菜单内容是否展开
 */
function fold(child: any) {
  getRect(`#${dropMenuId.value}`, false, proxy).then((rect) => {
    // 度量回调晚于组件卸载落地时丢弃（真机 9902 晚到 patch 家族）
    if (!isAlive()) return
    if (!rect) return
    const { top, bottom } = rect
    if (props.direction === 'down') {
      offset.value = Number(bottom)
    } else {
      offset.value = windowHeight.value - Number(top)
    }
    const exposed = child.$ && child.$.exposed
    if (exposed && typeof exposed.toggle === 'function') {
      exposed.toggle()
    }
  })
}

function handleClickOverlay() {
  if (props.closeOnClickModal) {
    // 关闭所有打开的菜单项
    children.forEach((child) => {
      const exposed = child.$ && child.$.exposed
      if (exposed && typeof exposed.close === 'function') {
        exposed.close()
      }
    })
  }
}
</script>

<template>
  <view :style="parseStyle(customStyle)" :class="`wd-drop-menu ${customClass}`" @tap.stop.prevent="handleRootTap" :id="dropMenuId">
    <wd-overlay
      :show="overlayVisible"
      :duration="duration"
      :z-index="12"
      :custom-style="modalStyle"
      @click="handleClickOverlay"
      v-if="modal"
    />

    <view class="wd-drop-menu__list">
      <view
        v-for="(child, index) in children"
        :key="index"
        @tap="toggle(child)"
        :class="`wd-drop-menu__option ${child.disabled ? 'is-disabled' : ''} ${isChildActive(child) ? 'is-active' : ''}`"
      >
        <view class="wd-drop-menu__option-title">
          <view class="wd-drop-menu__option-title-text">
            <text>{{ getDisplayTitle(child) }}</text>
          </view>
          <wd-icon :name="arrowIcon(child.icon)" :size="child.iconSize" custom-class="wd-drop-menu__arrow" />
        </view>
      </view>
    </view>
    <slot />
  </view>
</template>
