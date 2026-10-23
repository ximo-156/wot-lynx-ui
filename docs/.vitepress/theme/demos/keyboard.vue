<script setup lang="ts">
/**
 * Keyboard 键盘 — 文档站 H5 预览演示（手工编写）。
 *
 * 覆盖 default / custom / car 三种模式；车牌键盘含中英切换与
 * autoSwitchLang（输入首位后自动切英文），布局对齐 wot-ui 的十列网格。
 */
import { ref } from 'vue'
import WdKeyboard from 'wot-lynx-ui/components/wd-keyboard/wd-keyboard.vue'
import WdButton from 'wot-lynx-ui/primitives/wd-button/wd-button.vue'
import WdInput from 'wot-lynx-ui/primitives/wd-input/wd-input.vue'

const defaultVisible = ref(false)
const customVisible = ref(false)
const carVisible = ref(false)

const payValue = ref('')
const customValue = ref('')
const carValue = ref('')
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">默认数字键盘</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button size="small" type="primary" @tap="defaultVisible = true">弹出键盘</wd-button>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">自定义键盘（mode="custom"）</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-input v-model="customValue" placeholder="点右侧按钮弹起自定义键盘" readonly style="flex: 1" />
          <wd-button size="small" @tap="customVisible = true">弹起键盘</wd-button>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">车牌号键盘（mode="car"）</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-input v-model="carValue" placeholder="点右侧按钮弹起车牌键盘" readonly style="flex: 1" />
          <wd-button size="small" @tap="carVisible = true">弹起键盘</wd-button>
        </view>
        <view class="wd-h5-demo__row">
          <text class="wd-h5-demo__panel-label">输入首位省份后 auto-switch-lang 自动切换英文键盘</text>
        </view>
      </view>
    </view>

    <wd-keyboard v-model="payValue" v-model:visible="defaultVisible" />
    <wd-keyboard v-model="customValue" v-model:visible="customVisible" mode="custom" extra-key="." close-text="关闭" />
    <wd-keyboard v-model="carValue" v-model:visible="carVisible" mode="car" :maxlength="8" auto-switch-lang />
  </scroll-view>
</template>
