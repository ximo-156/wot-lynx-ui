/*
 * wd-drop-menu — 下拉菜单
 *
 * Lynx 实现说明：经 useChildren 向 drop-menu-item 提供 offset/fold；
 * 展开态由各 item 内部维护（expose getShowPop/close），本组件据此显示
 * 遮罩、执行手风琴收起与菜单条高度度量（offset）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, ref } from 'vue-lynx'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import { dropMenuProps, DROP_MENU_KEY } from './types'
import { useChildren } from '../../composables/useChildren'
import { useAlive } from '../../composables/useAlive'
import { getRect, parseStyle, uuid } from '../../common/util'

const props = defineProps(dropMenuProps)
const isAlive = useAlive()

/** 根节点 id：菜单条高度度量用（同页多个 drop-menu 不撞 id） */
const dropMenuId = ref<string>(`wd-drop-menu-${uuid()}`)

/** 菜单条高度（偏移）：item 浮层 top 读此缓存，挂载后一次性度量 */
const offset = ref<number>(0)

const { children, linkChildren } = useChildren(DROP_MENU_KEY)

/**
 * 收起除 child 外的展开项（手风琴）。
 *
 * child 为子组件公共实例代理（item 展开前经 fold(instance.proxy) 调用）；
 * 各 item 经 expose 暴露 close()，由本方法逐个调用——曾是空转的
 * forEach，连续点两个菜单标题会两个列表同时展开。
 */
function fold(child?: any) {
  children.forEach((c: any) => {
    if (!child || c !== child) {
      const exposed = c.$ && c.$.exposed
      if (exposed && typeof exposed.close === 'function') {
        exposed.close()
      }
    }
  })
}

linkChildren({
  props: props as any,
  offset,
  fold
})

onMounted(() => {
  // 菜单条高度一次性度量并缓存（CONVENTIONS §16：触摸热路径不度量）；
  // item 的浮层 top 直接读该缓存，避免 top:0 盖住菜单栏自身。
  getRect(`#${dropMenuId.value}`).then((rect) => {
    // 度量回调晚于组件卸载落地时丢弃（9902 防护）
    if (!isAlive()) return
    offset.value = Number(rect && rect.height) || 0
  })
})

const showOverlay = computed(() => {
  // 遮罩仅在有浮层展开时显示：读子组件 expose 的 getShowPop（内部展开态）。
  // 曾误写为 c.props?.modelValue——Vue 公共实例代理只有 $props 没有 props，
  // 恒读成 undefined，遮罩永不显示；改读 modelValue 也不对（选中值恒为真，
  // 选中后遮罩常驻不消失）。
  return children.some((c: any) => {
    const exposed = c.$ && c.$.exposed
    if (exposed && typeof exposed.getShowPop === 'function') {
      return exposed.getShowPop()
    }
    // 兜底：子组件尚未 expose 时读 modelValue
    const childProps = c.$ && c.$.props
    return Boolean(childProps && childProps.modelValue)
  })
})

/** 点击遮罩：受 closeOnClickModal 控制，关闭所有展开项 */
function handleClickOverlay() {
  if (!props.closeOnClickModal) return
  children.forEach((c: any) => {
    const exposed = c.$ && c.$.exposed
    if (exposed && typeof exposed.close === 'function') {
      exposed.close()
    }
  })
}
</script>

<template>
  <view :id="dropMenuId" :class="`wd-drop-menu ${customClass}`" :style="parseStyle(customStyle)">
    <slot />
    <wd-overlay
      v-if="modal"
      :show="showOverlay"
      :lock-scroll="false"
      :z-index="zIndex - 1"
      custom-style="background-color: transparent;"
      @tap="handleClickOverlay"
    />
  </view>
</template>
