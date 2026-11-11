<script setup lang="ts">
import { ref } from 'vue'
import WdCascader from '@wot-lynx/ui-form/wd-cascader'
import WdButton from '@wot-lynx/primitives/wd-button'

const visible = ref(true)
const value = ref<string | number>('xh')
const lineWidth = ref<number | undefined>()
const options = [
  { value: 'zj', text: '浙江省', children: [
    { value: 'hz', text: '杭州市', children: [{ value: 'xh', text: '西湖区' }, { value: 'bj', text: '滨江区' }] },
    { value: 'nb', text: '宁波市', children: [{ value: 'jb', text: '江北区' }] }
  ] },
  { value: 'js', text: '江苏省', children: [{ value: 'nj', text: '南京市', children: [{ value: 'xw', text: '玄武区' }] }] }
]
function reset() { value.value = ''; visible.value = true }
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">省 / 市 / 区选择与回显</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <WdButton custom-class="docs-cascader-open" size="small" @tap="visible = true">打开已选地区</WdButton>
          <WdButton custom-class="docs-cascader-reset" size="small" @tap="reset">重新选择</WdButton>
          <WdButton custom-class="docs-cascader-width" size="small" @tap="lineWidth = lineWidth ? undefined : 40">切换线宽</WdButton>
        </view>
        <text class="wd-h5-demo__panel-label">选中值：{{ value || '未选择' }}</text>
        <text class="wd-h5-demo__panel-label">紫线应居中于当前层级；点击前一级可重新选择。</text>
      </view>
    </view>
    <WdCascader v-model="value" v-model:visible="visible" :options="options" :line-width="lineWidth" title="选择地区" />
  </scroll-view>
</template>
