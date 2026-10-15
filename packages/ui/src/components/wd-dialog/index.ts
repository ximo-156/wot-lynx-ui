import { inject, provide, ref } from 'vue-lynx'
import type { Dialog, DialogOptions, DialogOptionsWithCallBack, DialogResult, DialogType } from './types'
import { deepMerge, isDef, isObj, isString } from '../../common/util'

const dialogDefaultOptionKey = '__MESSAGE_OPTION__'

const None = Symbol('None')

export const defaultOptions: DialogOptionsWithCallBack = {
  title: '',
  show: false,
  closeOnClickModal: false,
  msg: '',
  type: 'alert',
  inputProps: { type: 'text', modelValue: '' },
  showErr: false,
  zIndex: 99,
  lazyRender: true,
  inputError: '',
  theme: 'button',
  actionLayout: 'horizontal',
  confirmButtonProps: {},
  cancelButtonProps: {}
}

/** Dialog 弹窗函数式调用 */
export function useDialog(selector: string = ''): Dialog {
  const dialogOptionKey = selector ? dialogDefaultOptionKey + selector : dialogDefaultOptionKey
  const dialogOption = inject(dialogOptionKey, ref<DialogOptionsWithCallBack | typeof None>(None))
  if (dialogOption.value === None) {
    dialogOption.value = defaultOptions
    provide(dialogOptionKey, dialogOption)
  }

  const createMethod = (type: DialogType) => {
    return (options: DialogOptions | string) => {
      const dialogOptions = deepMerge({ type }, isString(options) ? { title: options } : options) as DialogOptionsWithCallBack

      if (dialogOptions.cancelButtonProps === undefined && dialogOptions.showCancelButton === undefined) {
        dialogOptions.showCancelButton = dialogOptions.type === 'confirm' || dialogOptions.type === 'prompt'
      }

      if (dialogOption.value !== None) {
        dialogOption.value = deepMerge(defaultOptions, dialogOptions)
        dialogOption.value.show = true
      }
    }
  }

  const show = createMethod('alert')
  const alert = createMethod('alert')
  const confirm = createMethod('confirm')
  const prompt = createMethod('prompt')

  const close = () => {
    if (dialogOption.value !== None) {
      dialogOption.value.show = false
    }
  }

  return { show, alert, confirm, prompt, close }
}

export const getDialogDefaultOptionKey = (selector: string) => {
  return selector ? `${dialogDefaultOptionKey}${selector}` : dialogDefaultOptionKey
}

export type { DialogResult }
