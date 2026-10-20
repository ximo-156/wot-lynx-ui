import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

/**
 * 地址信息
 */
export type AddressInfo = {
  /**
   * 联系人姓名
   */
  name: string
  /**
   * 联系电话
   */
  tel: string
  /**
   * 省
   */
  province?: string
  /**
   * 市
   */
  city?: string
  /**
   * 区/县
   */
  county?: string
  /**
   * 详细地址
   */
  addressDetail?: string
  /**
   * 地区编码
   */
  areaCode?: string
  /**
   * 邮政编码
   */
  postalCode?: string
  /**
   * 是否默认地址
   */
  isDefault?: boolean
  /**
   * 未尽字段
   */
  [key: string]: any
}

export const addressEditProps = {
  ...baseProps,
  /**
   * 地址信息
   * 类型: AddressInfo
   * 默认值: {}
   */
  addressInfo: {
    type: Object as () => AddressInfo,
    default: () => ({})
  },
  /**
   * 是否显示保存按钮
   * 类型: boolean
   * 默认值: true
   */
  showSaveButton: makeBooleanProp(true),
  /**
   * 保存按钮文字
   * 类型: string
   * 默认值: '保存'
   */
  saveButtonText: makeStringProp('保存'),
  /**
   * 删除按钮文字
   * 类型: string
   * 默认值: '删除'
   */
  deleteButtonText: makeStringProp('删除'),
  /**
   * 是否显示删除按钮
   * 类型: boolean
   * 默认值: false
   */
  showDeleteButton: makeBooleanProp(false),
  /**
   * 是否显示设置默认地址开关
   * 类型: boolean
   * 默认值: true
   */
  showSetDefault: makeBooleanProp(true),
  /**
   * 是否显示邮政编码输入
   * 类型: boolean
   * 默认值: false
   */
  showPostalCode: makeBooleanProp(false),
  /**
   * 是否显示地区编码输入
   * 类型: boolean
   * 默认值: false
   */
  showAreaCode: makeBooleanProp(false),
  /**
   * 搜索框占位符
   * 类型: string
   * 默认值: '搜索地区'
   */
  searchPlaceholder: makeStringProp('搜索地区'),
  /**
   * 是否显示搜索结果
   * 类型: boolean
   * 默认值: false
   */
  showSearchResult: makeBooleanProp(false),
  /**
   * 地址数据（省市区列表）
   * 类型: any[]
   * 默认值: []
   */
  areaList: {
    type: Array as () => any[],
    default: () => []
  },
  /**
   * 是否显示详细地址输入
   * 类型: boolean
   * 默认值: true
   */
  showDetail: makeBooleanProp(true),
  /**
   * 详细地址最大长度
   * 类型: number
   * 默认值: 200
   */
  detailMaxlength: makeNumberProp(200),
  /**
   * 是否禁用表单
   * 类型: boolean
   * 默认值: false
   */
  disabled: makeBooleanProp(false),
  /**
   * 地址列数
   * 类型: number
   * 默认值: 1
   */
  areaColumns: makeNumberProp(1)
}

export type AddressEditProps = ExtractPropTypes<typeof addressEditProps>
