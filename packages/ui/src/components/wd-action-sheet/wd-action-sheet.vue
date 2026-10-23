/*
 * wd-action-sheet — 动作面板
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 结构：view.wd-action-sheet-wrapper > wd-popup（bottom + round）> 内容视图，
 *   与 wot-ui 一致；
 * - 参考源用 watch + ref 维护 showPopup / formatPanels（受控 modelValue 与
 *   panels 归一化），此处逐段保留该逻辑；
 * - 参考源模板里的 block 元素（uni-app 专有、Lynx 无此内置元素）改为
 *   template v-if / v-for；view 内的裸文本包 text 元素；
 * - 面板横向轨道：参考源为 view + overflow-x: auto（Lynx 普通 view 不产生
 *   原生滚动），按 NATIVE-REWRITE §3.3 改用原生 scroll-view（scroll-x，
 *   类名与 DOM 层级不变）；
 * - 根视图显式 display: flex + flex-direction: column（NATIVE-REWRITE §3.1
 *   根节点三件套），并 flex-shrink: 0——弹层 .wd-popup 现为 flex column
 *   容器，操作项很多时本视图不被按比例压缩，超出部分由弹层滚动承担；
 * - 参考源 :style 字符串拼接（popup 的 background: transparent、内容视图的
 *   customStyle）改为对象语法并经 parseStyle 归一（字符串 :style 会被
 *   vue-lynx 静默丢弃，CONVENTIONS §19）；
 * - 命令式 API 经 defineExpose({ open / close }) 暴露（本地扩展，wot-ui 仅支持
 *   v-model 受控）：open 走 update:modelValue(true)，与受控通道同一出口；
 * - 选项/面板点击 @click → @tap（CONVENTIONS §6）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdPopup from '../../primitives/wd-popup/wd-popup.vue'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import WdLoading from '../../primitives/wd-loading/wd-loading.vue'
import { actionSheetProps, type Panel } from './types'
import { getSystemInfo, isArray, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(actionSheetProps)
const emit = defineEmits(['select', 'click-modal', 'cancel', 'leave', 'after-leave', 'close', 'enter', 'after-enter', 'update:modelValue'])

const formatPanels = ref<Array<Panel[]>>([])

/**
 * 有内容（actions / panels）时弹层本身透明，由内容视图承担背景；无内容时回落
 * 弹层自身的背景令牌（与 .wd-popup 的 background 声明等价）。
 *
 * 走 Style Funnel（CONVENTIONS §20）：background 键每帧都写全，条件由真转假时
 * 回落中性值，不会残留 transparent。
 */
const POPUP_STYLE = defineStyleKeys({ background: 'var(--wot-popup-bg, var(--wot-filled-oppo))' })

const popupStyle = computed<Record<string, string>>(() => {
  const hasContent = Boolean((props.actions && props.actions.length) || (props.panels && props.panels.length))
  return resolveStyle(POPUP_STYLE, { background: hasContent ? 'transparent' : '' })
})

const showPopup = ref<boolean>(false)
const ACTION_STYLE = defineStyleKeys({ color: '' })
const actionsStyle = computed(() => ({ 'max-height': `${getSystemInfo().windowHeight / 2}px` }))

watch(() => props.panels, computedValue, { deep: true, immediate: true })

watch(
  () => props.modelValue,
  (newValue) => {
    showPopup.value = newValue
  },
  { deep: true, immediate: true }
)

/**
 * 判断 panels 是否为一维数组
 */
function isPanelArray() {
  return props.panels.length && !isArray(props.panels[0])
}

/**
 * 计算面板数据
 */
function computedValue() {
  formatPanels.value = isPanelArray() ? [props.panels as Panel[]] : (props.panels as Panel[][])
}

/**
 * 点击选项
 * @param rowIndex 行索引
 * @param type 类型
 * @param colIndex 列索引
 */
function select(rowIndex: number, type: 'action' | 'panels', colIndex?: number) {
  if (type === 'action') {
    if (props.actions[rowIndex].disabled || props.actions[rowIndex].loading) {
      return
    }
    emit('select', {
      item: props.actions[rowIndex],
      index: rowIndex
    })
  } else if (isPanelArray()) {
    emit('select', {
      item: props.panels[Number(colIndex)],
      index: colIndex
    })
  } else {
    emit('select', {
      item: (props.panels as Panel[][])[rowIndex][Number(colIndex)],
      rowIndex,
      colIndex
    })
  }
  if (props.closeOnClickAction) {
    emit('update:modelValue', false)
  }
}

/**
 * 点击遮罩层
 */
function handleClickModal() {
  emit('click-modal')
}

/**
 * 点击取消按钮
 */
function handleCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}

/**
 * 关闭动作面板
 */
function close() {
  emit('update:modelValue', false)
  emit('close')
}

/**
 * 命令式打开（ref.open()，本地扩展）：与 v-model 受控通道同一出口。
 */
function open() {
  emit('update:modelValue', true)
}

defineExpose({ open, close })
</script>

<template>
  <view class="wd-action-sheet-wrapper">
    <WdPopup
      custom-class="wd-action-sheet-wrapper__popup"
      :custom-style="popupStyle"
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
      <view :class="`wd-action-sheet ${customClass}`" :style="parseStyle(customStyle)">
        <view v-if="title" :class="`wd-action-sheet__title ${customTitleClass}`">
          <text>{{ title }}</text>
          <slot name="close" :close="close">
            <WdIcon custom-class="wd-action-sheet__close" name="close" @tap="close" />
          </slot>
        </view>

        <slot>
          <scroll-view v-if="actions && actions.length" :scroll-y="true" class="wd-action-sheet__actions" :style="actionsStyle">
            <view
              v-for="(action, rowIndex) in actions"
              :key="rowIndex"
              :class="`wd-action-sheet__action ${title ? '' : 'is-border'} ${action.disabled ? 'wd-action-sheet__action--disabled' : ''}  ${
                action.loading ? 'wd-action-sheet__action--loading' : ''
              }`"
              :style="resolveStyle(ACTION_STYLE, { color: action.color })"
              @tap="select(rowIndex, 'action')"
            >
              <WdLoading custom-class="wd-action-sheet__action-loading" v-if="action.loading" />
              <text v-else class="wd-action-sheet__name">{{ action.name }}</text>
              <text v-if="!action.loading && action.description" class="wd-action-sheet__description">{{ action.description }}</text>
            </view>
          </scroll-view>
          <view v-if="isArray(formatPanels) && formatPanels.length" class="wd-action-sheet__panels-wrap">
            <view v-for="(panel, rowIndex) in formatPanels" :key="rowIndex" class="wd-action-sheet__panels">
              <!-- 横向滚动轨道用原生 scroll-view（NATIVE-REWRITE §3.3） -->
              <scroll-view :scroll-x="true" class="wd-action-sheet__panels-content">
                <view v-for="(col, colIndex) in panel" :key="colIndex" class="wd-action-sheet__panel" @tap="select(rowIndex, 'panels', colIndex)">
                  <WdIcon custom-class="wd-action-sheet__panel-img" :name="col.icon" />
                  <text class="wd-action-sheet__panel-title">{{ col.title }}</text>
                </view>
              </scroll-view>
            </view>
          </view>
        </slot>
        <view v-if="cancelText" class="wd-action-sheet__gap"></view>
        <view v-if="cancelText" class="wd-action-sheet__cancel" @tap="handleCancel">
          <text>{{ cancelText }}</text>
        </view>
      </view>
    </WdPopup>
  </view>
</template>
