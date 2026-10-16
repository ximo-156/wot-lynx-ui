import { inject, onUnmounted, provide, ref } from 'vue-lynx'
import type { Toast, ToastOptions } from './types'
import { deepMerge } from '../../common/util'
import { useAlive } from '../../composables/useAlive'

/**
 * useToast 用到的 key
 */
const toastDefaultOptionKey = '__TOAST_OPTION__'

// 默认模板
export const defaultOptions: ToastOptions = {
  duration: 2000,
  show: false
}

const None = Symbol('None')

// 使用 map 存储定时器，避免先前的定时器覆盖后续的定时器
const toastTimerMap = new Map<string, ReturnType<typeof setTimeout>>()

export function useToast(selector: string = ''): Toast {
  const toastOptionKey = getToastOptionKey(selector)
  const toastOption = inject(toastOptionKey, ref<ToastOptions | typeof None>(None))
  if (toastOption.value === None) {
    toastOption.value = defaultOptions
    provide(toastOptionKey, toastOption)
  }

  // 页面卸载后不再响应命令式调用：useToast 常被消费方在组件/页面 setup 里
  // 调用，遗留引用在卸载后继续 show() 会向已销毁页面提供的 ref 写状态
  // （真机 9902 晚到 patch 家族）。onUnmounted 仅在本 composable 所在
  // 组件（通常是页面根）卸载时触发。
  const isAlive = useAlive()

  const createMethod = (toastOptions: ToastOptions) => {
    return (options: ToastOptions | string) => {
      return show(deepMerge(toastOptions, typeof options === 'string' ? { msg: options } : options) as ToastOptions)
    }
  }

  const show = (option: ToastOptions | string) => {
    if (!isAlive()) return
    const options = deepMerge(defaultOptions, typeof option === 'string' ? { msg: option } : option) as ToastOptions
    toastOption.value = deepMerge(options, { show: true }) as ToastOptions
    const prevTimer = toastTimerMap.get(toastOptionKey)
    if (prevTimer) {
      clearTimeout(prevTimer)
      toastTimerMap.delete(toastOptionKey)
    }
    if (options.duration && options.duration > 0) {
      const nextTimer = setTimeout(() => {
        toastTimerMap.delete(toastOptionKey)
        close()
      }, options.duration)
      toastTimerMap.set(toastOptionKey, nextTimer)
    }
  }

  const loading = createMethod({
    iconName: 'loading',
    duration: 0,
    cover: true
  })
  const success = createMethod({
    iconName: 'success',
    duration: 1500
  })
  const error = createMethod({ iconName: 'error' })
  const warning = createMethod({ iconName: 'warning' })
  const info = createMethod({ iconName: 'info' })

  const close = () => {
    const timer = toastTimerMap.get(toastOptionKey)
    if (timer) {
      clearTimeout(timer)
      toastTimerMap.delete(toastOptionKey)
    }
    if (!isAlive()) return
    toastOption.value = { show: false }
  }

  // 页面卸载时清掉本 selector 的自动关闭定时器。模块级 toastTimerMap 的
  // 生命周期长于页面：不清则残留定时器到期后仍会执行 close()（虽此时 watch
  // 已停止、写 ref 多为无操作，但清理掉才能彻底断开「定时器 → 死树」链路）。
  onUnmounted(() => {
    const timer = toastTimerMap.get(toastOptionKey)
    if (timer) {
      clearTimeout(timer)
      toastTimerMap.delete(toastOptionKey)
    }
  })

  return {
    show,
    loading,
    success,
    error,
    warning,
    info,
    close
  }
}

export const getToastOptionKey = (selector: string) => {
  return selector ? `${toastDefaultOptionKey}${selector}` : toastDefaultOptionKey
}

export const toastIcon = {
  success: 'success',
  warning: 'warning',
  info: 'prompt',
  error: 'error'
}
