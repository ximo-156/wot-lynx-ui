/**
 * render() — 通过完整的双线程管线挂载 Vue 组件，返回挂载 @testing-library/dom
 * 查询的 JSDOM 容器。
 */
import type { Component, Plugin } from 'vue-lynx'
import { getQueriesForElement } from '@testing-library/dom'
import { createApp, resetForTesting, nextTick } from 'vue-lynx'

let currentApp: ReturnType<typeof createApp> | null = null

export interface RenderResult {
  container: Element
  unmount: () => void
  rerender: (component: Component, props?: Record<string, unknown>) => RenderResult
  [key: string]: any
}

export function cleanup(): void {
  const env = (globalThis as any).lynxTestingEnv
  if (currentApp) {
    env.switchToBackgroundThread()
    currentApp.unmount()
    currentApp = null
  }
}

export function render(
  rootComponent: Component,
  rootProps?: Record<string, unknown>,
  plugins: Plugin[] = []
): RenderResult {
  const env = (globalThis as any).lynxTestingEnv

  cleanup()

  env.switchToMainThread()
  const doc = env.jsdom.window.document
  doc.body.innerHTML = ''

  const renderPage = (globalThis as any).renderPage
  if (typeof renderPage === 'function') {
    renderPage({ cssId: 0, doc: {} })
  }

  env.switchToBackgroundThread()

  const app = createApp(rootComponent, rootProps)
  plugins.forEach((plugin) => app.use(plugin))
  currentApp = app as any
  app.mount()

  nextTick(() => {})

  const container = doc.getElementById('1') || doc.body.firstElementChild || doc.body

  const result: RenderResult = {
    container,
    unmount: () => cleanup(),
    rerender: (component: Component, props?: Record<string, unknown>) => render(component, props),
    ...getQueriesForElement(container as HTMLElement)
  }

  return result
}

export { resetForTesting }
