/*
 * wd-notify — 消息通知
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 结构：wd-popup（无遮罩）> view.wd-notify，与 wot-ui 一致；
 * - 状态通道：wot-ui 用 inject(getNotifyOptionKey(selector), ref(props)) 单通道
 *   （命令式 useNotify 写、组件读）。本地保留双通道：注入的 option ref（useNotify
 *   命令式 / defineExpose 的 showNotify）+ props 声明式同步，两者都汇入 state；
 * - 图标名：wot-ui 用 check-circle-fill / exclamation-circle-fill /
 *   close-circle-fill / info-circle-fill，本地内置图标集（iconfont）无同名字形，
 *   映射为 success / warning / error / prompt（CONVENTIONS §8）；
 * - 弹层定位：wot-ui 写 top: calc(var(--window-top) + safeHeight) /
 *   bottom: var(--window-bottom)（uni-app 小程序专有 CSS 变量，Lynx 不存在），
 *   改用 popup 的 padding-top 承担顶部安全高度；floating 变体的 left/right
 *   由内联样式给出（同 wot-ui 的 12px），width 保持 auto；
 *   overflow: unset 为 Web 专有写法，Lynx 不支持，删除；
 * - 内联样式一律对象语法并经 parseStyle 归一 customStyle（字符串 :style 会被
 *   vue-lynx 静默丢弃，CONVENTIONS §19）；会随 position / variant 切换的键
 *   （padding-top / left / right / width）经 Style Funnel（defineStyleKeys +
 *   resolveStyle）每帧写全，省略键等于保留旧值（CONVENTIONS §20）；
 * - 根视图显式 display: flex + flex-direction: row（NATIVE-REWRITE §3.1
 *   根节点三件套）并 flex-shrink: 0——弹层 .wd-popup 现为 flex column
 *   容器；内容区 __content 补 min-width: 0，保证单行省略时前缀图标与
 *   关闭按钮不被文本挤出屏外；
 * - 根 view 的点击 @click → @tap，并在 emits 声明 tap 转发（CONVENTIONS §6/§14）；
 *   onClick / onClosed / onOpened 回调选项优先于 emit（与 wot-ui 一致）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, inject, ref, watch } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { notifyProps, type NotifyType, type NotifyProps } from './types'
import { getNotifyOptionKey } from '.'
import { addUnit, filterStyle, isDef, isFunction, isString, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(notifyProps)
const emit = defineEmits(['click', 'closed', 'opened', 'update:visible', 'tap'])

const notifyOptionKey = getNotifyOptionKey(props.selector)
const state = ref<NotifyProps>({ ...props })
const isAlive = useAlive()

// 命令式 API（useNotify(selector) / defineExpose 的 showNotify）与 props
// 两条通道都汇入本地 state：useNotify 写的是页面级 provide 下来的共享
// option ref，此前本组件只计算 key 从未 inject，导致命令式调用无人消费
// （demo 的 notifyRef.value.showNotify() 静默无效）。
// None 哨兵 = 页面未调用 useNotify，此时仅 props / 暴露方法生效。
const notifyOption = inject(notifyOptionKey, ref<any>(Symbol('None')))

/** 把外部选项合并进 state（仅覆盖已定义字段，与 useToast.reset 同语义） */
function applyOptions(options: Record<string, any>) {
  const next: Record<string, any> = { ...state.value }
  for (const key of Object.keys(options)) {
    if (isDef(options[key])) next[key] = options[key]
  }
  state.value = next as NotifyProps
}

watch(
  () => notifyOption.value,
  (newVal) => {
    // 卸载后晚到的写入直接丢弃：vue-lynx 在已销毁树上继续 patch 会产生
    // 晚到的 remove/insert，真机表现为 removeNode 未知签名（9902）。
    if (!newVal || typeof newVal === 'symbol' || !isAlive()) return
    applyOptions(newVal as Record<string, any>)
  },
  { deep: true }
)

// 声明式 props 同步：state 初始为 props 快照，此处把关键 props 的后续变更汇入
// state（visible 变化可开/关），与命令式通道并存。
watch(
  () => [
    props.visible,
    props.message,
    props.type,
    props.duration,
    props.color,
    props.background,
    props.position,
    props.zIndex,
    props.safeHeight,
    props.closable,
    props.variant
  ],
  () => {
    if (!isAlive()) return
    applyOptions({
      visible: props.visible,
      message: props.message,
      type: props.type,
      duration: props.duration,
      color: props.color,
      background: props.background,
      position: props.position,
      zIndex: props.zIndex,
      safeHeight: props.safeHeight,
      closable: props.closable,
      variant: props.variant
    })
  }
)

/**
 * 弹层定位样式（CONVENTIONS §20 Style Funnel）。
 *
 * 这些键都会随 position / variant 切换（padding-top 仅 top 位、left/right
 * 仅 floating 变体），省略键等于保留旧值（SetStyle 逐属性合并），故声明
 * 完整键集 + 中性值，每帧写全：position 由 top 切 bottom 时 padding-top
 * 回落 0px，variant 由 floating 切回 filled 时 left/right 回落 0px。
 */
const POPUP_STYLE = defineStyleKeys({
  background: 'transparent',
  'padding-top': '0px',
  left: '0px',
  right: '0px',
  width: 'auto'
})

const popupStyle = computed<Record<string, string>>(() =>
  resolveStyle(POPUP_STYLE, {
    'padding-top': state.value.position === 'top' ? addUnit(state.value.safeHeight || 0) : '',
    left: state.value.variant === 'floating' ? '12px' : '',
    right: state.value.variant === 'floating' ? '12px' : ''
  })
)

/**
 * 颜色 / 背景色为可选配置：未传时经 filterStyle 剔除空值（CONVENTIONS §19.3），
 * 由 .wd-notify--<type> 的类型类承担配色。弹层默认 lazyRender + hideWhenClose，
 * 通知每次展示都是新挂载的节点，不存在跨帧残留。
 */
const rootStyle = computed(() => {
  const style: Record<string, string> = {
    color: state.value.color || '',
    'background-color': state.value.background || ''
  }
  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})

/**
 * 根据消息类型获取对应的图标
 */
const iconName = computed(() => {
  const map: Record<NotifyType, string> = {
    primary: 'prompt',
    success: 'success',
    warning: 'warning',
    danger: 'error'
  }
  return map[state.value.type!] || ''
})

/**
 * 处理点击事件
 */
const onClick = (event: any) => {
  if (isFunction(state.value.onClick)) return state.value.onClick(event)
  emit('click', event)
  emit('tap', event)
}

/**
 * 处理关闭动画结束事件
 */
const onClosed = () => {
  if (isFunction(state.value.onClosed)) return state.value.onClosed()
  emit('closed')
}

/**
 * 处理打开动画结束事件
 */
const onOpened = () => {
  if (isFunction(state.value.onOpened)) return state.value.onOpened()
  emit('opened')
}

/**
 * 点击关闭按钮处理
 */
function handleClose() {
  state.value.visible = false
}

watch(
  () => state.value.visible,
  (visible) => {
    emit('update:visible', visible as boolean)
  },
  { deep: true }
)

/**
 * 命令式展示（组件实例方法，demo 的 ref 调用方式；与 useNotify 共享
 * 同一 option ref 的页面会经 watch 同步）。字符串入参视为 message。
 */
function showNotify(option: Record<string, any> | string) {
  if (!isAlive()) return
  applyOptions({ ...(isString(option) ? { message: option } : option), visible: true })
}

/** 命令式关闭 */
function closeNotify() {
  if (!isAlive()) return
  state.value.visible = false
}

defineExpose({ showNotify, closeNotify })
</script>

<template>
  <WdPopup
    v-model="state.visible"
    :custom-style="popupStyle"
    :position="state.position"
    :z-index="state.zIndex"
    :modal="false"
    :root-portal="state.rootPortal"
    @leave="onClosed"
    @enter="onOpened"
  >
    <view
      :class="[
        'wd-notify',
        `wd-notify--${state.type}`,
        `wd-notify--${state.position}`,
        state.variant === 'floating' ? 'wd-notify--floating' : '',
        customClass
      ]"
      :style="rootStyle"
      @tap="onClick"
    >
      <slot name="prefix">
        <WdIcon v-if="iconName" :name="iconName" custom-class="wd-notify__prefix" />
      </slot>
      <view class="wd-notify__content">
        <slot>
          <text class="wd-notify__text">{{ state.message }}</text>
        </slot>
      </view>
      <slot name="close" v-if="state.closable">
        <WdIcon name="close" custom-class="wd-notify__close" @tap="handleClose" />
      </slot>
    </view>
  </WdPopup>
</template>
