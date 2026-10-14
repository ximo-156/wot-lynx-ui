<script setup lang="ts">
import { ref } from 'vue-lynx'

// 组件通过 wotLynxUI 插件全局注册

const count = ref(0)
const showOverlay = ref(false)
const showPopup = ref(false)
const showCenterPopup = ref(false)
const showDialog = ref(false)
const showActionSheet = ref(false)
const inputValue = ref('')
const switchValue = ref(true)
const radioValue = ref('a')
const checkboxValues = ref<string[]>(['a'])
const rateValue = ref(3)
const sliderValue = ref(50)
const segmentedValue = ref('a')
const tabValue = ref(0)
const sidebarValue = ref(0)
const collapseValue = ref<string[]>(['1'])
const swiperIndex = ref(0)
const swiperList = [
  { color: '#3482FF', text: '1' },
  { color: '#34C759', text: '2' },
  { color: '#FF4D4F', text: '3' }
]
const stepValue = ref(1)
const qrValue = ref('https://wot-ui.cn')
const barValue = ref('12345678901')
const signResult = ref('')
const signatureRef = ref<any>(null)
const paginationValue = ref(1)

function onTapButton() {
  count.value++
}
</script>

<template>
  <!-- app-root 显式挂 height:100%：Lynx 中百分比高度只相对「已确定高度」的父级解析，
       若包裹层为 auto（内容高度），其下 scroll-view 的 height:100% 会解析成内容高度而非
       屏幕高度——滚动容器与内容等高即无可滚动范围（页面无法滚动）。
       链路：page 根(屏幕高，确定) > app-root(100%) > scroll-view.page(100%)。
       wd-config-provider 的根 view 现已内置 height:100%，此处显式声明使布局契约不依赖组件内部实现。 -->
  <wd-config-provider theme="light" custom-class="app-root">
    <scroll-view scroll-orientation="vertical" class="page">
      <view class="page__header">
        <text class="page__title">wot-lynx-ui</text>
        <text class="page__subtitle">基于 Vue Lynx 的 wot-ui 适配组件库 · {{ count }}</text>
      </view>

      <!-- Button -->
      <view class="demo-section">
        <text class="demo-section__title">Button 按钮</text>
        <view class="demo-panel">
          <!-- 演示结构对齐 wot-ui demo：组件类型 / 变体 / 样式（尺寸） / 内容形态 / 布局能力 -->
          <text class="demo-panel__label">类型</text>
          <view class="demo-row">
            <wd-button type="primary" @click="onTapButton">主要按钮</wd-button>
            <wd-button type="success">成功</wd-button>
            <wd-button type="danger">危险</wd-button>
          </view>
          <view class="demo-row">
            <wd-button type="warning">警告</wd-button>
            <wd-button type="info">信息</wd-button>
          </view>

          <text class="demo-panel__label">变体</text>
          <view class="demo-row">
            <wd-button type="primary" variant="plain">朴素</wd-button>
            <wd-button type="primary" variant="soft">柔和</wd-button>
            <wd-button type="primary" variant="text">文字</wd-button>
          </view>

          <text class="demo-panel__label">尺寸</text>
          <view class="demo-row">
            <wd-button type="primary" size="large">大按钮</wd-button>
            <wd-button type="primary" size="medium">中按钮</wd-button>
            <wd-button type="primary" size="small">小按钮</wd-button>
            <wd-button type="primary" size="mini">迷你</wd-button>
          </view>

          <text class="demo-panel__label">图标与状态</text>
          <view class="demo-row">
            <wd-button type="primary" icon="settings">设置</wd-button>
            <wd-button type="primary" loading>加载中</wd-button>
            <wd-button disabled>禁用</wd-button>
            <wd-button type="danger" round>圆角</wd-button>
          </view>

          <text class="demo-panel__label">块级按钮</text>
          <view class="demo-row demo-row--block">
            <wd-button type="primary" block>主要按钮</wd-button>
          </view>
        </view>
      </view>

      <!-- Icon / Loading -->
      <view class="demo-section">
        <text class="demo-section__title">Icon 图标 / Loading 加载</text>
        <view class="demo-panel">
          <view class="demo-row">
            <wd-icon name="close" size="20" />
            <wd-icon name="loading" size="24" color="#3482FF" />
            <wd-icon name="arrow-left" size="20" />
            <wd-icon name="settings" size="20" color="#FF8800" />
          </view>
          <view class="demo-row">
            <wd-loading type="circular" size="24px" />
            <wd-loading type="spinner" size="24px" />
            <wd-loading type="dots" size="24px" />
            <wd-loading type="wave" size="24px" />
            <wd-loading type="circular" size="20px" color="#3482FF" text="加载中" />
          </view>
        </view>
      </view>

      <!-- Cell -->
      <view class="demo-section">
        <text class="demo-section__title">Cell 单元格</text>
        <wd-cell-group border>
          <wd-cell title="头像" value="未设置" is-link />
          <wd-cell title="昵称" value="Lynx" is-link />
          <wd-cell title="简介" label="点击查看更多信息" value="点击设置" is-link />
          <wd-cell title="手机号" placeholder="请输入手机号" />
        </wd-cell-group>
      </view>

      <!-- 基础展示 -->
      <view class="demo-section">
        <text class="demo-section__title">Tag / Badge / Divider / Text / Card / Avatar / Empty</text>
        <view class="demo-panel">
          <view class="demo-row">
            <wd-tag type="primary">主要</wd-tag>
            <wd-tag type="success">成功</wd-tag>
            <wd-tag type="danger" round>危险</wd-tag>
            <wd-badge :value="8"><wd-button size="mini">消息</wd-button></wd-badge>
            <wd-badge dot><wd-icon name="notification" size="20" /></wd-badge>
          </view>
          <wd-divider>分割线</wd-divider>
          <wd-text text="主要文本" type="primary" />
          <wd-text text="这是一段很长的文本内容用来测试单行省略效果超出容器宽度后自动省略号显示" size="14" :ellipsis="true" style="width: 200px" />
          <wd-gap height="12px" />
          <wd-card title="卡片标题" content="卡片内容区域，用于展示信息。">
            <template #footer>
              <text class="demo-card-footer">卡片尾部</text>
            </template>
          </wd-card>
          <view class="demo-row">
            <wd-avatar name="L" size="40" />
            <wd-avatar name="A" size="40" shape="circle" />
            <wd-img src="https://avatars.githubusercontent.com/u/6128107?s=64" width="40px" height="40px" radius="8px" />
          </view>
          <wd-empty description="暂无数据" />
        </view>
      </view>

      <!-- 表单 -->
      <view class="demo-section">
        <text class="demo-section__title">Form 表单</text>
        <view class="demo-panel">
          <wd-input v-model="inputValue" label="输入框" placeholder="请输入" clearable />
          <wd-textarea v-model="inputValue" label="文本域" placeholder="请输入" :maxlength="100" show-count />
          <wd-input-number v-model="sliderValue" :min="0" :max="100" label="步进器" />
          <wd-search v-model="inputValue" placeholder="搜索" />
          <view class="demo-row">
            <text class="demo-label">Switch</text>
            <wd-switch v-model="switchValue" />
          </view>
          <wd-radio-group v-model="radioValue">
            <wd-radio value="a">选项 A</wd-radio>
            <wd-radio value="b">选项 B</wd-radio>
          </wd-radio-group>
          <wd-checkbox-group v-model="checkboxValues">
            <wd-checkbox value="a">多选 A</wd-checkbox>
            <wd-checkbox value="b">多选 B</wd-checkbox>
          </wd-checkbox-group>
          <view class="demo-row">
            <text class="demo-label">Rate</text>
            <wd-rate v-model="rateValue" />
          </view>
          <view class="demo-row">
            <text class="demo-label">Slider</text>
            <wd-slider v-model="sliderValue" style="flex: 1" />
          </view>
          <view class="demo-row">
            <text class="demo-label">Segmented</text>
            <wd-segmented v-model="segmentedValue" :options="[{label:'A',value:'a'},{label:'B',value:'b'}]" />
            <wd-sort-button v-model="segmentedValue" title="排序" />
          </view>
        </view>
      </view>

      <!-- 反馈 -->
      <view class="demo-section">
        <text class="demo-section__title">Feedback 反馈</text>
        <view class="demo-panel">
          <view class="demo-row">
            <wd-button type="primary" @click="showOverlay = true">遮罩</wd-button>
            <wd-button type="primary" @click="showPopup = true">底部弹出</wd-button>
            <wd-button type="primary" @click="showCenterPopup = true">居中弹出</wd-button>
            <wd-button type="primary" @click="showDialog = true">对话框</wd-button>
            <wd-button type="primary" @click="showActionSheet = true">动作面板</wd-button>
          </view>
          <view class="demo-row">
            <wd-toast ref="toastRef" v-model="showOverlay" />
          </view>
          <wd-skeleton title :row="3" />
        </view>
      </view>

      <!-- 展示 -->
      <view class="demo-section">
        <text class="demo-section__title">Progress / Circle / CountDown / NoticeBar</text>
        <view class="demo-panel">
          <view class="demo-row">
            <text class="demo-label">Progress</text>
            <wd-progress :percentage="60" style="flex: 1" />
          </view>
          <view class="demo-row">
            <wd-circle :percentage="70" size="100px" />
            <wd-count-down :time="3600000" format="HH:mm:ss" />
          </view>
          <wd-notice-bar text="这是一条通知公告内容" left-icon="notification" />
        </view>
      </view>

      <!-- 导航 -->
      <view class="demo-section">
        <text class="demo-section__title">Tabs / Sidebar / Steps / Pagination / Backtop</text>
        <view class="demo-panel">
          <wd-tabs v-model="tabValue">
            <wd-tab title="标签一">
              <text class="demo-tab-text">标签一内容</text>
            </wd-tab>
            <wd-tab title="标签二">
              <text class="demo-tab-text">标签二内容</text>
            </wd-tab>
          </wd-tabs>
          <view class="demo-row" style="height: 120px">
            <wd-sidebar v-model="sidebarValue">
              <wd-sidebar-item value="0" label="侧边一" />
              <wd-sidebar-item value="1" label="侧边二" />
            </wd-sidebar>
            <text class="demo-tab-text">当前选中: {{ sidebarValue }}</text>
          </view>
          <wd-steps :active="stepValue">
            <wd-step title="步骤一" description="描述" />
            <wd-step title="步骤二" description="描述" />
            <wd-step title="步骤三" description="描述" />
          </wd-steps>
          <view class="demo-row">
            <wd-pagination v-model="paginationValue" :total-items="100" :items-per-page="10" />
            <wd-backtop :scroll-top="200" />
          </view>
          <wd-collapse v-model="collapseValue">
            <wd-collapse-item name="1" title="折叠面板">
              <text class="demo-tab-text">折叠内容</text>
            </wd-collapse-item>
          </wd-collapse>
        </view>
      </view>

      <!-- 高级展示 -->
      <view class="demo-section">
        <text class="demo-section__title">SwipeAction 滑动操作 / Slider 滑块</text>
        <wd-swipe-action>
          <wd-cell title="左滑显示操作" value="跟手无延迟" />
          <template #right>
            <view class="demo-swipe-btn demo-swipe-btn--danger"><text class="demo-swipe-btn-text">删除</text></view>
          </template>
        </wd-swipe-action>
        <view class="demo-panel">
          <view class="demo-row" style="margin-top: 12px">
            <text class="demo-label">Slider</text>
            <wd-slider v-model="sliderValue" style="flex: 1" />
          </view>

          <text class="demo-section__title">Swiper / Table / Fab / Loadmore / Sticky</text>
          <wd-swiper :current="swiperIndex" :height="150" autoplay :list="swiperList" @update:current="swiperIndex = $event">
            <template #default="{ item }">
              <view class="demo-swiper-item" :style="{ background: item.color }"><text class="demo-swiper-text">{{ item.text }}</text></view>
            </template>
          </wd-swiper>
          <wd-table :data="[{name: 'Lynx', age: 1}, {name: 'Vue', age: 3}]">
            <wd-table-column prop="name" label="名称" />
            <wd-table-column prop="age" label="版本" />
          </wd-table>
          <view class="demo-row">
            <wd-fab icon="plus" />
            <wd-loadmore>没有更多了</wd-loadmore>
          </view>
        </view>
      </view>

      <!-- SVG 化组件：QrCode / BarCode / Signature / Watermark / Circle -->
      <view class="demo-section">
        <text class="demo-section__title">QrCode 二维码 / BarCode 条形码（SVG）</text>
        <view class="demo-panel">
          <view class="demo-row">
            <wd-qr-code :text="qrValue" :size="120" />
            <wd-bar-code :value="barValue" :width="180" :height="60" />
          </view>

          <text class="demo-section__title">Signature 手写签名（SVG polyline）</text>
          <view class="demo-row" style="align-items: flex-start">
            <wd-signature ref="signatureRef" :height="120" background="#f7f8fa" style="flex: 1" @confirm="(e: any) => (signResult = e.tempFilePath.slice(0, 42) + '…')" />
          </view>
          <view class="demo-row">
            <wd-button size="mini" @click="signatureRef && signatureRef.clear()">清空</wd-button>
            <wd-button size="mini" type="primary" @click="signatureRef && signatureRef.confirm()">确认</wd-button>
            <text class="demo-label">{{ signResult || '签名结果' }}</text>
          </view>

          <text class="demo-section__title">Watermark 水印（SVG data URI 背景）</text>
          <!-- full-screen=false：本节演示「容器内平铺」水印（.demo-watermark 是 120px 定位容器），
               fullScreen 默认 true 会渲染成 position:fixed 全屏水印、覆盖整个页面 -->
          <view class="demo-watermark">
            <wd-watermark content="wot-lynx-ui" :width="120" :height="60" :gutter-x="24" :gutter-y="24" :full-screen="false" />
            <text class="demo-watermark__text">水印平铺内容区域</text>
          </view>
        </view>
      </view>

      <view class="page__footer">
        <text class="page__footer-text">Lynx × Vue × wot-ui</text>
      </view>
    </scroll-view>

    <!-- 遮罩 -->
    <wd-overlay :show="showOverlay" @click="showOverlay = false" />

    <!-- 底部弹出层 -->
    <wd-popup v-model="showPopup" position="bottom">
      <view class="demo-popup">
        <text class="demo-popup__text">底部弹出层</text>
        <wd-button type="primary" @click="showPopup = false">关闭</wd-button>
      </view>
    </wd-popup>

    <!-- 居中弹出层 -->
    <wd-popup v-model="showCenterPopup" position="center">
      <view class="demo-popup demo-popup--center">
        <text class="demo-popup__text">居中弹出层</text>
        <wd-button type="primary" @click="showCenterPopup = false">关闭</wd-button>
      </view>
    </wd-popup>

    <!-- 对话框 -->
    <wd-dialog v-model="showDialog" title="提示" message="这是一个对话框" />

    <!-- 动作面板 -->
    <wd-action-sheet v-model="showActionSheet" :actions="[{name: '选项一'}, {name: '选项二'}]" />

    <!-- Toast / Notify -->
    <wd-notify v-model="showOverlay" />
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

.page__header {
  padding: 32px 20px 16px;
}

.page__title {
  font-size: 26px;
  font-weight: 700;
  color: #191a1f;
}

.page__subtitle {
  font-size: 13px;
  color: #868a93;
  margin-top: 6px;
}

.page__footer {
  padding: 32px 0;
  align-items: center;
}

.page__footer-text {
  font-size: 12px;
  color: #afb2bb;
}

/* HyperOS：分组标题在卡片之外（页面级辅助文字），内容为白色圆角卡片 */
.demo-section {
  margin-bottom: 4px;
}

.demo-section__title {
  font-size: 13px;
  font-weight: 500;
  color: #868a93;
  margin: 16px 16px 8px;
}

.demo-panel {
  background: #fff;
  border-radius: 16px;
  margin: 0 12px 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(25, 26, 31, 0.05);
}

/* 面板内分组标签（对齐 wot-ui demo 的 demo-group-item 标题） */
.demo-panel__label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #868a93;
  margin: 12px 0 8px;
}

.demo-panel__label:first-child {
  margin-top: 0;
}

.demo-watermark {
  position: relative;
  height: 120px;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.demo-watermark__text {
  position: absolute;
  left: 16px;
  top: 16px;
  font-size: 14px;
  color: #191a1f;
}

/* Lynx 3.x 新 CSS 引擎（enableCSSEngine + defaultDisplayLinear）下 view 的默认
   布局是 linear 而非 flex：未显式声明 display:flex 的元素不识别 flex-direction /
   flex-wrap（按 linear 默认的纵向排列，行内元素逐个独占一行）。
   因此所有依赖横向 flex 布局的容器必须显式 display:flex，详见 CONVENTIONS.md §14。 */
.demo-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}

/* 块级按钮行：子按钮 width:100% 独占一行，去掉底部间距避免双倍留白 */
.demo-row--block {
  margin-bottom: 0;
}

.demo-label {
  font-size: 14px;
  color: #454851;
  width: 64px;
}

.demo-card-footer {
  font-size: 12px;
  color: #868a93;
}

.demo-tab-text {
  font-size: 14px;
  color: #454851;
  padding: 12px 0;
}

.demo-swiper-item {
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.demo-swiper-text {
  font-size: 32px;
  color: #fff;
}

.demo-popup {
  background: #fff;
  border-radius: 28px 28px 0 0;
  padding: 24px;
  align-items: center;
  gap: 16px;
}

.demo-popup--center {
  border-radius: 24px;
  width: 280px;
}

.demo-swipe-btn {
  height: 100%;
  padding: 0 20px;
  align-items: center;
  justify-content: center;
}

.demo-swipe-btn--danger {
  background: #ff4d4f;
}

.demo-swipe-btn-text {
  color: #fff;
  font-size: 14px;
}

.demo-popup__text {
  font-size: 15px;
  color: #191a1f;
}
</style>
