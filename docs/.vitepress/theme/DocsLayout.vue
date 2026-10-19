<script setup lang="ts">
/**
 * DocsLayout — 文档站布局外壳。
 *
 * 在默认主题布局的右侧栏（aside，大纲下方）注入 H5 预览：
 * - 组件文档页（/components/<slug>）右侧显示对应组件的手机实时预览；
 * - 点击侧边栏切换组件 → 路由变化 → 预览实时重载（见 H5Preview 的 slug 监听）；
 * - 非组件页（指南 / 首页）不显示预览。
 *
 * 右侧栏加宽与窄屏回退由 preview.css 中 body.has-h5-preview 规则完成。
 */
import DefaultTheme from 'vitepress/theme'
import H5Preview from './H5Preview.vue'
import { useRoute } from 'vitepress'
import { computed, onMounted, watch } from 'vue'

const route = useRoute()

/** 当前是否组件文档页（/components/button 或 /components/button.html） */
const isComponentPage = computed(() => /^\/components\/[^/]+$/.test(route.path))

const slug = computed(() =>
  route.path.replace(/^\/components\//, '').replace(/\.html$/, '')
)

/** body 挂类名，供 preview.css 加宽右侧栏（SSR 无 document，仅客户端执行） */
function syncBodyClass() {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('has-h5-preview', isComponentPage.value)
}

onMounted(syncBodyClass)
watch(isComponentPage, syncBodyClass)
</script>

<template>
  <DefaultTheme.Layout>
    <template #aside-outline-after>
      <H5Preview v-if="isComponentPage" :name="slug" />
    </template>
  </DefaultTheme.Layout>
</template>
