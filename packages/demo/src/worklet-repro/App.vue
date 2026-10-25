<!--
  最小复现页：Lynx Web 预览里点击时抛
  `Uncaught TypeError: Cannot read properties of undefined (reading 'bind')`
  （栈顶 `S @ web-core-main-thread-apis.js:1:3556`，即事件分发里的
  `g.globalWindow.runWorklet?.(s.value, [d])` 这一支）。

  四个用例按「handler 形态」递进，点一下看控制台哪几条报错：

    1 纯 @tap            —— handler 是字符串事件名，走 publishEvent（对照组）
    2 纯 worklet         —— 只有 :main-thread-bindtouchstart，handler 是 worklet 对象
    3 worklet + @tap     —— 同一个 view 上两种都挂（wd-button 的形状）
    4 wd-button          —— 库组件，自带 hover worklet + @tap

  worklet 跑通的视觉信号：方块背景变绿（主线程 setStyleProperty）。
  只打印日志不变绿 = worklet 没执行。

  跑起来：
    pnpm --filter wot-lynx-demo exec rspeedy dev -c lynx.config.worklet-repro.ts
    浏览器开 http://localhost:3100/__web_preview?casename=worklet-repro.web.bundle
-->
<script setup lang="ts">
import { useMainThreadRef } from 'vue-lynx'

const ref2 = useMainThreadRef<any>(null)
const ref3 = useMainThreadRef<any>(null)

// 用例 2：只有 worklet，没有 @tap
const onWorkletOnlyStart = (event: any) => {
  'main thread'
  const element = ref2.current
  if (!element) return
  element.setStyleProperty('background-color', '#2e7d32')
}

// 用例 3：worklet 与 @tap 挂在同一个 view 上
const onWorkletWithTapStart = (event: any) => {
  'main thread'
  const element = ref3.current
  if (!element) return
  element.setStyleProperty('background-color', '#2e7d32')
}

function onCaseTap(tag: string) {
  console.log(`[repro] ${tag} tap`)
}

function onButtonTap() {
  console.log('[repro] wd-button tap')
}

console.log('[repro] mounted')
</script>

<template>
  <view class="repro">
    <text class="repro__title">worklet / tap 报错复现</text>
    <text class="repro__hint">点一遍四个方块，看控制台哪几条抛 reading 'bind'；变绿 = worklet 真的跑了</text>

    <!-- 1 对照组：纯 @tap -->
    <view class="repro__case" @tap="onCaseTap('case-1-tap-only')">
      <text class="repro__label">1 纯 @tap（对照）</text>
      <text class="repro__desc">handler 是字符串事件名，走 publishEvent</text>
    </view>

    <!-- 2 纯 worklet -->
    <view
      class="repro__case"
      :main-thread-ref="ref2"
      :main-thread-bindtouchstart="onWorkletOnlyStart"
    >
      <text class="repro__label">2 纯 worklet</text>
      <text class="repro__desc">只有 :main-thread-bindtouchstart</text>
    </view>

    <!-- 3 worklet + @tap 同挂 -->
    <view
      class="repro__case"
      :main-thread-ref="ref3"
      :main-thread-bindtouchstart="onWorkletWithTapStart"
      @tap="onCaseTap('case-3-worklet-plus-tap')"
    >
      <text class="repro__label">3 worklet + @tap</text>
      <text class="repro__desc">同一个 view 上两种都挂（wd-button 的形状）</text>
    </view>

    <!-- 4 库组件 -->
    <view class="repro__case repro__case--plain">
      <text class="repro__label">4 wd-button</text>
      <text class="repro__desc">库组件：hover worklet + @tap</text>
      <wd-button type="primary" @tap="onButtonTap">点我</wd-button>
    </view>
  </view>
</template>

<style>
.repro {
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.repro__title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.repro__hint {
  font-size: 12px;
  color: #6b7085;
  margin-bottom: 16px;
}

.repro__case {
  display: flex;
  flex-direction: column;
  padding: 16px;
  margin-bottom: 12px;
  border-radius: 8px;
  background-color: #eef1f7;
}

.repro__case--plain {
  background-color: #ffffff;
}

.repro__label {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}

.repro__desc {
  font-size: 12px;
  color: #6b7085;
}
</style>
