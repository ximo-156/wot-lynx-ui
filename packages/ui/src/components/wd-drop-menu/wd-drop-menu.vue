/*
 * wd-drop-menu — native menu header and overlay.
 * Child-owned primitive snapshots keep controlled titles reactive without
 * subscribing the parent render to child props (inline options may be recreated
 * on every parent render). Measurements are scoped and latest-request guarded.
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, inject, nextTick, onBeforeMount, onBeforeUnmount, reactive, ref, watch } from 'vue-lynx'
import WdOverlay from '../../primitives/wd-overlay/wd-overlay.vue'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import { closeOther } from '../../common/clickoutside'
import { type Queue, queueKey } from '../../composables/useQueue'
import { getRect, getSystemInfo, parseStyle, uuid } from '../../common/util'
import { useChildren } from '../../composables/useChildren'
import { useAlive } from '../../composables/useAlive'
import { DROP_MENU_KEY, dropMenuProps, type DropMenuHeader } from './types'

const props = defineProps(dropMenuProps)
const emit = defineEmits(['tap'])
const isAlive = useAlive()
const queue = inject<Queue | null>(queueKey, null)
const dropMenuId = `dropMenuId${uuid()}`
const offset = ref(0)
const windowHeight = ref(0)
const { proxy } = getCurrentInstance() as any
const { linkChildren, children } = useChildren(DROP_MENU_KEY)
const headers = reactive<Record<number, DropMenuHeader>>({})
let foldRequest = 0
let overlayTimer: ReturnType<typeof setTimeout> | undefined

function syncHeader(uid: number, header: DropMenuHeader | null) {
  if (header === null) { delete headers[uid]; return }
  const previous = headers[uid]
  if (!previous || previous.title !== header.title || previous.disabled !== header.disabled || previous.icon !== header.icon || previous.iconSize !== header.iconSize) {
    headers[uid] = header
  }
}
function headerFor(child: any): DropMenuHeader {
  return headers[child.$.uid] || { title: '', disabled: false, icon: 'caret-down', iconSize: '18px' }
}
function isChildActive(child: any): boolean {
  return Boolean(child?.$?.exposed?.getShowPop?.())
}
const showOverlay = computed(() => children.some(isChildActive))
const overlayVisible = ref(false)
const modalStyle = computed(() => props.direction === 'down'
  ? { top: `calc(var(--window-top, 0px) + ${offset.value}px)`, bottom: '0px' }
  : { top: '0px', bottom: `calc(var(--window-bottom, 0px) + ${offset.value}px)` })

watch(showOverlay, (show) => {
  if (overlayTimer) clearTimeout(overlayTimer)
  if (show) {
    overlayVisible.value = true
    overlayTimer = undefined
  } else {
    overlayTimer = setTimeout(() => {
      if (isAlive()) overlayVisible.value = false
      overlayTimer = undefined
    }, 16)
  }
})
linkChildren({ props, fold, offset, syncHeader })
watch(() => props.direction, (direction) => {
  ++foldRequest
  if (!['up', 'down'].includes(direction)) {
    console.error("[wot ui] warning(wd-drop-menu): direction must be 'up' or 'down'")
  }
  if (showOverlay.value) nextTick(() => { void updateOffset() })
}, { immediate: true })
watch(() => props.customStyle, () => {
  ++foldRequest
  if (showOverlay.value) nextTick(() => { void updateOffset() })
}, { deep: true })
onBeforeMount(() => { windowHeight.value = getSystemInfo().windowHeight })
onBeforeUnmount(() => {
  ++foldRequest
  if (overlayTimer) clearTimeout(overlayTimer)
})
function applyOffset(rect: any) {
  offset.value = props.direction === 'down' ? Number(rect.bottom) : windowHeight.value - Number(rect.top)
}
async function updateOffset() {
  const request = ++foldRequest
  const rect = await getRect(`#${dropMenuId}`, false, proxy)
  if (isAlive() && request === foldRequest && rect) applyOffset(rect)
}
function toggle(child: any) {
  if (!child || headerFor(child).disabled) return
  if (queue?.closeOther) queue.closeOther(child)
  else closeOther(child)
  fold(child)
}
function fold(child?: any) {
  const request = ++foldRequest
  if (!child) return
  getRect(`#${dropMenuId}`, false, proxy).then((rect) => {
    if (!isAlive() || request !== foldRequest || !rect || !children.includes(child) || headerFor(child).disabled) return
    applyOffset(rect)
    child.$?.exposed?.toggle?.()
  })
}
function handleClickOverlay() {
  if (!props.closeOnClickModal) return
  ++foldRequest
  children.forEach((child) => child.$?.exposed?.close?.())
}
function handleRootTap(event: any) { emit('tap', event) }
</script>

<template>
  <view :style="parseStyle(customStyle)" :class="`wd-drop-menu ${customClass}`" @tap.stop.prevent="handleRootTap" :id="dropMenuId">
    <WdOverlay v-if="modal" :show="overlayVisible" :duration="duration" :z-index="zIndex" :custom-style="modalStyle" @click="handleClickOverlay" />
    <view class="wd-drop-menu__list">
      <view v-for="child in children" :key="child.$.uid" @tap="toggle(child)"
        :class="`wd-drop-menu__option ${headerFor(child).disabled ? 'is-disabled' : ''} ${isChildActive(child) ? 'is-active' : ''}`">
        <view class="wd-drop-menu__option-title">
          <view class="wd-drop-menu__option-title-text"><text>{{ headerFor(child).title }}</text></view>
          <WdIcon :name="headerFor(child).icon" :size="headerFor(child).iconSize" custom-class="wd-drop-menu__arrow" />
        </view>
      </view>
    </view>
    <slot />
  </view>
</template>
