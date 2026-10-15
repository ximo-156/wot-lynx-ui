import { inject, provide, ref } from 'vue-lynx'
import type { NotifyProps } from './types'
import { deepMerge, isString } from '../../common/util'

let timer: ReturnType<typeof setTimeout> | null = null
let currentOptions = getDefaultOptions()
const notifyDefaultOptionKey = '__NOTIFY_OPTION__'
const None = Symbol('None')

export const setNotifyDefaultOptions = (options: Partial<NotifyProps>) => {
  currentOptions = deepMerge(currentOptions, options) as NotifyProps
}

export const resetNotifyDefaultOptions = () => {
  currentOptions = getDefaultOptions()
}

export function useNotify(selector: string = '') {
  const notifyOptionKey = getNotifyOptionKey(selector)

  const notifyOption = inject(notifyOptionKey, ref<NotifyProps | typeof None>(None))
  if (notifyOption.value === None) {
    notifyOption.value = currentOptions
    provide(notifyOptionKey, notifyOption)
  }

  const showNotify = (option: NotifyProps | string) => {
    const options = deepMerge(currentOptions, isString(option) ? { message: option } : option) as NotifyProps
    notifyOption.value = deepMerge(options, { visible: true })
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (notifyOption.value.duration && notifyOption.value.duration > 0) {
      timer = setTimeout(() => closeNotify(), notifyOption.value.duration)
    }
  }

  const closeNotify = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (notifyOption.value !== None) {
      notifyOption.value.visible = false
    }
  }

  return { showNotify, closeNotify }
}

export const getNotifyOptionKey = (selector: string) => {
  return selector ? `${notifyDefaultOptionKey}${selector}` : notifyDefaultOptionKey
}

function getDefaultOptions(): NotifyProps {
  return {
    ...notifyPropsDefaults
  }
}

const notifyPropsDefaults: NotifyProps = {
  customStyle: '',
  customClass: '',
  type: 'danger',
  color: '',
  zIndex: 99,
  visible: false,
  message: '',
  selector: '',
  duration: 3000,
  position: 'top',
  safeHeight: undefined,
  background: '',
  rootPortal: false,
  closable: false,
  variant: 'filled'
}
