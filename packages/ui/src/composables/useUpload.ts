/**
 * 上传组合式函数（原生宿主能力版）。
 *
 * ADR-022 移除了 uni-app 兼容层：媒体选择与上传不再走 `uni.chooseMedia` /
 * `uni.uploadFile`，而是走 Lynx 宿主原生模块（`NativeModules.WotLynxUI` /
 * `lynx.getJSModule('WotLynxUI')`，或 Web/测试环境用 `configureHost` 注入）。
 *
 * 宿主未注册对应能力时，Promise 以可诊断的 `errMsg` 失败——不伪造成功，
 * 也不返回空任务对象。
 */
import { getHost } from '../common/host'
import { isArray, isDef, isFunction } from '../common/util'

/* ===== 上传相关类型契约（composable 层自有，wd-upload 组件从这里导入） ===== */

export type UploadSourceType = 'album' | 'camera'
export type UploadSizeType = 'original' | 'compressed'
export type UploadFileType = 'image' | 'video' | 'media' | 'all' | 'file'
export type UploadCameraType = 'front' | 'back'
export type UploadStatusType = 'pending' | 'loading' | 'success' | 'fail'
export type UploadSuccessStatus = number | number[]

export interface UploadFormData {
  [key: string]: any
}

export interface ChooseFileOption {
  // 是否支持多选文件
  multiple?: boolean
  // 所选的图片的尺寸
  sizeType?: UploadSizeType[]
  // 选择文件的来源
  sourceType?: UploadSourceType[]
  // 最大允许上传个数
  maxCount?: number
  // 接受文件类型
  accept?: UploadFileType
  // 是否压缩视频，当 accept 为 video 时生效
  compressed?: boolean
  // 拍摄视频最长拍摄时间，当 accept 为 video | media 时生效，单位秒
  maxDuration?: number
  // 使用前置或者后置相机，可选值为：back｜front
  camera?: UploadCameraType
  // 根据文件拓展名过滤，每一项都不能是空字符串, 默认不过滤，例如: ['.jpg']
  extension?: string[]
}

export type UploadFileItem = {
  [key: string]: any
  // 当前上传文件在列表中的唯一标识
  uid: number
  // 缩略图地址
  thumb?: string
  // 当前文件名称
  name?: string
  // 上传状态。若自定义了 statusKey，应取对应字段
  status?: UploadStatusType
  // 文件大小
  size?: number
  // 上传图片/视频的本地地址
  url: string
  // 上传进度
  percent?: number
  // 后端返回的内容，可能是对象，也可能是字符串
  response?: string | Record<string, any>
}

export interface ChooseFile {
  path: string // 上传临时地址
  size?: number // 上传大小
  name?: string // 当前文件名称
  type: 'image' | 'video' | 'file' // 上传类型
  duration?: number // 上传时间
  thumb?: string // 缩略图地址
}

/** 宿主上传成功回执。 */
export interface UploadSuccessResult {
  data: string
  statusCode: number
  errMsg?: string
  [key: string]: any
}

/** 宿主上传失败回执。 */
export interface UploadErrorResult {
  errMsg: string
  [key: string]: any
}

/** 宿主上传进度。 */
export interface UploadProgressResult {
  progress: number
  totalBytesSent?: number
  totalBytesExpectedToSend?: number
  [key: string]: any
}

/** 宿主上传任务（只需支持中断与进度订阅）。 */
export interface UploadTask {
  abort?: () => void
  onProgressUpdate?: (callback: (result: UploadProgressResult) => void) => void
  [key: string]: any
}

export type UploadMethod = (
  uploadFile: UploadFileItem,
  formData: UploadFormData,
  options: {
    action: string
    header: Record<string, any>
    name: string
    fileName: string
    fileType: 'image' | 'video' | 'audio'
    statusCode: UploadSuccessStatus
    // 是否自动中断之前的上传任务
    abortPrevious?: boolean
    onSuccess: (
      res: UploadSuccessResult,
      file: UploadFileItem,
      formData: UploadFormData
    ) => void
    onError: (res: UploadErrorResult, file: UploadFileItem, formData: UploadFormData) => void
    onProgress: (res: UploadProgressResult, file: UploadFileItem) => void
  }
) => UploadTask | void | Promise<void>

export const UPLOAD_STATUS: Record<string, UploadStatusType> = {
  PENDING: 'pending',
  LOADING: 'loading',
  SUCCESS: 'success',
  FAIL: 'fail'
}

export interface UseUploadReturn {
  // 开始上传文件
  startUpload: (file: UploadFileItem, options: UseUploadOptions) => UploadTask | void | Promise<void>
  // 中断上传
  abort: (task?: UploadTask) => void
  // 上传状态常量
  UPLOAD_STATUS: Record<string, UploadStatusType>
  // 选择文件
  chooseFile: (options: ChooseFileOption) => Promise<ChooseFile[]>
}

export interface UseUploadOptions {
  // 上传地址
  action: string
  // 请求头
  header?: Record<string, any>
  // 文件对应的 key
  name?: string
  // 其它表单数据
  formData?: Record<string, any>
  // 文件类型
  fileType?: 'image' | 'video' | 'audio'
  // 成功状态码
  statusCode?: UploadSuccessStatus
  // 文件状态的key
  statusKey?: string
  // 自定义上传方法
  uploadMethod?: UploadMethod
  // 上传成功回调
  onSuccess?: (res: UploadSuccessResult, file: UploadFileItem, formData: Record<string, any>) => void
  // 上传失败回调
  onError?: (res: UploadErrorResult, file: UploadFileItem, formData: Record<string, any>) => void
  // 上传进度回调
  onProgress?: (res: UploadProgressResult, file: UploadFileItem) => void
  // 是否自动中断之前的上传任务
  abortPrevious?: boolean
  // 根据文件拓展名过滤
  extension?: string[]
}

function unsupported(api: string): Error {
  return new Error(`[wot-lynx-ui] 宿主未注册 ${api} 能力（Native Module / JS Module 的 WotLynxUI）`)
}

export function useUpload(): UseUploadReturn {
  let currentTask: UploadTask | null = null

  // 中断上传
  const abort = (task?: UploadTask) => {
    if (task) {
      task.abort?.()
    } else if (currentTask) {
      currentTask.abort?.()
      currentTask = null
    }
  }

  /**
   * 默认上传方法：宿主原生模块 `uploadFile`。
   */
  const defaultUpload: UploadMethod = (file, formData, options) => {
    const host = getHost()
    if (typeof host.uploadFile !== 'function') {
      const failure = { errMsg: unsupported('uploadFile').message }
      options.onError(failure, file, formData)
      return
    }
    const uploadTask = host.uploadFile({
      url: options.action,
      header: options.header,
      name: options.name,
      fileName: options.name,
      fileType: options.fileType,
      formData,
      filePath: file.url,
      success(res: any) {
        const successStatus = options.statusCode
        const isSuccess = isArray(successStatus) ? successStatus.includes(res.statusCode) : res.statusCode === successStatus
        if (isSuccess) {
          // 上传成功
          options.onSuccess(res, file, formData)
        } else {
          // 上传失败
          options.onError({ ...res, errMsg: res.errMsg || '' }, file, formData)
        }
      },
      fail(err: any) {
        // 上传失败
        options.onError(err, file, formData)
      }
    })

    // 宿主未返回任务对象时允许调用方继续（多选时不会阻断同批其它文件）。
    uploadTask?.onProgressUpdate?.((res: UploadProgressResult) => {
      options.onProgress(res, file)
    })

    // 返回上传任务实例,让外部可以控制上传过程
    return uploadTask
  }

  /**
   * 开始上传文件
   */
  const startUpload = (file: UploadFileItem, options: UseUploadOptions) => {
    const {
      uploadMethod,
      formData = {},
      action,
      name = 'file',
      header = {},
      fileType = 'image',
      statusCode = 200,
      statusKey = 'status',
      abortPrevious = false
    } = options

    // 设置上传中状态
    file[statusKey] = UPLOAD_STATUS.LOADING

    let task: UploadTask | null = null
    let settled = false
    if (abortPrevious) abort()
    const clearTask = () => {
      settled = true
      if (currentTask === task) currentTask = null
    }
    const uploadOptions = {
      action,
      header,
      name,
      fileName: name,
      fileType,
      statusCode,
      abortPrevious,
      onSuccess: (res: UploadSuccessResult, file: UploadFileItem, formData: Record<string, any>) => {
        // 更新文件状态
        file[statusKey] = UPLOAD_STATUS.SUCCESS
        clearTask()
        options.onSuccess?.(res, file, formData)
      },
      onError: (error: UploadErrorResult, file: UploadFileItem, formData: Record<string, any>) => {
        // 更新文件状态和错误信息
        file[statusKey] = UPLOAD_STATUS.FAIL
        file.error = error.errMsg
        clearTask()
        options.onError?.(error, file, formData)
      },
      onProgress: (res: UploadProgressResult, file: UploadFileItem) => {
        // 更新上传进度
        file.percent = res.progress
        options.onProgress?.(res, file)
      }
    }

    // 返回上传任务实例,支持外部获取uploadTask进行操作
    const result = isFunction(uploadMethod)
      ? uploadMethod(file, formData, uploadOptions)
      : defaultUpload(file, formData, uploadOptions)
    if (result && typeof (result as UploadTask).abort === 'function' && !settled) {
      task = result as UploadTask
      currentTask = task
    }
    return result
  }

  /**
   * 格式化图片信息
   */
  function formatImage(res: any): ChooseFile[] {
    // 宿主可能把文件放在 files 字段（部分平台差异），保留防御性赋值。
    const files = isDef(res?.files) ? res.files : res?.tempFiles
    if (isArray(files)) {
      return files.map((item: any) => ({
        path: item.path || item.tempFilePath || '',
        name: item.name || '',
        size: item.size,
        type: 'image' as ChooseFile['type'],
        thumb: item.path || item.tempFilePath || ''
      }))
    }
    return [{
      path: files?.path || '',
      name: files?.name || '',
      size: files?.size,
      type: 'image',
      thumb: files?.path || ''
    }]
  }

  /**
   * 格式化视频信息
   */
  function formatVideo(res: any): ChooseFile[] {
    return [{
      path: res.tempFilePath || res.filePath || '',
      name: res.name || '',
      size: res.size,
      type: 'video',
      thumb: res.thumbTempFilePath || '',
      duration: res.duration
    }]
  }

  /**
   * 格式化媒体信息
   */
  function formatMedia(res: any): ChooseFile[] {
    const files = isArray(res?.tempFiles) ? res.tempFiles : []
    return files.map((item: any) => ({
      type: item.fileType,
      path: item.tempFilePath,
      thumb: item.fileType === 'video' ? item.thumbTempFilePath : item.tempFilePath,
      size: item.size,
      duration: item.duration
    }))
  }

  /**
   * 选择文件：宿主原生模块 `chooseMedia` / `chooseMessageFile` / `chooseFile`。
   */
  function chooseFile({
    accept,
    multiple,
    sizeType,
    sourceType,
    maxDuration,
    camera,
    compressed,
    maxCount,
    extension
  }: ChooseFileOption): Promise<ChooseFile[]> {
    return new Promise((resolve, reject) => {
      const host = getHost()
      const count = multiple ? maxCount : 1
      const fail = (error: any) => reject(error)
      const api = accept === 'file'
        ? 'chooseMessageFile'
        : (accept === 'all' ? 'chooseFile' : 'chooseMedia')
      const handler = host[api]
      if (typeof handler !== 'function') {
        reject(unsupported(api))
        return
      }
      switch (accept) {
        case 'image':
          handler({ count, mediaType: ['image'], sourceType, sizeType, camera, success: (res: any) => resolve(formatMedia(res)), fail })
          break
        case 'video':
          handler({ count, mediaType: ['video'], sourceType, camera, maxDuration, success: (res: any) => resolve(formatMedia(res)), fail })
          break
        case 'media':
          handler({ count, sourceType, sizeType, camera, maxDuration, compressed, success: (res: any) => resolve(formatMedia(res)), fail })
          break
        case 'file':
          handler({ count: multiple ? (isDef(maxCount) ? maxCount : 100) : 1, type: accept, extension, success: (res: any) => resolve(res.tempFiles), fail })
          break
        case 'all':
          handler({ count, type: accept, extension, success: (res: any) => resolve(res.tempFiles as ChooseFile[]), fail })
          break
        default:
          handler({ count, mediaType: ['image'], sourceType, sizeType, camera, success: (res: any) => resolve(formatMedia(res)), fail })
          break
      }
    })
  }

  return {
    startUpload,
    abort,
    UPLOAD_STATUS,
    chooseFile
  }
}
