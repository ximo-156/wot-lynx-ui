/**
 * wd-tabs 节点度量降级路径的回归测试。
 *
 * 背景（Sentry USER_RUNTIME_ERROR，error_code 201）：
 *   unhandled rejection: createSelectorQuery is not available
 *   at getRect -> scrollIntoView -> updateActive
 * 部分 Lynx 宿主运行时（后台线程）不提供 lynx.createSelectorQuery；
 * getRect 已降级为零尺寸矩形（见 common/util.ts），scrollIntoView 亦补齐
 * .catch，保证调用链上任何度量失败都不会产生未处理的 Promise 拒绝。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { ref } from 'vue-lynx'
import { render } from './render'
import WdTabs from '../src/components/wd-tabs/wd-tabs.vue'
import WdTab from '../src/components/wd-tab/wd-tab.vue'

const wait = (ms = 50) => new Promise((r) => setTimeout(r, ms))

/** 收集未处理的 Promise 拒绝（Sentry USER_RUNTIME_ERROR 的来源） */
function collectUnhandledRejections() {
  const rejections: unknown[] = []
  const handler = (reason: unknown) => rejections.push(reason)
  process.on('unhandledRejection', handler)
  return {
    rejections,
    dispose: () => process.off('unhandledRejection', handler)
  }
}

/** 还原 setup.ts 安装的默认 mock（零尺寸矩形） */
function restoreDefaultSelectorQuery() {
  const lynx = (globalThis as any).lynx
  if (!lynx || typeof lynx.createSelectorQuery !== 'function') return
  const rect = { id: '', left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }
  const makeRef = () => ({
    invoke(options: any) {
      if (options && typeof options.success === 'function') {
        setTimeout(() => options.success(rect), 0)
      }
      return { exec: () => {} }
    },
    boundingClientRect(cb: any) {
      if (typeof cb === 'function') setTimeout(() => cb(rect), 0)
      return { exec: () => {} }
    },
    fields(_: any, cb: any) {
      if (typeof cb === 'function') setTimeout(() => cb({ ...rect }), 0)
      return { exec: () => {} }
    }
  })
  const makeQuery = () => {
    const ref = makeRef()
    return {
      select: () => ref,
      selectAll: () => ref,
      in: () => makeQuery(),
      exec: () => {}
    }
  }
  lynx.createSelectorQuery = () => makeQuery()
}

/**
 * invoke 成功回调返回 null：模拟选择器未命中任何节点。
 * getRect 永不 reject：未命中 / 度量不可用时统一降级为零尺寸矩形。
 */
function mockSelectorQueryNoNode() {
  const lynx = (globalThis as any).lynx
  lynx.createSelectorQuery = () => {
    const makeRef = () => ({
      invoke(options: any) {
        if (options && typeof options.success === 'function') {
          setTimeout(() => options.success(null), 0)
        }
        return { exec: () => {} }
      },
      boundingClientRect(cb: any) {
        if (typeof cb === 'function') setTimeout(() => cb(null), 0)
        return { exec: () => {} }
      },
      fields(_: any, cb: any) {
        if (typeof cb === 'function') setTimeout(() => cb(null), 0)
        return { exec: () => {} }
      }
    })
    const makeQuery = () => {
      const ref = makeRef()
      return {
        select: () => ref,
        selectAll: () => ref,
        in: () => makeQuery(),
        exec: () => {}
      }
    }
    return makeQuery()
  }
}

/** 挂载含两个页签的 wd-tabs，返回激活值 ref 以便切换 */
function mountTabs() {
  const active = ref('tab1')
  const Wrapper = {
    components: { WdTabs, WdTab },
    setup: () => ({ active }),
    template: `
      <wd-tabs v-model="active">
        <wd-tab name="tab1" title="标签一">内容一</wd-tab>
        <wd-tab name="tab2" title="标签二">内容二</wd-tab>
      </wd-tabs>
    `
  }
  const { container } = render(Wrapper)
  return { active, container }
}

afterEach(() => {
  restoreDefaultSelectorQuery()
})

describe('wd-tabs 节点度量降级', () => {
  it('宿主缺少 createSelectorQuery 时挂载与切换均不产生未处理拒绝', async () => {
    const lynx = (globalThis as any).lynx
    const original = lynx.createSelectorQuery
    delete lynx.createSelectorQuery
    const tracker = collectUnhandledRejections()
    try {
      const { active } = mountTabs()
      await wait(100)
      // 切换激活项：watch(modelValue) -> setActive -> updateActive -> scrollIntoView -> getRect
      active.value = 'tab2'
      await wait(200)
      expect(tracker.rejections).toEqual([])
      expect(active.value).toBe('tab2')
      // 降级确实发生了：getRect 走零矩形兜底（告警由 setup.ts 静默并记录），
      // 组件侧只降级不崩溃。
      expect((globalThis as any).__metricDegradation.length).toBeGreaterThan(0)
    } finally {
      tracker.dispose()
      lynx.createSelectorQuery = original
    }
  })

  it('节点未命中（getRect 降级为零矩形）时切换不产生未处理拒绝', async () => {
    mockSelectorQueryNoNode()
    const tracker = collectUnhandledRejections()
    try {
      const { active } = mountTabs()
      await wait(100)
      active.value = 'tab2'
      await wait(200)
      expect(tracker.rejections).toEqual([])
    } finally {
      tracker.dispose()
    }
  })
})
