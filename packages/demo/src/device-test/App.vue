<script setup lang="ts">
import { computed, reactive, ref } from 'vue-lynx'
import { useToast } from 'wot-lynx-ui'

import { testSections, totalItems, type TestItem } from './checklist'
import ChecklistBox from './ChecklistBox.vue'

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

// ---------- 主题（第 8 组：亮暗切换，根 provider 受控） ----------
const themeMode = ref<'light' | 'dark'>('light')

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

// ---------- 2. Slider ----------
const sliderValue = ref(50)
const sliderStep = ref(50)
const sliderRange = ref<number[]>([20, 80])

// ---------- 3. SwipeAction ----------
const swipeCells = ref([
  { title: '单元格一', status: 'close' },
  { title: '单元格二', status: 'close' },
  { title: '单元格三', status: 'close' }
])
const swipeTip = ref('左右横滑单元格，点击两侧按钮')

// ---------- 4. 弹层 ----------
const popupVisible = ref(false)
const popupPosition = ref<'top' | 'bottom' | 'center'>('bottom')
const overlayVisible = ref(false)
const overlayEvent = ref('未触发')
const dialogRef = ref<any>(null)
const toast = useToast('device-test-toast')

function openPopup(position: 'top' | 'bottom' | 'center') {
  popupPosition.value = position
  popupVisible.value = true
}

function onPopupModel(value: boolean) {
  overlayEvent.value = `update:modelValue: ${value}`
}

function showAlert() {
  dialogRef.value?.alert({
    title: '提示',
    msg: '这是一个对话框',
    confirm: () => {
      overlayEvent.value = 'dialog alert: confirm'
    }
  })
}

function showConfirm() {
  dialogRef.value?.confirm({
    title: '确认操作',
    msg: '确定要执行该操作吗？',
    confirm: (result: any) => {
      overlayEvent.value = `dialog confirm: ${result.action}`
    },
    cancel: (result: any) => {
      overlayEvent.value = `dialog cancel: ${result.action}`
    }
  })
}

// ---------- 5. 表单 ----------
const keyboardVisible = ref(false)
const payValue = ref('')
const inputValue = ref('')
const switchValue = ref(true)
const radioValue = ref('a')
const checkboxValues = ref<string[]>(['a'])
const rateValue = ref(3)

// ---------- 6. Cell 长列表 ----------
const longList = computed(() => Array.from({ length: 30 }, (_, i) => i + 1))

// ---------- 7. 展示组件 ----------
const tabValue = ref(0)
const swiperList = ref([
  { url: 'https://temp.img1.lynxjs.org/close.png', text: '1' },
  { url: 'https://temp.img1.lynxjs.org/close.png', text: '2' }
])

// ---------- 8. 主题与适配 ----------
const safeAreaText = computed(() => {
  const sa = sysInfo.safeArea
  return sa
    ? `top ${sa.top} / bottom ${sa.bottom} / left ${sa.left} / right ${sa.right}`
    : '宿主未提供（Lynx 裸跑置零，属预期，见 CONVENTIONS §181）'
})
</script>

<template>
  <!-- app-root 显式挂 height:100%：Lynx 中百分比高度只相对「已确定高度」的父级解析，
        若包裹层为 auto（内容高度），其下 scroll-view 的 height:100% 会解析成内容高度而非
        屏幕高度——滚动容器与内容等高即无可滚动范围（页面无法滚动）。
        链路：page 根(屏幕高，确定) > app-root(100%) > scroll-view.page(100%) > 内容。
        wd-config-provider 的根 view 现已内置 height:100%，此处显式声明使布局契约不依赖组件内部实现。
        theme 受控切换：亮/暗令牌由 provider 根 view 的 wot-theme-* 类翻转（第 8 组验证）。 -->
  <wd-config-provider :theme="themeMode" custom-class="app-root">
    <scroll-view scroll-orientation="vertical" class="page">
      <!-- ============ 头部：设备信息 ============ -->
      <view class="header">
        <text class="header__title">wot-lynx-ui 真机测试</text>
        <text class="header__sub">Vue Lynx · 8 组 35 项验收清单</text>
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
        <text class="card__title">{{ testSections[0].title }}</text>
        <text class="card__hint">{{ testSections[0].hint }}</text>
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
        <ChecklistBox :items="testSections[0].items" :checked="checked" @toggle="toggle" />
      </view>

      <!-- ============ 2. Slider ============ -->
      <view class="card">
        <text class="card__title">{{ testSections[1].title }}</text>
        <text class="card__hint">{{ testSections[1].hint }}</text>
        <view class="row">
          <wd-slider v-model="sliderValue" style="flex: 1" />
          <text class="tag">当前 {{ sliderValue }}</text>
        </view>
        <view class="row">
          <wd-slider
            v-model="sliderStep"
            :step="10"
            :marks="{ 0: '0', 50: '50', 100: '100' }"
            style="flex: 1"
          />
        </view>
        <view class="row">
          <wd-slider v-model="sliderRange" range style="flex: 1" />
          <text class="tag">{{ sliderRange[0] }} ~ {{ sliderRange[1] }}</text>
        </view>
        <ChecklistBox :items="testSections[1].items" :checked="checked" @toggle="toggle" />
      </view>

      <!-- ============ 3. SwipeAction ============ -->
      <view class="card">
        <text class="card__title">{{ testSections[2].title }}</text>
        <text class="card__hint">{{ testSections[2].hint }}</text>
        <text class="tag">{{ swipeTip }}</text>
        <wd-swipe-action v-for="(cell, index) in swipeCells" :key="index" v-model="cell.status">
          <template #left>
            <wd-button size="small" type="warning" @tap="swipeTip = cell.title + '：收藏'">收藏</wd-button>
          </template>
          <wd-cell :title="cell.title" :value="cell.status" />
          <template #right>
            <wd-button size="small" type="danger" @tap="swipeTip = cell.title + '：删除'">删除</wd-button>
          </template>
        </wd-swipe-action>
        <view class="row">
          <text class="tag">状态：{{ swipeCells.map((c) => c.status).join(' / ') }}</text>
        </view>
        <ChecklistBox :items="testSections[2].items" :checked="checked" @toggle="toggle" />
      </view>

      <!-- ============ 4. 弹层 ============ -->
      <view class="card">
        <text class="card__title">{{ testSections[3].title }}</text>
        <text class="card__hint">{{ testSections[3].hint }}</text>
        <view class="row">
          <wd-button size="small" @tap="openPopup('bottom')">底部 Popup</wd-button>
          <wd-button size="small" @tap="openPopup('center')">居中 Popup</wd-button>
          <wd-button size="small" @tap="overlayVisible = true">Overlay 遮罩</wd-button>
        </view>
        <view class="row">
          <wd-button size="small" @tap="showAlert">Dialog 提示</wd-button>
          <wd-button size="small" @tap="showConfirm">Dialog 确认</wd-button>
          <wd-button size="small" @tap="toast.show('操作成功')">Toast</wd-button>
          <!-- loading 命令式语义为 cover + duration 0（需调用方主动 close）；测试页无
               常驻关闭入口，遮罩会连点两秒自动收起，避免把页面永久挡住 -->
          <wd-button size="small" @tap="toast.loading({ msg: '加载中', duration: 2000 })">Toast 加载</wd-button>
        </view>
        <text class="tag">事件：{{ overlayEvent }}</text>
        <ChecklistBox :items="testSections[3].items" :checked="checked" @toggle="toggle" />
      </view>

      <!-- ============ 5. 表单 ============ -->
      <view class="card">
        <text class="card__title">{{ testSections[4].title }}</text>
        <text class="card__hint">{{ testSections[4].hint }}</text>
        <view class="row">
          <wd-password-input :model-value="payValue" :length="6" />
          <wd-button size="small" @tap="keyboardVisible = true">弹起键盘</wd-button>
        </view>
        <view class="row">
          <wd-input v-model="inputValue" placeholder="请输入（受控回显）" clearable style="flex: 1" />
        </view>
        <text class="tag">已输入：{{ inputValue || '（空）' }}</text>
        <view class="row">
          <wd-switch v-model="switchValue" />
          <wd-radio-group v-model="radioValue" direction="horizontal">
            <wd-radio value="a">选项A</wd-radio>
            <wd-radio value="b">选项B</wd-radio>
          </wd-radio-group>
        </view>
        <view class="row">
          <wd-checkbox-group v-model="checkboxValues" direction="horizontal">
            <wd-checkbox name="a">多选A</wd-checkbox>
            <wd-checkbox name="b">多选B</wd-checkbox>
          </wd-checkbox-group>
        </view>
        <view class="row">
          <wd-rate v-model="rateValue" />
          <text class="tag">{{ rateValue }} 分</text>
        </view>
        <ChecklistBox :items="testSections[4].items" :checked="checked" @toggle="toggle" />
      </view>

      <!-- ============ 6. Cell 列表 ============ -->
      <view class="card">
        <text class="card__title">{{ testSections[5].title }}</text>
        <text class="card__hint">{{ testSections[5].hint }}</text>
        <wd-cell-group title="基础用法" border>
          <wd-cell title="单元格" value="内容" />
          <wd-cell title="图标 + 箭头" prefix-icon="setting" is-link value="跳转" />
          <wd-cell title="描述文本" label="这是描述信息" value="内容" />
        </wd-cell-group>
        <wd-cell-group title="卡片分组" insert>
          <wd-cell title="左侧标题宽度" value="内容" title-width="120" />
          <wd-cell title="垂直布局" label="上下排列" value="内容" layout="vertical" />
        </wd-cell-group>
        <wd-cell-group title="长列表（30 行）">
          <wd-cell v-for="n in longList" :key="n" :title="'第 ' + n + ' 行'" value="内容" is-link />
        </wd-cell-group>
        <ChecklistBox :items="testSections[5].items" :checked="checked" @toggle="toggle" />
      </view>

      <!-- ============ 7. 展示组件 ============ -->
      <view class="card">
        <text class="card__title">{{ testSections[6].title }}</text>
        <text class="card__hint">{{ testSections[6].hint }}</text>
        <view class="row">
          <wd-icon name="close" size="20" />
          <wd-icon name="loading" size="24" color="#1C64FD" />
          <wd-icon name="arrow-left-bold" size="20" />
          <wd-icon name="setting" size="20" color="#FF8800" />
        </view>
        <view class="row">
          <wd-loading type="circular" size="24px" />
          <wd-loading type="spinner" size="24px" />
          <wd-loading type="dots" size="24px" />
          <wd-loading type="wave" size="24px" />
        </view>
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
        <view class="row row--block">
          <wd-text text="这是一段用于验证行数省略的长文本，需要在容器宽度受限时于第二行末尾显示省略号。" :lines="2" />
        </view>
        <wd-divider>分割线</wd-divider>
        <wd-divider content-position="left">左对齐</wd-divider>
        <wd-divider dashed />
        <view class="row">
          <wd-progress :percentage="60" style="flex: 1" />
        </view>
        <wd-notice-bar text="这是一条通知栏提示" prefix="sound" />
        <wd-swiper :list="swiperList" style="margin-top: 8px" />
        <wd-tabs v-model="tabValue">
          <wd-tab title="标签一">
            <view class="tab-panel"><text class="tag">标签一内容</text></view>
          </wd-tab>
          <wd-tab title="标签二">
            <view class="tab-panel"><text class="tag">标签二内容</text></view>
          </wd-tab>
        </wd-tabs>
        <ChecklistBox :items="testSections[6].items" :checked="checked" @toggle="toggle" />
      </view>

      <!-- ============ 8. 主题与适配 ============ -->
      <view class="card">
        <text class="card__title">{{ testSections[7].title }}</text>
        <text class="card__hint">{{ testSections[7].hint }}</text>
        <view class="row">
          <wd-button size="small" :type="themeMode === 'light' ? 'primary' : 'default'" @tap="themeMode = 'light'">亮色</wd-button>
          <wd-button size="small" :type="themeMode === 'dark' ? 'primary' : 'default'" @tap="themeMode = 'dark'">暗色</wd-button>
          <text class="tag">当前：{{ themeMode }}</text>
        </view>
        <!-- themeVars 覆盖：嵌套 provider 需显式透传 theme，否则回退默认 light -->
        <wd-config-provider :theme="themeMode" :theme-vars="{ colorPrimary: '#FF8800' }">
          <view class="row">
            <wd-button type="primary" size="small">themeVars 覆盖主色</wd-button>
            <text class="tag">var(--wot-primary-6) 被覆盖为 #FF8800</text>
          </view>
        </wd-config-provider>
        <!-- rpx 与 px 对比：Lynx 仅支持 px/% ，rpx 解析为 0（web-core convertLengthToPx） -->
        <view class="row">
          <view class="unit-box unit-box--rpx" />
          <view class="unit-box unit-box--px" />
        </view>
        <text class="tag">左盒 375rpx（Lynx 解析为 0 → 不可见），右盒 187.5px（正常显示）</text>
        <text class="tag">安全区：{{ safeAreaText }}</text>
        <ChecklistBox :items="testSections[7].items" :checked="checked" @toggle="toggle" />
      </view>

      <!-- ============ 命令式 / 受控弹层实例（集中在 scroll-view 末尾） ============ -->
      <wd-popup
        v-model="popupVisible"
        :position="popupPosition"
        round
        closable
        @update:modelValue="onPopupModel"
        @after-enter="overlayEvent = 'popup after-enter'"
        @after-leave="overlayEvent = 'popup after-leave'"
      >
        <view class="popup-body">
          <text class="popup__title">position = {{ popupPosition }}</text>
          <text class="popup__hint">点击遮罩或关闭按钮退出；也可在弹层上继续打开 Dialog 验证层级</text>
          <wd-button size="small" type="primary" @tap="showConfirm">在弹层上打开 Dialog</wd-button>
        </view>
      </wd-popup>
      <wd-overlay :show="overlayVisible" @click="overlayVisible = false">
        <!-- 内容不可用 position: fixed：fixed 节点被引擎提升到页面根节点后
             脱离遮罩子树，遮罩隐藏时仍常驻、tap 也不再冒泡到遮罩（CONVENTIONS §9） -->
        <view class="overlay-center">
          <view class="overlay-box">
            <text class="overlay-box__text">遮罩内容（点击任意处关闭）</text>
          </view>
        </view>
      </wd-overlay>
      <wd-dialog ref="dialogRef" selector="device-test-dialog" />
      <wd-toast selector="device-test-toast" />
      <wd-keyboard v-model="payValue" v-model:visible="keyboardVisible" />
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
  background-color: var(--wot-filled-bottom);
}

.header {
  padding: 12px 4px;
}

.header__title {
  font-size: 20px;
  font-weight: 600;
  color: var(--wot-text-main);
}

.header__sub {
  font-size: 12px;
  color: var(--wot-text-auxiliary);
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
  color: var(--wot-text-secondary);
  background: var(--wot-filled-bottom);
  border-radius: 4px;
  padding: 2px 6px;
}

.card {
  background: var(--wot-filled-oppo);
  border-radius: 12px;
  border-width: 1px;
  border-style: solid;
  border-color: var(--wot-border-main);
  padding: 12px;
  margin-bottom: 12px;
}

.card__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--wot-text-main);
}

.card__hint {
  font-size: 11px;
  color: var(--wot-text-auxiliary);
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

.row--block {
  display: block;
}

.tag {
  font-size: 11px;
  color: var(--wot-text-secondary);
}

.tab-panel {
  padding: 12px;
}

.popup-body {
  padding: 24px;
  min-width: 200px;
}

.popup__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--wot-text-main);
}

.popup__hint {
  font-size: 11px;
  color: var(--wot-text-auxiliary);
  margin: 4px 0 12px;
}

.overlay-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.overlay-box {
  padding: 20px;
  background-color: var(--wot-filled-oppo);
  border-radius: 12px;
}

.overlay-box__text {
  font-size: 13px;
  color: var(--wot-text-main);
}

.unit-box {
  height: 28px;
  border-radius: 4px;
}

/* 375rpx：Lynx 不支持 rpx，宽度解析为 0（不可见）——适配结论验证 */
.unit-box--rpx {
  width: 375rpx;
  background: --wot-;
}

/* 187.5px：正常渲染的对照组 */
.unit-box--px {
  width: 187.5px;
  background: var(--wot-success-main);
}

.progress__row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.progress__count {
  font-size: 13px;
  color: var(--wot-text-main);
}

.progress__reset {
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--wot-primary-1);
}

.progress__reset-text {
  font-size: 12px;
  color: var(--wot-primary-6);
}

.progress__bar {
  height: 6px;
  border-radius: 3px;
  background: var(--wot-filled-bottom);
  margin-top: 8px;
  overflow: hidden;
}

.progress__bar-inner {
  height: 100%;
  background: var(--wot-primary-6);
  border-radius: 3px;
}
</style>
