<script setup lang="ts">
/**
 * Calendar 日历 — 文档站 H5 预览演示（手工编写）。
 *
 * 覆盖单选日期、区间选择与快捷选项三种形态；区间模式展示起止标签，
 * 快捷选项点击后直接写回选中值。
 */
import { ref } from 'vue'
import WdCalendar from 'wot-lynx-ui/components/wd-calendar/wd-calendar.vue'
import WdButton from 'wot-lynx-ui/primitives/wd-button/wd-button.vue'

const dateVisible = ref(false)
const rangeVisible = ref(false)
const shortcutVisible = ref(false)

const dateValue = ref<number | null>(null)
const rangeValue = ref<number[] | null>(null)
const shortcutValue = ref<number | null>(null)

/** 快捷选项：onShortcutsClick 的返回值即新的选中值 */
const shortcuts = [{ text: '今天' }, { text: '昨天' }, { text: '一周前' }]

function onShortcutsClick({ index }: { item: { text: string }; index: number }) {
  const day = 24 * 60 * 60 * 1000
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today.getTime() - index * day
}

function formatValue(value: number | number[] | null) {
  if (!value) return '未选择'
  const list = Array.isArray(value) ? value : [value]
  return list.map((v) => new Date(v).toLocaleDateString()).join(' ~ ')
}
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">选择日期</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button size="small" type="primary" @tap="dateVisible = true">打开日历</wd-button>
          <text class="wd-h5-demo__tag">{{ formatValue(dateValue) }}</text>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">选择区间（type="daterange"）</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button size="small" @tap="rangeVisible = true">打开日历</wd-button>
          <text class="wd-h5-demo__tag">{{ formatValue(rangeValue) }}</text>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">快捷选项（shortcuts）</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button size="small" @tap="shortcutVisible = true">打开日历</wd-button>
          <text class="wd-h5-demo__tag">{{ formatValue(shortcutValue) }}</text>
        </view>
      </view>
    </view>

    <wd-calendar v-model="dateValue" v-model:visible="dateVisible" type="date" title="日历" />
    <wd-calendar v-model="rangeValue" v-model:visible="rangeVisible" type="daterange" title="选择区间" />
    <wd-calendar
      v-model="shortcutValue"
      v-model:visible="shortcutVisible"
      type="date"
      title="选择日期"
      :shortcuts="shortcuts"
      :on-shortcuts-click="onShortcutsClick"
    />
  </scroll-view>
</template>
