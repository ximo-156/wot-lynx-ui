/*
 * wd-form — 表单
 *
 * 与 wot-ui 2.3.2 对齐；Lynx 适配点（相对参考源的差异）：
 * - 根节点三件套（NATIVE-REWRITE §3.1）：index.scss 显式声明
 *   display:flex + flex-direction:column，保证各表单项纵向堆叠；
 * - customStyle 经 parseStyle() 归一为对象后下发（CONVENTIONS §19：
 *   vue-lynx 的 :style 只认对象，字符串样式会被静默丢弃）；
 * - 平台 options 块（virtualHost / styleIsolation / addGlobalClass）为
 *   小程序专有能力，Lynx 不需要，未声明；
 * - errorType='toast' 时挂载命令式 toast 实例（selector 区分多表单），
 *   与参考源一致。
 */
<script lang="ts" setup>
import './index.css'

import { reactive, watch } from 'vue-lynx'
import WdToast from '../wd-toast/wd-toast.vue'
import { useToast } from '../wd-toast'
import { formProps, type ErrorMessage, type FormExpose, type FormSchemaIssue } from './types'
import { isArray, isDef, parseStyle } from '../../common/util'
import { useChildren } from '../../composables/useChildren'
import { FORM_KEY } from '../../composables/useFormDisabled'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(formProps)
const isAlive = useAlive()
let validationGeneration = 0
let validationSequence = 0
const validationRequests = new Map<string, number>()

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
      validationGeneration++
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
  const generation = validationGeneration
  const request = ++validationSequence
  const scope = propsToValidate.slice().sort().join('\0')
  validationRequests.set(scope, request)
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

  // 返回调用者真实结果；界面按字段识别重叠校验，旧的全表单请求不能覆盖新的单字段请求。
  if (!isAlive() || generation !== validationGeneration || request !== validationRequests.get(scope)) return { valid, errors: filteredErrors }
  const currentFields = childrenProps.filter((field) => {
    if (propsToValidate.length && !propsToValidate.some((target) => isSameOrSubPath(field, target))) return false
    for (const [newerScope, newerRequest] of validationRequests) {
      if (newerRequest <= request) continue
      if (!newerScope || newerScope.split('\0').some((target) => isSameOrSubPath(field, target))) return false
    }
    return true
  })
  showMessage(filteredErrors.filter((error) => {
    const field = getMatchedChildProp(error.prop, childrenProps)
    return field !== undefined && currentFields.includes(field)
  }))

  if (valid) currentFields.forEach(clearMessage)

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
  validationGeneration++
  clearMessage()
}

defineExpose<FormExpose>({ validate, reset })
</script>

<template>
  <view :class="`wd-form ${customClass}`" :style="parseStyle(customStyle)">
    <slot />
    <WdToast v-if="errorType === 'toast'" selector="wd-form-toast" />
  </view>
</template>
