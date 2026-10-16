<script lang="ts">
/**
 * H5Preview — 组件文档页的 H5（手机）预览外壳。
 *
 * 结构：文档流中的一张预览卡 = 顶部工具条（组件名 / 亮暗主题 / 重载）+
 * 手机框（状态栏 + 可滚动屏幕）。屏幕内由 lynx-dom 垫片以独立渲染器
 * 挂载「真实组件源码」编译出的演示页（ConfigProvider 包裹，令牌主题
 * 随亮暗切换）。
 *
 * 容错：演示装载 / 渲染失败时由错误边界降级为提示，不影响文档页其余部分。
 */
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type App, type Component } from 'vue'
import WdConfigProvider from 'wot-lynx-ui/components/wd-config-provider/wd-config-provider.vue'
import { createLynxApp, installLynxGlobals } from './lynx-dom'
import { loadDemo } from './demo-registry'

export default defineComponent({
  name: 'H5Preview',
  props: {
    /** 组件 slug（与 docs/components/<slug>.md 一致） */
    name: { type: String, required: true }
  },
  setup(props) {
    const theme = ref<'light' | 'dark'>('light')
    const status = ref<'loading' | 'ready' | 'error'>('loading')
    const errorMessage = ref('')
    const reloadKey = ref(0)
    const screen = ref<HTMLDivElement>()
    let app: App | null = null
    let destroyed = false

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
      const container = screen.value
      if (!container) return
      status.value = 'loading'
      errorMessage.value = ''
      try {
        currentDemo = await loadDemo(props.name)
      } catch (err) {
        status.value = 'error'
        errorMessage.value = `演示装载失败：${(err as Error)?.message || err}`
        return
      }
      if (destroyed) return
      try {
        installLynxGlobals()
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
      destroyed = true
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

    watch([() => props.name, reloadKey], () => {
      unmount()
      destroyed = false
      mount()
    })

    return { theme, status, errorMessage, reloadKey, screen }
  }
})
</script>

<template>
  <div class="wd-h5-preview">
    <div class="wd-h5-preview__bar">
      <span class="wd-h5-preview__title">
        <span class="wd-h5-preview__dot" />H5 预览
      </span>
      <span class="wd-h5-preview__name">{{ name }}</span>
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
  margin: 16px 0 24px;
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
  padding: 20px 12px 24px;
}

/* ---- 手机框 ---- */
.wd-h5-phone {
  position: relative;
  width: 328px;
  height: 600px;
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
