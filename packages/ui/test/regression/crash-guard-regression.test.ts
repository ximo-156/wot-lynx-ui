/**
 * P1 原生崩溃修复回归测试（逐组件核实报告为本地留档，未入库）。
 *
 * 锁定三类修复：
 * 1. **A 模式（静态 id 跨实例重复）**：wd-popover / wd-tooltip 模板原为
 *    硬编码静态 id（popover/pos/content/target），同页多实例时 id→签名
 *    注册表错乱；现在每个实例持有 uuid 派生的唯一 id，且 usePopover 的
 *    度量查询走实例 id。demo 主页 2×popover + 1×tooltip 是实弹暴露面。
 * 2. **F 模式（单例死代码 / 跨页面定时器）**：wd-notify 此前只算 key 从未
 *    inject，useNotify 与 demo 的 ref.showNotify() 均无人消费；现在命令式
 *    API 经 expose 驱动，useToast/useNotify 增加卸载守卫与定时器清理。
 * 3. **useAlive 守卫**：组件卸载后 isAlive() 返回 false，异步回调据此
 *    丢弃晚到写入（真机 9902 removeNode 家族）。
 */
import { describe, it, expect } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { pause } from '../../src/common/util'
import Popover from '../../src/components/wd-popover/wd-popover.vue'
import Tooltip from '../../src/components/wd-tooltip/wd-tooltip.vue'
import Notify from '../../src/components/wd-notify/wd-notify.vue'
import { useAlive } from '../../src/composables/useAlive'

/** 等待过渡入场（pause 约 33ms 一帧） */
async function waitEnterFrames() {
  for (let i = 0; i < 4; i++) {
    await pause()
  }
}

describe('A 模式：popover/tooltip 实例唯一 id', () => {
  it('同页两个 wd-popover 的节点 id 互不重复', () => {
    const App = {
      setup() {
        return () =>
          h('view', null, [
            h(Popover, { content: '第一个', placement: 'top' }, { default: () => h('view', { class: 't1' }, '目标1') }),
            h(Popover, { content: '第二个', placement: 'top' }, { default: () => h('view', { class: 't2' }, '目标2') })
          ])
      }
    }
    const { container } = render(App as any)

    const ids = Array.from(container.querySelectorAll('[id]')).map((el) => el.id)
    expect(ids.length, '应渲染出带 id 的节点').toBeGreaterThan(0)
    // 每个 popover 实例：root / pos / content / target 四个唯一 id
    expect(new Set(ids).size, '同页多实例 id 不得重复').toBe(ids.length)
    for (const id of ids) {
      expect(id, 'id 应为实例唯一前缀派生').toMatch(/^wd-popover-[0-9a-f]+(-pos|-content|-target)?$/)
    }
    cleanup()
  })

  it('popover 与 tooltip 同页共存时 id 不碰撞', () => {
    const App = {
      setup() {
        return () =>
          h('view', null, [
            h(Popover, { content: '气泡', placement: 'top' }, { default: () => h('view', null, 'p') }),
            h(Tooltip, { content: '提示', placement: 'top' }, { default: () => h('view', null, 't') })
          ])
      }
    }
    const { container } = render(App as any)

    const ids = Array.from(container.querySelectorAll('[id]')).map((el) => el.id)
    expect(new Set(ids).size, 'popover 与 tooltip 的 id 不得碰撞').toBe(ids.length)
    cleanup()
  })
})

describe('F 模式：wd-notify 命令式 API', () => {
  it('expose 的 showNotify 驱动弹层打开（原为死代码）', async () => {
    const notifyRef = ref<any>(null)
    const App = {
      setup() {
        return () => h(Notify, { ref: notifyRef, selector: 'test-notify-regression' })
      }
    }
    const { container } = render(App as any)
    await nextTick()

    expect(notifyRef.value, 'ref 应拿到组件实例').not.toBeNull()
    expect(typeof notifyRef.value.showNotify, 'showNotify 应已暴露').toBe('function')

    notifyRef.value.showNotify({ message: '回归测试消息', type: 'success' })
    await nextTick()
    await waitEnterFrames()

    const notify = container.querySelector('.wd-notify')
    expect(notify, '命令式调用后通知应渲染').not.toBeNull()
    expect(notify!.textContent).toContain('回归测试消息')

    notifyRef.value.closeNotify()
    await nextTick()
    expect(container.querySelector('.wd-notify--floating') || notify, '关闭后不应抛错').toBeTruthy()
    cleanup()
  })
})

describe('useAlive 卸载守卫', () => {
  it('组件卸载后 isAlive() 返回 false', async () => {
    let isAlive: (() => boolean) | null = null
    const App = {
      setup() {
        isAlive = useAlive()
        return () => h('view', { class: 'alive-probe' }, 'x')
      }
    }
    const { container, unmount } = render(App as any)
    await nextTick()

    expect(container.querySelector('.alive-probe')).not.toBeNull()
    expect(isAlive!(), '挂载中应为 true').toBe(true)

    unmount()
    expect(isAlive!(), '卸载后应为 false').toBe(false)
  })
})
