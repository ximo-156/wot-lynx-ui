/*
 * wd-curtain — 幕帘
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 结构：wd-popup（center + zoom-in）> view.__content > image + close 插槽，
 *   与 wot-ui 一致；custom-class 直接下发到 popup 根节点（.wd-popup.wd-curtain），
 *   不再额外包一层 view。
 * - 事件映射：@click → @tap（CONVENTIONS §6，Lynx view 不派发 click）；
 *   图片点击经 clickImage 处理，emits 声明 'tap' 并转发（CONVENTIONS §14：
 *   消费方在组件上绑 @tap 不会穿透到根元素与内部绑定合并崩溃）。
 * - imgStyle 由参考源的字符串拼接改为对象语法（CONVENTIONS §19：字符串
 *   :style 会被 vue-lynx 静默丢弃），并经 defineStyleKeys + resolveStyle 每帧
 *   输出完整键集（Style Funnel，§20；中性值 auto 与 __content-img 类声明一致）。
 * - show-menu-by-longpress 为微信小程序专有属性，Lynx 无对应能力，按参考源
 *   绑定到 image 元素上但不产生效果（PORTING §2.3）。
 * - uni.navigateTo 经 common/uni 适配层转发，宿主未注入时降级告警不崩溃。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import WdPopup from '../../primitives/wd-popup/wd-popup.vue'
import { curtainProps } from './types'
import { addUnit } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { uni } from '../../common/uni'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(curtainProps)
const isAlive = useAlive()
const emit = defineEmits([
  'beforeenter',
  'enter',
  'afterenter',
  'beforeleave',
  'leave',
  'afterleave',
  'close',
  'closed',
  'click-modal',
  'load',
  'error',
  'click',
  'tap',
  'update:modelValue'
])

const modelValue = ref(props.modelValue || props.value)

watch(
  () => props.modelValue,
  (newVal) => {
    modelValue.value = newVal
  }
)

watch(
  () => props.value,
  (newVal) => {
    modelValue.value = newVal
  }
)

watch(modelValue, (newVal) => {
  emit('update:modelValue', newVal)
  if (!newVal) {
    emit('close')
  }
})

const imgSucc = ref<boolean>(true)
const imgScale = ref<number>(1)

// Lynx 适配：参考源返回 `width: Xpx ;height: Ypx` 字符串，本地改为对象语法
// （CONVENTIONS §19）；width / height 两键每帧都输出完整键集（Style Funnel，
// §20）——中性值取 auto，与 __content-img 类声明（width/height: auto）一致，
// 条件由真转假时不会残留旧宽高。
const IMG_STYLE = defineStyleKeys({ width: 'auto', height: 'auto' })

const imgStyle = computed(() =>
  resolveStyle(IMG_STYLE, {
    width: props.width ? addUnit(props.width) : undefined,
    height: props.width ? addUnit(props.width / imgScale.value) : undefined
  })
)

function beforeenter() {
  emit('beforeenter')
}

function enter() {
  emit('enter')
}
function afterenter() {
  emit('afterenter')
}

function beforeleave() {
  emit('beforeleave')
}

function leave() {
  emit('leave')
}

function afterleave() {
  emit('afterleave')
  emit('closed')
}

function close() {
  if (!isAlive()) return
  modelValue.value = false
}

function clickModal() {
  emit('click-modal')
}

function imgLoad(event: any) {
  if (!isAlive()) return
  const width = Number(event?.detail?.width)
  const height = Number(event?.detail?.height)
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) imgScale.value = width / height
  imgSucc.value = true
  emit('load')
}
function imgErr() {
  if (!isAlive()) return
  imgSucc.value = false
  emit('error')
}

function clickImage() {
  if (!isAlive()) return
  if (props.to) {
    uni.navigateTo({
      url: props.to
    })
  }
  emit('click')
  // CONVENTIONS §14：根 view 内部点击的 tap 转发
  emit('tap')
  if (props.closeOnClick) {
    close()
  }
}
</script>

<template>
  <WdPopup
    v-model="modelValue"
    transition="zoom-in"
    position="center"
    :close-on-click-modal="closeOnClickModal"
    :hide-when-close="hideWhenClose"
    :z-index="zIndex"
    :root-portal="rootPortal"
    @before-enter="beforeenter"
    @enter="enter"
    @after-enter="afterenter"
    @before-leave="beforeleave"
    @leave="leave"
    @after-leave="afterleave"
    @close="close"
    @click-modal="clickModal"
    :custom-class="`wd-curtain ${customClass}`"
    :custom-style="customStyle"
  >
    <view class="wd-curtain__content">
      <image
        :src="src"
        class="wd-curtain__content-img"
        :style="imgStyle"
        :show-menu-by-longpress="showMenuByLongpress"
        @tap="clickImage"
        @error="imgErr"
        @load="imgLoad"
      ></image>
      <slot name="close">
        <WdIcon
          name="close-circle"
          :custom-class="`wd-curtain__content-close ${closePosition} ${customCloseClass}`"
          :custom-style="customCloseStyle"
          @tap="close"
        />
      </slot>
    </view>
  </WdPopup>
</template>
