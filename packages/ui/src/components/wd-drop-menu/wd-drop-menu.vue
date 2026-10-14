<template>
  <view :style="styleToObject(customStyle)" :class="`wd-drop-menu ${customClass}`" @tap.stop.prevent="noop" :id="dropMenuId">
    <!-- 锁滚由 WdOverlay 默认的 lockScroll → WdTransition 的
         @touchmove.stop.prevent 完成；切勿在此再绑 @touchmove="noop"，
         同名 on* 监听会被 Vue mergeProps 合并成数组注册进 vue-lynx 事件注册表，
         派发时 publishEvent 调用数组会抛 TypeError（见 wd-popup 同款注释）。 -->
    <WdOverlay
      :show="overlayVisible"
      :duration="duration"
      :z-index="12"
      :custom-style="modalStyle"
      @click="handleClickOverlay"
      v-if="modal"
    />

    <!-- Lynx 适配：wot-ui 仅在 MP-DINGTALK 条件下给这层容器挂 id，本移植版
         统一只把 dropMenuId 挂在根节点上。同一 id 挂两个节点会触发 vue-lynx
         的 "Duplicate id" 告警并影响 Teleport 目标解析，fold() 里的
         getRect('#dropMenuId') 也会命中歧义节点。 -->
    <view>
      <view class="wd-drop-menu__list">
        <view
          v-for="(child, index) in children"
          :key="index"
          @tap="toggle(child)"
          :class="`wd-drop-menu__option ${rawChildProps(child).disabled ? 'is-disabled' : ''} ${child.$.exposed!.getShowPop() ? 'is-active' : ''}`"
        >
          <view class="wd-drop-menu__option-title">
            <view class="wd-drop-menu__option-title-text"><text>{{ getDisplayTitle(child) }}</text></view>
            <WdIcon :name="rawChildProps(child).icon" :size="rawChildProps(child).iconSize" custom-class="wd-drop-menu__arrow" />
          </view>
        </view>
      </view>
      <slot />
    </view>
  </view>
</template>
<script setup lang="ts">
import './index.css'
import { computed, getCurrentInstance, inject, onBeforeMount, ref, toRaw, watch } from 'vue-lynx'
import { closeOther } from '../../common/clickoutside'
import { type Queue, queueKey } from '../../composables/useQueue'
import { styleToObject, getRect, getSystemInfo, isArray, uuid } from '../../common/util'
import { useChildren } from '../../composables/useChildren'
import { DROP_MENU_KEY, dropMenuProps } from './types'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdIcon from '../wd-icon/wd-icon.vue'

const props = defineProps(dropMenuProps)
const queue = inject<Queue | null>(queueKey, null)
const dropMenuId = ref<string>(`dropMenuId${uuid()}`)
const offset = ref<number>(0)
const windowHeight = ref<number>(0)
const modalStyle = computed(() => {
  return props.direction === 'down'
    ? `top: calc(var(--window-top) + ${offset.value}px); bottom: 0;`
    : `top: 0; bottom: calc(var(--window-bottom) + ${offset.value}px)`
})

const { proxy } = getCurrentInstance() as any

const { linkChildren, children } = useChildren(DROP_MENU_KEY)

const showOverlay = computed(() => {
  // 子节点可能尚未暴露 exposed（时序竞争 / slot 混入非约定子节点），
  // 非空断言会在 computed（渲染路径）抛错崩卡片
  return children.some(
    (child) => child.$ && child.$.exposed && typeof child.$.exposed.getShowPop === 'function' && child.$.exposed.getShowPop()
  )
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
      // eslint-disable-next-line quotes
      console.error("[wot ui] warning(wd-drop-menu): direction must be 'up' or 'down'")
    }
  },
  { deep: true, immediate: true }
)

onBeforeMount(() => {
  windowHeight.value = getSystemInfo().windowHeight
})

function noop() {}

/**
 * 非跟踪地读取子组件的 props。
 *
 * 背景（线上 "Maximum recursive updates exceeded in component <wd-drop-menu>"）：
 * 本组件在渲染路径里读子组件 props（标题 / 图标 / options 匹配），而 slot 内容
 * 每次重渲染都会生成新 vnode——模板里的数组字面量（`:options="[{...}]"`）随之
 * 重新创建，Vue 再把它写回子组件实例的 props。父组件一旦跟踪了子组件 props，
 * 这次写回就会反向触发父组件重渲染 → 再次生成新 vnode → 无限循环，最终被
 * Vue 的递归更新检测抛出，变成未处理异常。
 *
 * 用 toRaw 取原始 props 对象读取即可断开这条反向依赖：值仍是每次渲染实时重读
 * 的（不会读到过期数据），只是不建立响应式依赖。仅影响「父读子」这一侧，
 * 子组件自身的响应式不受影响。
 */
function rawChildProps(child: any): Record<string, any> {
  const props = child && child.$ && child.$.props
  return (props && toRaw(props)) || {}
}

function getDisplayTitle(child: any) {
  const { title, modelValue, options, valueKey, labelKey } = rawChildProps(child)

  if (title) {
    return title
  }
  // 兜底：slot 混入非约定子节点（或子节点尚未完成 props 初始化）时 options
  // 可能缺失。该函数运行在渲染路径（v-for 内），直接取 .length 会抛错崩掉整张卡片。
  if (!isArray(options)) {
    return ''
  }
  for (let i = 0, len = options.length; i < len; i++) {
    if (modelValue === options[i][valueKey]) {
      return options[i][labelKey]
    }
  }
  console.error('[wot-design] warning(wd-drop-menu-item): no value is matched in the options option.')
}

/**
 * 取子节点暴露的方法。
 *
 * 兜底：子节点可能尚未暴露 exposed（时序竞争 / slot 混入非约定子节点），
 * 此处的非空断言一旦落空就会在 Promise 回调或渲染路径里抛错。
 */
function getChildExposed(child: any) {
  const exposed = child && child.$ && child.$.exposed
  return exposed && typeof exposed.toggle === 'function' && typeof exposed.close === 'function' ? exposed : null
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
  getRect(`#${dropMenuId.value}`, false, proxy)
    .then((rect) => {
      if (!rect) return
      const { top, bottom } = rect
      if (props.direction === 'down') {
        offset.value = Number(bottom)
      } else {
        offset.value = windowHeight.value - Number(top)
      }
      // 度量成功但子节点方法不可用时不抛错：保持菜单关闭态即可
      const exposed = getChildExposed(child)
      if (exposed) {
        exposed.toggle()
      }
    })
    .catch((error) => {
      // 节点度量失败（无匹配节点 / 宿主不支持 SelectorQuery）时不切换菜单，
      // 避免未处理的 Promise 拒绝被 Sentry 上报为 USER_RUNTIME_ERROR。
    })
}

function handleClickOverlay() {
  if (props.closeOnClickModal) {
    // 关闭所有打开的菜单项（子节点方法缺失时跳过，不让异常逃逸到事件回调）
    children.forEach((child) => {
      const exposed = getChildExposed(child)
      if (exposed) {
        exposed.close()
      }
    })
  }
}
</script>

