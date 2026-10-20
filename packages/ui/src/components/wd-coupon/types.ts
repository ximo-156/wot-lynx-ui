import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeArrayProp, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

/**
 * 优惠券数据
 */
export type Coupon = {
  /**
   * 优惠券 ID
   */
  id: string | number
  /**
   * 优惠券名称
   */
  name: string
  /**
   * 优惠金额（面值）
   */
  value: number
  /**
   * 优惠券单位：'yuan' 元 / 'discount' 折
   * 默认: 'yuan'
   */
  unit?: 'yuan' | 'discount'
  /**
   * 使用条件描述
   */
  condition?: string
  /**
   * 有效期描述
   */
  reason?: string
  /**
   * 生效时间戳
   */
  startAt?: number
  /**
   * 失效时间戳
   */
  endAt?: number
  /**
   * 优惠券描述
   */
  valueDesc?: string
  /**
   * 单位描述
   */
  unitDesc?: string
  /**
   * 是否已选中
   * 默认: false
   */
  chosen?: boolean
  /**
   * 是否禁用
   * 默认: false
   */
  disabled?: boolean
  /**
   * 未尽字段
   */
  [key: string]: any
}

export const couponProps = {
  ...baseProps,
  /**
   * 优惠券列表
   * 类型: Coupon[]
   * 默认值: []
   */
  coupons: makeArrayProp<Coupon>(),
  /**
   * 当前选中优惠券索引
   * 类型: number
   * 默认值: -1
   */
  chosenCoupon: makeNumberProp(-1),
  /**
   * 是否显示兑换码输入
   * 类型: boolean
   * 默认值: false
   */
  showExchangeBar: makeBooleanProp(false),
  /**
   * 兑换码输入占位符
   * 类型: string
   * 默认值: '请输入兑换码'
   */
  exchangePlaceholder: makeStringProp('请输入兑换码'),
  /**
   * 兑换按钮文字
   * 类型: string
   * 默认值: '兑换'
   */
  exchangeButtonText: makeStringProp('兑换'),
  /**
   * 禁用优惠券点击
   * 类型: boolean
   * 默认值: false
   */
  disabledCoupons: makeBooleanProp(false),
  /**
   * 兑换码最小长度
   * 类型: number
   * 默认值: 1
   */
  exchangeMinLength: makeNumberProp(1)
}

export type CouponProps = ExtractPropTypes<typeof couponProps>
