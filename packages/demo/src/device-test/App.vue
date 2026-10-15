<script setup lang="ts">
import { computed, reactive } from 'vue-lynx'
import { testSections, totalItems, type TestItem } from './checklist'

// ---------- 设备信息 ----------
const sysInfo = (globalThis as any).SystemInfo || {}
const deviceInfo = computed(() => {
  const ratio = sysInfo.pixelRatio || 2
  return {
    platform: sysInfo.platform || 'unknown',
    width: sysInfo.pixelWidth ? Math.round(sysInfo.pixelWidth / ratio) : 0,
    height: sysInfo.pixelHeight ? Math.round(sysInfo.pixelHeight / ratio) : 0,
    dpr: ratio,
    engine: sysInfo.engineVersion || sysInfo.lynxSdkVersion || '-'
  }
})

// ---------- 测试清单状态 ----------
const checked = reactive<Record<string, boolean>>({})
const checkedCount = computed(() => Object.values(checked).filter(Boolean).length)
const progress = computed(() => (totalItems === 0 ? 0 : Math.round((checkedCount.value / totalItems) * 100)))

function toggle(item: TestItem) {
  checked[item.id] = !checked[item.id]
}

function resetAll() {
  Object.keys(checked).forEach((k) => delete checked[k])
}
</script>

<template>
  <!-- app-root 显式挂 height:100%：Lynx 中百分比高度只相对「已确定高度」的父级解析，
       若包裹层为 auto（内容高度），其下 scroll-view 的 height:100% 会解析成内容高度而非
       屏幕高度——滚动容器与内容等高即无可滚动范围（页面无法滚动）。
       链路：page 根(屏幕高，确定) > app-root(100%) > scroll-view.page(100%) > 内容。
       wd-config-provider 的根 view 现已内置 height:100%，此处显式声明使布局契约不依赖组件内部实现。 -->
  <wd-config-provider theme="light" custom-class="app-root">
    <scroll-view scroll-orientation="vertical" class="page">
      <!-- ============ 头部：设备信息 ============ -->
      <view class="header">
        <text class="header__title">wot-lynx-ui 真机测试</text>
        <text class="header__sub">Vue Lynx · 重写版 Tier 1</text>
        <view class="header__device">
          <text class="header__device-item">平台 {{ deviceInfo.platform }}</text>
          <text class="header__device-item">屏幕 {{ deviceInfo.width }}×{{ deviceInfo.height }}</text>
          <text class="header__device-item">DPR {{ deviceInfo.dpr }}</text>
          <text class="header__device-item">引擎 {{ deviceInfo.engine }}</text>
        </view>
      </view>

      <!-- ============ 进度卡片 ============ -->
      <view class="card progress">
        <view class="progress__row">
          <text class="progress__count">已完成 {{ checkedCount }} / {{ totalItems }} 项</text>
          <view class="progress__reset" @tap="resetAll">
            <text class="progress__reset-text">重置</text>
          </view>
        </view>
        <view class="progress__bar">
          <view class="progress__bar-inner" :style="{ width: progress + '%' }" />
        </view>
        <text class="progress__pct">{{ progress }}%</text>
      </view>

      <!-- ============ 1. Button ============ -->
      <view class="card">
        <text class="card__title">1. Button 按钮</text>
        <text class="card__hint">验证类型/变体/按压缩态/禁用/加载态</text>
        <view class="row">
          <wd-button type="primary">主要</wd-button>
          <wd-button type="success">成功</wd-button>
          <wd-button type="danger">危险</wd-button>
          <wd-button type="warning">警告</wd-button>
          <wd-button type="info">信息</wd-button>
        </view>
        <view class="row">
          <wd-button type="primary" plain>朴素</wd-button>
          <wd-button type="primary" dashed>虚线</wd-button>
          <wd-button type="primary" soft>柔和</wd-button>
          <wd-button type="primary" subtle>淡雅</wd-button>
          <wd-button type="primary" text>文字</wd-button>
        </view>
        <view class="row">
          <wd-button disabled>禁用</wd-button>
          <wd-button type="primary" loading loading-color="#fff">加载中</wd-button>
          <wd-button type="danger" round>圆角</wd-button>
          <wd-button type="primary" block>块级</wd-button>
        </view>
        <view class="checklist">
          <view v-for="item in testSections[0].items" :key="item.id" class="checklist__item" @tap="toggle(item)">
            <view :class="['checklist__box', checked[item.id] ? 'checklist__box--on' : '']">
              <text v-if="checked[item.id]" class="checklist__box-tick">✓</text>
            </view>
            <view class="checklist__body">
              <text class="checklist__name">{{ item.name }}</text>
              <text class="checklist__expect">{{ item.expect }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- ============ 2. Icon / Loading ============ -->
      <view class="card">
        <text class="card__title">2. Icon / Loading</text>
        <text class="card__hint">验证 SVG 图标渲染与四类加载指示器</text>
        <view class="row">
          <wd-icon name="close" size="20" />
          <wd-icon name="loading" size="24" color="#FF6900" />
          <wd-icon name="arrow-left" size="20" />
          <wd-icon name="settings" size="20" color="#FF8800" />
        </view>
        <view class="row">
          <wd-loading type="circular" size="24px" />
          <wd-loading type="spinner" size="24px" />
          <wd-loading type="dots" size="24px" />
          <wd-loading type="wave" size="24px" />
        </view>
        <view class="checklist">
          <view v-for="item in testSections[1].items" :key="item.id" class="checklist__item" @tap="toggle(item)">
            <view :class="['checklist__box', checked[item.id] ? 'checklist__box--on' : '']">
              <text v-if="checked[item.id]" class="checklist__box-tick">✓</text>
            </view>
            <view class="checklist__body">
              <text class="checklist__name">{{ item.name }}</text>
              <text class="checklist__expect">{{ item.expect }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- ============ 3. Cell ============ -->
      <view class="card">
        <text class="card__title">3. Cell 单元格</text>
        <text class="card__hint">验证分组配置/箭头/星号/布局</text>
        <wd-cell-group title="基础用法" border>
          <wd-cell title="单元格" value="内容" />
          <wd-cell title="图标 + 箭头" prefix-icon="settings" is-link value="跳转" />
          <wd-cell title="描述文本" label="这是描述信息" value="内容" />
        </wd-cell-group>
        <wd-cell-group title="卡片分组" insert>
          <wd-cell title="左侧标题宽度" value="内容" title-width="120" />
          <wd-cell title="垂直布局" label="上下排列" value="内容" layout="vertical" />
        </wd-cell-group>
        <view class="checklist">
          <view v-for="item in testSections[2].items" :key="item.id" class="checklist__item" @tap="toggle(item)">
            <view :class="['checklist__box', checked[item.id] ? 'checklist__box--on' : '']">
              <text v-if="checked[item.id]" class="checklist__box-tick">✓</text>
            </view>
            <view class="checklist__body">
              <text class="checklist__name">{{ item.name }}</text>
              <text class="checklist__expect">{{ item.expect }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- ============ 4. Text / Divider / Gap ============ -->
      <view class="card">
        <text class="card__title">4. Text / Divider / Gap</text>
        <text class="card__hint">验证文本模式与分割线</text>
        <view class="row">
          <wd-text text="主文本" />
          <wd-text text="品牌色" type="primary" />
          <wd-text text="成功" type="success" />
          <wd-text text="危险" type="error" />
        </view>
        <view class="row">
          <wd-text mode="price" text="1234567.89" />
          <wd-text mode="phone" format text="22644212509" />
          <wd-text mode="date" text="1735689600000" />
        </view>
        <wd-divider>分割线</wd-divider>
        <wd-divider content-position="left">左对齐</wd-divider>
        <wd-divider dashed />
        <view class="checklist">
          <view v-for="item in testSections[3].items" :key="item.id" class="checklist__item" @tap="toggle(item)">
            <view :class="['checklist__box', checked[item.id] ? 'checklist__box--on' : '']">
              <text v-if="checked[item.id]" class="checklist__box-tick">✓</text>
            </view>
            <view class="checklist__body">
              <text class="checklist__name">{{ item.name }}</text>
              <text class="checklist__expect">{{ item.expect }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </wd-config-provider>
</template>

<style scoped>
.app-root {
  height: 100%;
}

.page {
  height: 100%;
  padding: 12px;
}

.header {
  padding: 12px 4px;
}

.header__title {
  font-size: 20px;
  font-weight: 600;
  color: #171b26;
}

.header__sub {
  font-size: 12px;
  color: #667085;
  margin-top: 2px;
}

.header__device {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.header__device-item {
  font-size: 11px;
  color: #4a5568;
  background: #eff1f5;
  border-radius: 4px;
  padding: 2px 6px;
}

.card {
  background: #ffffff;
  border-radius: 12px;
  border-width: 1px;
  border-style: solid;
  border-color: #e4e7ed;
  padding: 12px;
  margin-bottom: 12px;
}

.card__title {
  font-size: 15px;
  font-weight: 600;
  color: #171b26;
}

.card__hint {
  font-size: 11px;
  color: #8b93a3;
  margin: 2px 0 8px;
}

.row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.progress__row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.progress__count {
  font-size: 13px;
  color: #171b26;
}

.progress__reset {
  padding: 4px 10px;
  border-radius: 6px;
  background: #edf1ff;
}

.progress__reset-text {
  font-size: 12px;
  color: #7f5cff;
}

.progress__bar {
  height: 6px;
  border-radius: 3px;
  background: #eff1f5;
  margin-top: 8px;
  overflow: hidden;
}

.progress__bar-inner {
  height: 100%;
  background: #7f5cff;
  border-radius: 3px;
}

.progress__pct {
  font-size: 11px;
  color: #8b93a3;
  margin-top: 4px;
}

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
  border-color: #b4bac7;
  margin-top: 2px;
  margin-right: 8px;
  align-items: center;
  justify-content: center;
}

.checklist__box--on {
  background: #7f5cff;
  border-color: #7f5cff;
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
  color: #171b26;
}

.checklist__expect {
  font-size: 11px;
  color: #8b93a3;
  margin-top: 1px;
}
</style>
