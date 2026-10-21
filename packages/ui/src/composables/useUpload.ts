import { uni } from '../common/uni'
import { isArray, isDef, isFunction } from '../common/util'

/* ===== 上传相关类型契约（composable 层自有，wd-upload 组件从这里导入） ===== */

export type UploadSourceType = 'album' | 'camera'
export type UploadSizeType = 'original' | 'compressed'
export type UploadFileType = 'image' | 'video' | 'media' | 'all' | 'file'
export type UploadCameraType = 'front' | 'back'
export type UploadStatusType = 'pending' | 'loading' | 'success' | 'fail'
export type UploadSuccessStatus = number | number[]
export type UploadFormData = Record<string, any>

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
      res: UniApp.UploadFileSuccessCallbackResult,
      file: UploadFileItem,
      formData: UploadFormData
    ) => void
    onError: (res: UniApp.GeneralCallbackResult, file: UploadFileItem, formData: UploadFormData) => void
    onProgress: (res: UniApp.OnProgressUpdateResult, file: UploadFileItem) => void
  }
) => UniApp.UploadTask | void | Promise<void>

export const UPLOAD_STATUS: Record<string, UploadStatusType> = {
  PENDING: 'pending',
  LOADING: 'loading',
  SUCCESS: 'success',
  FAIL: 'fail'
}

export interface UseUploadReturn {
  // 开始上传文件
  startUpload: (file: UploadFileItem, options: UseUploadOptions) => UniApp.UploadTask | void | Promise<void>
  // 中断上传
  abort: (task?: UniApp.UploadTask) => void
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
  // 文件类型 仅支付宝支持且在支付宝平台必填
  fileType?: 'image' | 'video' | 'audio'
  // 成功状态码
  statusCode?: UploadSuccessStatus
  // 文件状态的key
  statusKey?: string
  // 自定义上传方法
  uploadMethod?: UploadMethod
  // 上传成功回调
  onSuccess?: (res: UniApp.UploadFileSuccessCallbackResult, file: UploadFileItem, formData: Record<string, any>) => void
  // 上传失败回调
  onError?: (res: UniApp.GeneralCallbackResult, file: UploadFileItem, formData: Record<string, any>) => void
  // 上传进度回调
  onProgress?: (res: UniApp.OnProgressUpdateResult, file: UploadFileItem) => void
  // 是否自动中断之前的上传任务
  abortPrevious?: boolean
  // 根据文件拓展名过滤(H5支持全部类型过滤,微信小程序支持all和file时过滤,其余平台不支持)
  extension?: string[]
}

export function useUpload(): UseUploadReturn {
  let currentTask: UniApp.UploadTask | null = null

  // 中断上传
  const abort = (task?: UniApp.UploadTask) => {
    if (task) {
      task.abort()
    } else if (currentTask) {
      currentTask.abort()
      currentTask = null
    }
  }

  /**
   * 默认上传方法
   */
  const defaultUpload: UploadMethod = (file, formData, options) => {
    const uploadTask = uni.uploadFile({
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

    // 获取当前文件加载的百分比。
    // Lynx 适配：宿主未经 configureUniAdapter 注入 uploadFile 时，common/uni
    // 的降级实现返回 undefined（uni-app 中 uploadFile 恒返回任务对象）。
    // 此处必须可选链兜底——否则 startUploadFiles 的 for 循环会在第一个文件处
    // 抛 TypeError，同批其余文件全部无法入列（wd-upload 多选回归）。
    uploadTask?.onProgressUpdate?.((res: any) => {
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

    let task: UniApp.UploadTask | null = null
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
      onSuccess: (res: UniApp.UploadFileSuccessCallbackResult, file: UploadFileItem, formData: Record<string, any>) => {
        // 更新文件状态
        file[statusKey] = UPLOAD_STATUS.SUCCESS
        clearTask()
        options.onSuccess?.(res, file, formData)
      },
      onError: (error: UniApp.GeneralCallbackResult, file: UploadFileItem, formData: Record<string, any>) => {
        // 更新文件状态和错误信息
        file[statusKey] = UPLOAD_STATUS.FAIL
        file.error = error.errMsg
        clearTask()
        options.onError?.(error, file, formData)
      },
      onProgress: (res: UniApp.OnProgressUpdateResult, file: UploadFileItem) => {
        // 更新上传进度
        file.percent = res.progress
        options.onProgress?.(res, file)
      }
    }

    // 返回上传任务实例,支持外部获取uploadTask进行操作
    const result = isFunction(uploadMethod)
      ? uploadMethod(file, formData, uploadOptions)
      : defaultUpload(file, formData, uploadOptions)
    if (result && typeof (result as UniApp.UploadTask).abort === 'function' && !settled) {
      task = result as UniApp.UploadTask
      currentTask = task
    }
    return result
  }

  /**
   * 格式化图片信息
   */
  function formatImage(res: UniApp.ChooseImageSuccessCallbackResult): ChooseFile[] {
    // Lynx 适配：部分平台（如钉钉）文件在 files 字段中，保留防御性赋值，
    // 移除 uni-app 条件编译注释（CONVENTIONS 第 3 节）。
    res.tempFiles = isDef((res as any).files) ? (res as any).files : res.tempFiles
    if (isArray(res.tempFiles)) {
      return res.tempFiles.map((item: any) => ({
        path: item.path || '',
        name: item.name || '',
        size: item.size,
        type: 'image' as ChooseFile['type'],
        thumb: item.path || ''
      }))
    }
    return [
      {
        path: (res.tempFiles as any).path || '',
        name: (res.tempFiles as any).name || '',
        size: (res.tempFiles as any).size,
        type: 'image',
        thumb: (res.tempFiles as any).path || ''
      }
    ]
  }

  /**
   * 格式化视频信息
   */
  function formatVideo(res: UniApp.ChooseVideoSuccess): ChooseFile[] {
    return [
      {
        path: res.tempFilePath || (res as any).filePath || '',
        name: res.name || '',
        size: res.size,
        type: 'video',
        thumb: (res as any).thumbTempFilePath || '',
        duration: res.duration
      }
    ]
  }

  /**
   * 格式化媒体信息
   */
  function formatMedia(res: UniApp.ChooseMediaSuccessCallbackResult): ChooseFile[] {
    return res.tempFiles.map((item: any) => ({
      type: item.fileType,
      path: item.tempFilePath,
      thumb: item.fileType === 'video' ? item.thumbTempFilePath : item.tempFilePath,
      size: item.size,
      duration: item.duration
    }))
  }

  /**
   * 选择文件
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
      // Lynx 适配：uni-app 的条件编译分支（MP-WEIXIN / H5 / MP-DINGTALK）全部移除，
      // 统一调用 common/uni 兼容层的 uni.*  API——宿主可通过 configureUniAdapter
      // 注入真实的媒体选择能力；未注入时统一降级（warning + fail 回调）。
      switch (accept) {
        case 'image':
          uni.chooseMedia({
            count: multiple ? maxCount : 1,
            mediaType: ['image'],
            sourceType,
            sizeType,
            camera,
            success: (res: any) => resolve(formatMedia(res)),
            fail: reject
          })
          break
        case 'video':
          uni.chooseMedia({
            count: multiple ? maxCount : 1,
            mediaType: ['video'],
            sourceType,
            camera,
            maxDuration,
            success: (res: any) => resolve(formatMedia(res)),
            fail: reject
          })
          break
        case 'media':
          uni.chooseMedia({
            count: multiple ? maxCount : 1,
            sourceType,
            sizeType,
            camera,
            maxDuration,
            success: (res: any) => resolve(formatMedia(res)),
            fail: reject
          })
          break
        case 'file':
          uni.chooseMessageFile({
            count: multiple ? (isDef(maxCount) ? maxCount : 100) : 1,
            type: accept,
            extension,
            success: (res: any) => resolve(res.tempFiles),
            fail: reject
          })
          break
        case 'all':
          uni.chooseFile({
            count: multiple ? maxCount : 1,
            type: accept,
            extension,
            success: (res: any) => resolve(res.tempFiles as ChooseFile[]),
            fail: reject
          })
          break
        default:
          uni.chooseMedia({
            count: multiple ? maxCount : 1,
            mediaType: ['image'],
            sourceType,
            sizeType,
            camera,
            success: (res: any) => resolve(formatMedia(res)),
            fail: reject
          })
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
