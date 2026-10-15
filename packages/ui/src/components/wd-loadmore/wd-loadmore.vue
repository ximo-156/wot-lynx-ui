/*
 * wd-loadmore — 加载更多
 *
 * Lynx 实现说明：loading / error / finished 三态；
 * error 态可点击重试（emit reload）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdDivider from '../wd-divider/wd-divider.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { loadmoreProps } from './types'
import { useTranslate } from '../../composables/useTranslate'
import { isDef, isUndefined, omitBy, parseStyle } from '../../common/util'

const props = defineProps(loadmoreProps)
const emit = defineEmits(['reload', 'tap'])

const { translate } = useTranslate('loadmore')

const customLoadingProps = computed(() => {
  const overrides = isDef(props.loadingProps) ? omitBy(props.loadingProps!, isUndefined) : {}
  return { ...overrides, customSpinnerClass: 'wd-loadmore__loading' }
})

function reload() {
  if (props.state === 'error') {
    emit('reload')
  }
  emit('tap')
}
</script>

<template>
  <view :class="['wd-loadmore', customClass]" :style="parseStyle(customStyle)" @tap="reload">
    <slot v-if="state === 'finished'" name="finished">
      <wd-divider custom-class="wd-loadmore__divider">{{ finishedText || translate('finished') }}</wd-divider>
    </slot>
    <slot v-else-if="state === 'error'" name="error">
      <text class="wd-loadmore__text">{{ errorText || translate('error') }}</text>
      <text class="wd-loadmore__refresh-text">{{ translate('retry') }}</text>
      <wd-icon name="refresh" custom-class="wd-loadmore__refresh" />
    </slot>
    <slot v-else-if="state === 'loading'" name="loading">
      <wd-loading v-bind="customLoadingProps" />
      <text class="wd-loadmore__text">{{ loadingText || translate('loading') }}</text>
    </slot>
  </view>
</template>
