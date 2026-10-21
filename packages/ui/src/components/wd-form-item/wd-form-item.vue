/*
 * wd-form-item — 表单项
 *
 * 与 wot-ui 2.3.2 对齐；Lynx 适配点（相对参考源的差异）：
 * - 根节点三件套（NATIVE-REWRITE §3.1）：本组件 DOM 根视图由 wd-cell 提供
 *   （custom-class 把 wd-form-item 类落到 cell 根视图上），index.scss 对
 *   .wd-form-item 显式声明 display:flex + flex-direction:column，保证
 *   Lynx 3.x 默认 linear 布局下纵向堆叠、宽度撑满表单；
 * - 结构基于 wd-cell（标题/标签/右侧内容/箭头），错误信息内联展示；
 *   错误提示文本包 text（Lynx view 内裸文本不渲染，CONVENTIONS §4）；
 * - 经 FORM_KEY 读取 form 配置与校验入口；向下提供禁用态
 *   （FORM_ITEM_DISABLED_KEY）与校验触发（FORM_ITEM_VALIDATE_KEY）；
 * - 字段值变化时按 validateTrigger 自动校验；schema.validate 由消费方
 *   提供，抛错时就地兜底告警，不冒泡成未处理的 Promise 拒绝（真机
 *   Sentry USER_RUNTIME_ERROR 防护，与 common/interceptor 约定一致）；
 * - 平台 options 块（virtualHost / styleIsolation / addGlobalClass）为
 *   小程序专有能力，Lynx 不需要，未声明；
 * - click 事件由 wd-cell 的 @tap 链路转发（cell 根 view 已声明并转发
 *   tap，CONVENTIONS §14）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, provide, watch } from 'vue-lynx'
import { useChildren } from '../../composables/useChildren'
import { useParent } from '../../composables/useParent'
import WdCell from '../wd-cell/wd-cell.vue'
import { FORM_KEY, FORM_ITEM_DISABLED_KEY } from '../../composables/useFormDisabled'
import { FORM_ITEM_VALIDATE_KEY } from '../../composables/useFormItemValidate'
import { FORM_VALIDATE_EVENTS, type FormValidateEvent, type FormValidateTrigger, type FormProps } from '../wd-form/types'
import type { CellAsteriskPosition, CellLayout, CellSize, CellValueAlign } from '../wd-cell/types'
import { formItemProps } from './types'
import { getPropByPath, isDef } from '../../common/util'

const props = defineProps(formItemProps)

const { parent: form, index } = useParent(FORM_KEY)
const { linkChildren } = useChildren(FORM_ITEM_VALIDATE_KEY)

const emit = defineEmits(['click'])

// 本地共享契约（composables/useFormDisabled 的 FormProvide.props）未声明
// schema 字段，此处按 wd-form/types 的 FormProps 读取（星号推导需要）；
// disabled 的 null 归一为 undefined：显式传 null 与「未设置」在布尔语义上
// 等价（isDef 判空），归一后与 FORM_ITEM_DISABLED_KEY 的契约类型一致
const isDisabled = computed<boolean | undefined>(() => {
  const disabled = isDef(props.disabled) ? props.disabled : form.value?.props.disabled
  return isDef(disabled) ? disabled : undefined
})

provide(FORM_ITEM_DISABLED_KEY, {
  disabled: isDisabled
})

function handleClick() {
  if (isDisabled.value) return
  emit('click')
}

function normalizeValidateTrigger(trigger?: FormValidateTrigger | FormValidateTrigger[]): FormValidateEvent[] {
  const triggerList = Array.isArray(trigger) ? trigger : trigger ? [trigger] : []
  return triggerList.filter((item): item is FormValidateEvent => {
    return FORM_VALIDATE_EVENTS.includes(item as FormValidateEvent)
  })
}

const validateTriggerSet = computed(() => {
  const formTrigger = form.value?.props.validateTrigger
  const currentTrigger = isDef(props.validateTrigger) ? props.validateTrigger : formTrigger
  return new Set(normalizeValidateTrigger(currentTrigger as FormValidateTrigger | FormValidateTrigger[] | undefined))
})

function shouldTrigger(event: FormValidateEvent): boolean {
  return validateTriggerSet.value.has(event)
}

async function validateByTrigger(event: FormValidateEvent): Promise<void> {
  if (!props.prop || !shouldTrigger(event)) {
    return
  }
  // schema.validate 由消费方提供，同步抛错或返回被拒绝的 Promise 属可预期
  // 的消费方缺陷：此处统一兜底告警（与 common/interceptor 的约定一致），
  // 不冒泡成未处理的 Promise 拒绝（真机 Sentry USER_RUNTIME_ERROR）
  try {
    await form.value?.validate?.(props.prop)
  } catch (error) {
    console.error('[wot-lynx-ui] wd-form-item 校验执行失败（已兜底，未向上抛出）', error)
  }
}

const propValue = computed(() => {
  if (!props.prop) {
    return undefined
  }
  return getPropByPath(form.value?.props.model, props.prop)
})

watch(
  () => propValue.value,
  async () => {
    await validateByTrigger('change')
  },
  {
    deep: true
  }
)

linkChildren({
  prop: props.prop,
  shouldTrigger,
  validateByTrigger
})

const errorMessage = computed(() => {
  if (form.value && props.prop && form.value.errorMessages && form.value.errorMessages[props.prop]) {
    return form.value.errorMessages[props.prop]
  } else {
    return ''
  }
})

const formItemBorder = computed(() => {
  if (isDef(props.border)) {
    return props.border
  }
  if (index.value > 0 && form.value && form.value.props.border) {
    return true
  }
  return false
})

const formItemCenter = computed(() => {
  return isDef(props.center) ? props.center : form.value?.props.center
})

const formItemSize = computed<CellSize | undefined>(() => {
  return isDef(props.size) ? props.size : (form.value?.props.size as CellSize | undefined)
})

const formItemTitleWidth = computed(() => {
  return isDef(props.titleWidth) ? props.titleWidth : form.value?.props.titleWidth || '98px'
})

const formItemLayout = computed<CellLayout>(() => {
  return (isDef(props.layout) ? props.layout : (form.value?.props.layout as CellLayout | undefined)) || 'horizontal'
})

const formItemValueAlign = computed<CellValueAlign>(() => {
  return (isDef(props.valueAlign) ? props.valueAlign : (form.value?.props.valueAlign as CellValueAlign | undefined)) || 'left'
})

const formItemEllipsis = computed(() => {
  return isDef(props.ellipsis) ? props.ellipsis : form.value?.props.ellipsis
})

const formItemAsteriskPosition = computed<CellAsteriskPosition | undefined>(() => {
  return isDef(props.asteriskPosition) ? props.asteriskPosition : (form.value?.props.asteriskPosition as CellAsteriskPosition | undefined)
})

const formItemHideAsterisk = computed(() => {
  return isDef(props.hideAsterisk) ? props.hideAsterisk : form.value?.props.hideAsterisk
})

// 必填星号：显式 required 优先，否则由 schema.isRequired(path) 推导。
// schema 经 FormProps 读取：共享契约 FormProvide.props 未声明该字段
// （composables/useFormDisabled 缺 schema，见交付报告）
const formSchema = computed(() => (form.value?.props as Partial<FormProps> | undefined)?.schema)

const isRequired = computed(() => {
  if (props.required === true) {
    return true
  }
  if (!props.prop || !formSchema.value?.isRequired) {
    return false
  }
  return !!formSchema.value.isRequired(props.prop)
})

const showPlaceholder = computed(() => {
  return Boolean(props.placeholder && (props.value === '' || props.value === undefined || props.value === null))
})
</script>

<template>
  <WdCell
    :custom-class="`wd-form-item ${isDisabled ? 'is-disabled' : ''} ${customClass}`"
    :custom-style="customStyle"
    :use-title-slot="!!$slots.title"
    :title="title"
    :use-label-slot="!!$slots.label"
    :label="label"
    :title-width="formItemTitleWidth"
    :prefix-icon="prefixIcon"
    :icon-size="iconSize"
    :icon-prefix="iconPrefix"
    :css-icon="cssIcon"
    :required="isRequired"
    :size="formItemSize"
    :value-align="formItemValueAlign"
    :center="formItemCenter"
    :ellipsis="formItemEllipsis"
    :clickable="!isDisabled && clickable"
    :is-link="!isDisabled && isLink"
    :asterisk-position="formItemAsteriskPosition"
    :border="formItemBorder"
    :hide-asterisk="formItemHideAsterisk"
    :layout="formItemLayout"
    :custom-prefix-class="customPrefixClass"
    :custom-label-class="customLabelClass"
    :custom-title-class="customTitleClass"
    :custom-value-class="customValueClass"
    @click="handleClick"
  >
    <template #title v-if="$slots.title">
      <slot name="title"></slot>
    </template>

    <template #label v-if="$slots.label">
      <slot name="label"></slot>
    </template>

    <slot>
      <text v-if="showPlaceholder" class="wd-form-item__placeholder">{{ placeholder }}</text>
      <text v-else-if="isDef(value)">{{ value }}</text>
    </slot>
    <view v-if="errorMessage" class="wd-form-item__error-message"><text>{{ errorMessage }}</text></view>
  </WdCell>
</template>
