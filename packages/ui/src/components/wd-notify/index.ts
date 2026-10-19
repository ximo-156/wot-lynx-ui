import { inject, onUnmounted, provide, ref } from 'vue-lynx'
import type { NotifyProps } from './types'
import { deepMerge, isString } from '../../common/util'
import { useAlive } from '../../composables/useAlive'

const notifyPropsDefaults: NotifyProps = {
  customStyle: '',
  customClass: '',
  type: 'danger',
  color: '',
  zIndex: 99,
  visible: false,
  message: '',
  duration: 3000,
  position: 'top',
  safeHeight: undefined,
  background: '',
  rootPortal: false,
  closable: false,
  variant: 'filled'
}

// 按 selector 分桶存储定时器：模块级单变量会被同页第二个 selector 的
// showNotify 覆盖（前一条通知永不自动关闭）。与 useToast 的 toastTimerMap
// 同范式。
const notifyTimerMap = new Map<string, ReturnType<typeof setTimeout>>()
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

  // 页面卸载后不再响应命令式调用（遗留引用写死树 ref → 真机 9902 家族）。
  const isAlive = useAlive()

  const clearNotifyTimer = () => {
    const timer = notifyTimerMap.get(notifyOptionKey)
    if (timer) {
      clearTimeout(timer)
      notifyTimerMap.delete(notifyOptionKey)
    }
  }

  const showNotify = (option: NotifyProps | string) => {
    if (!isAlive()) return
    const options = deepMerge(currentOptions, isString(option) ? { message: option } : option) as NotifyProps
    notifyOption.value = deepMerge(options, { visible: true })
    clearNotifyTimer()
    if (notifyOption.value.duration && notifyOption.value.duration > 0) {
      notifyTimerMap.set(
        notifyOptionKey,
        setTimeout(() => {
          notifyTimerMap.delete(notifyOptionKey)
          closeNotify()
        }, notifyOption.value.duration)
      )
    }
  }

  const closeNotify = () => {
    clearNotifyTimer()
    if (notifyOption.value !== None && isAlive()) {
      // 赋新对象而非原地改 visible：首次使用前 notifyOption.value 就是模块级
      // currentOptions 本体，原地写 visible=false 会把全局默认值一起改掉
      // （与 useToast 的 deepMerge 赋新对象保持一致）。
      notifyOption.value = deepMerge(notifyOption.value, { visible: false }) as NotifyProps
    }
  }

  // 页面卸载时清掉本 selector 的自动关闭定时器，断开「定时器 → 死树」链路。
  onUnmounted(() => {
    clearNotifyTimer()
  })

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
