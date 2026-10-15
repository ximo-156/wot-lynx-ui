import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp, numericProp } from '../../common/props'

export type SignatureFileType = 'png' | 'jpg'

export type SignatureEmits = {
  (e: 'confirm', value: { image: string; canvas: null; width: number; height: number }): void
  (e: 'clear'): void
}

export const signatureProps = {
  ...baseProps,
  /**
   * 画笔颜色
   */
  penColor: {
    type: String,
    default: '#171B26'
  },
  /**
   * 笔画宽度
   */
  lineWidth: {
    type: Number,
    default: 3
  },
  /**
   * 确认按钮文字
   */
  confirmText: String,
  /**
   * 清空按钮文字
   */
  clearText: String,
  /**
   * 撤销按钮文字
   */
  revokeText: String,
  /**
   * 恢复按钮文字
   */
  restoreText: String,
  /**
   * 导出文件类型
   */
  fileType: {
    type: String as PropType<SignatureFileType>,
    default: 'png'
  },
  /**
   * 导出质量（0-1）
   */
  quality: {
    type: Number,
    default: 1
  },
  /**
   * 导出缩放
   */
  exportScale: {
    type: Number,
    default: 1
  },
  /**
   * 是否禁用
   */
  disabled: {
    type: Boolean,
    default: false
  },
  /**
   * 画布高度
   */
  height: numericProp,
  /**
   * 画布宽度
   */
  width: numericProp,
  /**
   * 背景色
   */
  backgroundColor: String,
  /**
   * 签名时是否禁止页面滚动
   */
  disableScroll: {
    type: Boolean,
    default: true
  }
}

export type SignatureProps = ExtractPropTypes<typeof signatureProps>

export type SignatureExpose = {
  clear: () => void
  confirm: () => void
  revoke: () => void
  restore: () => void
}
