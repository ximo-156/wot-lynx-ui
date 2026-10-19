/*
 * wd-image-preview — 图片预览
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 事件映射：@click → @tap（CONVENTIONS §6，Lynx view 不派发 click）；
 *   页码插值包在 text 元素中；customStyle 由 wd-overlay 经 parseStyle 归一
 *   为对象语法下发（CONVENTIONS §19）。
 * - 根链为 wd-overlay（→ wd-transition 根 view），overlay 已声明并转发
 *   tap / click，消费方在组件上绑 @tap / @click 不会穿透合并（CONVENTIONS §14）。
 * - wd-swiper 能力差异（本地 wd-swiper 为重写实现，非本批组件）：
 *   · list 项需为 { url } 对象（本地 swiper 读 item.url || item.src），故
 *     state.images 经 swiperList 计算属性映射；
 *   · loop → 本地 prop 名为 circular；
 *   · image-mode / show-menu-by-longpress / #indicator 插槽本地 swiper 未实现：
 *     image-mode 硬编码 aspectFill（图片为裁剪而非包含，见交付报告共享层缺口）；
 *     页码指示器按参考源默认插槽语义改为 swiper 的同级节点渲染。
 * - 过渡回调（enter / after-leave）加 isAlive 守卫：leave 落地时组件可能已
 *   卸载，晚到写入会触发真机 9902 家族问题。
 */
<script lang="ts" setup>
import './index.css'

import { computed, inject, reactive, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdSwiper from '../wd-swiper/wd-swiper.vue'
import { imagePreviewProps, type ImagePreviewExpose, type ImagePreviewOptions } from './types'
import { defaultOptions, getImagePreviewOptionKey, getImageUrl } from './index'
import { isDef, isFunction } from '../../common/util'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(imagePreviewProps)

const emit = defineEmits<{
  open: []
  close: []
  click: [{ index: number }]
  change: [{ index: number }]
  'long-press': [{ image: string }]
}>()

// 组件状态
const state = reactive({
  show: false,
  visible: false,
  currentIndex: 0,
  images: [] as string[]
})

// 获取注入的选项
const imagePreviewOptionKey = getImagePreviewOptionKey(props.selector)
const imagePreviewOption = inject(imagePreviewOptionKey, ref<ImagePreviewOptions>(defaultOptions))

// 合并后的选项
const options = computed(() => ({
  showIndex: isDef(imagePreviewOption.value.showIndex) ? imagePreviewOption.value.showIndex : props.showIndex,
  loop: isDef(imagePreviewOption.value.loop) ? imagePreviewOption.value.loop : props.loop,
  closeable: isDef(imagePreviewOption.value.closeable) ? imagePreviewOption.value.closeable : props.closeable,
  closeIcon: isDef(imagePreviewOption.value.closeIcon) ? imagePreviewOption.value.closeIcon : props.closeIcon,
  closeIconPosition: isDef(imagePreviewOption.value.closeIconPosition) ? imagePreviewOption.value.closeIconPosition : props.closeIconPosition,
  closeOnClick: isDef(imagePreviewOption.value.closeOnClick) ? imagePreviewOption.value.closeOnClick : props.closeOnClick,
  showMenuByLongpress: isDef(imagePreviewOption.value.showMenuByLongpress) ? imagePreviewOption.value.showMenuByLongpress : props.showMenuByLongpress,
  zIndex: isDef(imagePreviewOption.value.zIndex) ? imagePreviewOption.value.zIndex! : props.zIndex,
  onOpen: imagePreviewOption.value.onOpen || props.onOpen || null,
  onClose: imagePreviewOption.value.onClose || props.onClose || null,
  onChange: imagePreviewOption.value.onChange || props.onChange || null,
  onLongPress: imagePreviewOption.value.onLongPress || props.onLongPress || null
}))

// Lynx 适配：本地 wd-swiper 的 list 项读取 item.url || item.src，
// 参考源直接传 string[]，这里映射为 { url } 对象
const swiperList = computed(() => state.images.map((url) => ({ url })))

const isAlive = useAlive()

// 监听选项变化
watch(
  () => imagePreviewOption.value,
  (newVal: ImagePreviewOptions) => {
    if (!isAlive()) return
    reset(newVal)
  },
  { deep: true, immediate: true }
)

// 监听 show 变化，触发事件
watch(
  () => state.show,
  (newVal, oldVal) => {
    if (newVal && !oldVal) {
      emit('open')
      if (isFunction(options.value.onOpen)) {
        options.value.onOpen()
      }
    } else if (!newVal && oldVal) {
      emit('close')
      if (isFunction(options.value.onClose)) {
        options.value.onClose()
      }
    }
  }
)

/**
 * 重置选项
 */
function reset(option: ImagePreviewOptions) {
  state.show = isDef(option.show) ? option.show! : false

  if (state.show) {
    state.images = isDef(option.images) ? option.images! : props.images || []
    state.currentIndex = isDef(option.startPosition) ? option.startPosition! : props.startPosition
  }
}

/**
 * 进入动画完成
 */
function handleEnter() {
  // enter 链经 wd-transition 的帧定时器驱动，可能晚于卸载落地
  if (!isAlive()) return
  state.visible = true
}

/**
 * 离开动画完成
 */
function handleAfterLeave() {
  // leave 链落地时组件可能已卸载：此时置 visible=false 会卸载 swiper
  // 子树，在已销毁树上产生晚到的 remove（真机 9902 家族）
  if (!isAlive()) return
  state.visible = false
  state.images = []
  state.currentIndex = 0
}

/**
 * 打开预览
 */
function open(opts?: ImagePreviewOptions | string[]) {
  if (opts) {
    if (Array.isArray(opts)) {
      state.images = opts
    } else {
      state.images = isDef(opts.images) ? opts.images! : props.images || []
      state.currentIndex = isDef(opts.startPosition) ? opts.startPosition! : props.startPosition
    }
  }
  state.show = true
}

/**
 * 关闭预览
 */
function close() {
  state.show = false
}

/**
 * 设置当前图片
 */
function setActive(index: number) {
  if (index >= 0 && index < state.images.length) {
    state.currentIndex = index
  }
}

/**
 * 处理轮播切换
 */
function handleSwiperChange({ current }: { current: number }) {
  state.currentIndex = current
  emit('change', { index: current })
  if (isFunction(options.value.onChange)) {
    options.value.onChange(current)
  }
}

/**
 * 处理图片点击
 */
function handleImageClick({ index }: { index: number }) {
  emit('click', { index })
  if (options.value.closeOnClick) {
    close()
  }
}

/**
 * 处理长按
 */
function handleLongPress(image: string | Record<string, any>) {
  const url = getImageUrl(image)
  emit('long-press', { image: url })
  if (isFunction(options.value.onLongPress)) {
    options.value.onLongPress(url)
  }
}

defineExpose<ImagePreviewExpose>({
  open,
  close,
  setActive
})
</script>

<template>
  <WdOverlay
    :show="state.show"
    :z-index="options.zIndex"
    :lock-scroll="true"
    :custom-class="`wd-image-preview ${customClass}`"
    :custom-style="customStyle"
    @enter="handleEnter"
    @after-leave="handleAfterLeave"
  >
    <!-- 关闭按钮插槽 -->
    <slot name="close" :close="close">
      <view v-if="options.closeable" :class="`wd-image-preview__close wd-image-preview__close--${options.closeIconPosition}`" @tap.stop="close">
        <WdIcon custom-class="wd-image-preview__close-icon" :name="options.closeIcon" />
      </view>
    </slot>

    <!-- 图片轮播（本地 wd-swiper 能力差异见文件头说明） -->
    <WdSwiper
      v-if="state.visible"
      custom-class="wd-image-preview__swiper"
      :list="swiperList"
      v-model:current="state.currentIndex"
      :autoplay="false"
      :circular="options.loop"
      height="100%"
      @click="handleImageClick"
      @change="handleSwiperChange"
    />

    <!-- 页码指示器（参考源经 swiper #indicator 插槽渲染，本地 swiper 无该插槽，
         按默认插槽语义以同级节点等价渲染） -->
    <view v-if="options.showIndex && state.images.length > 1" class="wd-image-preview__index">
      <text>{{ state.currentIndex + 1 }} / {{ state.images.length }}</text>
    </view>

    <!-- 默认插槽（用于自定义底部内容等） -->
    <slot :current="state.currentIndex" :total="state.images.length" :images="state.images" :close="close"></slot>
  </WdOverlay>
</template>
