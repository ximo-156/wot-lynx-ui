/*
 * wd-address-edit — 地址编辑
 *
 * Lynx 实现说明：
 * - 结构：view.wd-address-edit > 表单区域 + 底部操作栏；
 * - 表单字段：姓名、电话、地区选择、详细地址、默认开关；
 * - 根节点三件套：display: flex + flex-direction: column；
 * - Style Funnel：rootStyle 经 defineStyleKeys + resolveStyle 输出完整键集；
 * - 按钮点击 @click → @tap（CONVENTIONS §6）。
 *
 * ⚠️ 降级标注：**内置省市区选择面板未实现**。点击「地区」只 emit
 * 'change-area'，由消费方自行弹出选择器并回填 addressInfo；areaList /
 * searchPlaceholder / showSearchResult / areaColumns 四个 props 仅为
 * wot-ui API 对齐保留、当前不生效（wot-ui 的内置面板依赖地区数据集，
 * 见 CONVENTIONS §12 降级清单）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdButton from '../../primitives/wd-button/wd-button.vue'
import WdCell from '../../primitives/wd-cell/wd-cell.vue'
import WdCellGroup from '../wd-cell-group/wd-cell-group.vue'
import WdInput from '../../primitives/wd-input/wd-input.vue'
import WdTextarea from '../../primitives/wd-textarea/wd-textarea.vue'
import WdSwitch from '../wd-switch/wd-switch.vue'
import { addressEditProps, type AddressInfo } from './types'
import { parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(addressEditProps)
const emit = defineEmits(['save', 'delete', 'change-area'])

const formData = ref<AddressInfo>({ ...props.addressInfo })

watch(
  () => props.addressInfo,
  (newVal) => {
    formData.value = { ...newVal }
  },
  { deep: true }
)

const ADDRESS_STYLE = defineStyleKeys({})

const rootStyle = computed(() => {
  return {
    ...resolveStyle(ADDRESS_STYLE, {}),
    ...parseStyle(props.customStyle)
  }
})

function onSave() {
  if (props.disabled) return
  emit('save', { ...formData.value })
}

function onDelete() {
  if (props.disabled) return
  emit('delete', { ...formData.value })
}

function onChangeArea() {
  if (props.disabled) return
  emit('change-area', { ...formData.value })
}
</script>

<template>
  <view class="wd-address-edit" :class="customClass" :style="rootStyle">
    <view class="wd-address-edit__fields">
      <WdInput
        v-model="formData.name"
        label="联系人"
        placeholder="姓名"
        :disabled="disabled"
        custom-class="wd-address-edit__field"
      />
      <WdInput
        v-model="formData.tel"
        label="电话"
        type="tel"
        placeholder="手机号码"
        :disabled="disabled"
        custom-class="wd-address-edit__field"
      />
      <WdCell
        title="地区"
        :value="formData.province ? `${formData.province} ${formData.city || ''} ${formData.county || ''}`.trim() : '请选择地区'"
        :is-link="!disabled"
        custom-class="wd-address-edit__field"
        @tap="onChangeArea"
      />
      <WdTextarea
        v-if="showDetail"
        v-model="formData.addressDetail"
        label="详细地址"
        :placeholder="'请输入详细地址'"
        :maxlength="detailMaxlength"
        :disabled="disabled"
        custom-class="wd-address-edit__field"
      />
      <WdInput
        v-if="showPostalCode"
        v-model="formData.postalCode"
        label="邮政编码"
        type="number"
        placeholder="邮政编码"
        :disabled="disabled"
        custom-class="wd-address-edit__field"
      />
      <WdInput
        v-if="showAreaCode"
        v-model="formData.areaCode"
        label="地区编码"
        placeholder="地区编码"
        :disabled="disabled"
        custom-class="wd-address-edit__field"
      />
    </view>
    <view v-if="showSetDefault" class="wd-address-edit__default">
      <text class="wd-address-edit__default-label">设为默认地址</text>
      <WdSwitch v-model="formData.isDefault" :disabled="disabled" />
    </view>
    <view class="wd-address-edit__actions">
      <WdButton
        v-if="showDeleteButton"
        type="danger"
        plain
        :disabled="disabled"
        custom-class="wd-address-edit__delete-btn"
        @tap="onDelete"
      >
        {{ deleteButtonText }}
      </WdButton>
      <WdButton
        v-if="showSaveButton"
        type="primary"
        :disabled="disabled"
        custom-class="wd-address-edit__save-btn"
        @tap="onSave"
      >
        {{ saveButtonText }}
      </WdButton>
    </view>
  </view>
</template>
