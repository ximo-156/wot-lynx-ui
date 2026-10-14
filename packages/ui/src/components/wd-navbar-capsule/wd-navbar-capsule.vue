<template>
  <view :class="`wd-navbar-capsule ${customClass}`" :style="styleToObject(customStyle)">
    <WdIcon @click="handleBack" name="left" custom-class="wd-navbar-capsule__icon" />
    <!-- Lynx 适配：wot-ui 用 ::after 绘制胶囊中间的分割线，Lynx 无伪元素，
         改为模板中的真实元素（样式见 index.scss 的 .wd-navbar-capsule__separator）。 -->
    <view class="wd-navbar-capsule__separator" />
    <WdIcon @click="handleBackHome" name="home" custom-class="wd-navbar-capsule__icon" />
  </view>
</template>
<script setup lang="ts">
import './index.css'
import { styleToObject } from '../../common/util'
import WdIcon from '../wd-icon/wd-icon.vue'
import { navbarCapsuleProps } from './types'

/**
 * 事件发送器
 */
const emit = defineEmits(['back', 'back-home'])

defineProps(navbarCapsuleProps)

/**
 * 处理返回事件
 */
function handleBack() {
  emit('back')
}

/**
 * 处理返回首页事件
 */
function handleBackHome() {
  emit('back-home')
}
</script>

