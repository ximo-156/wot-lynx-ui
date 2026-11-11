import { getNativeModule } from './native'

export const NATIVE_MEDIA_PICKER_NAME = 'WotMediaPicker'
export type NativeMediaType = 'image' | 'video'
export type NativeMediaSource = 'album' | 'camera'

/** Only serializable values cross the native bridge; callbacks are separate arguments. */
export interface NativeMediaOptions {
  count: number
  multiple: boolean
  mediaType: NativeMediaType[]
  sourceType: NativeMediaSource[]
  camera: 'front' | 'back'
  sizeType: Array<'original' | 'compressed'>
  compressed: boolean
  maxDuration: number
}
export interface NativePickedMedia {
  fileType: NativeMediaType
  tempFilePath: string
  name: string
  size: number
  thumbTempFilePath?: string
  duration?: number
}
export interface NativeMediaSuccess {
  success: true
  tempFiles: NativePickedMedia[]
}
export interface NativeMediaFailure {
  success: false
  errMsg: string
  code?: string
}
export type NativeMediaResult = NativeMediaSuccess | NativeMediaFailure
export interface NativeMediaPickerModule {
  chooseMedia(options: NativeMediaOptions, callback: (result: NativeMediaResult) => void): void
}
export interface HostMediaOptions {
  count?: number
  mediaType?: NativeMediaType[]
  sourceType?: NativeMediaSource[]
  camera?: 'front' | 'back'
  sizeType?: Array<'original' | 'compressed'>
  compressed?: boolean
  maxDuration?: number
  success?: (result: NativeMediaSuccess) => void
  fail?: (error: { errMsg: string; code?: string }) => void
}
export interface MediaPickerHost {
  chooseMedia(options: HostMediaOptions): void
}

function unique<T extends string>(values: readonly T[] | undefined, allowed: readonly T[], fallback: T[]): T[] {
  if (!Array.isArray(values)) return fallback
  const result = [...new Set(values.filter(value => allowed.includes(value)))]
  return result.length ? result : fallback
}
export function normalizeNativeMediaOptions(options: HostMediaOptions): NativeMediaOptions {
  const rawCount = Number(options.count)
  const count = Number.isFinite(rawCount) && rawCount > 0 ? Math.min(50, Math.max(1, Math.floor(rawCount))) : 9
  const duration = Number(options.maxDuration)
  return {
    count,
    multiple: count > 1,
    mediaType: unique(options.mediaType, ['image', 'video'], ['image']),
    sourceType: unique(options.sourceType, ['album', 'camera'], ['album', 'camera']),
    camera: options.camera === 'front' ? 'front' : 'back',
    sizeType: unique(options.sizeType, ['original', 'compressed'], ['original']),
    compressed: options.compressed === true,
    maxDuration: Number.isFinite(duration) && duration > 0 ? duration : 60
  }
}

function validFile(file: unknown): file is NativePickedMedia {
  if (!file || typeof file !== 'object') return false
  const value = file as Partial<NativePickedMedia>
  return (value.fileType === 'image' || value.fileType === 'video') &&
    typeof value.tempFilePath === 'string' && value.tempFilePath.length > 0 &&
    !/^content:|^blob:|fakepath/i.test(value.tempFilePath) &&
    Number.isFinite(value.size) && Number(value.size) >= 0
}

/** Adapts the real Native Module ABI to Upload's established success/fail callbacks. */
export function createNativeMediaPickerHost(module: NativeMediaPickerModule): MediaPickerHost {
  return {
    chooseMedia(options) {
      const request = normalizeNativeMediaOptions(options)
      let settled = false
      const receive = (result: NativeMediaResult) => {
        if (settled) return
        settled = true
        if (result?.success === true && Array.isArray(result.tempFiles) &&
          result.tempFiles.length > 0 && result.tempFiles.every(validFile)) {
          options.success?.({ success: true, tempFiles: result.tempFiles.slice(0, request.count) })
        } else if (result?.success === false) {
          options.fail?.({ errMsg: result.errMsg || 'chooseMedia:fail native picker failed', code: result.code })
        } else {
          options.fail?.({ errMsg: 'chooseMedia:fail invalid native media response', code: 'invalid_response' })
        }
      }
      try {
        module.chooseMedia(request, receive)
      } catch (error) {
        if (settled) return
        settled = true
        options.fail?.({ errMsg: error instanceof Error ? error.message : String(error), code: 'native_exception' })
      }
    }
  }
}

/** Derived at call time: installing or registering a native module can add the capability later. */
export function getNativeMediaPickerHost(): MediaPickerHost | undefined {
  const module = getNativeModule<NativeMediaPickerModule>(NATIVE_MEDIA_PICKER_NAME)
  return module && typeof module.chooseMedia === 'function' ? createNativeMediaPickerHost(module) : undefined
}

/** Preserve all existing host methods and their receiver; add only a missing media chooser. */
export function supplementMediaPicker<T extends object>(host: T, media: MediaPickerHost): T & MediaPickerHost {
  const bound = new Map<PropertyKey, { value: unknown; method: unknown }>()
  return new Proxy({} as T & MediaPickerHost, {
    get(_target, property) {
      if (property === 'chooseMedia') return media.chooseMedia
      const value = Reflect.get(host, property, host)
      if (typeof value !== 'function') return value
      const existing = bound.get(property)
      if (existing && existing.value === value) return existing.method
      const method = value.bind(host)
      bound.set(property, { value, method })
      return method
    },
    has(_target, property) { return property === 'chooseMedia' || property in host },
    ownKeys() { return [...new Set([...Reflect.ownKeys(host), 'chooseMedia'])] },
    getOwnPropertyDescriptor(_target, property) {
      if (property === 'chooseMedia' || property in host) return { configurable: true, enumerable: true }
      return undefined
    }
  })
}
