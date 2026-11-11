import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import Upload from '@wot-lynx/ui-form/wd-upload'
import { configureHost } from '@wot-lynx/core/common/host'
import {
  createNativeMediaPickerHost, normalizeNativeMediaOptions, supplementMediaPicker,
  type NativeMediaOptions, type NativeMediaResult, type NativeMediaPickerModule,
  type NativeMediaSuccess, type NativePickedMedia
} from '@wot-lynx/core/common/nativeMediaPicker'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import type { UploadFileItem } from '@wot-lynx/ui-form/wd-upload/types'

const image = (path = '/data/user/0/explorer/cache/WotMediaPicker/photo.jpg'): NativePickedMedia => ({
  fileType: 'image', tempFilePath: path, name: 'photo.jpg', size: 42
})
const video = (): NativePickedMedia => ({
  fileType: 'video', tempFilePath: '/var/mobile/Library/Caches/WotMediaPicker/clip.mov',
  name: 'clip.mov', size: 80, thumbTempFilePath: '/var/mobile/Library/Caches/WotMediaPicker/clip.jpg', duration: 3.25
})
function pendingPicker() {
  let receive: ((result: NativeMediaResult) => void) | undefined
  const chooseMedia = vi.fn((options: NativeMediaOptions, callback: (result: NativeMediaResult) => void) => { receive = callback })
  const module: NativeMediaPickerModule = { chooseMedia }
  return { module, chooseMedia, respond: (result: unknown) => {
    expect(receive).toBeTypeOf('function')
    receive!(result as NativeMediaResult)
  } }
}
async function flush() { await nextTick(); await Promise.resolve(); await nextTick() }
function mountUpload(props: Record<string, unknown> = {}) {
  const files = ref<UploadFileItem[]>([])
  const errors: unknown[] = []
  const mounted = render({ setup: () => () => h(Upload, {
    fileList: files.value, limit: 3, multiple: true, autoUpload: false, ...props,
    'onUpdate:fileList': (value: UploadFileItem[]) => { files.value = value },
    onChooseerror: (error: unknown) => errors.push(error)
  }, { default: () => h('view', { class: 'native-media-evoke' }, [h('text', null, '选择媒体')]) }) } as never)
  return { ...mounted, files, errors, tap: () => fireEvent.tap(mounted.container.querySelector('.native-media-evoke')!, { bubbles: true }) }
}
afterEach(() => { cleanup(); configureHost(null); vi.useRealTimers(); vi.restoreAllMocks() })

describe('WotMediaPicker native ABI facade', () => {
  it('passes exactly two arguments, with JSON-safe options rather than nested success/fail functions', () => {
    const picker = pendingPicker(), success = vi.fn(), fail = vi.fn()
    const host = createNativeMediaPickerHost(picker.module)
    host.chooseMedia({ count: 3, mediaType: ['image', 'video'], sourceType: ['album'], camera: 'front',
      sizeType: ['original', 'compressed'], compressed: true, maxDuration: 12, success, fail })
    expect(picker.chooseMedia).toHaveBeenCalledOnce()
    const args = picker.chooseMedia.mock.calls[0]
    expect(args).toHaveLength(2)
    expect(args[0]).toEqual({ count: 3, multiple: true, mediaType: ['image', 'video'], sourceType: ['album'],
      camera: 'front', sizeType: ['original', 'compressed'], compressed: true, maxDuration: 12 })
    expect(JSON.parse(JSON.stringify(args[0]))).toEqual(args[0])
    expect(args[0]).not.toHaveProperty('success'); expect(args[0]).not.toHaveProperty('fail')
    expect(args[1]).toBeTypeOf('function')
    expect(success).not.toHaveBeenCalled(); expect(fail).not.toHaveBeenCalled()
  })

  it.each([
    [undefined, 9], [0, 9], [-1, 9], [NaN, 9], [Infinity, 9], [0.5, 1], [1, 1], [3.8, 3], [100, 50]
  ])('normalizes count %s to %s and derives native multiple from that count', (count, expected) => {
    const value = normalizeNativeMediaOptions({ count })
    expect(value.count).toBe(expected)
    expect(value.multiple).toBe(expected > 1)
  })

  it('filters duplicate or unsupported options and applies the real default contract', () => {
    expect(normalizeNativeMediaOptions({})).toEqual({ count: 9, multiple: true, mediaType: ['image'],
      sourceType: ['album', 'camera'], camera: 'back', sizeType: ['original'], compressed: false, maxDuration: 60 })
    const options = { count: 2, mediaType: ['video', 'video', 'file'], sourceType: ['album', 'album', 'unknown'],
      sizeType: ['compressed', 'compressed', 'unknown'], camera: 'invalid', maxDuration: -1 }
    expect(normalizeNativeMediaOptions(options as never)).toEqual({ count: 2, multiple: true, mediaType: ['video'],
      sourceType: ['album'], camera: 'back', sizeType: ['compressed'], compressed: false, maxDuration: 60 })
    expect(options.mediaType).toEqual(['video', 'video', 'file'])
  })

  it('preserves the native method receiver and returns actual image/video local-path receipts', () => {
    const files = [image(), video()], success = vi.fn(), fail = vi.fn()
    const module = { chooseMedia: vi.fn(function (this: unknown, _options: NativeMediaOptions, callback: (result: NativeMediaResult) => void) {
      expect(this).toBe(module)
      callback({ success: true, tempFiles: files })
    }) }
    createNativeMediaPickerHost(module).chooseMedia({ count: 2, success, fail })
    expect(success).toHaveBeenCalledExactlyOnceWith({ success: true, tempFiles: files })
    expect(fail).not.toHaveBeenCalled()
  })

  it('enforces the requested count without mutating the native result array', () => {
    const picker = pendingPicker(), success = vi.fn()
    const files = [image('/a.jpg'), image('/b.jpg'), image('/c.jpg')]
    createNativeMediaPickerHost(picker.module).chooseMedia({ count: 1, success })
    picker.respond({ success: true, tempFiles: files })
    expect(success).toHaveBeenCalledWith({ success: true, tempFiles: [files[0]] })
    expect(files).toHaveLength(3)
  })

  it.each([
    { code: 'ERR_CANCELLED', errMsg: 'chooseMedia:fail cancel' },
    { code: 'PERMISSION_DENIED', errMsg: 'chooseMedia:fail camera permission denied' },
    { code: 'BUSY', errMsg: 'chooseMedia:fail picker already open' }
  ])('forwards native $code failure once instead of converting it to success', error => {
    const picker = pendingPicker(), success = vi.fn(), fail = vi.fn()
    createNativeMediaPickerHost(picker.module).chooseMedia({ success, fail })
    picker.respond({ success: false, ...error })
    picker.respond({ success: true, tempFiles: [image()] })
    expect(fail).toHaveBeenCalledExactlyOnceWith(error)
    expect(success).not.toHaveBeenCalled()
  })

  it.each([
    undefined, null, {}, { success: true }, { success: true, tempFiles: [] },
    { success: true, tempFiles: [{ ...image(), tempFilePath: '' }] },
    { success: true, tempFiles: [{ ...image(), tempFilePath: 'content://provider/123' }] },
    { success: true, tempFiles: [{ ...image(), tempFilePath: 'blob:temporary' }] },
    { success: true, tempFiles: [{ ...image(), tempFilePath: 'C:\\fakepath\\photo.jpg' }] },
    { success: true, tempFiles: [{ ...image(), fileType: 'file' }] },
    { success: true, tempFiles: [{ ...image(), size: -1 }] },
    { success: true, tempFiles: [{ ...image(), size: NaN }] },
    { success: true, tempFiles: [image(), { ...image(), tempFilePath: '' }] }
  ])('rejects malformed native response %j without adding a bogus file', result => {
    const picker = pendingPicker(), success = vi.fn(), fail = vi.fn()
    createNativeMediaPickerHost(picker.module).chooseMedia({ success, fail })
    picker.respond(result)
    picker.respond({ success: true, tempFiles: [image()] })
    expect(fail).toHaveBeenCalledExactlyOnceWith({ errMsg: 'chooseMedia:fail invalid native media response', code: 'invalid_response' })
    expect(success).not.toHaveBeenCalled()
  })

  it('settles at the first callback even when native calls twice and then throws', () => {
    const success = vi.fn(), fail = vi.fn()
    const module = { chooseMedia: (_options: NativeMediaOptions, callback: (result: NativeMediaResult) => void) => {
      callback({ success: true, tempFiles: [image()] })
      callback({ success: false, errMsg: 'late failure' })
      throw new Error('throw after callback')
    } }
    expect(() => createNativeMediaPickerHost(module).chooseMedia({ success, fail })).not.toThrow()
    expect(success).toHaveBeenCalledOnce(); expect(fail).not.toHaveBeenCalled()
  })

  it('forwards a synchronous native exception once', () => {
    const success = vi.fn(), fail = vi.fn()
    const module = { chooseMedia: () => { throw new Error('chooseMedia:fail native crashed') } }
    createNativeMediaPickerHost(module).chooseMedia({ success, fail })
    expect(fail).toHaveBeenCalledExactlyOnceWith({ errMsg: 'chooseMedia:fail native crashed', code: 'native_exception' })
    expect(success).not.toHaveBeenCalled()
  })

  it('does not expire while a user is still choosing in the system picker', async () => {
    vi.useFakeTimers()
    const picker = pendingPicker(), success = vi.fn(), fail = vi.fn()
    createNativeMediaPickerHost(picker.module).chooseMedia({ success, fail })
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000)
    expect(success).not.toHaveBeenCalled(); expect(fail).not.toHaveBeenCalled()
    picker.respond({ success: true, tempFiles: [image()] })
    expect(success).toHaveBeenCalledOnce(); expect(fail).not.toHaveBeenCalled()
  })

  it('supplements frozen host methods without changing their receiver or existing fields', () => {
    const method = vi.fn(function (this: unknown) { return this })
    const base = Object.freeze({ marker: 'original', chooseMedia: undefined, uploadFile: method })
    const media = createNativeMediaPickerHost(pendingPicker().module)
    const host = supplementMediaPicker(base, media)
    expect(host.marker).toBe('original')
    expect(host.chooseMedia).toBe(media.chooseMedia)
    expect(host.uploadFile({})).toBe(base)
    expect(method.mock.contexts[0]).toBe(base)
    expect('chooseMedia' in host).toBe(true)
    expect({ ...host }).toMatchObject({ marker: 'original', chooseMedia: media.chooseMedia })
    expect(base.chooseMedia).toBeUndefined()
  })
})

describe('native media receipt to real Upload pipeline', () => {
  it('maps multi-image native receipts into Upload fileList and previews through one tap', async () => {
    const picker = pendingPicker()
    configureHost(createNativeMediaPickerHost(picker.module))
    const mounted = mountUpload()
    mounted.tap()
    expect(picker.chooseMedia).toHaveBeenCalledOnce()
    expect(picker.chooseMedia.mock.calls[0][0]).toMatchObject({ count: 3, multiple: true, mediaType: ['image'] })
    picker.respond({ success: true, tempFiles: [image('/a.jpg'), image('/b.jpg')] })
    await flush()
    expect(mounted.errors).toEqual([])
    expect(mounted.files.value.map(file => file.url)).toEqual(['/a.jpg', '/b.jpg'])
    expect(mounted.files.value[0]).toMatchObject({ thumb: '/a.jpg', name: 'photo.jpg', size: 42, status: 'pending' })
    expect(mounted.container.querySelectorAll('.wd-upload__preview')).toHaveLength(2)
    expect(mounted.container.querySelector('input')).toBeNull()
  })

  it('maps single video choice, thumbnail and seconds duration without a fake file input', async () => {
    const picker = pendingPicker()
    configureHost(createNativeMediaPickerHost(picker.module))
    const mounted = mountUpload({ accept: 'video', multiple: false })
    mounted.tap()
    expect(picker.chooseMedia.mock.calls[0][0]).toMatchObject({ count: 1, multiple: false, mediaType: ['video'] })
    picker.respond({ success: true, tempFiles: [video()] }); await flush()
    expect(mounted.files.value[0]).toMatchObject({ url: video().tempFilePath, thumb: video().thumbTempFilePath, size: 80, duration: 3.25 })
    expect(mounted.errors).toEqual([])
  })

  it('forwards native cancellation through chooseerror and never inserts a file', async () => {
    const picker = pendingPicker()
    configureHost(createNativeMediaPickerHost(picker.module))
    const mounted = mountUpload()
    mounted.tap()
    picker.respond({ success: false, code: 'ERR_CANCELLED', errMsg: 'chooseMedia:fail cancel' }); await flush()
    expect(mounted.files.value).toHaveLength(0)
    expect(mounted.errors).toHaveLength(1)
    expect(mounted.errors[0]).toMatchObject({ error: { code: 'ERR_CANCELLED', errMsg: 'chooseMedia:fail cancel' } })
  })

  it('does not mutate a destroyed Upload when native completes later or duplicates its result', async () => {
    const picker = pendingPicker()
    configureHost(createNativeMediaPickerHost(picker.module))
    const mounted = mountUpload()
    mounted.tap(); mounted.unmount()
    picker.respond({ success: true, tempFiles: [image()] })
    picker.respond({ success: true, tempFiles: [image('/later.jpg')] }); await flush()
    expect(mounted.files.value).toHaveLength(0)
    expect(mounted.errors).toEqual([])
  })
})
