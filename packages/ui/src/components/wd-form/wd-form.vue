/*
 * wd-form — 表单
 *
 * Lynx 实现说明：
 * - 经 useChildren 向 form-item 提供 props / errorMessages / validate；
 * - 校验驱动来自 schema（返回问题列表）；错误提示按 errorType 分流：
 *   message 写入 errorMessages（表单项内联展示），toast 经 useToast 弹出；
 * - errorType='toast' 时挂载命令式 toast 实例（selector 区分多表单）。
 */
<script lang="ts" setup>
import './index.css'

import { reactive, watch } from 'vue-lynx'
import WdToast from '../wd-toast/wd-toast.vue'
import { useToast } from '../wd-toast'
import { formProps, type ErrorMessage, type FormExpose, type FormSchemaIssue } from './types'
import { isArray, isDef } from '../../common/util'
import { useChildren } from '../../composables/useChildren'
import { FORM_KEY } from '../../composables/useFormDisabled'

const props = defineProps(formProps)

const { children, linkChildren } = useChildren(FORM_KEY)
const errorMessages = reactive<Record<string, string>>({})

linkChildren({ props, errorMessages, validate })

// 与模板中的 wd-toast 实例共用 'wd-form-toast' selector；
// errorType 非 toast 时不会调用 showToast，注入无副作用
const { show: showToast } = useToast('wd-form-toast')

watch(
  () => props.model,
  () => {
    if (props.resetOnChange) {
      clearMessage()
    }
  },
  { immediate: true, deep: true }
)

/**
 * 表单校验
 * @param prop 指定校验字段或字段数组
 */
async function validate(prop?: string | string[]): Promise<{ valid: boolean; errors: ErrorMessage[] }> {
  const propsToValidate = isArray(prop) ? prop : isDef(prop) ? [prop] : []
  const rawIssues: FormSchemaIssue[] = props.schema ? await Promise.resolve(props.schema.validate(props.model)) : []
  const errors = rawIssues
    .filter((issue) => issue.path && issue.path.length > 0 && issue.message)
    .map((issue) => ({
      prop: issue.path.map((item) => String(item)).join('.'),
      message: issue.message
    }))
  const childrenProps = getChildrenProps()
  const visibleErrors = errors.filter((error) => getMatchedChildProp(error.prop, childrenProps))
  const filteredErrors =
    propsToValidate.length > 0
      ? visibleErrors.filter((error) => propsToValidate.some((target) => isSameOrSubPath(error.prop, target)))
      : visibleErrors
  const valid = filteredErrors.length === 0

  showMessage(filteredErrors)

  if (valid) {
    if (propsToValidate.length) {
      propsToValidate.forEach(clearMessage)
    } else {
      clearMessage()
    }
  }

  return { valid, errors: filteredErrors }
}

function getChildrenProps(): string[] {
  return children.map((e: any) => e.prop).filter((prop): prop is string => Boolean(prop))
}

function isSameOrSubPath(prop: string, target: string): boolean {
  return prop === target || prop.startsWith(`${target}.`) || target.startsWith(`${prop}.`)
}

function getMatchedChildProp(prop: string, childrenProps: string[]): string | undefined {
  return childrenProps.find((target) => target === prop) || childrenProps.find((target) => isSameOrSubPath(prop, target))
}

function showMessage(errors: ErrorMessage[]) {
  const childrenProps = getChildrenProps()
  const messages = errors.reduce<ErrorMessage[]>((result, error) => {
    const matchedProp = getMatchedChildProp(error.prop, childrenProps)
    if (error.message && matchedProp && !result.some((message) => message.prop === matchedProp)) {
      result.push({ prop: matchedProp, message: error.message })
    }
    return result
  }, [])
  if (messages.length) {
    messages.sort((a, b) => childrenProps.indexOf(a.prop) - childrenProps.indexOf(b.prop))
    if (props.errorType === 'toast') {
      showToast(messages[0].message)
    } else if (props.errorType === 'message') {
      messages.forEach((error) => {
        errorMessages[error.prop] = error.message
      })
    }
  }
}

function clearMessage(prop?: string) {
  if (prop) {
    Object.keys(errorMessages).forEach((key) => {
      if (isSameOrSubPath(key, prop)) {
        errorMessages[key] = ''
      }
    })
  } else {
    Object.keys(errorMessages).forEach((key) => {
      errorMessages[key] = ''
    })
  }
}

/**
 * 重置表单项的验证提示
 */
function reset() {
  clearMessage()
}

defineExpose<FormExpose>({ validate, reset })
</script>

<template>
  <view :class="`wd-form ${customClass}`" :style="customStyle">
    <slot />
    <wd-toast v-if="errorType === 'toast'" selector="wd-form-toast" />
  </view>
</template>
