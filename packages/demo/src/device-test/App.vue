<script setup lang="ts">
import { computed, reactive, ref } from 'vue-lynx'
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

function toggle(item: TestItem, value: boolean) {
  checked[item.id] = value
}

function resetAll() {
  Object.keys(checked).forEach((k) => delete checked[k])
}

function sectionProgress(sectionItems: TestItem[]) {
  const done = sectionItems.filter((i) => checked[i.id]).length
  return `${done}/${sectionItems.length}`
}

// ---------- 交互状态 ----------
const sliderValue = ref(50)
const sliderRange = ref<number[]>([20, 80])
const inputValue = ref('')
const switchValue = ref(true)
const radioValue = ref('a')
const checkboxValues = ref<string[]>(['a'])
const rateValue = ref(3)
const showPopup = ref(false)
const showCenter = ref(false)
const showDialog = ref(false)
const showSheet = ref(false)
const showToast = ref(false)
const showNotify = ref(false)
const theme = ref<'light' | 'dark'>('light')
const swiperIndex = ref(0)
const swiperList = [
  { color: '#3482FF', text: '1' },
  { color: '#00B42A', text: '2' },
  { color: '#F53F3F', text: '3' }
]
const tabValue = ref(0)
const cellCount = ref(100)

const longCells = computed(() => Array.from({ length: cellCount.value }, (_, i) => i + 1))

// ---------- SVG 化组件 ----------
const qrValue = ref('https://wot-ui.cn')
const barValue = ref('12345678901')
const pickerValue = ref<number[]>([0])
const circleValue = ref(65)
const signResult = ref('')
const signatureRef = ref<any>(null)

function onSliderInput(v: number) {
  sliderValue.value = v
}
</script>

<template>
  <!-- app-root 显式挂 height:100%：Lynx 中百分比高度只相对「已确定高度」的父级解析，
       若包裹层为 auto（内容高度），其下 scroll-view 的 height:100% 会解析成内容高度而非
       屏幕高度——滚动容器与内容等高即无可滚动范围（页面无法滚动）。
       链路：page 根(屏幕高，确定) > app-root(100%) > scroll-view.page(100%)。
       wd-config-provider 的根 view 现已内置 height:100%，此处显式声明使布局契约不依赖组件内部实现。 -->
  <wd-config-provider :theme="theme" custom-class="app-root">
    <scroll-view scroll-orientation="vertical" class="page">
      <!-- ============ 头部：设备信息 ============ -->
      <view class="header">
        <text class="header__title">wot-lynx-ui 真机测试</text>
        <text class="header__sub">Vue Lynx · wot-ui 适配组件库</text>
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
          <wd-button type="primary" @tap="sliderValue = 50">主要</wd-button>
          <wd-button type="success">成功</wd-button>
          <wd-button type="danger">危险</wd-button>
          <wd-button type="warning">警告</wd-button>
          <wd-button type="info">信息</wd-button>
        </view>
        <view class="row">
          <wd-button type="primary" plain>朴素</wd-button>
          <wd-button type="primary" soft>柔和</wd-button>
          <wd-button type="primary" text>文字</wd-button>
          <wd-button type="primary" round>圆角</wd-button>
        </view>
        <view class="row">
          <wd-button disabled>禁用</wd-button>
          <wd-button type="primary" loading loading-color="#fff">加载中</wd-button>
        </view>
        <view class="checklist">
          <view v-for="item in testSections[0].items" :key="item.id" class="checklist__item">
            <wd-checkbox :model-value="!!checked[item.id]" @change="(v: any) => toggle(item, v)">{{ item.name }}</wd-checkbox>
            <text class="checklist__expect">{{ item.expect }}</text>
          </view>
        </view>
      </view>

      <!-- ============ 2. Slider ============ -->
      <view class="card">
        <text class="card__title">2. Slider 滑块</text>
        <text class="card__hint">核心项：拖动应严格跟手，无回弹抖动</text>
        <view class="row">
          <text class="row__label">单滑块</text>
          <wd-slider v-model="sliderValue" style="flex: 1" />
          <text class="row__value">{{ sliderValue }}</text>
        </view>
        <view class="row">
          <text class="row__label">双滑块</text>
          <wd-slider v-model="sliderRange" range style="flex: 1" />
        </view>
        <text class="card__hint">带刻度</text>
        <wd-slider v-model="sliderValue" :marks="{ 0: '0', 25: '25', 50: '50', 75: '75', 100: '100' }" />
        <view class="checklist">
          <view v-for="item in testSections[1].items" :key="item.id" class="checklist__item">
            <wd-checkbox :model-value="!!checked[item.id]" @change="(v: any) => toggle(item, v)">{{ item.name }}</wd-checkbox>
            <text class="checklist__expect">{{ item.expect }}</text>
          </view>
        </view>
      </view>

      <!-- ============ 3. SwipeAction ============ -->
      <view class="card">
        <text class="card__title">3. SwipeAction 滑动操作</text>
        <text class="card__hint">核心项：左滑跟手；纵向滚动不冲突</text>
        <wd-swipe-action>
          <wd-cell title="左滑我" value="露出操作按钮" is-link />
          <template #right>
            <view class="swipe-btn swipe-btn--warn"><text class="swipe-btn__text">收藏</text></view>
          </template>
          <template #left>
            <view class="swipe-btn swipe-btn--info"><text class="swipe-btn__text">标记</text></view>
          </template>
        </wd-swipe-action>
        <wd-swipe-action>
          <wd-cell title="再滑我" value="互斥展开验证" />
          <template #right>
            <view class="swipe-btn swipe-btn--danger"><text class="swipe-btn__text">删除</text></view>
          </template>
        </wd-swipe-action>
        <view class="checklist">
          <view v-for="item in testSections[2].items" :key="item.id" class="checklist__item">
            <wd-checkbox :model-value="!!checked[item.id]" @change="(v: any) => toggle(item, v)">{{ item.name }}</wd-checkbox>
            <text class="checklist__expect">{{ item.expect }}</text>
          </view>
        </view>
      </view>

      <!-- ============ 4. 弹层 ============ -->
      <view class="card">
        <text class="card__title">4. 弹层反馈</text>
        <text class="card__hint">验证遮罩、动画、层级</text>
        <view class="row">
          <wd-button type="primary" size="mini" @tap="showPopup = true">底部弹出</wd-button>
          <wd-button type="primary" size="mini" @tap="showCenter = true">居中弹出</wd-button>
          <wd-button type="primary" size="mini" @tap="showDialog = true">对话框</wd-button>
        </view>
        <view class="row">
          <wd-button type="primary" size="mini" @tap="showSheet = true">动作面板</wd-button>
          <wd-button type="primary" size="mini" @tap="showToast = true">Toast</wd-button>
          <wd-button type="primary" size="mini" @tap="showNotify = true">通知</wd-button>
        </view>
        <view class="checklist">
          <view v-for="item in testSections[3].items" :key="item.id" class="checklist__item">
            <wd-checkbox :model-value="!!checked[item.id]" @change="(v: any) => toggle(item, v)">{{ item.name }}</wd-checkbox>
            <text class="checklist__expect">{{ item.expect }}</text>
          </view>
        </view>
      </view>

      <!-- ============ 5. 表单 ============ -->
      <view class="card">
        <text class="card__title">5. 表单</text>
        <text class="card__hint">验证受控组件与键盘</text>
        <wd-input v-model="inputValue" label="输入框" placeholder="请输入内容" clearable />
        <view class="row">
          <text class="row__label">开关</text>
          <wd-switch v-model="switchValue" />
          <text class="row__label">评分</text>
          <wd-rate v-model="rateValue" />
        </view>
        <wd-radio-group v-model="radioValue">
          <wd-radio value="a">选项 A</wd-radio>
          <wd-radio value="b">选项 B</wd-radio>
        </wd-radio-group>
        <wd-checkbox-group v-model="checkboxValues">
          <wd-checkbox value="a">多选 A</wd-checkbox>
          <wd-checkbox value="b">多选 B</wd-checkbox>
        </wd-checkbox-group>
        <view class="checklist">
          <view v-for="item in testSections[4].items" :key="item.id" class="checklist__item">
            <wd-checkbox :model-value="!!checked[item.id]" @change="(v: any) => toggle(item, v)">{{ item.name }}</wd-checkbox>
            <text class="checklist__expect">{{ item.expect }}</text>
          </view>
        </view>
      </view>

      <!-- ============ 6. Cell 长列表 ============ -->
      <view class="card">
        <text class="card__title">6. Cell 列表与滚动</text>
        <text class="card__hint">上下滚动验证流畅度与 Cell 样式</text>
        <wd-cell-group border>
          <wd-cell v-for="n in longCells.slice(0, 30)" :key="n" :title="`第 ${n} 行`" value="内容" is-link />
        </wd-cell-group>
        <text class="card__hint">（此处展示 30 行，共 {{ cellCount }} 项数据）</text>
        <view class="checklist">
          <view v-for="item in testSections[5].items" :key="item.id" class="checklist__item">
            <wd-checkbox :model-value="!!checked[item.id]" @change="(v: any) => toggle(item, v)">{{ item.name }}</wd-checkbox>
            <text class="checklist__expect">{{ item.expect }}</text>
          </view>
        </view>
      </view>

      <!-- ============ 7. 展示组件 ============ -->
      <view class="card">
        <text class="card__title">7. 展示组件</text>
        <text class="card__hint">验证图标/动画/进度</text>
        <view class="row">
          <wd-icon name="close" size="20" />
          <wd-icon name="loading" size="24" color="#3482FF" />
          <wd-icon name="settings" size="20" color="#FF8800" />
          <wd-loading type="circular" size="20px" />
          <wd-loading type="spinner" size="20px" />
          <wd-loading type="dots" size="20px" />
          <wd-loading type="wave" size="20px" />
        </view>
        <view class="row">
          <text class="row__label">进度</text>
          <wd-progress :percentage="60" style="flex: 1" />
        </view>
        <wd-notice-bar text="这是一条通知公告，验证横向滚动动画" left-icon="notification" />
        <wd-swiper :current="swiperIndex" :height="120" autoplay :list="swiperList" @update:current="swiperIndex = $event">
          <template #default="{ item }">
            <view class="swiper-item" :style="{ background: item.color }"><text class="swiper-item__text">{{ item.text }}</text></view>
          </template>
        </wd-swiper>
        <wd-tabs v-model="tabValue">
          <wd-tab title="标签一"><text class="tab-text">标签一内容</text></wd-tab>
          <wd-tab title="标签二"><text class="tab-text">标签二内容</text></wd-tab>
        </wd-tabs>
        <view class="checklist">
          <view v-for="item in testSections[6].items" :key="item.id" class="checklist__item">
            <wd-checkbox :model-value="!!checked[item.id]" @change="(v: any) => toggle(item, v)">{{ item.name }}</wd-checkbox>
            <text class="checklist__expect">{{ item.expect }}</text>
          </view>
        </view>
      </view>

      <!-- ============ 8. 主题 ============ -->
      <view class="card">
        <text class="card__title">8. 主题与适配</text>
        <text class="card__hint">切换主题后观察全局令牌</text>
        <view class="row">
          <wd-button :type="theme === 'light' ? 'primary' : 'info'" size="mini" @tap="theme = 'light'">亮色</wd-button>
          <wd-button :type="theme === 'dark' ? 'primary' : 'info'" size="mini" @tap="theme = 'dark'">暗色</wd-button>
          <text class="row__label">当前：{{ theme === 'light' ? '亮色' : '暗色' }}</text>
        </view>
        <view class="checklist">
          <view v-for="item in testSections[7].items" :key="item.id" class="checklist__item">
            <wd-checkbox :model-value="!!checked[item.id]" @change="(v: any) => toggle(item, v)">{{ item.name }}</wd-checkbox>
            <text class="checklist__expect">{{ item.expect }}</text>
          </view>
        </view>
      </view>

      <!-- ============ 9. SVG 化组件 ============ -->
      <view class="card">
        <text class="card__title">9. SVG 化组件</text>
        <text class="card__hint">canvas 组件迁移 SVG 后的渲染与导出</text>
        <view class="row">
          <wd-qr-code :text="qrValue" :size="100" />
          <wd-bar-code :value="barValue" :width="160" :height="50" />
        </view>
        <view class="row">
          <wd-circle v-model="circleValue" :size="90" />
          <text class="row__label">环形 {{ circleValue }}%</text>
        </view>
        <view class="row" style="align-items: flex-start">
          <wd-signature ref="signatureRef" :height="100" style="flex: 1" @confirm="(e: any) => (signResult = e.tempFilePath.slice(0, 30) + '…')" />
        </view>
        <view class="row">
          <wd-button size="mini" @tap="signatureRef && signatureRef.clear()">清空</wd-button>
          <wd-button size="mini" type="primary" @tap="signatureRef && signatureRef.confirm()">确认</wd-button>
          <text class="row__label">{{ signResult || '签名 data URI' }}</text>
        </view>
        <view class="row">
          <!-- full-screen=false + .row 挂 position:relative：本节演示「容器内平铺」水印，
               fullScreen 默认 true 会渲染成 position:fixed 全屏水印、覆盖整个页面 -->
          <wd-watermark content="wot-lynx-ui" style="flex: 1; height: 80px" :full-screen="false" />
        </view>
        <view class="row" style="align-items: flex-start">
          <wd-picker-view v-model="pickerValue" :columns="[['选项一', '选项二', '选项三']]" style="width: 200px" />
        </view>
        <view class="checklist">
          <view v-for="item in testSections[8].items" :key="item.id" class="checklist__item">
            <wd-checkbox :model-value="!!checked[item.id]" @change="(v: any) => toggle(item, v)">{{ item.name }}</wd-checkbox>
            <text class="checklist__expect">{{ item.expect }}</text>
          </view>
        </view>
      </view>

      <view class="footer">
        <text class="footer__text">测试完成请截图保存进度 · wot-lynx-ui</text>
      </view>
    </scroll-view>

    <!-- ============ 弹层实例 ============ -->
    <wd-popup v-model="showPopup" position="bottom">
      <view class="popup">
        <text class="popup__text">底部弹出层（slide-up）</text>
        <wd-button type="primary" @tap="showPopup = false">关闭</wd-button>
      </view>
    </wd-popup>

    <wd-popup v-model="showCenter" position="center">
      <view class="popup popup--center">
        <text class="popup__text">居中弹出层（zoom-in）</text>
        <wd-button type="primary" @tap="showCenter = false">关闭</wd-button>
      </view>
    </wd-popup>

    <wd-dialog v-model="showDialog" title="对话框" message="确认/取消回调验证" @confirm="showDialog = false" />

    <wd-action-sheet
      v-model="showSheet"
      :actions="[{ name: '选项一' }, { name: '选项二' }, { name: '选项三' }]"
      @select="showSheet = false"
    />

    <wd-toast v-model="showToast" message="轻提示 2 秒后自动关闭" />
    <wd-notify v-model="showNotify" message="顶部通知栏" />
  </wd-config-provider>
</template>

<style>
/* 见模板内注释：高度链路必须逐级确定，scroll-view 才能获得有界高度并可滚动 */
.app-root {
  width: 100%;
  height: 100%;
}

.page {
  width: 100%;
  height: 100%;
  background: #f7f8fa;
}

.header {
  padding: 28px 20px 20px;
  background: linear-gradient(135deg, #3482ff, #5c99ff);
}

.header__title {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
}

.header__sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 4px;
}

/* Lynx 3.x 新 CSS 引擎默认 linear 布局：横向 flex 容器必须显式 display:flex，
   否则 flex-direction:row 不生效（元素逐个纵向独占一行）。见 CONVENTIONS.md §14。 */
.header__device {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  margin-top: 10px;
  gap: 6px;
}

.header__device-item {
  font-size: 10px;
  color: #fff;
  background: rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  padding: 2px 8px;
}

.card {
  background: #fff;
  margin: 12px;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(25, 26, 31, 0.05);
}

.card__title {
  font-size: 16px;
  font-weight: 600;
  color: #191a1f;
}

.card__hint {
  font-size: 12px;
  color: #868a93;
  margin-top: 4px;
  margin-bottom: 8px;
}

/* 同上：显式 display:flex 使 flex-direction:row 生效（CONVENTIONS.md §14） */
.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  /* 作为行内水印（position:absolute; inset:0）的定位容器 */
  position: relative;
}

.row__label {
  font-size: 13px;
  color: #454851;
  width: 56px;
}

.row__value {
  font-size: 14px;
  color: #3482ff;
  font-weight: 600;
  width: 36px;
  text-align: right;
}

/* 同上：显式 display:flex（CONVENTIONS.md §14） */
.progress__row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.progress__count {
  font-size: 14px;
  font-weight: 600;
  color: #191a1f;
}

.progress__reset {
  padding: 4px 12px;
  background: #f1f2f5;
  border-radius: 999px;
}

.progress__reset-text {
  font-size: 12px;
  color: #454851;
}

.progress__bar {
  height: 6px;
  background: #e7e8ed;
  border-radius: 999px;
  margin-top: 10px;
  overflow: hidden;
}

.progress__bar-inner {
  height: 100%;
  background: #3482ff;
  border-radius: 999px;
  transition: width 0.2s ease;
}

.progress__pct {
  font-size: 11px;
  color: #868a93;
  margin-top: 4px;
  text-align: right;
}

.checklist {
  margin-top: 8px;
  border-top: 1ppx solid #e7e8ed;
  padding-top: 8px;
}

.checklist__item {
  padding: 6px 0;
}

.checklist__expect {
  font-size: 11px;
  color: #afb2bb;
  margin-left: 28px;
  margin-top: 2px;
}

.swipe-btn {
  height: 100%;
  padding: 0 20px;
  align-items: center;
  justify-content: center;
}

.swipe-btn--danger {
  background: #ff4d4f;
}

.swipe-btn--warn {
  background: #ff8800;
}

.swipe-btn--info {
  background: #3482ff;
}

.swipe-btn__text {
  color: #fff;
  font-size: 14px;
}

.swiper-item {
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.swiper-item__text {
  font-size: 32px;
  color: #fff;
}

.tab-text {
  font-size: 14px;
  color: #454851;
  padding: 12px 0;
}

.popup {
  background: #fff;
  border-radius: 28px 28px 0 0;
  padding: 24px;
  align-items: center;
  gap: 16px;
}

.popup--center {
  border-radius: 24px;
  width: 280px;
}

.popup__text {
  font-size: 15px;
  color: #1d1f29;
}

.footer {
  padding: 24px 0 40px;
  align-items: center;
}

.footer__text {
  font-size: 11px;
  color: #a9acb8;
}
</style>
