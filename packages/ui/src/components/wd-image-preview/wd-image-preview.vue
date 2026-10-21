/*
 * wd-image-preview — 图片预览
 * 单次选项恢复 prop 默认值；命令式回调与组件事件分离，不重复调用同名监听。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, inject, reactive, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdSwiper from '../wd-swiper/wd-swiper.vue'
import { imagePreviewProps, type ImagePreviewExpose, type ImagePreviewOptions } from './types'
import { getImagePreviewOptionKey, getImageUrl } from './index'
import { isDef, isFunction } from '../../common/util'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(imagePreviewProps)
const emit = defineEmits<{
  open: []
  close: []
  click: [{ index: number }]
  tap: [event: any]
  change: [{ index: number }]
  'long-press': [{ image: string }]
}>()
const instance = getCurrentInstance()!
const isAlive = useAlive()
const state = reactive({ show: false, visible: false, currentIndex: 0, images: [] as string[] })
const requestOptions = ref<ImagePreviewOptions>({})
const imagePreviewOption = inject(getImagePreviewOptionKey(props.selector), ref<ImagePreviewOptions>({}))
const options = computed(() => {
  const overrides = Object.fromEntries(Object.entries(requestOptions.value).filter(([, value]) => isDef(value)))
  return { ...props, ...overrides } as typeof props & ImagePreviewOptions
})

function normalizeIndex(value: number) {
  return Math.min(Math.max(0, state.images.length - 1), Math.max(0, Number.isFinite(value) ? Math.trunc(value) : 0))
}
function reset(option: ImagePreviewOptions) {
  if (!isAlive()) return
  if (!option.show) {
    close()
    return
  }
  requestOptions.value = { ...option }
  state.images = Array.isArray(option.images) ? option.images.slice() : props.images.slice()
  state.currentIndex = normalizeIndex(isDef(option.startPosition) ? option.startPosition! : props.startPosition)
  state.show = true
}
function runLifecycleCallback(name: 'onOpen' | 'onClose') {
  const raw = instance.vnode.props || {}
  const kebab = name === 'onOpen' ? 'on-open' : 'on-close'
  const callback = requestOptions.value[name] || raw[kebab]
  if (isFunction(callback) && callback !== raw[name]) callback()
}
watch(() => state.show, (show, previous) => {
  if (!isAlive() || show === previous) return
  if (show) emit('open')
  else emit('close')
  runLifecycleCallback(show ? 'onOpen' : 'onClose')
})
watch(() => imagePreviewOption.value, reset, { deep: true, immediate: true })
function handleEnter() {
  if (isAlive() && state.show) state.visible = true
}
function handleAfterLeave() {
  if (!isAlive() || state.show) return
  state.visible = false
  state.images = []
  state.currentIndex = 0
}
function open(input?: ImagePreviewOptions | string[]) {
  reset({ ...(Array.isArray(input) ? { images: input } : input || {}), show: true })
}
function close() {
  if (isAlive()) state.show = false
}
function setActive(index: number) {
  if (isAlive() && Number.isInteger(index) && index >= 0 && index < state.images.length) state.currentIndex = index
}
function handleSwiperChange({ current }: { current: number }) {
  if (!isAlive() || !state.show || !Number.isInteger(current) || current < 0 || current >= state.images.length) return
  state.currentIndex = current
  emit('change', { index: current })
  // @change / h({ onChange }) 是事件监听；:on-change 是数字索引回调 prop。
  const raw = instance.vnode.props || {}
  const callback = requestOptions.value.onChange || raw['on-change']
  if (isFunction(callback) && callback !== raw.onChange) callback(current)
}
function handleImageClick({ index }: { index: number }) {
  if (!isAlive() || !state.show) return
  emit('click', { index })
  if (options.value.closeOnClick) close()
}
function handleMaskClick() {
  if (options.value.closeOnClick) close()
}
function handleLongPress(image: string | Record<string, any>) {
  if (!isAlive() || !state.show) return
  const url = getImageUrl(image)
  emit('long-press', { image: url })
  const raw = instance.vnode.props || {}
  const callback = requestOptions.value.onLongPress || raw['on-long-press']
  const listener = raw.onLongPress || raw['onLong-press']
  if (isFunction(callback) && callback !== listener) callback(url)
}

defineExpose<ImagePreviewExpose>({ open, close, setActive })
</script>

<template>
  <WdOverlay
    :show="state.show"
    :z-index="options.zIndex"
    :lock-scroll="true"
    :custom-class="`wd-image-preview ${customClass}`"
    :custom-style="customStyle"
    @click="handleMaskClick"
    @tap="emit('tap', $event)"
    @enter="handleEnter"
    @after-leave="handleAfterLeave"
  >
    <slot name="close" :close="close">
      <view v-if="options.closeable" :class="`wd-image-preview__close wd-image-preview__close--${options.closeIconPosition}`" @tap.stop="close">
        <WdIcon custom-class="wd-image-preview__close-icon" :name="options.closeIcon" />
      </view>
    </slot>
    <WdSwiper
      v-if="state.visible"
      custom-class="wd-image-preview__swiper"
      :list="state.images"
      v-model:current="state.currentIndex"
      :autoplay="false"
      :loop="options.loop"
      :show-menu-by-longpress="options.showMenuByLongpress"
      image-mode="aspectFit"
      height="100%"
      @click="handleImageClick"
      @long-press="({ item }) => handleLongPress(item)"
      @change="handleSwiperChange"
    >
      <template #indicator="{ total, current }">
        <slot name="indicator" :total="total" :current="current">
          <view v-if="options.showIndex && total > 1" class="wd-image-preview__index"><text>{{ current + 1 }} / {{ total }}</text></view>
        </slot>
      </template>
    </WdSwiper>
    <slot :current="state.currentIndex" :total="state.images.length" :images="state.images" :close="close" />
  </WdOverlay>
</template>
