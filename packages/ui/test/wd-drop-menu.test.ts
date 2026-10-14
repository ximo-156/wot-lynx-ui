/**
 * wd-drop-menu 回归测试。
 *
 * 锁定两件事：
 * 1. **节点 id 唯一**：dropMenuId 只能挂在一个节点上。同一 id 挂两个节点会触发
 *    vue-lynx 的 "Duplicate id" 告警并影响 Teleport 目标解析，fold() 里的
 *    getRect('#dropMenuId') 也会命中歧义节点（wot-ui 仅在 MP-DINGTALK 下给
 *    内层容器挂 id，本移植版统一只挂根节点）。
 * 2. **异常兜底**：slot 混入非约定子节点 / 子节点 exposed 未就绪时不抛错，
 *    度量失败也不产生未处理的 Promise 拒绝。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render } from './render'
import { fireEvent } from './fire-event'
import { captureConsole } from './capture-console'
import WdDropMenu from '../src/components/wd-drop-menu/wd-drop-menu.vue'
import WdDropMenuItem from '../src/components/wd-drop-menu-item/wd-drop-menu-item.vue'

const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms))

function mountDropMenu() {
  const Wrapper = {
    components: { WdDropMenu, WdDropMenuItem },
    setup: () => ({ value: 'a' }),
    template: `
      <wd-drop-menu>
        <wd-drop-menu-item v-model="value" :options="[{ label: '选项A', value: 'a' }, { label: '选项B', value: 'b' }]" />
        <wd-drop-menu-item v-model="value" :options="[{ label: '选项C', value: 'c' }]" title="自定义标题" />
      </wd-drop-menu>
    `
  }
  const { container } = render(Wrapper)
  return { container }
}

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

describe('wd-drop-menu', () => {
  it('dropMenuId 只挂在一个节点上（不产生 Duplicate id 告警）', () => {
    const capture = captureConsole()
    try {
      const { container } = mountDropMenu()
      // 结构性告警锁死：重复 id 会让 Teleport 目标解析不可靠
      expect(capture.frameworkWarnings()).toEqual([])
      const withId = Array.from(container.querySelectorAll('[id]')).filter((el) => el.id.startsWith('dropMenuId'))
      expect(withId.length).toBe(1)
    } finally {
      capture.restore()
    }
  })

  it('slot 里内联 options 字面量不会引发无限重渲染', async () => {
    // 回归点（线上 "Maximum recursive updates exceeded in component <wd-drop-menu>"）：
    // 父组件渲染时跟踪了子组件 props，而 slot 每次重渲染都会生成新的 options
    // 数组字面量并被写回子组件 props，反向再次触发父组件重渲染 → 无限循环，
    // 最终由 Vue 的递归更新检测抛出，成为未处理异常。修复见 rawChildProps。
    const tracker = collectUnhandledRejections()
    try {
      mountDropMenu()
      await wait()
      expect(tracker.rejections).toEqual([])
    } finally {
      tracker.dispose()
    }
  })

  it('点击标题展开菜单，度量失败也不产生未处理拒绝', async () => {
    const tracker = collectUnhandledRejections()
    try {
      const { container } = mountDropMenu()
      await wait()
      // Lynx 的 tap 不冒泡，@tap 监听器挂在 .wd-drop-menu__option 上
      const option = container.querySelector('.wd-drop-menu__option')!
      fireEvent.tap(option)
      await wait()
      // fold() 走 getRect -> toggle，菜单进入展开态并渲染出选项列表
      expect(container.querySelector('.wd-drop-menu__option.is-active')).toBeTruthy()
      expect(container.querySelector('.wd-drop-item__popup')).toBeTruthy()
      expect(tracker.rejections).toEqual([])
    } finally {
      tracker.dispose()
    }
  })

  it('子节点缺少 options 时不抛错（渲染路径兜底）', async () => {
    const capture = captureConsole()
    try {
      // 直接渲染一个不带 options 的菜单项：getDisplayTitle 不能因 options 缺失而崩
      const Wrapper = {
        components: { WdDropMenu, WdDropMenuItem },
        template: `<wd-drop-menu><wd-drop-menu-item /></wd-drop-menu>`
      }
      const { container } = render(Wrapper)
      await wait()
      expect(container.querySelector('.wd-drop-menu')).toBeTruthy()
      expect(capture.frameworkWarnings()).toEqual([])
    } finally {
      capture.restore()
    }
  })

  afterEach(() => {
    // 还原 setup.ts 安装的默认 mock（零尺寸矩形），避免影响后续文件
    const lynx = (globalThis as any).lynx
    if (lynx && typeof lynx.createSelectorQuery !== 'function') {
      lynx.createSelectorQuery = () => {
        const rect = { id: '', left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }
        const makeNodesRef = () => ({
          invoke(options: any) {
            if (options && typeof options.success === 'function') setTimeout(() => options.success(rect), 0)
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
        return {
          select: () => makeNodesRef(),
          selectAll: () => makeNodesRef(),
          in: () => ({ select: () => makeNodesRef(), selectAll: () => makeNodesRef(), exec: () => {} }),
          exec: () => {}
        }
      }
    }
  })
})
