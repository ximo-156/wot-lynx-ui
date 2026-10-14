import { describe, it, expect, vi } from 'vitest'
import { provide, ref } from 'vue-lynx'
import { render } from './render'
import { fireEvent } from './fire-event'
import WdDialog from '../src/components/wd-dialog/wd-dialog.vue'
import { useDialog } from '../src/components/wd-dialog'

/**
 * 轮询等待条件成立（过渡动画为 setTimeout 驱动，需等待 enter/leave 生命周期完成）
 */
async function waitFor(condition: () => boolean, timeout = 2000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (condition()) return
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error('waitFor timeout')
}

/** 弹层是否处于隐藏态（leave 动画结束后 wd-transition 输出 display:none） */
function isHidden(container: Element): boolean {
  const popup = container.querySelector('.wd-popup')
  return !!popup && (popup.getAttribute('style') || '').includes('display: none')
}

/** 弹层是否处于可见态 */
function isVisible(container: Element): boolean {
  const popup = container.querySelector('.wd-popup')
  return !!popup && !(popup.getAttribute('style') || '').includes('display: none')
}

function makeWrapper(extraProps: Record<string, unknown> = {}) {
  const show = ref(false)
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const onOpen = vi.fn()
  const onClose = vi.fn()
  const Wrapper = {
    components: { WdDialog },
    setup() {
      provide('__test__', true)
      return { show, onConfirm, onCancel, onOpen, onClose }
    },
    data: () => ({ extraProps }),
    template: `<WdDialog
      v-model="show"
      title="提示"
      msg="这是一个对话框"
      @confirm="onConfirm"
      @cancel="onCancel"
      @open="onOpen"
      @close="onClose"
      v-bind="extraProps"
    />`
  }
  return { show, Wrapper, onConfirm, onCancel, onOpen, onClose }
}

describe('wd-dialog 声明式用法（v-model）', () => {
  it('v-model 打开时渲染 title 与 msg，并触发 open 事件', async () => {
    const { show, Wrapper, onOpen } = makeWrapper()
    const { container } = render(Wrapper)

    show.value = true
    await waitFor(() => isVisible(container))

    const dialog = container.querySelector('.wd-dialog')
    expect(dialog).toBeTruthy()
    expect(dialog!.textContent).toContain('提示')
    expect(dialog!.textContent).toContain('这是一个对话框')
    expect(onOpen).toHaveBeenCalled()
  })

  it('点击确定关闭弹层、同步 v-model 并触发 confirm 事件', async () => {
    const { show, Wrapper, onConfirm, onClose } = makeWrapper()
    const { container } = render(Wrapper)

    show.value = true
    await waitFor(() => isVisible(container))

    const confirmBtn = container.querySelector('.wd-dialog__actions-btn--confirm')
    expect(confirmBtn).toBeTruthy()
    expect(confirmBtn!.textContent).toContain('确定')

    fireEvent.tap(confirmBtn!)

    await waitFor(() => isHidden(container))
    expect(show.value).toBe(false)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm.mock.calls[0][0]).toEqual({ action: 'confirm', value: '' })
    expect(onClose).toHaveBeenCalled()
  })

  it('点击取消关闭弹层、同步 v-model 并触发 cancel 事件', async () => {
    const { show, Wrapper, onCancel } = makeWrapper({ type: 'confirm' })
    const { container } = render(Wrapper)

    show.value = true
    await waitFor(() => isVisible(container))

    const cancelBtn = container.querySelector('.wd-dialog__actions-btn--cancel')
    expect(cancelBtn).toBeTruthy()

    fireEvent.tap(cancelBtn!)

    await waitFor(() => isHidden(container))
    expect(show.value).toBe(false)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('外部将 v-model 置为 false 时关闭弹层', async () => {
    const { show, Wrapper } = makeWrapper()
    const { container } = render(Wrapper)

    show.value = true
    await waitFor(() => isVisible(container))

    show.value = false
    await waitFor(() => isHidden(container))
  })

  it('closeOnClickModal 默认为 true，点击蒙层关闭并同步 v-model', async () => {
    const { show, Wrapper } = makeWrapper()
    const { container } = render(Wrapper)

    show.value = true
    await waitFor(() => isVisible(container))

    const overlay = container.querySelector('.wd-overlay')
    expect(overlay).toBeTruthy()
    fireEvent.tap(overlay!)

    await waitFor(() => isHidden(container))
    expect(show.value).toBe(false)
  })

  it('showCancelButton 控制取消按钮显隐', async () => {
    const { show, Wrapper } = makeWrapper({ showCancelButton: true, cancelButtonText: '取消' })
    const { container } = render(Wrapper)

    show.value = true
    await waitFor(() => isVisible(container))

    const cancelBtn = container.querySelector('.wd-dialog__actions-btn--cancel')
    expect(cancelBtn).toBeTruthy()
    expect(cancelBtn!.textContent).toContain('取消')
  })

  it('confirmButtonProps 为 null 时隐藏确认按钮', async () => {
    const { show, Wrapper } = makeWrapper({ confirmButtonProps: null })
    const { container } = render(Wrapper)

    show.value = true
    await waitFor(() => isVisible(container))

    expect(container.querySelector('.wd-dialog__actions-btn--confirm')).toBeFalsy()
  })

  it('prompt 类型输入校验不通过时点击确定不关闭', async () => {
    const { show, Wrapper } = makeWrapper({
      type: 'prompt',
      inputPattern: /^\d+$/,
      inputError: '请输入数字'
    })
    const { container } = render(Wrapper)

    show.value = true
    await waitFor(() => isVisible(container))

    const confirmBtn = container.querySelector('.wd-dialog__actions-btn--confirm')
    fireEvent.tap(confirmBtn!)

    await new Promise((r) => setTimeout(r, 100))
    // 校验失败：弹层保持打开，v-model 不同步
    expect(isVisible(container)).toBe(true)
    expect(show.value).toBe(true)
    expect(container.querySelector('.wd-dialog__input-error')!.textContent).toContain('请输入数字')
  })
})

describe('wd-dialog 命令式用法（useDialog）', () => {
  it('useDialog().alert 展示标题，点击确定后关闭', async () => {
    const dialog = { current: null as null | ReturnType<typeof useDialog> }
    const Wrapper = {
      components: { WdDialog },
      setup() {
        dialog.current = useDialog()
      },
      template: `<WdDialog />`
    }
    const { container } = render(Wrapper)
    await new Promise((r) => setTimeout(r, 50))

    const promise = dialog.current!.alert({ title: '标题', msg: '内容' })
    await waitFor(() => isVisible(container))
    expect(container.querySelector('.wd-dialog')!.textContent).toContain('标题')
    expect(container.querySelector('.wd-dialog')!.textContent).toContain('内容')

    const confirmBtn = container.querySelector('.wd-dialog__actions-btn--confirm')
    fireEvent.tap(confirmBtn!)

    await waitFor(() => isHidden(container))
    const result = await promise
    expect(result).toEqual({ action: 'confirm', value: '' })
  })

  it('useDialog 的 closeOnClickModal 默认关闭（wot-ui 语义：false）', async () => {
    const dialog = { current: null as null | ReturnType<typeof useDialog> }
    const Wrapper = {
      components: { WdDialog },
      setup() {
        dialog.current = useDialog()
      },
      template: `<WdDialog />`
    }
    const { container } = render(Wrapper)
    await new Promise((r) => setTimeout(r, 50))

    dialog.current!.alert('标题')
    await waitFor(() => isVisible(container))

    // 命令式默认 closeOnClickModal=false：点击蒙层不关闭
    const overlay = container.querySelector('.wd-overlay')
    fireEvent.tap(overlay!)
    await new Promise((r) => setTimeout(r, 100))
    expect(isVisible(container)).toBe(true)
  })
})
