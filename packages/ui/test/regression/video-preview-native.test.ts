import { createEvent } from '@testing-library/dom'
import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import { nativeRuntime, restoreNativeStubs, setEngineVersion } from '../helpers/native-stubs'
import { configureHost } from '../../src/common/host'
import { pause } from '../../src/common/util'
import VideoPreview from '../../src/components/wd-video-preview/wd-video-preview.vue'
import Swiper from '../../src/components/wd-swiper/wd-swiper.vue'
import Upload from '../../src/components/wd-upload/wd-upload.vue'

const restores: Array<() => void> = []
afterEach(() => {
  cleanup()
  restores.splice(0).reverse().forEach((restore) => restore())
  restoreNativeStubs()
  configureHost(null)
})

async function frames(count = 4) {
  for (let index = 0; index < count; index++) await pause()
}

function mountPreview(props: Record<string, unknown> = {}) {
  const exposed = ref<any>()
  const result = render({ setup: () => () => h('view', null, [h(VideoPreview, { ...props, ref: exposed })]) } as any)
  return { ...result, exposed }
}

type Invocation = { selector: string; method: string; success: (result: any) => void; fail: (result: any) => void }
function stubPlayback() {
  const runtime = nativeRuntime()
  const original = runtime.createSelectorQuery
  const calls: Invocation[] = []
  runtime.createSelectorQuery = () => ({
    select: (selector: string) => ({
      invoke: (options: any) => ({ exec: () => { calls.push({ selector, ...options }) } })
    })
  })
  restores.push(() => { runtime.createSelectorQuery = original })
  return calls
}

function videoEvent(element: Element, name: string, detail: Record<string, unknown> = {}) {
  const event = createEvent(`bindEvent:${name}`, element, {})
  Object.assign(event, { eventType: 'bindEvent', eventName: name, detail })
  fireEvent(element, event)
}

const player = (container: Element) => container.querySelector('video')!
const control = (container: Element) => container.querySelector('.wd-video-preview__control')!

describe('原生视频：4.0 门禁、真实播放反馈与媒体生命周期', () => {
  it('Lynx 4.0 的预览、轮播和无封面上传项都不得创建 video', async () => {
    configureHost({})
    setEngineVersion('4.0')
    const calls = stubPlayback()
    const exposed = ref<any>()
    const { container } = render({ setup: () => () => h('view', null, [
      h(VideoPreview, { ref: exposed }),
      h(Swiper, { list: ['https://example.com/swiper.mp4'], autoplay: false, autoplayVideo: true }),
      h(Upload, { fileList: [{ url: 'https://example.com/upload.mp4', name: 'upload.mp4', status: 'success' }] })
    ]) } as any)
    exposed.value.open({ url: 'https://example.com/preview.mp4', poster: 'poster.png', fullScreen: true })
    await frames()
    expect(container.querySelectorAll('video')).toHaveLength(0)
    expect(container.querySelector('.wd-video-preview__fallback-text')?.textContent).toContain('4.1')
    expect(container.querySelector('.wd-video-preview__control')).toBeNull()
    expect(calls.some((call) => call.method === 'play')).toBe(false)
    fireEvent.tap(container.querySelector('.wd-video-preview__close')!)
    await pause(450)
    expect(container.querySelector('.wd-video-preview__fallback')).toBeNull()
  })

  it('同一预览实例在宿主后注册、撤销后重开时重新读能力，不缓存 computed 快照', async () => {
    configureHost({ supportsVideoElement: () => false })
    setEngineVersion('4.1.0')
    stubPlayback()
    const { container, exposed } = mountPreview()
    exposed.value.open({ url: 'old.mp4' })
    await frames()
    expect(player(container)).toBeNull()
    exposed.value.close()
    await frames(1)
    configureHost({ supportsVideoElement: () => true })
    exposed.value.open({ url: 'supported.mp4' })
    await frames()
    expect(player(container)?.getAttribute('src')).toBe('supported.mp4')
    configureHost({ supportsVideoElement: () => false })
    exposed.value.open({ url: 'unsupported.mp4' })
    await frames()
    expect(player(container)).toBeNull()
    expect(container.querySelector('.wd-video-preview__fallback-text')).not.toBeNull()
  })

  it('play 下发不等于播放成功；首帧才撤封面，原生暂停/结束后可再次播放', async () => {
    configureHost({ supportsVideoElement: () => true })
    const calls = stubPlayback()
    const { container, exposed } = mountPreview()
    exposed.value.open({ url: 'a.mp4', poster: 'a.png' })
    await frames()
    const video = player(container)
    fireEvent.tap(control(container))
    await nextTick()
    expect(calls.at(-1)?.method).toBe('play')
    expect(control(container).classList.contains('is-playing')).toBe(false)
    calls.at(-1)!.success({ success: true })
    await nextTick()
    expect(control(container).classList.contains('is-playing')).toBe(false)
    expect(container.querySelector('.wd-video-preview__poster')).not.toBeNull()
    videoEvent(video, 'playing')
    videoEvent(video, 'firstframe', { duration: 10 })
    await nextTick()
    expect(control(container).classList.contains('is-playing')).toBe(true)
    expect(container.querySelector('.wd-video-preview__poster')).toBeNull()
    fireEvent.tap(control(container))
    expect(calls.at(-1)?.method).toBe('pause')
    videoEvent(video, 'paused')
    await nextTick()
    expect(control(container).classList.contains('is-playing')).toBe(false)
    fireEvent.tap(control(container))
    expect(calls.at(-1)?.method).toBe('play')
    videoEvent(video, 'playing')
    videoEvent(video, 'ended')
    await nextTick()
    fireEvent.tap(control(container))
    expect(calls.at(-1)?.method).toBe('play')
  })

  it.each(['fail', 'success-false', 'event'] as const)('%s 失败显示原因而非假装播放，并允许重试', async (failure) => {
    configureHost({ supportsVideoElement: () => true })
    const calls = stubPlayback()
    const { container, exposed } = mountPreview()
    exposed.value.open({ url: 'bad.mp4', poster: 'a.png' })
    await frames()
    fireEvent.tap(control(container))
    if (failure === 'fail') calls.at(-1)!.fail({ code: 1, data: 'network unavailable' })
    else if (failure === 'success-false') calls.at(-1)!.success({ success: false, errorCode: 42, msg: 'decoder failed' })
    else videoEvent(player(container), 'error', { errorCode: 42, errorMsg: 'decoder failed' })
    await nextTick()
    expect(container.querySelector('.wd-video-preview__error')?.textContent).toContain('失败')
    expect(control(container).classList.contains('is-playing')).toBe(false)
    fireEvent.tap(control(container))
    await nextTick()
    expect(calls.filter((call) => call.method === 'play')).toHaveLength(2)
    expect(container.querySelector('.wd-video-preview__error')).toBeNull()
  })

  it('缺少 UIMethod 通道也给出失败反馈', async () => {
    configureHost({ supportsVideoElement: () => true })
    const runtime = nativeRuntime()
    const original = runtime.createSelectorQuery
    runtime.createSelectorQuery = undefined
    restores.push(() => { runtime.createSelectorQuery = original })
    const { container, exposed } = mountPreview()
    exposed.value.open({ url: 'a.mp4' })
    await frames()
    fireEvent.tap(control(container))
    await nextTick()
    expect(container.querySelector('.wd-video-preview__error')?.textContent).toContain('失败')
  })

  it('换片/关闭立即停止旧播放器，旧请求的失败不能污染新片，卸载后不再响应', async () => {
    configureHost({ supportsVideoElement: () => true })
    const calls = stubPlayback()
    const { container, exposed } = mountPreview({ fullScreen: true })
    exposed.value.open({ url: 'old.mp4' })
    await frames()
    const oldId = player(container).id
    const oldPlay = calls.find((call) => call.method === 'play')!
    exposed.value.open({ url: 'new.mp4' })
    await frames()
    const newId = player(container).id
    expect(newId).not.toBe(oldId)
    expect(calls.some((call) => call.method === 'stop' && call.selector === `#${oldId}`)).toBe(true)
    oldPlay.fail({ code: 1 })
    await nextTick()
    expect(container.querySelector('.wd-video-preview__error')).toBeNull()
    videoEvent(player(container), 'playing')
    await nextTick()
    exposed.value.close()
    expect(calls.at(-1)?.method).toBe('stop')
    expect(calls.at(-1)?.selector).toBe(`#${newId}`)
    await frames(1)
    exposed.value.open({ url: 'reopened.mp4', fullScreen: false })
    await frames()
    expect(player(container).getAttribute('src')).toBe('reopened.mp4')
    expect(control(container).classList.contains('is-playing')).toBe(false)
    const retained = exposed.value
    const latePlay = calls.filter((call) => call.method === 'play').at(-1)!
    cleanup()
    const count = calls.length
    expect(calls.at(-1)?.method).toBe('stop')
    latePlay.fail({ code: 1 })
    retained.open({ url: 'unmounted.mp4' })
    retained.close()
    await frames()
    expect(calls).toHaveLength(count)
    expect(container.querySelector('video')).toBeNull()
  })

  it('全屏打开同一 tick 关闭时，不向未挂载或已离场节点播放', async () => {
    configureHost({ supportsVideoElement: () => true })
    const calls = stubPlayback()
    const { exposed } = mountPreview()
    exposed.value.open({ url: 'canceled.mp4', fullScreen: true })
    exposed.value.close()
    await frames()
    expect(calls.filter((call) => call.method === 'play')).toHaveLength(0)
  })
})
