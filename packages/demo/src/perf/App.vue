<script setup lang="ts">
import { ref } from 'vue-lynx'
import Slider from '@wot-lynx/ui-form/wd-slider'
import NativeSlider from './NativeSlider.vue'

const mode = ref<'component' | 'native'>('component')
const value = ref(50)
const moves = ref(0)
const changes = ref(0)
let moveCount = 0
const sliderStyle = { width: '280px' }
function select(next: 'component' | 'native') {
  mode.value = next
  value.value = 50
  moveCount = 0
  moves.value = 0
  changes.value = 0
}
function update(next: number | number[]) { value.value = Number(next) }
function moved() { moveCount++ }
function changed() { changes.value++; moves.value = moveCount }
</script>

<template>
  <view class="perf">
    <text class="perf__title">Slider 跟手性能基线 P1</text>
    <text class="perf__hint">每次只挂载一个版本。预热后连续左右拖动 10 秒，分别录制 trace。</text>
    <view class="perf__choices">
      <view class="perf__choice" @tap="select('component')"><text>组件版</text></view>
      <view class="perf__choice" @tap="select('native')"><text>原生节点基线</text></view>
    </view>
    <text>{{ mode }} · 值 {{ value }} · move {{ moves }} · change {{ changes }}</text>
    <view class="perf__stage">
      <Slider v-if="mode === 'component'" :model-value="value" :min="0" :max="100" :step="1" popover-visible="never" :custom-style="sliderStyle" @update:model-value="update" @dragmove="moved" @change="changed" />
      <NativeSlider v-else :model-value="value" @update:model-value="update" @dragmove="moved" @change="changed" />
    </view>
    <text class="perf__hint">固定 280px，值域 0–100，步长 1，初值 50。两版均保留实时值、move 和结束事件订阅。</text>
    <text class="perf__hint">基线只覆盖水平单指拖动。组件额外包含多指、迟到事件、禁用、范围值等协议；节点数和功能并不完全相同，结果只能说明基础拖动开销差距。</text>
    <text class="perf__hint">move 计数在松手后刷新，避免逐帧更新诊断文本。页面计数不是 FPS；正式结果来自同条件的原始性能 trace。</text>
  </view>
</template>

<style>
.perf { display: flex; flex-direction: column; padding: 24px; }
.perf__title { font-size: 20px; margin-bottom: 16px; }
.perf__hint { font-size: 14px; margin-top: 16px; }
.perf__choices { display: flex; flex-direction: row; margin-top: 16px; margin-bottom: 16px; }
.perf__choice { padding: 12px; margin-right: 12px; background-color: #eeeeee; }
.perf__stage { display: flex; width: 280px; height: 80px; align-items: center; margin-top: 24px; }
</style>
