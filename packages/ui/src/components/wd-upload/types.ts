import type { ComponentPublicInstance, ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeArrayProp, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'
import type {
  ChooseFile,
  ChooseFileOption,
  UploadFileItem,
  UploadFormData,
  UploadMethod,
  UploadSourceType,
  UploadStatusType,
  UploadSuccessStatus
} from '../../composables/useUpload'
import type { LoadingType } from '../wd-loading/types'

// 兼容历史从 wd-upload/types 深度导入的用法
export type { ChooseFile, ChooseFileOption, UploadFileItem, UploadMethod, UploadStatusType, UploadSuccessStatus }

export type UploadFile = UploadFileItem

export type UploadBeforeUpload = (file: UploadFileItem, formData: UploadFormData) => boolean | Promise<boolean>

export type UploadBeforeChoose = (options: ChooseFileOption) => boolean | Promise<boolean>

export type UploadBeforeRemove = (file: UploadFileItem, fileList: UploadFileItem[]) => boolean | Promise<boolean>

export type UploadBeforePreview = (options: { file: UploadFileItem; index: number }) => boolean | Promise<boolean>

export type UploadOnPreviewFail = (file: UploadFileItem) => void

export type UploadBuildFormData = (options: { file: UploadFileItem; formData: UploadFormData }) => UploadFormData | Promise<UploadFormData>

export type UploadErrorEvent = { file: UploadFileItem; error: any }
export type UploadChangeEvent = { fileList: UploadFileItem[] }
export type UploadSuccessEvent = { file: UploadFileItem; response: any; formData: UploadFormData }
export type UploadProgressEvent = { file: UploadFileItem; progress: number }
export type UploadOversizeEvent = { file: UploadFileItem; maxSize: number }
export type UploadRemoveEvent = { file: UploadFileItem; index: number; fileList: UploadFileItem[] }

export type UploadExpose = {
  submit: () => void
  abort: () => void
}

export const uploadProps = {
  ...baseProps,
  /**
   * 文件列表（受控）
   */
  fileList: makeArrayProp<UploadFile>(),
  /**
   * 上传地址
   */
  action: makeStringProp(''),
  /**
   * 请求头
   */
  header: { type: Object as PropType<Record<string, any>>, default: () => ({}) },
  /**
   * 是否多选
   */
  multiple: makeBooleanProp(false),
  /**
   * 是否禁用
   */
  disabled: makeBooleanProp(false),
  /**
   * 最大上传数量
   */
  limit: Number,
  /**
   * 是否显示数量提示
   */
  showLimitNum: makeBooleanProp(true),
  /**
   * 单文件最大体积（字节）
   */
  maxSize: makeNumberProp(Number.MAX_VALUE),
  /**
   * 选择文件来源
   */
  sourceType: {
    type: Array as PropType<UploadSourceType[]>,
    default: () => ['album', 'camera']
  },
  /**
   * 图片尺寸类型
   */
  sizeType: {
    type: Array as PropType<Array<'original' | 'compressed'>>,
    default: () => ['original', 'compressed']
  },
  /**
   * 文件对应的 key
   */
  name: makeStringProp('file'),
  /**
   * 其它表单数据
   */
  formData: { type: Object as PropType<UploadFormData>, default: () => ({}) },
  /**
   * 预览失败回调
   */
  onPreviewFail: Function as PropType<UploadOnPreviewFail>,
  /**
   * 上传前拦截
   */
  beforeUpload: Function as PropType<UploadBeforeUpload>,
  /**
   * 选择前拦截
   */
  beforeChoose: Function as PropType<UploadBeforeChoose>,
  /**
   * 删除前拦截
   */
  beforeRemove: Function as PropType<UploadBeforeRemove>,
  /**
   * 预览前拦截
   */
  beforePreview: Function as PropType<UploadBeforePreview>,
  /**
   * 构造表单数据
   */
  buildFormData: Function as PropType<UploadBuildFormData>,
  /**
   * 加载类型
   */
  loadingType: makeStringProp<LoadingType>('circular'),
  /**
   * 接受的文件类型
   */
  accept: makeStringProp<'image' | 'video' | 'media' | 'all' | 'file'>('image'),
  /**
   * 成功状态码
   */
  successStatus: makeNumberProp(200),
  /**
   * 文件状态 key
   */
  statusKey: makeStringProp('status'),
  /**
   * 自定义上传方法
   */
  uploadMethod: Function as PropType<UploadMethod>,
  /**
   * 图片裁剪模式
   */
  imageMode: makeStringProp('aspectFit'),
  /**
   * 预览列表自定义类名
   */
  customPreviewClass: makeStringProp('')
}

export type UploadProps = ExtractPropTypes<typeof uploadProps>

export type UploadInstance = ComponentPublicInstance<UploadProps, UploadExpose>
