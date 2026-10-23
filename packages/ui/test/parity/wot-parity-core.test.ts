import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, ref } from 'vue-lynx'
import { cleanup, render } from '../render'
import { pause } from '../../src/common/util'
import { configureUniAdapter, uni } from '../../src/common/uni'
import { useUpload } from '../../src/composables/useUpload'
import Text from '../../src/components/wd-text/wd-text.vue'
import Avatar from '../../src/components/wd-avatar/wd-avatar.vue'
import Badge from '../../src/primitives/wd-badge/wd-badge.vue'
import Img from '../../src/primitives/wd-img/wd-img.vue'
import Skeleton from '../../src/components/wd-skeleton/wd-skeleton.vue'
import Progress from '../../src/components/wd-progress/wd-progress.vue'
import Table from '../../src/components/wd-table/wd-table.vue'
import TableColumn from '../../src/components/wd-table-column/wd-table-column.vue'
import CountTo from '../../src/components/wd-count-to/wd-count-to.vue'
import Button from '../../src/primitives/wd-button/wd-button.vue'
import Sticky from '../../src/components/wd-sticky/wd-sticky.vue'
import { fireEvent } from '../fire-event'

async function frames(count = 2) { for (let i = 0; i < count; i++) await pause() }
afterEach(() => { cleanup(); vi.useRealTimers(); configureUniAdapter({ uploadFile: undefined, openType: undefined }) })

describe('wot 2.3.2 core and display compatibility', () => {
  it('clears declared empty values, returning text to existing CSS/theme styles', async () => {
    const color = ref('rgb(10, 20, 30)')
    const size = ref('24px')
    const { container } = render({ setup: () => () => h(Text, { text: 'text', color: color.value, size: size.value }) } as any)
    const root = container.querySelector('.wd-text') as HTMLElement
    expect(root.style.color).toBe('rgb(10, 20, 30)')
    expect(root.style.fontSize).toBe('24px')
    color.value = ''; size.value = ''
    await frames()
    expect(root.style.color).toBe('')
    expect(root.style.fontSize).toBe('')
    expect(root.classList.contains('is-default')).toBe(true)
  })

  it('clears custom avatar dimensions when returning to a built-in size', async () => {
    const size = ref<string | number>(80)
    const { container } = render({ setup: () => () => h(Avatar, { text: 'A', size: size.value }) } as any)
    const root = container.querySelector('.wd-avatar') as HTMLElement
    expect(root.style.width).toBe('80px')
    size.value = 'small'
    await frames()
    expect(root.style.width).toBe('')
    expect(root.style.height).toBe('')
    expect(root.classList.contains('wd-avatar--small')).toBe(true)
  })

  it('clears badge offsets when removing overrides', async () => {
    const top = ref<number | undefined>(15)
    const right = ref<number | undefined>(20)
    const { container } = render({ setup: () => () => h(Badge, { value: 5, top: top.value, right: right.value }) } as any)
    const content = container.querySelector('.wd-badge__content') as HTMLElement
    expect(content.style.top).toBe('15px')
    top.value = undefined; right.value = undefined
    await frames()
    expect(content.style.top).toBe('')
    expect(content.style.right).toBe('')
  })

  it('clears image radius and clipping when removing overrides', async () => {
    const radius = ref<number | undefined>(20)
    const width = ref<number | undefined>(100)
    const { container } = render({ setup: () => () => h(Img, { src: 'image.png', radius: radius.value, width: width.value }) } as any)
    const root = container.querySelector('.wd-img') as HTMLElement
    expect(root.style.borderRadius).toBe('20px')
    radius.value = undefined; width.value = undefined
    await frames()
    expect(root.style.borderRadius).toBe('')
    expect(root.style.overflow).toBe('')
    expect(root.style.width).toBe('')
  })

  it('reacts to skeleton theme changes and deeply edited row-col configuration', async () => {
    const theme = ref('text')
    const rowCol = ref<any[]>([])
    const { container } = render({ setup: () => () => h(Skeleton, { theme: theme.value, rowCol: rowCol.value }) } as any)
    expect(container.querySelectorAll('.wd-skeleton__row')).toHaveLength(2)
    theme.value = 'avatar'
    await frames()
    expect(container.querySelectorAll('.wd-skeleton__row')).toHaveLength(1)
    expect(container.querySelector('.wd-skeleton--type-circle')).not.toBeNull()
    rowCol.value.push({ type: 'rect', width: 60, height: 30 })
    await frames()
    const col = container.querySelector('.wd-skeleton__col') as HTMLElement
    expect(col.style.width).toBe('60px')
    rowCol.value[0].width = 90
    await frames()
    expect(col.style.width).toBe('90px')
    rowCol.value[0] = 1
    await frames()
    expect(col.style.width).toBe('')
    expect(col.style.height).toBe('')
  })

  it('passes numeric and CSS-unit column widths without appending px twice', async () => {
    const width = ref<string | number>('80px')
    const spanMethod = ({ columnIndex }: any) => columnIndex === 0 ? { rowspan: 1, colspan: 2 } : { rowspan: 0, colspan: 0 }
    const { container } = render({
      setup: () => () => h(Table, { data: [{ a: 'merged', b: 'hidden' }], spanMethod }, {
        default: () => [h(TableColumn, { prop: 'a', label: 'A', width: width.value }), h(TableColumn, { prop: 'b', label: 'B', width: 120 })]
      })
    } as any)
    await frames()
    const root = container.querySelector('.wd-table-column') as HTMLElement
    const cell = root.querySelector('.wd-table__cell') as HTMLElement
    expect(root.style.width).toBe('80px')
    expect(cell.style.width).toBe('calc(200px)')
    width.value = 90
    await frames()
    expect(root.style.width).toBe('90px')
    expect(cell.style.width).toBe('calc(210px)')
  })

  it('renders merged virtual row heights without shifting following rows upward', async () => {
    const spanMethod = ({ columnIndex, rowIndex }: any) => columnIndex === 0 && rowIndex === 0
      ? { rowspan: 2, colspan: 1 }
      : columnIndex === 0 && rowIndex === 1 ? { rowspan: 0, colspan: 0 } : { rowspan: 1, colspan: 1 }
    const { container } = render({
      setup: () => () => h(Table, { data: [{ a: 'a1', b: 'b1' }, { a: 'a2', b: 'b2' }, { a: 'a3', b: 'b3' }], virtual: true, height: 200, rowHeight: 44, spanMethod }, {
        default: () => [h(TableColumn, { prop: 'a', label: 'A' }), h(TableColumn, { prop: 'b', label: 'B' })]
      })
    } as any)
    await frames()
    const cells = container.querySelector('.wd-table-column')!.querySelectorAll('.wd-table__cell')
    expect(cells).toHaveLength(2)
    expect((cells[0] as HTMLElement).style.height).toBe('88px')
    expect((cells[1] as HTMLElement).style.height).toBe('44px')
  })

  it('retains a host upload task and its progress/abort contract', () => {
    const task = { abort: vi.fn(), onProgressUpdate: vi.fn<(callback: (res: any) => void) => void>() }
    configureUniAdapter({ uploadFile: vi.fn(() => task) })
    expect(uni.uploadFile({ filePath: 'file.png' })).toBe(task)
    const upload = useUpload()
    const file = { uid: 1, url: 'file.png' }
    const progress = vi.fn()
    expect(upload.startUpload(file, { action: '/upload', onProgress: progress })).toBe(task)
    task.onProgressUpdate.mock.calls[0][0]({ progress: 45 })
    expect((file as any).percent).toBe(45)
    expect(progress).toHaveBeenCalledOnce()
    upload.abort()
    expect(task.abort).toHaveBeenCalledOnce()
  })

  it('allows an explicitly returned custom upload task to be aborted', () => {
    const task = { abort: vi.fn() }
    const upload = useUpload()
    expect(upload.startUpload({ uid: 1, url: 'file.png' }, { action: '/upload', uploadMethod: () => task as any })).toBe(task)
    upload.abort()
    expect(task.abort).toHaveBeenCalledOnce()
  })

  it('progress uses new colors at the same percentage and never mutates supplied stops', async () => {
    vi.useFakeTimers()
    const color = ref<any>('rgb(10, 20, 30)')
    const { container } = render({ setup: () => () => h(Progress, { percentage: 50, duration: 0, color: color.value }) } as any)
    await vi.advanceTimersByTimeAsync(200)
    const inner = container.querySelector('.wd-progress__inner') as HTMLElement
    expect(inner.style.width).toBe('50%')
    expect(inner.style.background).toBe('rgb(10, 20, 30)')
    color.value = 'rgb(30, 40, 50)'
    await vi.advanceTimersByTimeAsync(200)
    expect(inner.style.background).toBe('rgb(30, 40, 50)')
    const stops = Object.freeze([Object.freeze({ percentage: 80, color: 'blue' }), Object.freeze({ percentage: 30, color: 'red' })])
    color.value = stops
    await vi.advanceTimersByTimeAsync(200)
    expect(stops[0].percentage).toBe(80)
    expect(inner.style.background).toBe('blue')
    color.value = undefined
    await vi.advanceTimersByTimeAsync(200)
    expect(inner.style.background).toBe('')
  })

  it('sticky instance methods control actual positioning and expose current offset', async () => {
    let instance: any
    const offsetTop = ref(12)
    const { container } = render({ setup: () => () => h(Sticky, { offsetTop: offsetTop.value, ref: (value: any) => { instance = value } }) } as any)
    const root = container.querySelector('.wd-sticky') as HTMLElement
    expect(root.style.position).toBe('sticky')
    expect(instance.offsetTop).toBe(12)
    instance.setPosition(true, 'absolute', 37)
    await frames()
    expect(instance.stickyState.boxLeaved).toBe(true)
    expect(root.style.position).toBe('absolute')
    expect(root.style.top).toBe('37px')
    instance.setPosition(false, 'sticky', 0)
    offsetTop.value = 5
    await frames()
    expect(instance.offsetTop).toBe(5)
    expect(root.style.position).toBe('sticky')
    expect(root.style.top).toBe('5px')
  })

  it('button invokes only explicit host open-type capabilities, with one result event', () => {
    const getuserinfo = vi.fn()
    const error = vi.fn()
    const click = vi.fn()
    const host = vi.fn((options: any) => {
      expect(options.openType).toBe('getUserInfo')
      options.success({ detail: { userInfo: { name: 'test' } } })
      options.success({ detail: { ignored: true } })
    })
    configureUniAdapter({ openType: host })
    const { container } = render(Button, { openType: 'getUserInfo', onGetuserinfo: getuserinfo, onError: error, onClick: click })
    fireEvent.tap(container.querySelector('.wd-button')!)
    expect(host).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(getuserinfo).toHaveBeenCalledExactlyOnceWith({ detail: { userInfo: { name: 'test' } } })
    expect(error).not.toHaveBeenCalled()
    cleanup()
    const disabled = render(Button, { openType: 'getUserInfo', disabled: true })
    fireEvent.tap(disabled.container.querySelector('.wd-button')!)
    expect(host).toHaveBeenCalledOnce()
  })

  it('count-to with zero duration shows its final formatted value, not NaN', () => {
    const { container } = render(CountTo, { startVal: 0, endVal: 1234.5, duration: 0, decimals: 1, useEasing: false })
    expect(container.querySelector('.wd-count-to__main-text')!.textContent).toBe('1,234.5')
  })
})
