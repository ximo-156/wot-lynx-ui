/*
 * wd-loadmore — 加载更多
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 参考源根 view 绑 @click，Lynx view 不存在 click 事件（只派发 tap，
 *   CONVENTIONS §14 订正），改绑 @tap；同时按 §14 在 emits 声明 'tap' 并在
 *   处理器里转发，消费方在组件上绑 @tap 才不会落入 mergeProps 合并崩溃；
 * - 参考源根 view 直接绑定 customStyle 字符串，改为 parseStyle(customStyle)
 *   归一的对象语法（CONVENTIONS §19）；
 * - 参考源经 getRect(selector, false, proxy) 的能力本组件未使用；内部
 *   wd-loading 的属性合并（omitBy 去 undefined 后追加 wd-loadmore__loading
 *   类名）与参考源一致，loading 根节点挂该类名供 edeep(loading) 规则命中；
 * - 参考源 options 块的 virtualHost / addGlobalClass / styleIsolation 为
 *   uni-app 小程序专有能力，Lynx 无需声明，已移除；
 * - 原生优先重写（NATIVE-REWRITE §3）：本组件为纯展示（仅根 view 的 tap
 *   重试，无跟手手势，不涉及 MTS），根 view 经 SCSS 显式补全 flex-direction:
 *   row（「加载图标 + 文案」横向行；不写则 Lynx 3.x linear 布局下被静默丢弃
 *   排成纵向），justify-content + align-items 成对居中，文本节点另加
 *   text-align: center 双保险。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import WdDivider from '../wd-divider/wd-divider.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { useTranslate } from '../../composables/useTranslate'
import { loadmoreProps, type LoadMoreState } from './types'
import type { LoadingProps } from '../wd-loading/types'
import { isDef, isUndefined, omitBy, parseStyle } from '../../common/util'

// 计算 Loading 组件的属性 - 合并用户传入的属性和组件需要的自定义样式
const customLoadingProps = computed(() => {
  const loadingProps: Partial<LoadingProps> = isDef(props.loadingProps) ? omitBy(props.loadingProps, isUndefined) : {}
  loadingProps.customClass = `wd-loadmore__loading ${loadingProps.customClass || ''}`
  return loadingProps
})

const props = defineProps(loadmoreProps)
const emit = defineEmits(['reload', 'tap'])

const { translate } = useTranslate('loadmore')

/** 当前加载状态 */
const currentState = ref<LoadMoreState | null>(null)

/**
 * 处理重新加载操作 - 当加载失败时，点击可触发 reload 事件
 */
function reload(event: any) {
  if (props.state !== 'error') return
  currentState.value = 'loading'
  emit('reload')
  // Lynx 适配：根 view 绑 @tap，按 CONVENTIONS §14 转发原生 tap 事件，
  // 避免消费方 @tap 穿透 $attrs 与根元素同名监听合并成数组
  emit('tap', event)
}
</script>

<template>
  <view :class="['wd-loadmore', customClass]" :style="parseStyle(customStyle)" @tap="reload">
    <slot v-if="state === 'finished'" name="finished">
      <WdDivider custom-class="wd-loadmore__divider">{{ finishedText || translate('finished') }}</WdDivider>
    </slot>
    <slot v-else-if="state === 'error'" name="error">
      <text class="wd-loadmore__text">{{ errorText || translate('error') }}</text>
      <text class="wd-loadmore__refresh-text">{{ translate('retry') }}</text>
      <WdIcon name="refresh" custom-class="wd-loadmore__refresh" />
    </slot>
    <slot v-else-if="state === 'loading'" name="loading">
      <WdLoading v-bind="customLoadingProps" />
      <text class="wd-loadmore__text">{{ loadingText || translate('loading') }}</text>
    </slot>
  </view>
</template>
