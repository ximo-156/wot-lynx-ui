/*
 * wd-action-sheet — 动作面板
 *
 * Lynx 实现说明：基于 wd-popup（bottom + round）；
 * 支持菜单列表（actions）与宫格面板（panels 分组）两种形态。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import { actionSheetProps, type Action, type Panel } from './types'
import { isArray } from '../../common/util'

const props = defineProps(actionSheetProps)
const emit = defineEmits(['select', 'close', 'update:modelValue', 'enter', 'after-enter', 'leave', 'after-leave', 'click-modal'])

const showPopup = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const formatPanels = computed(() => {
  if (!isArray(props.panels)) return []
  // 一维数组自动按 3 个一组分组
  const first = props.panels[0]
  if (first && !isArray(first)) {
    const panels = props.panels as Panel[]
    const result: Panel[][] = []
    for (let i = 0; i < panels.length; i += 3) {
      result.push(panels.slice(i, i + 3))
    }
    return result
  }
  return props.panels as Panel[][]
})

function select(rowIndex: number, type: 'action' | 'panels', colIndex?: number) {
  if (type === 'action') {
    const action = props.actions[rowIndex] as Action
    if (action.disabled || action.loading) return
    emit('select', { item: action, index: rowIndex })
  } else {
    const panel = (formatPanels.value[rowIndex] as Panel[])[colIndex!]
    if (panel.disabled) return
    emit('select', { item: panel, index: colIndex })
  }
  if (props.closeOnClickAction) {
    close()
  }
}

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function handleClickModal() {
  emit('click-modal')
  if (props.closeOnClickModal) {
    close()
  }
}
</script>

<template>
  <view class="wd-action-sheet-wrapper">
    <wd-popup
      custom-class="wd-action-sheet-wrapper__popup"
      :custom-style="`${(actions && actions.length) || (panels && panels.length) ? 'background: transparent;' : ''}`"
      v-model="showPopup"
      :duration="duration"
      position="bottom"
      :close-on-click-modal="closeOnClickModal"
      :safe-area-inset-bottom="safeAreaInsetBottom"
      :lazy-render="lazyRender"
      :root-portal="rootPortal"
      round
      @close="close"
      @enter="emit('enter')"
      @after-enter="emit('after-enter')"
      @leave="emit('leave')"
      @after-leave="emit('after-leave')"
      @click-modal="handleClickModal"
      :z-index="zIndex"
    >
      <view :class="`wd-action-sheet ${customClass}`" :style="customStyle">
        <view v-if="title" :class="`wd-action-sheet__title ${customTitleClass}`">
          <text class="wd-action-sheet__title-text">{{ title }}</text>
          <slot name="close" :close="close">
            <wd-icon custom-class="wd-action-sheet__close" name="close" @tap="close" />
          </slot>
        </view>

        <slot>
          <view v-if="actions && actions.length" class="wd-action-sheet__actions">
            <view
              v-for="(action, rowIndex) in actions"
              :key="rowIndex"
              :class="[
                'wd-action-sheet__action',
                title ? '' : 'is-border',
                action.disabled ? 'wd-action-sheet__action--disabled' : '',
                action.loading ? 'wd-action-sheet__action--loading' : ''
              ]"
              :style="`color: ${action.color || ''}`"
              @tap="select(rowIndex, 'action')"
            >
              <wd-loading v-if="action.loading" custom-class="wd-action-sheet__action-loading" />
              <text v-else class="wd-action-sheet__name">{{ action.name }}</text>
              <text v-if="!action.loading && action.description" class="wd-action-sheet__description">{{ action.description }}</text>
            </view>
          </view>
          <view v-if="formatPanels.length" class="wd-action-sheet__panels-wrap">
            <view v-for="(panel, rowIndex) in formatPanels" :key="rowIndex" class="wd-action-sheet__panels">
              <view class="wd-action-sheet__panels-content">
                <view
                  v-for="(col, colIndex) in panel"
                  :key="colIndex"
                  class="wd-action-sheet__panel"
                  @tap="select(rowIndex, 'panels', colIndex)"
                >
                  <wd-icon custom-class="wd-action-sheet__panel-img" :name="col.icon" />
                  <text class="wd-action-sheet__panel-title">{{ col.title }}</text>
                </view>
              </view>
            </view>
          </view>
        </slot>

        <view v-if="cancelText" class="wd-action-sheet__gap" />
        <view v-if="cancelText" class="wd-action-sheet__cancel" @tap="close">
          <text class="wd-action-sheet__cancel-text">{{ cancelText }}</text>
        </view>
      </view>
    </wd-popup>
  </view>
</template>
