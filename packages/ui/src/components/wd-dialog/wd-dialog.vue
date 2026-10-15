/*
 * wd-dialog — 对话框
 *
 * Lynx 实现说明：
 * - 基于 wd-popup（zoom-in 过渡）；alert / confirm / prompt 三类型；
 * - prompt 模式经 wd-input 收集输入，inputPattern / inputValidate
 *   校验（经 common/interceptor）；
 * - 命令式 API 经 useDialog(selector) 驱动（模块级注入单例）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, inject, reactive, ref, useSlots, watch } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdInput from '../wd-input/wd-input.vue'
import WdButton from '../wd-button/wd-button.vue'
import { dialogProps, type DialogResult } from './types'
import { defaultOptions, getDialogDefaultOptionKey } from '.'
import { callInterceptor } from '../../common/interceptor'
import { useTranslate } from '../../composables/useTranslate'
import { isDef } from '../../common/util'

const props = defineProps(dialogProps)
const emit = defineEmits(['update:modelValue', 'confirm', 'cancel', 'close', 'open'])

const { translate } = useTranslate('dialog')
const slots = useSlots()

const inputVal = ref<string | number>(props.inputValue || '')

const messageOptionKey = getDialogDefaultOptionKey(props.selector)
const messageOption = inject(messageOptionKey, ref(defaultOptions))

const dialogState = reactive({
  show: props.modelValue,
  title: props.title,
  msg: props.msg,
  type: props.type,
  theme: props.theme,
  zIndex: props.zIndex,
  lazyRender: props.lazyRender,
  closeOnClickModal: props.closeOnClickModal,
  actionLayout: props.actionLayout,
  showErr: props.showErr,
  inputError: props.inputError,
  headerImage: props.headerImage,
  icon: props.icon,
  iconColor: props.iconColor,
  showCancelButton: props.showCancelButton,
  showConfirmButton: props.showConfirmButton,
  confirmButtonProps: props.confirmButtonProps,
  cancelButtonProps: props.cancelButtonProps,
  inputProps: props.inputProps,
  textareaProps: props.textareaProps,
  showClose: (props as any).showClose
})

/** 命令式注入的选项同步到状态 */
watch(
  () => messageOption.value,
  (val: any) => {
    if (val && isDef(val.show)) {
      Object.assign(dialogState, val)
      emit('update:modelValue', val.show)
    }
  },
  { deep: true }
)

watch(
  () => props.modelValue,
  (val) => {
    dialogState.show = val
  }
)

const rootClass = computed(() => {
  const classes = ['wd-dialog']
  if (dialogState.theme === 'button') classes.push('wd-dialog--button')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

const bodyClass = computed(() => {
  const classes = ['wd-dialog__body']
  if (!dialogState.title && !dialogState.msg && !slots.default) classes.push('is-no-title')
  if (dialogState.headerImage) classes.push('is-image')
  if (dialogState.type === 'prompt') classes.push('is-prompt')
  return classes.join(' ')
})

const showCancelButton = computed(() => {
  if (isDef(dialogState.showCancelButton)) return dialogState.showCancelButton
  return dialogState.type === 'confirm' || dialogState.type === 'prompt'
})

const showConfirmButton = computed(() => {
  if (isDef(dialogState.showConfirmButton)) return dialogState.showConfirmButton
  return true
})

function getConfirmText(): string {
  return dialogState.confirmButtonProps?.['text'] || translate('confirm')
}

function getCancelText(): string {
  return dialogState.cancelButtonProps?.['text'] || translate('cancel')
}

function toggleModal(action: 'confirm' | 'cancel' | 'modal' | 'close') {
  if (action === 'modal') {
    if (props.closeOnClickModal) {
      handleCancel()
    }
    return
  }
  if (action === 'confirm') {
    onConfirm()
  } else {
    handleCancel()
  }
}

function onConfirm() {
  if (dialogState.type === 'prompt') {
    // 输入校验
    const value = String(inputVal.value)
    const pattern = props.inputPattern
    if (pattern && !pattern.test(value)) {
      dialogState.showErr = true
      dialogState.inputError = props.inputError || translate('inputNoValidate')
      return
    }
    callInterceptor(props.inputValidate ? () => props.inputValidate!(value) : undefined, {
      args: [],
      done: () => confirm(value)
    })
    return
  }
  confirm()
}

function confirm(value?: string) {
  const result: DialogResult = { action: 'confirm', value }
  dialogState.show = false
  emit('update:modelValue', false)
  emit('confirm', result)
  const cb = (messageOption.value as any)?.confirm
  if (typeof cb === 'function') cb(result)
}

function handleCancel() {
  const result: DialogResult = { action: 'cancel' }
  dialogState.show = false
  emit('update:modelValue', false)
  emit('cancel', result)
  const cb = (messageOption.value as any)?.cancel
  if (typeof cb === 'function') cb(result)
}
</script>

<template>
  <wd-popup
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
      <wd-icon v-if="dialogState.showClose" custom-class="wd-dialog__close" name="close" @tap="toggleModal('close')" />
      <view :class="bodyClass">
        <image v-if="dialogState.headerImage" mode="widthFix" class="wd-dialog__img" :src="dialogState.headerImage" />
        <view v-if="dialogState.icon || dialogState.title" class="wd-dialog__title">
          <wd-icon
            v-if="dialogState.icon"
            :custom-class="'wd-dialog__icon'"
            :name="dialogState.icon"
            :color="dialogState.iconColor"
          />
          <text v-if="dialogState.title" class="wd-dialog__title-text">{{ dialogState.title }}</text>
        </view>
        <view v-if="dialogState.type === 'prompt' || !!dialogState.msg || slots.default" class="wd-dialog__content">
          <slot :msg="dialogState.msg" :type="dialogState.type" :inputValue="inputVal" :showErr="dialogState.showErr" :inputError="dialogState.inputError">
            <wd-input
              v-if="dialogState.type === 'prompt'"
              v-model="inputVal"
              custom-class="wd-dialog__input"
              v-bind="dialogState.inputProps || {}"
            />
            <text v-else class="wd-dialog__content-text">{{ dialogState.msg }}</text>
          </slot>
          <view v-if="dialogState.showErr" class="wd-dialog__input-error">
            <text>{{ dialogState.inputError || translate('inputNoValidate') }}</text>
          </view>
        </view>
      </view>
      <view v-if="showCancelButton || showConfirmButton" :class="`wd-dialog__footer wd-dialog__footer--${dialogState.actionLayout}`">
        <wd-button
          v-if="showCancelButton"
          type="info"
          variant="plain"
          size="medium"
          custom-class="wd-dialog__action"
          v-bind="dialogState.cancelButtonProps || {}"
          @tap="toggleModal('cancel')"
        >
          {{ getCancelText() }}
        </wd-button>
        <wd-button
          v-if="showConfirmButton"
          type="primary"
          size="medium"
          custom-class="wd-dialog__action"
          v-bind="dialogState.confirmButtonProps || {}"
          @tap="toggleModal('confirm')"
        >
          {{ getConfirmText() }}
        </wd-button>
      </view>
    </view>
  </wd-popup>
</template>
