<script setup lang="ts">
import Showcase from './showcase/Showcase.vue'
</script>

<template>
  <!-- app-root 显式挂 height:100%：Lynx 中百分比高度只相对「已确定高度」的父级解析，
       若包裹层为 auto（内容高度），其下 scroll-view 的 height:100% 会解析成内容高度而非
       屏幕高度——滚动容器与内容等高即无可滚动范围（页面无法滚动）。
       链路：page 根(屏幕高，确定) > app-root(100%) > scroll-view.page(100%) > 内容。 -->
  <wd-config-provider theme="light" custom-class="app-root">
    <scroll-view scroll-orientation="vertical" class="page">
      <!-- 组件演示内容：与 device-test 入口共用同一份 Showcase（106/106 覆盖） -->
      <Showcase />
    </scroll-view>
  </wd-config-provider>
</template>

<style scoped>
.app-root {
  height: 100%;
}

.page {
  height: 100%;
  padding: 16px;
}
</style>
