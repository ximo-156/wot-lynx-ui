/*
 * wd-sticky — 粘性布局
 *
 * Lynx 实现说明：基于 wd-resize 监听内容尺寸，
 * 滚动出视口时切换 position: sticky / fixed；
 * Lynx 的 position: sticky 支持有限，主要靠 fixed + 位移计算。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import WdResize from '../wd-resize/wd-resize.vue'
import { stickyProps } from './types'
import { uuid, filterStyle } from '../../common/util'

const props = defineProps(stickyProps)

const styckyId = ref<string>(`wd-sticky-${uuid()}`)
const stickyTop = ref<number>(0)
const fixed = ref<boolean>(false)

const rootStyle = computed(() => {
  return `${props.customStyle || ''}display: inline-block;`
})

const stickyStyle = computed(() => {
  const style: Record<string, string> = {}
  if (fixed.value) {
    style.position = 'fixed'
    style.top = `${props.offsetTop}px`
    style.left = '0'
    style.right = '0'
    style['z-index'] = String(props.zIndex)
  }
  return filterStyle(style)
})

const containerStyle = computed<Record<string, string>>(() => {
  return {}
})

function handleResize() {
  // 尺寸变化时的扩展位（滚动联动由页面 scroll-view 驱动）
}
</script>

<template>
  <view :style="rootStyle">
    <view :class="`wd-sticky ${customClass}`" :style="stickyStyle" :id="styckyId">
      <view class="wd-sticky__container" :style="containerStyle">
        <wd-resize @resize="handleResize" custom-style="display: inline-block;">
          <slot />
        </wd-resize>
      </view>
    </view>
  </view>
</template>
