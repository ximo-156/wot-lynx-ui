/*
 * wd-drop-menu-item — 下拉菜单项
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 结构对齐参考源：本组件只渲染浮层（view.wd-drop-item > wd-popup > 选项
 *   scroll-view），菜单条由父级 wd-drop-menu 渲染；定位用 fixed 包裹层 +
 *   popup 的 absolute 贴边（参考源方案），top/bottom 由父级 offset 推导；
 * - var(--window-top) / var(--window-bottom) 为 uni-app 内置 CSS 变量，
 *   Lynx 无该变量，按 PORTING §4.5 以 var(--window-top, 0px) 回退取 0；
 * - @click → @tap；选项文本包 text 元素（Lynx view 内裸文本不渲染）；
 * - 根 view 与 popup 的内联样式由参考源的字符串拼接改为对象语法
 *   （CONVENTIONS §19：字符串 :style 被静默丢弃），customPopupStyle 经
 *   parseStyle 归一；scroll-view 的 height 键恒写（CONVENTIONS §20）；
 * - 图标名映射：内置 180 图标集无 caret-down / check 字形（CONVENTIONS §8），
 *   模板内分别映射到 arrow-down-bold / check-item（与 wd-cell / wd-step 同方案），
 *   props 默认值保持与参考源一致，消费方传名透传；
 * - 异步拦截器（beforeToggle）落地前组件可能已卸载，回调里写 ref 前判活；
 * - root-portal 为小程序专有能力（Lynx 的 fixed 节点由引擎提升到页面根，
 *   无需 teleport），props 保留声明，由 wd-popup 自行降级。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, inject, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { pushToQueue, removeFromQueue } from '../../common/clickoutside'
import { type Queue, queueKey } from '../../composables/useQueue'
import type { PopupType } from '../wd-popup/types'
import { useParent } from '../../composables/useParent'
import { useAlive } from '../../composables/useAlive'
import { DROP_MENU_KEY } from '../wd-drop-menu/types'
import { isDef, parseStyle } from '../../common/util'
import { callInterceptor } from '../../common/interceptor'
import { dorpMenuItemProps, type DropMenuItemExpose } from './types'

const props = defineProps(dorpMenuItemProps)
const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
  (e: 'change', event: { value: string | number; selectedItem: Record<string, any> }): void
  (e: 'open'): void
  (e: 'opened'): void
  (e: 'close'): void
  (e: 'closed'): void
}>()

const isAlive = useAlive()
const queue = inject<Queue | null>(queueKey, null)
const showWrapper = ref<boolean>(false)
const showPop = ref<boolean>(false)
const position = ref<PopupType>()
const zIndex = ref<number>(12)
const duration = ref<number>(0)

const { parent: dropMenu } = useParent(DROP_MENU_KEY)

const { proxy } = getCurrentInstance() as any

const positionStyle = computed(() => {
  let style: string = ''
  if (showWrapper.value && dropMenu.value) {
    style =
      dropMenu.value.props.direction === 'down'
        ? `top: calc(var(--window-top, 0px) + ${dropMenu.value.offset.value}px); bottom: 0;`
        : `top: 0; bottom: calc(var(--window-bottom, 0px) + ${dropMenu.value.offset.value}px)`
  } else {
    style = ''
  }
  return style
})

/** 根 view 内联样式（对象语法，CONVENTIONS §19/§20） */
const rootStyle = computed<Record<string, string>>(() => {
  return {
    'z-index': String(zIndex.value),
    ...parseStyle(positionStyle.value),
    ...parseStyle(props.customStyle)
  }
})

/** popup 内联样式：max-height 恒写，未设置 popupHeight 时取 80% */
const popupStyle = computed<Record<string, string>>(() => {
  return {
    'max-height': props.popupHeight ? props.popupHeight : '80%',
    ...parseStyle(props.customPopupStyle)
  }
})

/** 选项滚动区高度键恒写（CONVENTIONS §20） */
const scrollViewStyle = computed<Record<string, string>>(() => {
  return { height: props.popupHeight ? props.popupHeight : 'auto' }
})

watch(
  () => props.modelValue,
  (newValue) => {
    if (isDef(newValue) && typeof newValue !== 'number' && typeof newValue !== 'string') {
      console.error('[wot-design] warning(wd-drop-menu-item): the type of value should be a number or a string.')
    }
  },
  {
    deep: true,
    immediate: true
  }
)

onBeforeMount(() => {
  if (queue && queue.pushToQueue) {
    queue.pushToQueue(proxy)
  } else {
    pushToQueue(proxy)
  }
})

onBeforeUnmount(() => {
  if (queue && queue.removeFromQueue) {
    queue.removeFromQueue(proxy)
  } else {
    removeFromQueue(proxy)
  }
})

function getShowPop() {
  return showPop.value
}
// 模拟单选操作 默认根据 value 选中操作
function choose(index: number) {
  if (props.disabled) return
  const { valueKey } = props
  const item = props.options[index]
  const newValue = item[valueKey] !== undefined ? item[valueKey] : item
  emit('update:modelValue', newValue)
  emit('change', {
    value: newValue,
    selectedItem: item
  })
  close()
}
// 外部关闭弹出框
function close() {
  if (!showPop.value) {
    return
  }
  callInterceptor(props.beforeToggle, {
    args: [{ status: false }],
    done: handleClose
  })
}

function handleClose() {
  // 异步拦截器落地前组件可能已卸载：晚到写入不得作用在死树上
  if (!isAlive()) return
  if (showPop.value) {
    showPop.value = false
  }
}

function open() {
  if (showPop.value) {
    return
  }
  callInterceptor(props.beforeToggle, {
    args: [{ status: true }],
    done: handleOpen
  })
}

function handleOpen() {
  if (!isAlive()) return
  showWrapper.value = true
  showPop.value = true
  if (dropMenu.value) {
    duration.value = Number(dropMenu.value.props.duration)
    position.value = dropMenu.value.props.direction === 'down' ? 'top' : 'bottom'
  }
}

function toggle() {
  if (showPop.value) {
    close()
  } else {
    open()
  }
}

function afterLeave() {
  showWrapper.value = false
  emit('closed')
}
function beforeEnter() {
  emit('open')
}
function afterEnter() {
  emit('opened')
}
function beforeLeave() {
  emit('close')
}

defineExpose<DropMenuItemExpose>({ getShowPop, open, close, toggle })
</script>

<template>
  <view v-if="showWrapper" :class="`wd-drop-item ${customClass}`" :style="rootStyle">
    <wd-popup
      v-model="showPop"
      :z-index="zIndex"
      :duration="duration"
      :position="position"
      :custom-style="popupStyle"
      :custom-class="`${customPopupClass} wd-drop-item__popup`"
      :modal="false"
      :close-on-click-modal="false"
      :root-portal="rootPortal"
      @before-enter="beforeEnter"
      @after-enter="afterEnter"
      @before-leave="beforeLeave"
      @after-leave="afterLeave"
    >
      <slot>
        <scroll-view :style="scrollViewStyle" scroll-y scroll-with-animation :show-scrollbar="true">
          <view
            v-for="(item, index) in options"
            :key="index"
            @tap="choose(index)"
            :class="`wd-drop-item__option ${(item[valueKey] !== '' ? item[valueKey] : item) === modelValue ? 'is-active' : ''}`"
          >
            <view class="wd-drop-item__title">
              <text class="wd-drop-item__title-text">{{ item[labelKey] ? item[labelKey] : item }}</text>
              <text v-if="item[tipKey]" class="wd-drop-item__tip">{{ item[tipKey] }}</text>
            </view>
            <!-- Lynx 适配：check 字形映射到 check-item（CONVENTIONS §8） -->
            <wd-icon v-if="(item[valueKey] !== '' ? item[valueKey] : item) === modelValue" :name="iconName === 'check' ? 'check-item' : iconName" custom-class="wd-drop-item__icon" />
          </view>
        </scroll-view>
      </slot>
    </wd-popup>
  </view>
</template>
