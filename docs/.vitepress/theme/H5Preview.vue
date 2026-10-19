<script lang="ts">
/**
 * H5Preview — 组件文档页右侧栏的 H5（手机）预览外壳。
 *
 * 结构：一张预览卡 = 顶部工具条（组件名 / 亮暗主题 / 重载）+ 手机框
 * （状态栏 + 可滚动屏幕）。屏幕内由 lynx-dom 垫片以独立渲染器挂载
 * 「真实组件源码」编译出的演示页（ConfigProvider 包裹，令牌主题随亮暗
 * 切换）。
 *
 * 数据来源：优先取 name prop；未传时从当前路由派生（/components/button
 * → button）——由 DocsLayout 注入右侧栏时依赖此路由派生，点击侧边栏
 * 切换组件即实时重载预览。
 *
 * 容错：演示装载 / 渲染失败时由错误边界降级为提示，不影响文档页其余部分。
 */
import { defineComponent, h, computed, onBeforeUnmount, onMounted, ref, watch, type App, type Component } from 'vue'
import { useRoute } from 'vitepress'
import WdConfigProvider from 'wot-lynx-ui/components/wd-config-provider/wd-config-provider.vue'
import { createLynxApp, installLynxGlobals } from './lynx-dom'
import { installPreviewHostCapabilities } from './preview-host'
import { loadDemo } from './demo-registry'

/** 从路由路径提取组件 slug：/components/button(.html) → button */
function slugFromPath(path: string): string {
  const m = path.match(/^\/components\/([^/]+?)(?:\.html)?\/?$/)
  return m ? m[1] : ''
}

export default defineComponent({
  name: 'H5Preview',
  props: {
    /** 组件 slug（与 docs/components/<slug>.md 一致）；缺省时从路由派生 */
    name: { type: String, default: '' }
  },
  setup(props) {
    const route = useRoute()
    /** 当前预览的组件 slug（prop 优先，否则跟随路由——侧边栏点击即切换） */
    const slug = computed(() => props.name || slugFromPath(route.path))

    const theme = ref<'light' | 'dark'>('light')
    const status = ref<'loading' | 'ready' | 'error'>('loading')
    const errorMessage = ref('')
    const reloadKey = ref(0)
    const screen = ref<HTMLDivElement>()
    let app: App | null = null
    /** 挂载代次：slug 连续变化时只认最后一次挂载，避免旧演示竞争写入容器 */
    let mountGen = 0

    /** 主题为模块级 ref，跨渲染器响应式（reactivity 与渲染器无关） */
    const Shell = {
      name: 'H5PreviewShell',
      setup() {
        return () =>
          h(
            WdConfigProvider as Component,
            { theme: theme.value, customClass: 'wd-h5-screen-root' },
            { default: () => [h(currentDemo)] }
          )
      }
    }

    let currentDemo: Component = { render: () => null }

    async function mount() {
      const gen = ++mountGen
      const container = screen.value
      if (!container) return
      status.value = 'loading'
      errorMessage.value = ''
      try {
        currentDemo = await loadDemo(slug.value)
      } catch (err) {
        status.value = 'error'
        errorMessage.value = `演示装载失败：${(err as Error)?.message || err}`
        return
      }
      // 已被更新的挂载（再次切换组件 / 重载）取代，丢弃本次结果
      if (gen !== mountGen) return
      try {
        installLynxGlobals()
        // 宿主能力（文件选择 / 模拟上传）先于演示挂载注入，
        // 保证 wd-upload 等组件的 uni.* 调用在预览里拿到浏览器等价实现
        installPreviewHostCapabilities()
        // 注意：不可手动清空 container——加载提示由 v-if 托管，若在此处
        // innerHTML='' 会剥离旧 vnode 的 DOM 父节点，status 翻转时
        // patchBlockChildren 以 hostParentNode(oldVNode.el) 取 container
        // 得到 null，运行时 insertBefore 崩溃（Vue 3.5 源码行为）。
        app = createLynxApp(Shell as Component)
        // 挂载后的响应式渲染异常也走降级提示，避免白屏
        app.config.errorHandler = (err: unknown) => {
          console.error('[H5Preview] demo error', err)
          status.value = 'error'
          errorMessage.value = `演示渲染失败：${(err as Error)?.message || err}`
        }
        app.mount(container)
        status.value = 'ready'
      } catch (err) {
        status.value = 'error'
        errorMessage.value = `演示渲染失败：${(err as Error)?.message || err}`
      }
    }

    function unmount() {
      // 代次自增使进行中的异步挂载失效
      mountGen++
      if (app) {
        try {
          app.unmount()
        } catch {
          /* 忽略卸载异常 */
        }
        app = null
      }
    }

    onMounted(() => {
      mount()
    })
    onBeforeUnmount(unmount)

    // slug 变化（侧边栏点击切换组件）或重载 → 重建演示
    watch([slug, reloadKey], () => {
      unmount()
      mount()
    })

    return { theme, status, errorMessage, reloadKey, screen, slug }
  }
})
</script>

<template>
  <div class="wd-h5-preview">
    <div class="wd-h5-preview__bar">
      <span class="wd-h5-preview__title">
        <span class="wd-h5-preview__dot" />H5 预览
      </span>
      <span class="wd-h5-preview__name">{{ slug }}</span>
      <span class="wd-h5-preview__actions">
        <button
          class="wd-h5-preview__btn"
          :class="{ 'is-active': theme === 'light' }"
          type="button"
          @click="theme = 'light'"
        >
          浅色
        </button>
        <button
          class="wd-h5-preview__btn"
          :class="{ 'is-active': theme === 'dark' }"
          type="button"
          @click="theme = 'dark'"
        >
          深色
        </button>
        <button class="wd-h5-preview__btn" type="button" @click="reloadKey++">重载</button>
      </span>
    </div>
    <div class="wd-h5-preview__stage">
      <div class="wd-h5-phone">
        <div class="wd-h5-phone__notch" />
        <div class="wd-h5-phone__statusbar" :class="`is-${theme}`">
          <span class="wd-h5-phone__time">9:41</span>
          <span class="wd-h5-phone__icons">
            <span class="wd-h5-phone__signal" />
            <span class="wd-h5-phone__wifi" />
            <span class="wd-h5-phone__battery" />
          </span>
        </div>
        <div ref="screen" class="wd-h5-phone__screen" :class="`is-${theme}`">
          <div v-if="status === 'loading'" class="wd-h5-phone__loading">加载中…</div>
          <div v-else-if="status === 'error'" class="wd-h5-phone__error">{{ errorMessage }}</div>
        </div>
        <div class="wd-h5-phone__homebar" :class="`is-${theme}`" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.wd-h5-preview {
  /* 右侧栏上下文：无外边距（栏内自带间距），手机框自适应栏宽 */
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}

.wd-h5-preview__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  font-size: 13px;
}

.wd-h5-preview__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.wd-h5-preview__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00a06d;
}

.wd-h5-preview__name {
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}

.wd-h5-preview__actions {
  margin-left: auto;
  display: inline-flex;
  gap: 6px;
}

.wd-h5-preview__btn {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  border-radius: 6px;
  padding: 2px 10px;
  font-size: 12px;
  cursor: pointer;
  line-height: 20px;
}

.wd-h5-preview__btn.is-active {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.wd-h5-preview__stage {
  display: flex;
  justify-content: center;
  padding: 16px 10px 20px;
}

/* ---- 手机框 ---- */
.wd-h5-phone {
  position: relative;
  width: min(300px, 100%);
  height: 560px;
  border-radius: 36px;
  background: #f5f5f7;
  box-shadow:
    0 0 0 8px #1d1d1f,
    0 18px 48px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wd-h5-phone__notch {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 88px;
  height: 20px;
  border-radius: 12px;
  background: #1d1d1f;
  z-index: 20;
}

.wd-h5-phone__statusbar {
  flex: none;
  height: 30px;
  padding: 6px 18px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  color: #1d1d1f;
  background: #f5f5f7;
}

.wd-h5-phone__icons {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.wd-h5-phone__signal {
  width: 12px;
  height: 8px;
  background: currentColor;
  clip-path: polygon(0 100%, 3 100%, 3 60%, 6 60%, 6 100%, 9 100%, 9 30%, 12 30%, 12 100%);
}

.wd-h5-phone__wifi {
  width: 10px;
  height: 8px;
  background: currentColor;
  clip-path: polygon(50% 100%, 0 30%, 20% 12%, 50% 0, 80% 12%, 100% 30%);
}

.wd-h5-phone__battery {
  width: 14px;
  height: 8px;
  border-radius: 2px;
  background: currentColor;
}

.wd-h5-phone__screen {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  /* 关键：transform 使 position:fixed 的弹层（popup/overlay/toast）
     相对手机框定位，而不是浏览器视口 */
  transform: translate(0);
  background: #f5f5f7;
}

.wd-h5-phone__screen.is-dark,
.wd-h5-phone__statusbar.is-dark,
.wd-h5-phone__homebar.is-dark {
  background: #121214;
  color: #f5f5f7;
}

.wd-h5-phone__homebar.is-dark::after {
  background: #f5f5f7;
}

.wd-h5-phone__loading,
.wd-h5-phone__error {
  margin: auto;
  padding: 0 24px;
  font-size: 12px;
  color: #8e8e93;
  text-align: center;
}

.wd-h5-phone__homebar {
  flex: none;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f7;
}

.wd-h5-phone__homebar::after {
  content: '';
  width: 100px;
  height: 4px;
  border-radius: 2px;
  background: #1d1d1f;
  opacity: 0.85;
}
</style>
