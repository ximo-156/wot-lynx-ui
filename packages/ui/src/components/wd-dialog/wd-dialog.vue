<template>
  <WdPopup
    transition="zoom-in"
    v-model="dialogState.show"
    :close-on-click-modal="dialogState.closeOnClickModal"
    :lazy-render="dialogState.lazyRender"
    :lock-scroll="lockScroll"
    custom-class="wd-dialog"
    @click-modal="toggleModal('modal')"
    :z-index="dialogState.zIndex"
    :duration="200"
    :root-portal="rootPortal"
  >
    <view :class="rootClass">
      <WdIcon v-if="dialogState.showClose" custom-class="wd-dialog__close" name="close" :size="18" :color="COOLGREY[6]" @click="toggleModal('close')"></WdIcon>
      <slot name="header" />
      <view :class="bodyClass">
        <slot name="image">
          <image v-if="dialogState.headerImage" mode="widthFix" class="wd-dialog__img" :src="dialogState.headerImage"></image>
        </slot>
        <slot name="title" :icon="dialogState.icon" :title="dialogState.title" :iconProps="dialogState.iconProps">
          <view
            v-if="dialogState.iconProps?.name || dialogState.title"
            :class="`wd-dialog__title${dialogState.headerImage ? ' has-img' : ''}`"
          >
            <WdIcon
              v-if="dialogState.iconProps?.name"
              :custom-class="`wd-dialog__icon ${iconTypeClass}`"
              :name="dialogState.iconProps.name"
              :color="iconColor"
              :size="dialogState.iconProps.size"
            ></WdIcon>
            <text>{{ dialogState.title }}</text>
          </view>
        </slot>
        <view
          :class="`wd-dialog__content${dialogState.headerImage ? ' has-img' : ''}${
            dialogState.iconProps?.name || dialogState.title ? ' has-title' : ''
          }`"
          v-if="dialogState.type === 'prompt' || !!dialogState.msg || $slots.default"
        >
          <slot
            :msg="dialogState.msg"
            :type="dialogState.type"
            :inputValue="inputVal"
            :showErr="dialogState.showErr"
            :inputError="dialogState.inputError"
          >
            <template v-if="dialogState.type === 'prompt'">
              <WdTextarea
                v-if="dialogState.textareaProps"
                v-model="inputVal"
                custom-class="wd-dialog__input"
                v-bind="textareaPropsWithoutModelValue"
              />
              <WdInput v-else v-model="inputVal" custom-class="wd-dialog__input" v-bind="inputPropsWithoutModelValue" />
              <view v-if="dialogState.showErr" class="wd-dialog__input-error">
                <text>{{ dialogState.inputError || translate('inputNoValidate') }}</text>
              </view>
            </template>
            <text v-else class="wd-dialog__content-text"><text>{{ dialogState.msg }}</text></text>
          </slot>
        </view>
      </view>
      <slot name="actions" :confirm="() => toggleModal('confirm')" :cancel="() => toggleModal('cancel')" :close="() => toggleModal('close')">
        <view
          :class="`wd-dialog__actions ${dialogState.actionLayout === 'vertical' ? 'wd-dialog__actions--vertical' : ''} ${
            dialogState.actionLayout === 'vertical' || showCancelButton || (dialogState.actions && dialogState.actions.length > 1)
              ? 'wd-dialog__flex'
              : 'wd-dialog__block'
          } ${dialogState.theme === 'text' ? 'is-text' : ''}`"
        >
          <template v-if="customActions && customActions.length">
            <WdButton
              v-for="(btn, index) in customActions"
              :key="index"
              v-bind="getActionButtonProps(btn, index === customActions.length - 1)"
              @click="handleAction(btn)"
              @getuserinfo="(e: any) => handleOpenTypeEvent(btn, 'onGetuserinfo', e)"
              @contact="(e: any) => handleOpenTypeEvent(btn, 'onContact', e)"
              @getphonenumber="(e: any) => handleOpenTypeEvent(btn, 'onGetphonenumber', e)"
              @getrealtimephonenumber="(e: any) => handleOpenTypeEvent(btn, 'onGetrealtimephonenumber', e)"
              @error="(e: any) => handleOpenTypeEvent(btn, 'onError', e)"
              @launchapp="(e: any) => handleOpenTypeEvent(btn, 'onLaunchapp', e)"
              @opensetting="(e: any) => handleOpenTypeEvent(btn, 'onOpensetting', e)"
              @chooseavatar="(e: any) => handleOpenTypeEvent(btn, 'onChooseavatar', e)"
              @agreeprivacyauthorization="(e: any) => handleOpenTypeEvent(btn, 'onAgreeprivacyauthorization', e)"
              custom-class="wd-dialog__actions-btn"
            >
              <text>{{ btn.text }}</text>
            </WdButton>
          </template>
          <template v-else>
            <WdButton
              v-bind="customCancelProps"
              v-if="showCancelButton"
              @click="toggleModal('cancel')"
              @getuserinfo="(e: any) => handleButtonOpenTypeEvent('cancel', 'onGetuserinfo', e)"
              @contact="(e: any) => handleButtonOpenTypeEvent('cancel', 'onContact', e)"
              @getphonenumber="(e: any) => handleButtonOpenTypeEvent('cancel', 'onGetphonenumber', e)"
              @getrealtimephonenumber="(e: any) => handleButtonOpenTypeEvent('cancel', 'onGetrealtimephonenumber', e)"
              @error="(e: any) => handleButtonOpenTypeEvent('cancel', 'onError', e)"
              @launchapp="(e: any) => handleButtonOpenTypeEvent('cancel', 'onLaunchapp', e)"
              @opensetting="(e: any) => handleButtonOpenTypeEvent('cancel', 'onOpensetting', e)"
              @chooseavatar="(e: any) => handleButtonOpenTypeEvent('cancel', 'onChooseavatar', e)"
              @agreeprivacyauthorization="(e: any) => handleButtonOpenTypeEvent('cancel', 'onAgreeprivacyauthorization', e)"
            >
              <text>{{ getCancelText() }}</text>
            </WdButton>
            <WdButton
              v-bind="customConfirmProps"
              v-if="showConfirmButton"
              @click="toggleModal('confirm')"
              @getuserinfo="(e: any) => handleButtonOpenTypeEvent('confirm', 'onGetuserinfo', e)"
              @contact="(e: any) => handleButtonOpenTypeEvent('confirm', 'onContact', e)"
              @getphonenumber="(e: any) => handleButtonOpenTypeEvent('confirm', 'onGetphonenumber', e)"
              @getrealtimephonenumber="(e: any) => handleButtonOpenTypeEvent('confirm', 'onGetrealtimephonenumber', e)"
              @error="(e: any) => handleButtonOpenTypeEvent('confirm', 'onError', e)"
              @launchapp="(e: any) => handleButtonOpenTypeEvent('confirm', 'onLaunchapp', e)"
              @opensetting="(e: any) => handleButtonOpenTypeEvent('confirm', 'onOpensetting', e)"
              @chooseavatar="(e: any) => handleButtonOpenTypeEvent('confirm', 'onChooseavatar', e)"
              @agreeprivacyauthorization="(e: any) => handleButtonOpenTypeEvent('confirm', 'onAgreeprivacyauthorization', e)"
            >
              <text>{{ getConfirmText() }}</text>
            </WdButton>
          </template>
        </view>
      </slot>
    </view>
  </WdPopup>
</template>
<script setup lang="ts">
import './index.css'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdButton from '../wd-button/wd-button.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdInput from '../wd-input/wd-input.vue'
import WdTextarea from '../wd-textarea/wd-textarea.vue'
import { computed, inject, reactive, ref, watch } from 'vue-lynx'
import {
  dialogProps,
  type DialogBeforeConfirm,
  type DialogOptionsWithCallBack,
  type DialogResult,
  type DialogBuiltinIconType,
  DIALOG_BUILTIN_ICON_MAP,
  type DialogAction,
  type DialogButtonOpenTypeEvents,
  OPEN_TYPE_EVENT_KEYS
} from './types'
import { BLUE, GREEN, ORANGE, RED, COOLGREY } from '../../common/theme'
import { defaultOptions, getDialogDefaultOptionKey } from '.'
import { callInterceptor } from '../../common/interceptor'
import { deepAssign, isDef, isFunction, isObj, isString, isUndefined, omitBy } from '../../common/util'
import { useTranslate } from '../../composables/useTranslate'
import type { ButtonProps, ButtonVariant } from '../wd-button/types'

const props = defineProps(dialogProps)
const emit = defineEmits(['update:modelValue', 'confirm', 'cancel', 'open', 'close'])

const { translate } = useTranslate('dialog')

// 当前图标的内置类型（用于添加 class）
const iconType = ref<string>('')

// 图标类型对应的 class
const iconTypeClass = computed(() => {
  return iconType.value ? `is-${iconType.value}` : ''
})

// 内置类型图标的语义色：Lynx 的 svg content 不继承 CSS currentColor，
// 颜色需经 color prop 显式下发（令牌 JS 常量，与 index.scss 中各 is-* 规则一致）
const DIALOG_BUILTIN_ICON_COLORS: Record<string, string> = {
  success: GREEN[6],
  info: BLUE[6],
  warning: ORANGE[6],
  danger: RED[6]
}

const iconColor = computed(() => {
  if (dialogState.iconProps?.color) return dialogState.iconProps.color
  if (iconType.value) return DIALOG_BUILTIN_ICON_COLORS[iconType.value]
  return undefined
})

const rootClass = computed(() => {
  return `wd-dialog__container ${props.customClass}`
})

const bodyClass = computed(() => {
  return `wd-dialog__body  ${dialogState.type === 'prompt' ? 'is-prompt' : ''}`
})

const messageOptionKey = getDialogDefaultOptionKey(props.selector)
const messageOption = inject(messageOptionKey, ref<DialogOptionsWithCallBack>(defaultOptions)) // message选项

const inputVal = ref<string | number>('') // 输入框当前值

const dialogState = reactive<DialogOptionsWithCallBack>({
  msg: '', // 消息内容
  show: false, // 是否显示弹框
  title: '', // 标题
  closeOnClickModal: false, // 是否支持点击蒙层关闭
  type: 'alert', // 弹框类型
  inputProps: {
    type: 'text',
    modelValue: ''
  }, // 输入框属性
  inputError: '', // 输入框错误提示文案
  showErr: false, // 是否显示错误提示
  zIndex: 99, // 弹窗层级
  lazyRender: true, // 弹层内容懒渲染
  headerImage: '', // 顶部图片
  showClose: false, // 是否显示关闭按钮
  actionLayout: 'horizontal', // 按钮排列方式
  theme: 'button' // 弹窗按钮风格
})

/**
 * 获取确认按钮文本
 * 从 confirmButtonProps 获取（快捷属性已在 index.ts 中合并）
 */
function getConfirmText(): string {
  const { confirmButtonProps } = dialogState
  if (isString(confirmButtonProps)) {
    return confirmButtonProps
  }
  if (isDef(confirmButtonProps) && isObj(confirmButtonProps) && confirmButtonProps.text) {
    return confirmButtonProps.text as string
  }
  return translate('confirm')
}

/**
 * 获取取消按钮文本
 * 从 cancelButtonProps 获取（快捷属性已在 index.ts 中合并）
 */
function getCancelText(): string {
  const { cancelButtonProps } = dialogState
  if (isString(cancelButtonProps)) {
    return cancelButtonProps
  }
  if (isDef(cancelButtonProps) && isObj(cancelButtonProps) && cancelButtonProps.text) {
    return cancelButtonProps.text as string
  }
  return translate('cancel')
}

/**
 * 是否显示取消按钮
 * cancelButtonProps 为 null 时隐藏，有值时显示（快捷属性已在 index.ts 中合并）
 */
const showCancelButton = computed(() => {
  return isDef(dialogState.cancelButtonProps)
})

/**
 * 是否显示确认按钮
 * confirmButtonProps 为 null 时隐藏，其他情况显示
 */
const showConfirmButton = computed(() => {
  return isDef(dialogState.confirmButtonProps)
})

/**
 * 输入框属性（排除 modelValue，避免覆盖 v-model）
 */
const inputPropsWithoutModelValue = computed(() => {
  if (!dialogState.inputProps) return {}
  const { modelValue, ...rest } = dialogState.inputProps
  return rest
})

/**
 * 文本域属性（排除 modelValue，避免覆盖 v-model）
 */
const textareaPropsWithoutModelValue = computed(() => {
  if (!dialogState.textareaProps) return {}
  const { modelValue, ...rest } = dialogState.textareaProps
  return rest
})

/**
 * 自定义 actions 按钮列表（当 theme 为 text 时强制 variant 为 text）
 */
const customActions = computed<DialogAction[]>(() => {
  if (!dialogState.actions || !dialogState.actions.length) return []
  return dialogState.actions.map((action) => {
    if (dialogState.theme === 'text') {
      return { ...action, variant: 'text' as ButtonVariant }
    }
    // HyperOS：对话框操作按钮默认文字按钮风格（主按钮主色、取消/危险操作语义色），
    // 用户显式传入 variant 时优先保留
    return action.variant ? action : ({ ...action, variant: 'text' as ButtonVariant } as DialogAction)
  })
})

/**
 * 从按钮配置中提取用于 v-bind 的 props（排除 openType 事件回调和 click）
 * @param btn 按钮配置
 * @param isLast 是否为最后一个按钮（Lynx 不支持 :last-child，按索引传类名）
 */
function getActionButtonProps(btn: DialogAction, isLast: boolean = false) {
  const result: Record<string, any> = {}
  for (const key in btn) {
    // 排除 openType 事件回调、click 和 text
    if (!OPEN_TYPE_EVENT_KEYS.includes(key as keyof DialogButtonOpenTypeEvents) && key !== 'click' && key !== 'text') {
      result[key] = (btn as any)[key]
    }
  }
  // Lynx 适配：:not(:last-child) 不受支持，is-last 类名按索引生成（CONVENTIONS §4.3）
  result.customClass = `${result.customClass || ''} wd-dialog__actions-btn${isLast ? ' is-last' : ''}`
  return result
}

/**
 * 处理 actions 按钮的 openType 事件
 * @param btn 按钮配置
 * @param eventName 事件名
 * @param event 事件详情
 */
function handleOpenTypeEvent(btn: DialogAction, eventName: keyof DialogButtonOpenTypeEvents, event: any) {
  const handler = btn[eventName]
  if (isFunction(handler)) {
    handler(event)
  }
}

/**
 * 处理确认/取消按钮的 openType 事件
 * @param type 按钮类型
 * @param eventName 事件名
 * @param event 事件详情
 */
function handleButtonOpenTypeEvent(type: 'confirm' | 'cancel', eventName: keyof DialogButtonOpenTypeEvents, event: any) {
  const buttonProps = type === 'confirm' ? dialogState.confirmButtonProps : dialogState.cancelButtonProps
  if (isDef(buttonProps) && isObj(buttonProps)) {
    const handler = (buttonProps as DialogAction)[eventName]
    if (isFunction(handler)) {
      handler(event)
    }
  }
}

/**
 * 确认按钮属性
 */
const customConfirmProps = computed(() => {
  const defaultProps: Partial<ButtonProps> = {
    block: true,
    // HyperOS：对话框主按钮为文字按钮风格，文字取主色（wd-button text 变体 + primary 类型）
    variant: 'text'
  }
  let buttonProps: Partial<ButtonProps> = { ...defaultProps }

  const { confirmButtonProps } = dialogState

  if (isDef(confirmButtonProps) && isObj(confirmButtonProps)) {
    // 从 confirmButtonProps 中排除 text 属性（text 单独处理为按钮文本）
    const { text, ...restProps } = confirmButtonProps
    buttonProps = deepAssign(buttonProps, omitBy(restProps, isUndefined))
  }

  // 当 theme 为 text 时，强制 variant 为 text，优先于用户传入的类型
  if (dialogState.theme === 'text') {
    buttonProps.variant = 'text'
  }

  buttonProps.customClass = `${buttonProps.customClass || ''} wd-dialog__actions-btn wd-dialog__actions-btn--confirm is-last`
  return buttonProps
})

/**
 * 取消按钮属性
 */
const customCancelProps = computed(() => {
  const defaultProps: Partial<ButtonProps> = {
    block: true,
    type: 'info',
    // HyperOS：对话框取消按钮为文字按钮风格，文字取次要语义色（见 index.scss --cancel 规则）
    variant: 'text'
  }
  let buttonProps: Partial<ButtonProps> = { ...defaultProps }

  const { cancelButtonProps } = dialogState

  if (isDef(cancelButtonProps) && isObj(cancelButtonProps)) {
    // 从 cancelButtonProps 中排除 text 属性（text 单独处理为按钮文本）
    const { text, ...restProps } = cancelButtonProps
    buttonProps = deepAssign(buttonProps, omitBy(restProps, isUndefined))
  }

  // 当 theme 为 text 时，强制 variant 为 text，优先于用户传入的类型
  if (dialogState.theme === 'text') {
    buttonProps.variant = 'text'
  }

  buttonProps.customClass = `${buttonProps.customClass || ''} wd-dialog__actions-btn wd-dialog__actions-btn--cancel${
    showConfirmButton ? '' : ' is-last'
  }`
  return buttonProps
})

// 监听options变化展示
watch(
  () => messageOption.value,
  (newVal: DialogOptionsWithCallBack) => {
    reset(newVal)
  },
  {
    deep: true,
    immediate: true
  }
)

// 声明式用法（v-model + props）：props 变化同步进 dialogState。
//
// Lynx/vue-lynx 适配要点：wd-dialog 必须自行声明 modelValue prop 并消费。
// 若未声明，父级 v-model 的 modelValue/onUpdate:modelValue 会经 $attrs
// 穿透到根节点 WdPopup（WdPopup 声明了同名 prop），attrs 合并时会覆盖
// 模板自身的 :model-value="dialogState.show" 绑定——弹层显隐被父级 ref
// 独占，点击确定只改 dialogState.show 无法关闭弹层，title/msg 等 props
// 也不会生效。参考 wd-action-sheet 的 modelValue 同步模式。
//
// 注册顺序须在 messageOption 的 watch 之后：immediate 时 props 覆盖命令式
// 默认值；命令式 useDialog 用法下 props 不变化，不会干扰 reset() 的状态应用。
watch(
  () => [
    props.modelValue,
    props.title,
    props.msg,
    props.type,
    props.theme,
    props.zIndex,
    props.lazyRender,
    props.closeOnClickModal,
    props.showClose,
    props.actionLayout,
    props.headerImage,
    props.icon,
    props.iconColor,
    props.iconProps,
    props.inputProps,
    props.textareaProps,
    props.inputPattern,
    props.inputValidate,
    props.inputError,
    props.showErr,
    props.beforeConfirm,
    props.showCancelButton,
    props.showConfirmButton,
    props.confirmButtonText,
    props.cancelButtonText,
    props.confirmButtonProps,
    props.cancelButtonProps,
    props.actions
  ],
  () => {
    syncFromProps()
  },
  { immediate: true }
)

watch(
  () => dialogState.show,
  (newValue) => {
    resetErr(!!newValue)
    // 显隐变化对外通知：open/close 事件 + v-model 同步（命令式用法无监听方时为无副作用调用）
    emit(newValue ? 'open' : 'close')
    emit('update:modelValue', newValue)
  },
  {
    deep: true,
    immediate: true
  }
)

/**
 * 声明式用法：把 props 同步进 dialogState（与 reset() 的命令式字段保持一致）。
 * 按钮配置按 wot-ui useDialog 的 normalizeButtonProps 语义推导：
 * 显式配置 > 快捷文本 > showCancelButton/showConfirmButton > type 推导。
 */
function syncFromProps() {
  dialogState.show = props.modelValue
  dialogState.title = props.title
  dialogState.msg = props.msg
  dialogState.type = props.type
  dialogState.theme = props.theme
  dialogState.zIndex = props.zIndex
  dialogState.lazyRender = props.lazyRender
  dialogState.closeOnClickModal = props.closeOnClickModal
  dialogState.showClose = props.showClose
  dialogState.actionLayout = props.actionLayout
  dialogState.headerImage = props.headerImage
  dialogState.inputError = props.inputError
  dialogState.showErr = props.showErr
  dialogState.inputPattern = props.inputPattern
  dialogState.inputValidate = props.inputValidate
  dialogState.beforeConfirm = props.beforeConfirm
  if (isDef(props.inputProps)) {
    dialogState.inputProps = props.inputProps
  }
  if (isDef(props.textareaProps)) {
    dialogState.textareaProps = props.textareaProps
  }
  // 初始化 inputVal，优先级：inputValue > textareaProps.modelValue > inputProps.modelValue
  if (isDef(props.inputValue)) {
    inputVal.value = props.inputValue!
  } else if (props.textareaProps && isDef(props.textareaProps.modelValue)) {
    inputVal.value = props.textareaProps.modelValue!
  } else if (props.inputProps && isDef(props.inputProps.modelValue)) {
    inputVal.value = props.inputProps.modelValue!
  } else {
    inputVal.value = ''
  }

  // 图标快捷属性合并进 iconProps（与 useDialog 的 normalizeIconProps 一致），
  // 内置类型图标名映射为内置图标
  let iconProps = props.iconProps
  if (props.icon || props.iconColor) {
    iconProps = { ...iconProps }
    if (props.icon) iconProps.name = props.icon
    if (props.iconColor) iconProps.color = props.iconColor
  }
  const iconName = iconProps?.name
  if (iconName && iconName in DIALOG_BUILTIN_ICON_MAP) {
    dialogState.iconProps = { ...iconProps, name: DIALOG_BUILTIN_ICON_MAP[iconName as DialogBuiltinIconType] }
    iconType.value = iconName
  } else {
    dialogState.iconProps = iconProps
    iconType.value = ''
  }

  // 自定义操作按钮
  dialogState.actions = props.actions

  normalizeDeclarativeButtonProps()
}

/**
 * 声明式用法：按钮配置推导（语义与 useDialog 的 normalizeButtonProps 一致）
 * - confirmButtonProps/cancelButtonProps 为 null 时隐藏对应按钮
 * - confirmButtonText/cancelButtonText 快捷文本优先合并
 * - 均未配置时：确认按钮默认显示，取消按钮按 showCancelButton 或 type 推导
 *   （alert 隐藏，confirm/prompt 显示）
 */
function normalizeDeclarativeButtonProps() {
  const { confirmButtonText, cancelButtonText } = props

  // 确认按钮
  if (props.confirmButtonProps === null) {
    dialogState.confirmButtonProps = null
  } else if (isDef(confirmButtonText)) {
    dialogState.confirmButtonProps = isObj(props.confirmButtonProps)
      ? { ...props.confirmButtonProps, text: confirmButtonText }
      : { text: confirmButtonText }
  } else {
    dialogState.confirmButtonProps = props.showConfirmButton === false ? null : (props.confirmButtonProps ?? {})
  }

  // 取消按钮
  if (props.cancelButtonProps === null) {
    dialogState.cancelButtonProps = null
  } else if (isDef(cancelButtonText)) {
    dialogState.cancelButtonProps = isObj(props.cancelButtonProps)
      ? { ...props.cancelButtonProps, text: cancelButtonText }
      : { text: cancelButtonText }
  } else {
    const showCancel = isDef(props.showCancelButton)
      ? props.showCancelButton
      : isDef(props.cancelButtonProps) || dialogState.type === 'confirm' || dialogState.type === 'prompt'
    dialogState.cancelButtonProps = showCancel ? (props.cancelButtonProps ?? {}) : null
  }
}

/**
 * 点击操作
 * @param action
 */
function toggleModal(action: 'confirm' | 'cancel' | 'modal' | 'close') {
  if (action === 'modal' && !dialogState.closeOnClickModal) {
    return
  }
  if (dialogState.type === 'prompt' && action === 'confirm' && !validate()) {
    return
  }
  switch (action) {
    case 'confirm':
      if (dialogState.beforeConfirm) {
        callInterceptor(dialogState.beforeConfirm as DialogBeforeConfirm, {
          args: [inputVal.value],
          done: () =>
            handleConfirm({
              action: action,
              value: inputVal.value
            })
        })
      } else {
        handleConfirm({
          action: action,
          value: inputVal.value
        })
      }
      break
    case 'cancel':
      handleCancel({
        action: action
      })
      break
    case 'modal':
    case 'close':
      handleCancel({
        action: action
      })
      break
  }
}

/**
 * @description 处理自定义动作按钮点击
 * @param action 按钮配置
 * @param index 索引
 */
function handleAction(action: DialogAction) {
  if (action.disabled || action.loading) return

  if (isFunction(action.click)) {
    action.click()
  }

  handleConfirm({
    action: 'confirm',
    value: inputVal.value
  })
}

/**
 * 确认回调
 * @param result
 */
function handleConfirm(result: DialogResult) {
  dialogState.show = false
  emit('confirm', result)
  if (isFunction(dialogState.success)) {
    dialogState.success(result)
  }
}

/**
 * 取消回调
 * @param result
 */
function handleCancel(result: DialogResult) {
  dialogState.show = false
  // 仅点击取消按钮时触发 cancel 事件；点击蒙层/关闭按钮归入 close 事件（见 show watch）
  if (result.action === 'cancel') {
    emit('cancel', result)
  }
  if (isFunction(dialogState.fail)) {
    dialogState.fail(result)
  }
}

/**
 * 如果存在校验规则行为，则进行判断校验是否通过规则。默认不存在校验直接铜鼓。
 */
function validate() {
  if (dialogState.inputPattern && !dialogState.inputPattern.test(String(inputVal.value))) {
    dialogState.showErr = true
    return false
  }
  if (isFunction(dialogState.inputValidate)) {
    const validateResult = dialogState.inputValidate(inputVal.value!)
    if (!validateResult) {
      dialogState.showErr = true
      return false
    }
  }
  dialogState.showErr = false
  return true
}

/**
 * @description show关闭时，销毁错误提示
 * @param val
 */
function resetErr(val: boolean) {
  if (val === false) {
    dialogState.showErr = false
  }
}

watch(
  () => inputVal.value,
  (val) => {
    if (val === '') {
      dialogState.showErr = false
    }
  }
)

/**
 * 重置message选项值
 * @param option message选项值
 */
function reset(option: DialogOptionsWithCallBack) {
  if (option) {
    dialogState.title = isDef(option.title) ? option.title : ''
    dialogState.show = option.show
    dialogState.closeOnClickModal = option.closeOnClickModal
    dialogState.msg = option.msg
    dialogState.type = option.type
    dialogState.inputProps = option.inputProps
    dialogState.textareaProps = option.textareaProps
    // 初始化 inputVal，优先级：inputValue > textareaProps.modelValue > inputProps.modelValue
    if (isDef(option.inputValue)) {
      inputVal.value = option.inputValue!
    } else if (option.textareaProps && isDef(option.textareaProps.modelValue)) {
      inputVal.value = option.textareaProps.modelValue!
    } else if (option.inputProps && isDef(option.inputProps.modelValue)) {
      inputVal.value = option.inputProps.modelValue!
    } else {
      inputVal.value = ''
    }

    dialogState.inputPattern = option.inputPattern!
    dialogState.inputValidate = option.inputValidate
    dialogState.success = option.success
    dialogState.fail = option.fail
    dialogState.beforeConfirm = option.beforeConfirm
    dialogState.inputError = option.inputError
    dialogState.showErr = option.showErr
    dialogState.zIndex = option.zIndex
    dialogState.lazyRender = option.lazyRender
    // 按钮配置（快捷属性已在 index.ts 中合并）
    dialogState.confirmButtonProps = option.confirmButtonProps
    dialogState.cancelButtonProps = option.cancelButtonProps
    dialogState.headerImage = option.headerImage
    // 图标配置（快捷属性已在 index.ts 中合并到 iconProps）
    // 处理内置图标类型映射
    const iconName = option.iconProps?.name || option.icon
    if (iconName && iconName in DIALOG_BUILTIN_ICON_MAP) {
      const builtinIcon = DIALOG_BUILTIN_ICON_MAP[iconName as DialogBuiltinIconType]
      dialogState.iconProps = { ...option.iconProps, name: builtinIcon }
      iconType.value = iconName // 记录内置类型用于添加 class
    } else {
      dialogState.iconProps = option.iconProps
      iconType.value = '' // 非内置类型，使用默认样式
    }
    dialogState.showClose = option.showClose
    dialogState.actionLayout = option.actionLayout
    dialogState.theme = option.theme
    // 自定义操作按钮
    dialogState.actions = option.actions
  }
}
</script>

