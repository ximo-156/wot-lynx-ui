/*
 * wd-share-sheet — 分享面板
 *
 * Lynx 实现说明：
 * - 结构：view.wd-share-sheet-wrapper > wd-popup（bottom + round）> 内容视图；
 * - 分享选项以宫格形式展示，图标支持内置图标名或图片 URL；
 * - 根节点三件套：display: flex + flex-direction: column；
 * - Style Funnel：rootStyle 经 defineStyleKeys + resolveStyle 输出完整键集；
 * - 选项点击 @click → @tap（CONVENTIONS §6）；
 * - 命令式 API 经 defineExpose({ open / close }) 暴露。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { shareSheetProps, type ShareOption } from './types'
import { parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(shareSheetProps)
const emit = defineEmits(['select', 'click-modal', 'cancel', 'update:modelValue'])

const showPopup = ref<boolean>(false)

watch(
  () => props.modelValue,
  (newValue) => {
    showPopup.value = newValue
  },
  { deep: true, immediate: true }
)

function onSelect(option: ShareOption, index: number) {
  if (option.disabled) return
  emit('select', { option, index })
}

function onClickModal() {
  emit('click-modal')
  if (props.closeOnClickModal) {
    emit('update:modelValue', false)
  }
}

function onCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}

defineExpose({
  open() {
    emit('update:modelValue', true)
  },
  close() {
    emit('update:modelValue', false)
  }
})
</script>

<template>
  <WdPopup
    v-model="showPopup"
    position="bottom"
    :round="true"
    :duration="duration"
    :z-index="zIndex"
    :safe-area-inset-bottom="safeAreaInsetBottom"
    @click-modal="onClickModal"
  >
    <view class="wd-share-sheet">
      <view v-if="title" class="wd-share-sheet__title">
        <text class="wd-share-sheet__title-text">{{ title }}</text>
      </view>
      <view class="wd-share-sheet__options">
        <view
          v-for="(option, index) in options"
          :key="index"
          :class="`wd-share-sheet__option ${option.disabled ? 'wd-share-sheet__option--disabled' : ''}`"
          @tap="onSelect(option, index)"
        >
          <view class="wd-share-sheet__option-icon">
            <WdIcon :name="option.icon" custom-class="wd-share-sheet__icon" />
          </view>
          <text class="wd-share-sheet__option-name">{{ option.name }}</text>
        </view>
      </view>
      <view class="wd-share-sheet__cancel" @tap="onCancel">
        <text class="wd-share-sheet__cancel-text">{{ cancelText }}</text>
      </view>
    </view>
  </WdPopup>
</template>
