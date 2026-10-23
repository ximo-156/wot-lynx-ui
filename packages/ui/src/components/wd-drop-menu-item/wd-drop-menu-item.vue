/*
 * Native drop-menu popup. Public methods/events match wot 2.3.2; async requests
 * are invalidated on opposite requests and unmount. Child-owned header snapshots
 * avoid parent/child render recursion while retaining controlled title updates.
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, inject, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue-lynx'
import WdPopup from '../../primitives/wd-popup/wd-popup.vue'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import { pushToQueue, removeFromQueue } from '../../common/clickoutside'
import { type Queue, queueKey } from '../../composables/useQueue'
import type { PopupType } from '../../primitives/wd-popup/types'
import { useParent } from '../../composables/useParent'
import { useAlive } from '../../composables/useAlive'
import { DROP_MENU_KEY } from '../wd-drop-menu/types'
import { isDef, parseStyle } from '../../common/util'
import { callInterceptor } from '../../common/interceptor'
import { dorpMenuItemProps, type DropMenuItemExpose } from './types'

const props = defineProps(dorpMenuItemProps)
const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
  (e: 'change', event: { value: string | number; selectedItem: Record<string, any> }): void
  (e: 'open'): void
  (e: 'opened'): void
  (e: 'close'): void
  (e: 'closed'): void
}>()
const isAlive = useAlive()
const queue = inject<Queue | null>(queueKey, null)
const showWrapper = ref(false)
const showPop = ref(false)
let toggleRequest = 0
let opening = false
const { parent: dropMenu } = useParent(DROP_MENU_KEY)
const { proxy } = getCurrentInstance() as any
const position = computed<PopupType | undefined>(() => dropMenu.value ? dropMenu.value.props.direction === 'down' ? 'top' : 'bottom' : undefined)
const zIndex = computed(() => Number(dropMenu.value?.props.zIndex ?? 12))
const duration = computed(() => Number(dropMenu.value?.props.duration ?? 0))
const header = computed(() => {
  const selected = props.options.find((item) => props.modelValue === item[props.valueKey])
  return { title: props.title || selected?.[props.labelKey] || '', disabled: props.disabled, icon: props.icon, iconSize: props.iconSize }
})
watch(header, (value) => { dropMenu.value?.syncHeader(proxy.$.uid, value) }, { immediate: true })
const rootStyle = computed(() => ({
  'z-index': String(zIndex.value),
  ...(dropMenu.value ? dropMenu.value.props.direction === 'down'
    ? { top: `calc(var(--window-top, 0px) + ${dropMenu.value.offset.value}px)`, bottom: '0px' }
    : { top: '0px', bottom: `calc(var(--window-bottom, 0px) + ${dropMenu.value.offset.value}px)` }
    : { top: '', bottom: '' }),
  ...parseStyle(props.customStyle)
}))
const popupStyle = computed(() => ({ 'max-height': props.popupHeight || '80%', ...parseStyle(props.customPopupStyle) }))
const scrollViewStyle = computed(() => ({ height: props.popupHeight || 'auto' }))
watch(() => props.modelValue, (value) => {
  if (isDef(value) && typeof value !== 'number' && typeof value !== 'string') {
    console.error('[wot-design] warning(wd-drop-menu-item): the type of value should be a number or a string.')
  }
}, { immediate: true, deep: true })
onBeforeMount(() => {
  if (queue?.pushToQueue) queue.pushToQueue(proxy)
  else pushToQueue(proxy)
})
onBeforeUnmount(() => {
  ++toggleRequest
  opening = false
  dropMenu.value?.syncHeader(proxy.$.uid, null)
  if (queue?.removeFromQueue) queue.removeFromQueue(proxy)
  else removeFromQueue(proxy)
})
function getShowPop() { return showPop.value }
function choose(index: number) {
  if (!isAlive() || props.disabled || !props.options[index]) return
  const item = props.options[index]
  const value = item[props.valueKey] !== undefined ? item[props.valueKey] : item
  emit('update:modelValue', value)
  emit('change', { value, selectedItem: item })
  close()
}
function close() {
  const request = ++toggleRequest
  opening = false
  if (!isAlive() || !showPop.value) return
  callInterceptor(props.beforeToggle, {
    args: [{ status: false }],
    done: () => { if (isAlive() && request === toggleRequest) showPop.value = false }
  })
}
function open() {
  const request = ++toggleRequest
  // Disabled blocks header/options only; official imperative open remains usable.
  if (!isAlive() || showPop.value) return
  opening = true
  callInterceptor(props.beforeToggle, {
    args: [{ status: true }],
    done: () => {
      if (!isAlive() || request !== toggleRequest) return
      opening = false
      showWrapper.value = true
      showPop.value = true
    },
    canceled: () => { if (request === toggleRequest) opening = false },
    error: () => { if (request === toggleRequest) opening = false }
  })
}
function toggle() { if (showPop.value || opening) close(); else open() }
function afterLeave() {
  if (!isAlive() || showPop.value) return
  showWrapper.value = false
  emit('closed')
}
function beforeEnter() { if (isAlive()) emit('open') }
function afterEnter() { if (isAlive() && showPop.value) emit('opened') }
function beforeLeave() { if (isAlive()) emit('close') }
defineExpose<DropMenuItemExpose>({ getShowPop, open, close, toggle })
</script>

<template>
  <view v-if="showWrapper" :class="`wd-drop-item ${customClass}`" :style="rootStyle">
    <WdPopup v-model="showPop" :z-index="zIndex" :duration="duration" :position="position" :custom-style="popupStyle"
      :custom-class="`${customPopupClass} wd-drop-item__popup`" :modal="false" :close-on-click-modal="false" :root-portal="rootPortal"
      @before-enter="beforeEnter" @after-enter="afterEnter" @before-leave="beforeLeave" @after-leave="afterLeave">
      <slot>
        <scroll-view :style="scrollViewStyle" scroll-y scroll-with-animation :show-scrollbar="true">
          <view v-for="(item, index) in options" :key="index" @tap="choose(index)"
            :class="`wd-drop-item__option ${(item[valueKey] !== undefined ? item[valueKey] : item) === modelValue ? 'is-active' : ''}`">
            <view class="wd-drop-item__title">
              <text class="wd-drop-item__title-text">{{ item[labelKey] ? item[labelKey] : item }}</text>
              <text v-if="item[tipKey]" class="wd-drop-item__tip">{{ item[tipKey] }}</text>
            </view>
            <WdIcon v-if="(item[valueKey] !== undefined ? item[valueKey] : item) === modelValue" :name="iconName" custom-class="wd-drop-item__icon" />
          </view>
        </scroll-view>
      </slot>
    </WdPopup>
  </view>
</template>
