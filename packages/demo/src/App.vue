<script setup lang="ts">
import { computed } from 'vue-lynx'
import { usePageScrollLock, useQueue, useSafeArea, VIEWPORT_BREAKPOINTS } from 'wot-lynx-ui'
import Showcase from './showcase/Showcase.vue'
import { useDemoViewport } from './useDemoViewport'

const demoProps = withDefaults(defineProps<{ stress?: boolean }>(), { stress: false })
const pageScrollLocked = usePageScrollLock()
const { closeOutside } = useQueue()
const { width, inset } = useSafeArea()
const { onViewportLayout } = useDemoViewport()
const columns = computed(() => width.value >= 1440 ? 3 : width.value >= VIEWPORT_BREAKPOINTS.desktop ? 2 : 1)
const padding = computed(() => columns.value > 1 ? 24 : 16)
const contentWidth = computed(() => Math.max(1, Math.min(1440, width.value - padding.value * 2)))
const pageStyle = computed(() => ({
  'padding-left': `${padding.value}px`,
  'padding-right': `${padding.value}px`,
  'padding-top': inset('top', padding.value),
  'padding-bottom': inset('bottom', padding.value)
}))
const contentStyle = computed(() => ({
  width: `${contentWidth.value}px`,
  'margin-left': `${Math.max(0, (width.value - padding.value * 2 - contentWidth.value) / 2)}px`
}))
</script>

<template>
  <!-- Measure the full, unpadded LynxView; inner scroll padding only reserves safe content. -->
  <view class="app-viewport" @layoutchange="onViewportLayout">
    <wd-config-provider theme="light" custom-class="app-root" @tap="closeOutside">
      <scroll-view id="main-demo-page" scroll-orientation="vertical" :scroll-enable="!pageScrollLocked" :enable-scroll="!pageScrollLocked" class="page" :style="pageStyle">
        <view class="page__content" :style="contentStyle">
          <!-- Same catalog; normal browsing mounts only the selected section. -->
          <Showcase :columns="columns" :content-width="contentWidth" :browse="!demoProps.stress" scroll-target="#main-demo-page" />
        </view>
      </scroll-view>
    </wd-config-provider>
  </view>
</template>

<style scoped>
.app-viewport,
.app-root {
  width: 100%;
  height: 100%;
}
.page {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 16px;
}
.page__content {
  flex-shrink: 0;
}
</style>
