<template>
  <WdTransition :show="show" name="fade">
    <view
      :class="`wd-backtop ${customClass} is-${shape}`"
      :style="styleToObject(`z-index: ${zIndex}; bottom: ${bottom}px; right: ${right}px; ${customStyle}`)"
      @tap="handleBacktop"
    >
      <slot>
        <view class="wd-backtop__content">
          <!-- Lynx 适配：wd-icon 的 svg content 不继承 CSS currentColor，颜色需显式下发。 -->
          <WdIcon custom-class="wd-backtop__backicon" name="to-top" :color="iconColor" :custom-style="iconStyle" />
          <text class="wd-backtop__text" v-if="text"><text>{{ text }}</text></text>
        </view>
      </slot>
    </view>
  </WdTransition>
</template>

<script setup lang="ts">
import './index.css'
import { uni } from '../../common/uni'
import { styleToObject } from '../../common/util'
import WdTransition from '../wd-transition/wd-transition.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { computed } from 'vue-lynx'
import { backtopProps } from './types'
import { BLUE } from '../../common/theme'

const props = defineProps(backtopProps)

/**
 * 回到顶部图标取色
 * Lynx 适配：wd-icon 的 svg content 不继承 CSS currentColor，需显式下发颜色，
 * 取值与主题变量 --wot-primary-6 保持一致（见 common/theme.ts）。
 */
const iconColor = BLUE[6]

/**
 * 是否显示回到顶部按钮
 */
const show = computed(() => props.scrollTop > props.top)

/**
 * 处理点击回到顶部
 */
function handleBacktop() {
  uni.pageScrollTo({
    scrollTop: 0,
    duration: props.duration
  })
}
</script>

