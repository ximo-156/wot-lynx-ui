<script setup lang="ts">
import { computed } from 'vue-lynx'
import { usePageScrollLock, useQueue, useViewportSize, VIEWPORT_BREAKPOINTS } from 'wot-lynx-ui'
import Showcase from './showcase/Showcase.vue'

const pageScrollLocked = usePageScrollLock()
const { closeOutside } = useQueue()
const { width } = useViewportSize()
const columns = computed(() => width.value >= 1440 ? 3 : width.value >= VIEWPORT_BREAKPOINTS.desktop ? 2 : 1)
const padding = computed(() => columns.value > 1 ? 24 : 16)
const contentWidth = computed(() => Math.max(1, Math.min(1440, width.value - padding.value * 2)))
const pageStyle = computed(() => ({ padding: `${padding.value}px` }))
const contentStyle = computed(() => ({
  width: `${contentWidth.value}px`,
  'margin-left': `${Math.max(0, (width.value - padding.value * 2 - contentWidth.value) / 2)}px`
}))
</script>

<template>
  <!-- The explicit height chain keeps the native scroll viewport scrollable. -->
  <wd-config-provider theme="light" custom-class="app-root" @tap="closeOutside">
    <scroll-view scroll-orientation="vertical" :scroll-enable="!pageScrollLocked" :enable-scroll="!pageScrollLocked" class="page" :style="pageStyle">
      <view class="page__content" :style="contentStyle">
        <!-- Still the same 106-component catalog used by device-test. -->
        <Showcase :columns="columns" :content-width="contentWidth" />
      </view>
    </scroll-view>
  </wd-config-provider>
</template>

<style scoped>
.app-root {
  width: 100%;
  height: 100%;
}
.page {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}
.page__content {
  flex-shrink: 0;
}
</style>
