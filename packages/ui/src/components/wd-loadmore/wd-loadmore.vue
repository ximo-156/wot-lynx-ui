<template>
  <view :class="['wd-loadmore', customClass]" :style="styleToObject(customStyle)" @tap="reload">
    <slot v-if="state === 'finished'" name="finished">
      <WdDivider custom-class="wd-loadmore__divider"><text>{{ finishedText || translate('finished') }}</text></WdDivider>
    </slot>
    <slot v-else-if="state === 'error'" name="error">
      <text class="wd-loadmore__text"><text>{{ errorText || translate('error') }}</text></text>
      <text class="wd-loadmore__refresh-text"><text>{{ translate('retry') }}</text></text>
      <WdIcon name="refresh" custom-class="wd-loadmore__refresh" :color="BLUE6" />
    </slot>
    <slot v-else-if="state === 'loading'" name="loading">
      <WdLoading v-bind="customLoadingProps" />
      <text class="wd-loadmore__text"><text>{{ loadingText || translate('loading') }}</text></text>
    </slot>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import WdDivider from '../wd-divider/wd-divider.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { BLUE } from '../../common/theme'

/** 刷新图标色：Lynx 的 wd-icon SVG 不吃 CSS color */
const BLUE6 = BLUE[6]
import { computed, ref } from 'vue-lynx'
import { useTranslate } from '../../composables/useTranslate'
import { loadmoreProps, type LoadMoreState } from './types'
import type { LoadingProps } from '../wd-loading/types'
import { styleToObject, isDef, isUndefined, omitBy } from '../../common/util'

// 计算 Loading 组件的属性 - 合并用户传入的属性和组件需要的自定义样式
const customLoadingProps = computed(() => {
  const loadingProps: Partial<LoadingProps> = isDef(props.loadingProps) ? omitBy(props.loadingProps, isUndefined) : {}
  loadingProps.customClass = `wd-loadmore__loading ${loadingProps.customClass || ''}`
  return loadingProps
})

const props = defineProps(loadmoreProps)
const emit = defineEmits(['reload'])

const { translate } = useTranslate('loadmore')

/** 当前加载状态 */
const currentState = ref<LoadMoreState | null>(null)

/**
 * 处理重新加载操作 - 当加载失败时，点击可触发 reload 事件
 */
function reload() {
  if (props.state !== 'error') return
  currentState.value = 'loading'
  emit('reload')
}
</script>

