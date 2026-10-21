/* wd-share-sheet — 本地扩展；wot-ui 2.3.2 不包含此组件。 */
<script lang="ts" setup>
import './index.css'

import { ref, watch } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { shareSheetProps, type ShareOption } from './types'
import { parseStyle } from '../../common/util'

const props = defineProps(shareSheetProps)
const emit = defineEmits(['select', 'click-modal', 'cancel', 'update:modelValue'])
const showPopup = ref(props.modelValue)
watch(() => props.modelValue, (value) => { showPopup.value = value })
function setVisible(value: boolean) {
  showPopup.value = value
  emit('update:modelValue', value)
}
function onSelect(option: ShareOption, index: number) { if (!option.disabled) emit('select', { option, index }) }
function onClickModal() { emit('click-modal'); if (props.closeOnClickModal) setVisible(false) }
function onCancel() { emit('cancel'); setVisible(false) }
defineExpose({ open: () => setVisible(true), close: () => setVisible(false) })
</script>

<template>
  <WdPopup :model-value="showPopup" position="bottom" round :duration="duration" :z-index="zIndex" :safe-area-inset-bottom="safeAreaInsetBottom" :close-on-click-modal="false" @click-modal="onClickModal">
    <view :class="['wd-share-sheet', customClass]" :style="parseStyle(customStyle)">
      <view v-if="title" class="wd-share-sheet__title"><text class="wd-share-sheet__title-text">{{ title }}</text></view>
      <view class="wd-share-sheet__options">
        <view v-for="(option, index) in options" :key="index" :class="['wd-share-sheet__option', { 'wd-share-sheet__option--disabled': option.disabled }]" @tap="onSelect(option, index)">
          <view class="wd-share-sheet__option-icon"><WdIcon :name="option.icon" custom-class="wd-share-sheet__icon" /></view>
          <text class="wd-share-sheet__option-name">{{ option.name }}</text>
        </view>
      </view>
      <view class="wd-share-sheet__cancel" @tap="onCancel"><text class="wd-share-sheet__cancel-text">{{ cancelText }}</text></view>
    </view>
  </WdPopup>
</template>
