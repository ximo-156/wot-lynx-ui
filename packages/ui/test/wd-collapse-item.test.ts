import { describe, it, expect, afterEach } from 'vitest'
import { ref } from 'vue-lynx'
import { render } from './render'
import { fireEvent } from './fire-event'
import WdCollapse from '../src/components/wd-collapse/wd-collapse.vue'
import WdCollapseItem from '../src/components/wd-collapse-item/wd-collapse-item.vue'

const wait = (ms = 50) => new Promise((r) => setTimeout(r, ms))

/**
 * 移除 lynx.createSelectorQuery，模拟 Web 预览 / 旧版引擎等未提供
 * SelectorQuery 的宿主。返回还原函数。
 */
function removeSelectorQuery(): () => void {
  const lynx = (globalThis as any).lynx
  const original = lynx && lynx.createSelectorQuery
  if (lynx) {
    delete lynx.createSelectorQuery
  }
  return () => {
    if (lynx && original) lynx.createSelectorQuery = original
  }
}

/** 还原 setup.ts 安装的默认 mock（零尺寸矩形），避免影响后续文件 */
afterEach(() => {
  const lynx = (globalThis as any).lynx
  if (lynx && typeof lynx.createSelectorQuery !== 'function') {
    lynx.createSelectorQuery = () => {
      const rect = { id: '', left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }
      const makeNodesRef = () => ({
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
          if (typeof cb === 'function') setTimeout(() => cb({ width: 0, height: 0 }), 0)
          return { exec: () => {} }
        }
      })
      const ref0 = makeNodesRef()
      return {
        select: () => ref0,
        selectAll: () => ref0,
        in: () => ({ select: () => ref0, selectAll: () => ref0, exec: () => {} }),
        exec: () => {}
      }
    }
  }
})

/**
 * 安装一个 invoke 走 fail 回调的 SelectorQuery mock，模拟节点查询失败
 * （getRect 当前约定下会降级为零尺寸矩形）。用于验证 collapse-item 在
 * 度量失败路径下的稳定性。
 */
function makeFailingSelectorQuery(): () => void {
  const lynx = (globalThis as any).lynx
  const original = lynx && lynx.createSelectorQuery
  const makeNodesRef = () => ({
    invoke(options: any) {
      if (options && typeof options.fail === 'function') {
        setTimeout(() => options.fail('get rect failed'), 0)
      }
      return { exec: () => {} }
    },
    boundingClientRect() {
      return { exec: () => {} }
    },
    fields() {
      return { exec: () => {} }
    }
  })
  const ref0 = makeNodesRef()
  lynx.createSelectorQuery = () => ({
    select: () => ref0,
    selectAll: () => ref0,
    in: () => ({ select: () => ref0, selectAll: () => ref0, exec: () => {} }),
    exec: () => {}
  })
  return () => {
    if (lynx && original) lynx.createSelectorQuery = original
  }
}

describe('wd-collapse-item', () => {
  it('渲染标题与内容', () => {
    const { container } = render(WdCollapseItem, { title: '折叠', name: '1' })
    expect(container.querySelector('.wd-collapse-item__header')).toBeTruthy()
  })

  it('createSelectorQuery 不可用时，挂载与 tap 不产生未处理 Promise 拒绝', async () => {
    // 复现线上崩溃路径：onMounted -> updateExpand -> initRect -> getRect
    // （createSelectorQuery 缺失）。此前 getRect reject 且 initRect 未
    // await/无 catch，产生 "unhandled rejection" 被 Sentry 上报。
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    const restore = removeSelectorQuery()
    try {
      const Wrapper = {
        components: { WdCollapse, WdCollapseItem },
        setup: () => ({ value: ['1'] }),
        template: `<wd-collapse v-model="value"><wd-collapse-item name="1" title="标题">内容</wd-collapse-item></wd-collapse>`
      }
      const { container } = render(Wrapper)
      await wait()
      const header = container.querySelector('.wd-collapse-item__header')!
      // tap 走 handleClick -> updateExpand -> handleBeforeExpand -> initRect
      fireEvent.tap(header)
      await wait()
      expect(container.querySelector('.wd-collapse-item__header')).toBeTruthy()
      // 降级确实发生了：getRect 走零矩形兜底（告警由 setup.ts 静默并记录），
      // 组件侧只降级不崩溃。
      expect((globalThis as any).__metricDegradation.length).toBeGreaterThan(0)
    } finally {
      restore()
      process.off('unhandledRejection', onUnhandled)
    }
    expect(unhandled).toEqual([])
  })

  it('节点查询失败时（invoke fail 降级零矩形），挂载与 tap 不崩溃', async () => {
    // getRect 约定永不 reject（查询失败统一降级为零尺寸矩形）。
    // 本用例守住组件侧结构：即便 getRect 将来恢复 reject，
    // updateExpand 中 await initRect + try/catch 也不会让其成为未处理拒绝。
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    const restore = makeFailingSelectorQuery()
    try {
      const Wrapper = {
        components: { WdCollapse, WdCollapseItem },
        setup: () => ({ value: ['1'] }),
        template: `<wd-collapse v-model="value"><wd-collapse-item name="1" title="标题">内容</wd-collapse-item></wd-collapse>`
      }
      const { container } = render(Wrapper)
      await wait()
      const header = container.querySelector('.wd-collapse-item__header')!
      fireEvent.tap(header)
      await wait()
      expect(container.querySelector('.wd-collapse-item__header')).toBeTruthy()
    } finally {
      restore()
      process.off('unhandledRejection', onUnhandled)
    }
    expect(unhandled).toEqual([])
  })

  it('tap 标题切换展开状态（v-model 更新）', async () => {
    const value = ref<string[]>(['1'])
    const Wrapper = {
      components: { WdCollapse, WdCollapseItem },
      setup: () => ({ value }),
      template: `<wd-collapse v-model="value"><wd-collapse-item name="1" title="标题">内容</wd-collapse-item></wd-collapse>`
    }
    const { container } = render(Wrapper)
    const header = container.querySelector('.wd-collapse-item__header')!
    fireEvent.tap(header)
    await wait()
    // 默认展开，点击后收起
    expect(value.value).toEqual([])
  })
})
