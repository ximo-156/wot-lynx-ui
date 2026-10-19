<script setup lang="ts">
import type { TestItem } from './checklist'

// 真机测试清单条目块：按分组渲染可勾选项，勾选态由页面统一维护
defineProps<{
  items: TestItem[]
  checked: Record<string, boolean>
}>()

const emit = defineEmits<{
  (e: 'toggle', item: TestItem): void
}>()
</script>

<template>
  <view class="checklist">
    <view v-for="item in items" :key="item.id" class="checklist__item" @tap="emit('toggle', item)">
      <view :class="['checklist__box', checked[item.id] ? 'checklist__box--on' : '']">
        <text v-if="checked[item.id]" class="checklist__box-tick">✓</text>
      </view>
      <view class="checklist__body">
        <text class="checklist__name">{{ item.name }}</text>
        <text class="checklist__expect">{{ item.expect }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.checklist {
  margin-top: 8px;
}

.checklist__item {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 6px 0;
}

.checklist__box {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border-width: 1px;
  border-style: solid;
  border-color: var(--wot-border-light);
  margin-top: 2px;
  margin-right: 8px;
  align-items: center;
  justify-content: center;
}

.checklist__box--on {
  background: var(--wot-primary-6);
  border-color: var(--wot-primary-6);
}

.checklist__box-tick {
  font-size: 10px;
  color: #ffffff;
}

.checklist__body {
  flex-grow: 1;
}

.checklist__name {
  font-size: 13px;
  color: var(--wot-text-main);
}

.checklist__expect {
  font-size: 11px;
  color: var(--wot-text-auxiliary);
  margin-top: 1px;
}
</style>
