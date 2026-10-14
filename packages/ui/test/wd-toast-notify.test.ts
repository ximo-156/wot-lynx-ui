import { describe, it, expect } from 'vitest'
import { ref } from 'vue-lynx'
import { render } from './render'
import WdToast from '../src/components/wd-toast/wd-toast.vue'
import WdNotify from '../src/components/wd-notify/wd-notify.vue'
import { useToast } from '../src/components/wd-toast'
import { useNotify } from '../src/components/wd-notify'

/**
 * 命令式弹层（useToast / useNotify）回归测试。
 *
 * 背景：命令式单例依赖 `optionRef.value = deepMerge(defaultOptions, options)`
 * 产生新引用触发 watch。deepMerge 曾为「原地修改并返回 target」，导致赋值的
 * 是同一引用（defaultOptions），watch 永不触发、弹层打不开，且 defaultOptions
 * 被调用方选项污染。现 deepMerge 与 wot-ui 语义一致（深拷贝 target）。
 *
 * 可见性判定说明：测试环境（jsdom）的 __SetInlineStyles 用 Object.assign 应用
 * 样式，不会移除旧样式键，因此「隐藏→显示」时旧的 display:none 会残留
 * （真机 Lynx 引擎的 SetInlineStyles 为整体替换，vue-lynx 的 v-show 同样依赖
 * 该语义）。故 toast 的显隐改用过渡类名（enter-to / leave-to）判定。
 */
async function waitFor(condition: () => boolean, timeout = 5000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (condition()) return
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error('waitFor timeout')
}

/** toast 过渡阶段：initial（未展示过）/ shown（enter 完成）/ hidden（leave 完成） */
function toastPhase(container: Element): string {
  const toast = container.querySelector('.wd-toast')
  if (!toast) return 'absent'
  const root = toast.closest('.wd-transition')
  if (!root) return 'absent'
  const cls = root.getAttribute('class') || ''
  if (cls.includes('fade-leave-to')) return 'hidden'
  if (cls.includes('fade-enter-to')) return 'shown'
  return 'initial'
}

describe('useToast 命令式用法', () => {
  it('toast.show 展示消息，duration 后自动关闭', async () => {
    const holder: any = {}
    const Wrapper = {
      components: { WdToast },
      setup() {
        holder.toast = useToast()
      },
      template: `<WdToast />`
    }
    const { container } = render(Wrapper)
    await new Promise((r) => setTimeout(r, 50))

    holder.toast.show('提示内容')
    await waitFor(() => toastPhase(container) === 'shown')
    expect(container.querySelector('.wd-toast')!.textContent).toContain('提示内容')

    // duration 默认 2000ms，自动关闭
    await waitFor(() => toastPhase(container) === 'hidden')
  })

  it('toast.loading 不自动关闭，toast.close 手动关闭', async () => {
    const holder: any = {}
    const Wrapper = {
      components: { WdToast },
      setup() {
        holder.toast = useToast()
      },
      template: `<WdToast />`
    }
    const { container } = render(Wrapper)
    await new Promise((r) => setTimeout(r, 50))

    holder.toast.loading('加载中')
    await waitFor(() => toastPhase(container) === 'shown')
    expect(container.querySelector('.wd-toast')!.textContent).toContain('加载中')

    // loading duration=0：800ms 后仍展示
    await new Promise((r) => setTimeout(r, 800))
    expect(toastPhase(container)).toBe('shown')

    holder.toast.close()
    await waitFor(() => toastPhase(container) === 'hidden')
  })
})

describe('useNotify 命令式用法', () => {
  it('notify.showNotify 展示通知并同步 update:visible', async () => {
    const holder: any = {}
    const visibleEvents: boolean[] = []
    const Wrapper = {
      components: { WdNotify },
      setup() {
        holder.notify = useNotify()
        return { visibleEvents }
      },
      template: `<WdNotify @update:visible="(v) => visibleEvents.push(v)" />`
    }
    const { container } = render(Wrapper)
    await new Promise((r) => setTimeout(r, 50))

    holder.notify.showNotify('通知内容')
    await waitFor(() => {
      const content = container.querySelector('.wd-notify__content')
      const root = content?.closest('.wd-transition')
      return !!root && !(root.getAttribute('style') || '').includes('display: none')
    })
    expect(container.querySelector('.wd-notify')!.textContent).toContain('通知内容')
    expect(visibleEvents).toContain(true)

    // duration 默认 3000ms 自动关闭
    await waitFor(
      () => {
        const content = container.querySelector('.wd-notify__content')
        const root = content?.closest('.wd-transition')
        return !!root && (root.getAttribute('style') || '').includes('display: none')
      },
      6000
    )
    expect(visibleEvents).toContain(false)
  })
})

describe('wd-notify 声明式用法（v-model:visible）', () => {
  it('visible prop 控制显隐并同步 update:visible', async () => {
    const show = ref(true)
    const visibleEvents: boolean[] = []
    const Wrapper = {
      components: { WdNotify },
      setup() {
        return { show, visibleEvents }
      },
      template: `<WdNotify v-model:visible="show" message="声明式通知" @update:visible="(v) => visibleEvents.push(v)" />`
    }
    const { container } = render(Wrapper)
    await waitFor(() => {
      const content = container.querySelector('.wd-notify__content')
      const root = content?.closest('.wd-transition')
      return !!root && !(root.getAttribute('style') || '').includes('display: none')
    })
    expect(container.querySelector('.wd-notify')!.textContent).toContain('声明式通知')

    show.value = false
    await waitFor(() => {
      const content = container.querySelector('.wd-notify__content')
      const root = content?.closest('.wd-transition')
      return !!root && (root.getAttribute('style') || '').includes('display: none')
    })
    expect(visibleEvents).toContain(false)
  })
})
