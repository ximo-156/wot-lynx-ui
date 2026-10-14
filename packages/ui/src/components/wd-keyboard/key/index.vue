<template>
  <view :class="`wd-key-wrapper ${wider ? 'wd-key-wrapper--wider' : ''}`" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
    <view :class="keyClass">
      <WdLoading custom-class="wd-key__loading-icon" v-if="props.loading" />
      <template v-if="type === 'delete'">
        <template v-if="text">
          <text>{{ text }}</text>
        </template>
        <WdIcon v-else custom-class="wd-key__icon" name="del" size="22px"></WdIcon>
      </template>
      <template v-else-if="type === 'extra'">
        <template v-if="text">
          <text>{{ text }}</text>
        </template>
        <WdIcon v-else custom-class="wd-key__icon" name="keyboard" size="22px"></WdIcon>
      </template>
      <template v-else><text>{{ text }}</text></template>
    </view>
  </view>
</template>
<script lang="ts" setup>
import './index.css'
import WdLoading from '../../wd-loading/wd-loading.vue'
import WdIcon from '../../wd-icon/wd-icon.vue'
import { computed, ref } from 'vue-lynx'
import { useTouch } from '../../../composables/useTouch'
import { keyProps } from './types'

const props = defineProps(keyProps)
const emit = defineEmits(['press'])

const touch = useTouch()
const active = ref<boolean>(false)

const keyClass = computed(() => {
  return `wd-key ${props.large ? 'wd-key--large' : ''} ${props.type === 'delete' ? 'wd-key--delete' : ''} ${
    props.type === 'close' ? 'wd-key--close' : ''
  } ${props.type === 'extra' ? 'wd-key--extra' : ''} ${props.isCar ? 'is-car' : ''} ${
    active.value ? 'wd-key--active' : ''
  }`
})

/**
 * 触摸开始事件处理
 * @param {TouchEvent} event 触摸事件对象
 */
function onTouchStart(event: TouchEvent) {
  touch.touchStart(event)
  active.value = true
}

/**
 * 触摸移动事件处理
 * @param {TouchEvent} event 触摸事件对象
 */
function onTouchMove(event: TouchEvent) {
  touch.touchMove(event)
  if (touch.direction.value) {
    active.value = false
  }
}

/**
 * 触摸结束事件处理
 */
function onTouchEnd() {
  if (active.value) {
    active.value = false
    emit('press', props.text, props.type)
  }
}
</script>
