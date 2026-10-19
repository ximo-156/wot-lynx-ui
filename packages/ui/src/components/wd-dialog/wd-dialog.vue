/*
 * wd-dialog — 对话框
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 结构：wd-popup（zoom-in）> view.wd-dialog__container > [close icon + body + actions]，
 *   与 wot-ui 一致；alert / confirm / prompt 三类型，theme 支持 button / text；
 * - 状态通道与 wot-ui 一致：命令式（useDialog(selector) 或实例方法
 *   defineExpose({ show / alert / confirm / prompt / close })）写入 messageOption
 *   ref，组件 watch 后 reset 进 dialogState；wot-ui 的 dialogProps 同样只作为
 *   API 声明（官方文档仅列出 selector / root-portal / custom-class / custom-style），
 *   组件内部只读 customClass 与 rootPortal；
 * - open-type 系列按钮事件（getUserInfo / contact / getPhoneNumber …）为
 *   uni-app / 小程序专有能力，Lynx 无原生事件可转发，故不在 wd-button 上声明
 *   监听（PORTING §2.3）；DialogButtonOpenTypeEvents 类型与 OPEN_TYPE_EVENT_KEYS
 *   保留，后者仍用于从按钮配置里过滤非 prop 键；
 * - 参考源模板的 block 元素（uni-app 专有）改为 template v-if / v-for；
 *   view 内的裸文本（标题 / 按钮文案 / 错误提示）包 text 元素；
 * - 相邻兄弟选择器（`.wd-dialog__img + .wd-dialog__title` 等）Lynx 支持有限，
 *   改为模板下发的状态类 is-after-image / is-after-title；
 *   按钮间距由 `:not(:last-child)` margin 改为容器 gap，text 主题下右边框的
 *   「最后一项无边框」改为索引类名 wd-dialog__actions-btn--last；
 * - ::-webkit-scrollbar 为 Web 专有伪元素，Lynx 不支持，删除（对应令牌保留）；
 * - display: block 在 Lynx 只认 flex / none / linear，__actions--block 改为
 *   flex + column（CONVENTIONS §15）；
 * - 图标名：wot-ui 用 check-circle-fill 等，本地内置图标集无同名字形，
 *   DIALOG_BUILTIN_ICON_MAP 映射为 success / prompt / warning / error；
 * - 点击事件 @click → @tap（CONVENTIONS §6）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, inject, reactive, ref, useSlots, watch } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdButton from '../wd-button/wd-button.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdInput from '../wd-input/wd-input.vue'
import WdTextarea from '../wd-textarea/wd-textarea.vue'
import {
  dialogProps,
  type DialogBeforeConfirm,
  type DialogOptions,
  type DialogType,
  type DialogOptionsWithCallBack,
  type DialogResult,
  type DialogBuiltinIconType,
  DIALOG_BUILTIN_ICON_MAP,
  type DialogAction,
  type DialogButtonOpenTypeEvents,
  OPEN_TYPE_EVENT_KEYS
} from './types'
import { defaultOptions, getDialogDefaultOptionKey } from '.'
import { callInterceptor } from '../../common/interceptor'
import { deepAssign, deepMerge, isDef, isFunction, isObj, isString, isUndefined, omitBy } from '../../common/util'
import { useTranslate } from '../../composables/useTranslate'
import type { ButtonProps, ButtonVariant } from '../wd-button/types'

const props = defineProps(dialogProps)

const { translate } = useTranslate('dialog')

// 当前图标的内置类型（用于添加 class）
const iconType = ref<string>('')

// 图标类型对应的 class
const iconTypeClass = computed(() => {
  return iconType.value ? `is-${iconType.value}` : ''
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
    return action
  })
})

/**
 * 从按钮配置中提取用于 v-bind 的 props（排除 openType 事件回调和 click）
 * @param btn 按钮配置
 */
function getActionButtonProps(btn: DialogAction) {
  const result: Record<string, any> = {}
  for (const key in btn) {
    // 排除 openType 事件回调、click 和 text
    if (!OPEN_TYPE_EVENT_KEYS.includes(key as keyof DialogButtonOpenTypeEvents) && key !== 'click' && key !== 'text') {
      result[key] = (btn as any)[key]
    }
  }
  return result
}

/**
 * 确认按钮属性
 */
const customConfirmProps = computed(() => {
  const defaultProps: Partial<ButtonProps> = {
    block: true
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

  // Lynx 适配：wot-ui 以 `:not(:last-child)` 区分最后一项按钮（text 主题的右边框），
  // 本地改为索引类名 --last（确定按钮恒为最后一项）
  buttonProps.customClass = `${buttonProps.customClass || ''} wd-dialog__actions-btn wd-dialog__actions-btn--confirm wd-dialog__actions-btn--last`
  return buttonProps
})

/**
 * 取消按钮属性
 */
const customCancelProps = computed(() => {
  const defaultProps: Partial<ButtonProps> = {
    block: true,
    type: 'info',
    variant: 'plain'
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

  // Lynx 适配：取消按钮仅在确认按钮不显示时才是最后一项
  buttonProps.customClass = `${buttonProps.customClass || ''} wd-dialog__actions-btn${showConfirmButton.value ? '' : ' wd-dialog__actions-btn--last'}`
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

watch(
  () => dialogState.show,
  (newValue) => {
    resetErr(!!newValue)
  },
  {
    deep: true,
    immediate: true
  }
)

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

const slots = useSlots()

/** 标题区是否展示（与模板中 title 的 v-if 条件一致，用于内容区的间距状态类） */
const showTitle = computed(() => Boolean(dialogState.iconProps?.name || dialogState.title))

/**
 * 合并按钮快捷属性到 confirmButtonProps/cancelButtonProps
 * 快捷属性（confirmButtonText/cancelButtonText/showCancelButton）优先级高于 Props 对象内的属性
 * （与 index.ts 的 normalizeButtonProps 同口径）
 */
function normalizeButtonProps(options: DialogOptions) {
  if (options.confirmButtonText) {
    if (isDef(options.confirmButtonProps) && isObj(options.confirmButtonProps)) {
      options.confirmButtonProps = { ...options.confirmButtonProps, text: options.confirmButtonText }
    } else if (!options.confirmButtonProps) {
      options.confirmButtonProps = options.confirmButtonText
    }
  }

  if (options.cancelButtonText) {
    if (isDef(options.cancelButtonProps) && isObj(options.cancelButtonProps)) {
      options.cancelButtonProps = { ...options.cancelButtonProps, text: options.cancelButtonText }
    } else if (!options.cancelButtonProps) {
      options.cancelButtonProps = options.cancelButtonText
    }
  }

  // 处理 showCancelButton
  if (options.showCancelButton === false && !isDef(options.cancelButtonProps)) {
    options.cancelButtonProps = null
  } else if (options.showCancelButton === true && !isDef(options.cancelButtonProps)) {
    // showCancelButton 为 true 时，设置为空对象让组件显示按钮，文本由组件内兜底
    options.cancelButtonProps = {}
  }
}

/**
 * 合并图标快捷属性到 iconProps
 * 快捷属性（icon/iconColor）优先级高于 Props 对象内的属性
 * （与 index.ts 的 normalizeIconProps 同口径）
 */
function normalizeIconProps(options: DialogOptions) {
  if (options.icon || options.iconColor) {
    const iconProps: Record<string, any> = {}
    if (options.icon) {
      iconProps.name = options.icon
    }
    if (options.iconColor) {
      iconProps.color = options.iconColor
    }
    options.iconProps = { ...options.iconProps, ...iconProps }
  }
}

/**
 * 命令式打开（与 useDialog(selector) 同一注入通道，逻辑对齐其 createMethod）。
 *
 * 写入 messageOption 即被上方 watch 消费并 reset 进 dialogState；
 * 页面未调用 useDialog 时，inject 的兜底 ref 由本组件持有，写入同样生效。
 * 字符串入参视为 title（与 useDialog 一致）。
 */
function open(type: DialogType, options: DialogOptionsWithCallBack | string) {
  const dialogOptions = deepMerge({ type }, isString(options) ? { title: options } : options) as DialogOptionsWithCallBack

  // 与 useDialog 的 createMethod 同口径：先补 showCancelButton 默认值，再把快捷
  // 属性合并进 confirmButtonProps / cancelButtonProps / iconProps（组件内只认
  // cancelButtonProps / confirmButtonProps / iconProps，见 showCancelButton 计算属性）
  if (dialogOptions.cancelButtonProps === undefined && dialogOptions.showCancelButton === undefined) {
    dialogOptions.showCancelButton = type === 'confirm' || type === 'prompt'
  }

  normalizeButtonProps(dialogOptions)
  normalizeIconProps(dialogOptions)

  if (
    dialogOptions.actions &&
    dialogOptions.actions.length > 0 &&
    (dialogOptions.confirmButtonProps !== undefined || dialogOptions.cancelButtonProps !== undefined)
  ) {
    console.warn(
      '[wot-ui] DialogBox: actions 和 confirmButtonProps/cancelButtonProps 同时配置时，将使用 actions 配置，confirmButtonProps/cancelButtonProps 将被忽略'
    )
  }

  return new Promise<DialogResult>((resolve, reject) => {
    const next = deepMerge(defaultOptions, dialogOptions)
    next.show = true
    next.success = (res: DialogResult) => {
      resolve(res)
    }
    next.fail = (res: DialogResult) => {
      reject(res)
    }
    messageOption.value = next
  })
}

/** 命令式关闭 */
function close() {
  messageOption.value = { ...defaultOptions, show: false }
}

defineExpose({
  show: (options: DialogOptionsWithCallBack | string) => open('alert', options),
  alert: (options: DialogOptionsWithCallBack | string) => open('alert', options),
  confirm: (options: DialogOptionsWithCallBack | string) => open('confirm', options),
  prompt: (options: DialogOptionsWithCallBack | string) => open('prompt', options),
  close
})
</script>

<template>
  <WdPopup
    transition="zoom-in"
    v-model="dialogState.show"
    :close-on-click-modal="dialogState.closeOnClickModal"
    :lazy-render="dialogState.lazyRender"
    custom-class="wd-dialog"
    @click-modal="toggleModal('modal')"
    :z-index="dialogState.zIndex"
    :duration="200"
    :root-portal="rootPortal"
  >
    <view :class="rootClass">
      <WdIcon v-if="dialogState.showClose" custom-class="wd-dialog__close" name="close" @tap="toggleModal('close')" />
      <slot name="header" />
      <view :class="bodyClass">
        <slot name="image">
          <image v-if="dialogState.headerImage" mode="widthFix" class="wd-dialog__img" :src="dialogState.headerImage" />
        </slot>
        <slot name="title" :icon="dialogState.icon" :title="dialogState.title" :iconProps="dialogState.iconProps">
          <view v-if="dialogState.iconProps?.name || dialogState.title" :class="`wd-dialog__title ${dialogState.headerImage ? 'is-after-image' : ''}`">
            <WdIcon
              v-if="dialogState.iconProps?.name"
              :custom-class="`wd-dialog__icon ${iconTypeClass}`"
              :name="dialogState.iconProps.name"
              :color="dialogState.iconProps.color"
              :size="dialogState.iconProps.size"
            />
            <text v-if="dialogState.title">{{ dialogState.title }}</text>
          </view>
        </slot>
        <view
          v-if="dialogState.type === 'prompt' || !!dialogState.msg || slots.default"
          :class="`wd-dialog__content ${showTitle ? 'is-after-title' : dialogState.headerImage ? 'is-after-image' : ''}`"
        >
          <slot :msg="dialogState.msg" :type="dialogState.type" :inputValue="inputVal" :showErr="dialogState.showErr" :inputError="dialogState.inputError">
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
            <text v-else class="wd-dialog__content-text">{{ dialogState.msg }}</text>
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
              v-bind="getActionButtonProps(btn)"
              :custom-class="`wd-dialog__actions-btn ${index === customActions.length - 1 ? 'wd-dialog__actions-btn--last' : ''}`"
              @tap="handleAction(btn)"
            >
              <text>{{ btn.text }}</text>
            </WdButton>
          </template>
          <template v-else>
            <WdButton v-bind="customCancelProps" v-if="showCancelButton" @tap="toggleModal('cancel')">
              <text>{{ getCancelText() }}</text>
            </WdButton>
            <WdButton v-bind="customConfirmProps" v-if="showConfirmButton" @tap="toggleModal('confirm')">
              <text>{{ getConfirmText() }}</text>
            </WdButton>
          </template>
        </view>
      </slot>
    </view>
  </WdPopup>
</template>
