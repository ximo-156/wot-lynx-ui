<script setup lang="ts">
/** Real canvas dimensions, separate renderer mount points, and a body-level Web preview. */
import { computed, h, nextTick, onBeforeUnmount, onMounted, provide, ref, watch, type App, type Component } from 'vue'
import { SCROLL_LOCK_TARGET_KEY } from '../../../packages/core/src/composables/useLockScroll'
import { useRoute } from 'vitepress'
import WdConfigProvider from 'wot-lynx-ui/components/wd-config-provider/wd-config-provider.vue'
import { capturePreviewViewport, createLynxApp, installLynxGlobals, setPreviewViewport } from './lynx-dom'
import { installPreviewHostCapabilities } from './preview-host'
import { loadDemo } from './demo-registry'

const props = withDefaults(defineProps<{ name?: string }>(), { name: '' })
const route = useRoute()
const slug = computed(() => props.name || route.path.match(/^\/components\/([^/]+?)(?:\.html)?\/?$/)?.[1] || '')
const theme = ref<'light' | 'dark'>('light')
const mode = ref<'phone' | 'desktop'>('phone')
const status = ref<'loading' | 'ready' | 'error'>('loading')
const errorMessage = ref('')
const reloadKey = ref(0)
const mounted = ref(false)
const desktopWidth = ref(1280)
const widths = [768, 1024, 1280, 1440]
const windowWidth = ref(1600)
const windowHeight = ref(1000)
// Do not scale gesture coordinates or claim a larger canvas than can be shown.
const desktopCanvasWidth = computed(() => Math.max(1, Math.min(desktopWidth.value, windowWidth.value - 32)))
const desktopCanvasHeight = computed(() => Math.max(1, Math.min(720, windowHeight.value - 180)))
const desktopStyle = computed(() => ({ width: `${desktopCanvasWidth.value}px`, height: `${desktopCanvasHeight.value}px` }))
const activeSize = computed(() => mode.value === 'desktop' ? `${desktopCanvasWidth.value}x${desktopCanvasHeight.value}` : 'phone')
const canvasWidth = ref(0)
const canvasHeight = ref(0)
const phoneScreen = ref<HTMLDivElement>()
const phoneMount = ref<HTMLDivElement>()
const desktopScreen = ref<HTMLDivElement>()
const desktopMount = ref<HTMLDivElement>()
const dialog = ref<HTMLDivElement>()
const closeButton = ref<HTMLButtonElement>()
let app: App | null = null
let generation = 0
let observer: ResizeObserver | null = null
let restoreViewport: (() => void) | null = null
let previousFocus: HTMLElement | null = null
let previousOverflow: string | null = null

function syncWindow() {
  windowWidth.value = window.innerWidth
  windowHeight.value = window.innerHeight
}

function disposeDemo() {
  observer?.disconnect()
  observer = null
  try { app?.unmount() } catch (error) { console.warn('[H5Preview] unmount', error) }
  app = null
  restoreViewport?.()
  restoreViewport = null
}

function syncCanvas(screen: HTMLDivElement) {
  if (!screen.isConnected || !screen.clientWidth || !screen.clientHeight) return
  canvasWidth.value = screen.clientWidth
  canvasHeight.value = screen.clientHeight
  setPreviewViewport(canvasWidth.value, canvasHeight.value)
}

async function mountDemo() {
  if (!mounted.value) return
  const request = ++generation
  disposeDemo()
  status.value = 'loading'
  errorMessage.value = ''
  await nextTick() // v-if/Teleport refs must point to the NEW mount container.
  if (!mounted.value || request !== generation) return
  const screen = mode.value === 'phone' ? phoneScreen.value : desktopScreen.value
  const container = mode.value === 'phone' ? phoneMount.value : desktopMount.value
  if (!screen || !container) return
  try {
    const Demo = await loadDemo(slug.value)
    if (!mounted.value || request !== generation || !container.isConnected) return
    restoreViewport = capturePreviewViewport()
    installLynxGlobals()
    syncCanvas(screen)
    installPreviewHostCapabilities()
    const Shell = { setup() {
      provide(SCROLL_LOCK_TARGET_KEY, () => screen.querySelector<HTMLElement>('.wd-h5-demo') || screen)
      return () => h(WdConfigProvider as Component,
        { theme: theme.value, customClass: 'wd-h5-screen-root' }, { default: () => h(Demo) })
    } }
    app = createLynxApp(Shell)
    app.config.errorHandler = error => {
      if (request !== generation) return
      console.error('[H5Preview]', error)
      status.value = 'error'
      errorMessage.value = `演示渲染失败：${String((error as Error)?.message || error)}`
    }
    app.mount(container)
    if (!errorMessage.value) status.value = 'ready'
    observer = new ResizeObserver(() => { if (request === generation) syncCanvas(screen) })
    observer.observe(screen)
  } catch (error) {
    if (!mounted.value || request !== generation) return
    disposeDemo()
    status.value = 'error'
    errorMessage.value = `演示装载失败：${String((error as Error)?.message || error)}`
  }
}

function closeDesktop() { mode.value = 'phone' }
function onKeydown(event: KeyboardEvent) {
  if (mode.value !== 'desktop') return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeDesktop()
  } else if (event.key === 'Tab' && dialog.value) {
    const targets = Array.from(dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]'))
      .filter(element => element.getClientRects().length)
    const first = targets[0]
    const last = targets[targets.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
}

watch(mode, async value => {
  if (!mounted.value) return
  if (value === 'desktop') {
    previousFocus = document.activeElement as HTMLElement
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    await nextTick()
    if (mode.value === 'desktop') closeButton.value?.focus()
  } else {
    if (previousOverflow !== null) document.body.style.overflow = previousOverflow
    previousOverflow = null
    await nextTick()
    if (previousFocus?.isConnected) previousFocus.focus()
    previousFocus = null
  }
})
watch([slug, mode, activeSize, reloadKey], mountDemo, { flush: 'post' })
onMounted(() => {
  mounted.value = true
  syncWindow()
  window.addEventListener('resize', syncWindow)
  window.addEventListener('keydown', onKeydown)
  void mountDemo()
})
onBeforeUnmount(() => {
  mounted.value = false
  ++generation
  disposeDemo()
  window.removeEventListener('resize', syncWindow)
  window.removeEventListener('keydown', onKeydown)
  if (previousOverflow !== null) document.body.style.overflow = previousOverflow
  previousOverflow = null
})
</script>

<template>
  <div class="wd-h5-preview" :class="`is-${mode}`" :data-status="status">
    <div class="wd-h5-preview__bar">
      <span class="wd-h5-preview__title"><span class="wd-h5-preview__dot" />组件预览</span>
      <span class="wd-h5-preview__name">{{ slug }}</span>
      <div class="wd-h5-preview__actions" role="group" aria-label="预览模式和主题">
        <button class="wd-h5-preview__btn" :class="{ 'is-active': mode === 'phone' }" :aria-pressed="mode === 'phone'" type="button" @click="mode = 'phone'">手机</button>
        <button class="wd-h5-preview__btn" :class="{ 'is-active': mode === 'desktop' }" :aria-pressed="mode === 'desktop'" type="button" @click="mode = 'desktop'">桌面 / Web</button>
        <button class="wd-h5-preview__btn" :class="{ 'is-active': theme === 'light' }" :aria-pressed="theme === 'light'" type="button" @click="theme = 'light'">浅色</button>
        <button class="wd-h5-preview__btn" :class="{ 'is-active': theme === 'dark' }" :aria-pressed="theme === 'dark'" type="button" @click="theme = 'dark'">深色</button>
        <button class="wd-h5-preview__btn" type="button" @click="reloadKey++">重载</button>
      </div>
    </div>
    <div v-if="mode === 'phone'" class="wd-h5-preview__stage">
      <div class="wd-h5-phone">
        <div class="wd-h5-phone__notch" />
        <div class="wd-h5-phone__statusbar" :class="`is-${theme}`"><span>9:41</span><span>▂ ▄ ▆ ▰</span></div>
        <div ref="phoneScreen" class="wd-h5-phone__screen" :class="`is-${theme}`" :data-viewport-width="canvasWidth" :data-viewport-height="canvasHeight">
          <div ref="phoneMount" class="wd-h5-preview__mount" />
          <div v-if="status !== 'ready'" class="wd-h5-preview__status" role="status">{{ status === 'error' ? errorMessage : '加载中…' }}</div>
        </div>
        <div class="wd-h5-phone__homebar" :class="`is-${theme}`" />
      </div>
    </div>
    <p class="wd-h5-preview__hint">{{ canvasWidth }} × {{ canvasHeight }} px · {{ mode === 'phone' ? '手机画布' : '桌面画布' }}</p>
    <Teleport to="body">
      <div v-if="mounted && mode === 'desktop'" class="wd-h5-desktop" @click.self="closeDesktop">
        <div ref="dialog" class="wd-h5-desktop__dialog" role="dialog" aria-modal="true" aria-label="组件桌面 Web 预览">
          <div class="wd-h5-desktop__chrome">
            <span class="wd-h5-desktop__url">{{ slug }} · Web</span>
            <label class="wd-h5-desktop__width">目标宽度
              <select v-model.number="desktopWidth" aria-label="桌面预览宽度"><option v-for="value in widths" :key="value" :value="value">{{ value }} px</option></select>
            </label>
            <span class="wd-h5-desktop__size">实际 {{ desktopCanvasWidth }} × {{ desktopCanvasHeight }}</span>
            <button class="wd-h5-preview__btn" type="button" @click="theme = theme === 'light' ? 'dark' : 'light'">{{ theme === 'light' ? '深色' : '浅色' }}</button>
            <button class="wd-h5-preview__btn" type="button" @click="reloadKey++">重载</button>
            <button ref="closeButton" class="wd-h5-preview__btn" type="button" aria-label="关闭桌面预览" @click="closeDesktop">收起</button>
          </div>
          <div ref="desktopScreen" class="wd-h5-desktop__screen" :class="`is-${theme}`" :style="desktopStyle" :data-viewport-width="desktopCanvasWidth" :data-viewport-height="desktopCanvasHeight">
            <div ref="desktopMount" class="wd-h5-preview__mount" />
            <div v-if="status !== 'ready'" class="wd-h5-preview__status" role="status">{{ status === 'error' ? errorMessage : '加载中…' }}</div>
          </div>
          <p v-if="desktopCanvasWidth < desktopWidth" class="wd-h5-desktop__notice">当前窗口较窄，画布按实际可用宽度渲染；扩大窗口可查看目标尺寸。</p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.wd-h5-preview { min-width: 0; border: 1px solid var(--vp-c-divider); border-radius: 12px; overflow: hidden; background: var(--vp-c-bg-soft); }
.wd-h5-preview__bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--vp-c-divider); background: var(--vp-c-bg); font-size: 13px; }
.wd-h5-preview__title { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
.wd-h5-preview__dot { width: 8px; height: 8px; border-radius: 50%; background: #00a06d; }
.wd-h5-preview__name { color: var(--vp-c-text-3); font-family: var(--vp-font-family-mono); font-size: 12px; }
.wd-h5-preview__actions { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; }
.wd-h5-preview__btn { border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg); color: var(--vp-c-text-2); border-radius: 6px; padding: 3px 8px; font-size: 12px; cursor: pointer; line-height: 20px; white-space: nowrap; }
.wd-h5-preview__btn.is-active { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.wd-h5-preview__btn:focus-visible, select:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
.wd-h5-preview__stage { display: flex; justify-content: center; padding: 16px 10px 20px; }
.wd-h5-phone { position: relative; width: min(300px, 100%); height: 560px; display: flex; flex-direction: column; overflow: hidden; border-radius: 36px; background: #f5f5f7; box-shadow: 0 0 0 8px #1d1d1f, 0 18px 48px #0003; }
.wd-h5-phone__notch { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 88px; height: 20px; border-radius: 12px; background: #1d1d1f; z-index: 20; }
.wd-h5-phone__statusbar { flex: none; height: 30px; padding: 6px 18px 0; display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: 600; color: #1d1d1f; background: #f5f5f7; }
.wd-h5-phone__screen, .wd-h5-desktop__screen { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; transform: translate(0); background: #f5f5f7; overflow: hidden; }
.wd-h5-phone__screen { flex: 1; }
.wd-h5-preview__mount { width: 100%; height: 100%; min-height: 0; }
.wd-h5-preview__status { position: absolute; inset: 0; display: flex; justify-content: center; align-items: center; padding: 24px; font-size: 12px; color: #8e8e93; text-align: center; background: inherit; z-index: 30; }
.wd-h5-phone__homebar { flex: none; height: 18px; display: flex; align-items: center; justify-content: center; background: #f5f5f7; }
.wd-h5-phone__homebar::after { content: ''; width: 100px; height: 4px; border-radius: 2px; background: #1d1d1f; opacity: .85; }
.wd-h5-phone__screen.is-dark, .wd-h5-phone__statusbar.is-dark, .wd-h5-phone__homebar.is-dark, .wd-h5-desktop__screen.is-dark { background: #121214; color: #f5f5f7; }
.wd-h5-phone__homebar.is-dark::after { background: #f5f5f7; }
.wd-h5-preview__hint { margin: 0; padding: 0 12px 10px; font-size: 11px; color: var(--vp-c-text-3); text-align: center; }
.wd-h5-desktop { position: fixed; inset: 0; z-index: 200; display: flex; justify-content: center; align-items: center; padding: 16px; background: #0008; }
.wd-h5-desktop__dialog { max-width: 100%; display: flex; flex-direction: column; overflow: hidden; border-radius: 12px; background: var(--vp-c-bg); box-shadow: 0 24px 64px #0006; }
.wd-h5-desktop__chrome { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft); }
.wd-h5-desktop__url { flex: 1; min-width: 80px; font-size: 12px; font-family: var(--vp-font-family-mono); }
.wd-h5-desktop__width { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.wd-h5-desktop__width select { border: 1px solid var(--vp-c-divider); border-radius: 6px; padding: 4px 8px; background: var(--vp-c-bg); color: var(--vp-c-text-1); }
.wd-h5-desktop__size { font-size: 11px; color: var(--vp-c-text-3); }
.wd-h5-desktop__screen { flex: none; }
.wd-h5-desktop__notice { margin: 0; padding: 8px 12px; font-size: 11px; color: var(--vp-c-text-2); }
</style>
