/**
 * WdTransition 卸载中止回归测试（真机 9902 removeNode 不同步防护）。
 *
 * 背景：wd-transition 的 enter()/leave() 链由 pause()/delay() 的 setTimeout
 * 驱动，此前 abortSchedules() 只在 show  prop 再次切换时调用，组件卸载时
 * 没有任何中止。父组件（popup / dialog / toast / overlay 等整条弹层链）在
 * leave 动画飞行中同步卸载时，挂起的帧定时器到期后仍会在已销毁实例上写
 * classes/display 并 emit('after-leave')，vue-lynx 在已销毁树上继续 patch，
 * 真机表现为
 * java.lang.RuntimeException: Trying to remove unknown ui signature（9902）。
 *
 * 本测试锁定：
 * 1. leave 动画飞行中同步卸载 → after-leave 不再触发、无迟到写入；
 * 2. 未卸载时 leave 正常落地（防止过度中止把正常路径改坏）；
 * 3. AbortablePromise 被中止的链不产生未处理的 Promise 拒绝。
 */
import { describe, it, expect, vi } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import WdTransition from '../src/primitives/wd-transition/wd-transition.vue'
import { AbortablePromise } from '../src/common/AbortablePromise'

/** 等待 enter 完成（pause 约 33ms 一帧，enter 需 3 帧） */
async function waitEnterFrames() {
  for (let i = 0; i < 4; i++) {
    await pause()
  }
}

function renderTransition(show: Ref<boolean>, onAfterLeave: () => void) {
  const App = {
    setup() {
      return () =>
        h(
          WdTransition,
          { show: show.value, name: 'fade', duration: 100, onAfterLeave },
          { default: () => h('view', { class: 'marker' }, 'x') }
        )
    }
  }
  return render(App as any)
}

describe('WdTransition 卸载中止（9902 removeNode 防护）', () => {
  it('leave 动画飞行中同步卸载：after-leave 不触发、无迟到写入', async () => {
    const onAfterLeave = vi.fn()
    const show = ref(true)
    const { container, unmount } = renderTransition(show, onAfterLeave)

    await waitEnterFrames()
    expect(container.querySelector('.marker'), '入场后内容应渲染').not.toBeNull()

    // 触发 leave（show=false），链在 before-leave → leave 类名阶段
    show.value = false
    await pause()
    await pause()

    // 动画飞行中同步卸载（模拟路由返回 / v-if 摘除父组件）
    unmount()

    // 定时器全部落地（duration 100ms + 帧间隔均远小于此）
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(onAfterLeave, '卸载后 after-leave 不得再触发').not.toHaveBeenCalled()
  })

  it('enter 动画飞行中同步卸载：无异常、无未处理拒绝', async () => {
    const onAfterEnter = vi.fn()
    const show = ref(true)
    const { unmount } = renderTransition(show, onAfterEnter)

    // 不等 enter 完成，立刻卸载（enter 链仍挂起）
    unmount()

    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(onAfterEnter, '卸载后 after-enter 不得再触发').not.toHaveBeenCalled()
  })

  it('未卸载时 leave 正常落地：after-leave 应触发（防止过度中止）', async () => {
    const onAfterLeave = vi.fn()
    const show = ref(true)
    const { container } = renderTransition(show, onAfterLeave)

    await waitEnterFrames()
    show.value = false
    await pause()
    await pause()
    await pause()
    await pause()
    await pause()
    await pause()

    expect(onAfterLeave, '未卸载时 leave 链应正常落地').toHaveBeenCalled()
    cleanup()
  })
})

describe('AbortablePromise 中止语义', () => {
  it('abort() 后等待方立即退出，不产生未处理拒绝', async () => {
    let continued = false
    const p = new AbortablePromise<void>(async (resolve) => {
      await pause(20)
      continued = true
      resolve()
    })

    let threw = false
    const waiter = (async () => {
      try {
        await p
      } catch {
        threw = true
      }
    })()

    p.abort()
    await waiter

    expect(threw, '等待方应收到 rejection 退出').toBe(true)
    // 链内自有的 await 仍在（abort 只能中止等待方，不能掐断执行中的微任务），
    // 但其后续 resolve() 不得漂成未处理拒绝——由构造函数统一接住。
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(continued).toBe(true)
  })

  it('同步 executor 的 abort 同样只 reject、不抛', () => {
    const p = new AbortablePromise<void>((resolve) => {
      setTimeout(resolve, 10)
    })
    expect(() => p.abort()).not.toThrow()
  })
})
