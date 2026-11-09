<script setup lang="ts">
import { computed, reactive, ref } from 'vue-lynx'
import { useToast, usePageScrollLock, useQueue } from 'wot-lynx-ui'

import { testSections, totalItems, type TestItem } from './checklist'
import { componentSections } from './component-checks'
import ChecklistBox from './ChecklistBox.vue'
import Showcase from '../showcase/Showcase.vue'
import ShowcaseLayout from '../showcase/ShowcaseLayout'
import DemoSection from '../showcase/DemoSection'
import { demoImage } from '../assets/demo-images'

// Default entry is bounded; all-at-once remains an explicit stress test.
const demoProps = withDefaults(defineProps<{ stress?: boolean }>(), { stress: false })

/**
 * 构建标记（真机自证）：换新包后这一行会变，看不到就是加载了旧 bundle。
 * 真机排查第一时间看它，避免"改了没生效"的误判。
 */
const buildTag = 'R19 · 106 组件逐页验收'

/**
 * 页面结构（R19 按组件分页）：真机反馈「每一个组件都要能显示出来，按页分」。
 * 顶部两种模式，默认落地组件目录：
 *
 * 1. **组件目录（106 页）**：与主 demo 共用同一份 Showcase，一个组件一节
 *    （节名即组件标签），逐页浏览；每页渲染该组件的真实演示，下方「真机检查」
 *    卡挂 component-checks.ts 的对应检查项，勾选进度与交互卡共用。
 * 2. **交互验收（8 组）**：手写交互卡（Slider 拖动跟手、弹层级联、键盘、
 *    亮暗主题等必须动手操作的场景），勾选进度按 39 项计。
 *
 * 两类合计 145 项；两种模式同时只挂载一个（v-if），切走即卸载，瞬态弹层
 * 不会跨模式残留。
 */
const mode = ref<'catalog' | 'interaction'>('catalog')

// 组件标签 → 真机检查项（'r-wd-button' → 'wd-button'），供组件目录逐页渲染
const checkMap = computed(() => {
  const map: Record<string, TestItem> = {}
  for (const section of componentSections) {
    for (const item of section.items) map[item.id.slice(2)] = item
  }
  return map
})

const pageScrollLocked = usePageScrollLock()
const { closeOutside } = useQueue()

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

function resetTransientTests() {
  popupVisible.value = false
  overlayVisible.value = false
  pickerVisible.value = false
  datetimeVisible.value = false
  notifyVisible.value = false
  keyboardVisible.value = false
  sliderDiagnostics.value = false
  toast.close()
  dialogRef.value?.close()
}

// ---------- 2. Slider ----------
const sliderValue = ref(50)
const sliderStep = ref(50)
const sliderRange = ref<number[]>([20, 80])

// 仅用户展开时采样；原生 row 监听不与 Slider 内部事件合并，也不拦冒泡/滚动。
const sliderDiagnostics = ref(false)
const sliderProbe = reactive({ phase: '未开始', rawMoves: 0, acceptedMoves: 0, firstId: '-', lastId: '-', x: '-', width: '-', target: '-' })
// Use a binding object, not an inline v-on ternary: Vue wraps inline expressions
// in an always-registered function, even when the expression returns undefined.
const sliderProbeBindings = computed(() => sliderDiagnostics.value ? {
  onTouchstart: (event: any) => sampleSliderTouch(event, 'start'),
  onTouchmove: (event: any) => sampleSliderTouch(event, 'move'),
  onTouchend: (event: any) => sampleSliderTouch(event, 'end'),
  onTouchcancel: (event: any) => sampleSliderTouch(event, 'cancel')
} : {})
function sampleSliderLayout(event: any) {
  // 此处记录演示中单滑块的控件宽度；不是伪造组件内部缓存的轨道度量结果。
  const layout = event?.detail?.layout ?? event?.detail
  const width = Number(layout?.width)
  sliderProbe.width = Number.isFinite(width) && width > 0 ? `${Math.round(width)}px` : '未布局'
}
function toggleSliderDiagnostics() {
  sliderDiagnostics.value = !sliderDiagnostics.value
}
function sampleSliderTouch(event: any, phase: 'start' | 'move' | 'end' | 'cancel') {
  if (!sliderDiagnostics.value) return
  const point = event?.changedTouches?.[0] ?? event?.touches?.[0]
  const id = String(point?.identifier ?? point?.id ?? '无 ID')
  sliderProbe.phase = phase
  sliderProbe.lastId = id
  sliderProbe.x = String(point?.clientX ?? point?.pageX ?? event?.detail?.x ?? '无坐标')
  if (phase === 'start') {
    sliderProbe.rawMoves = 0
    sliderProbe.acceptedMoves = 0
    sliderProbe.firstId = id
    sliderProbe.target = String(event?.target?.id || '(目标无 id)')
  } else if (phase === 'move') sliderProbe.rawMoves++
}
function sampleSliderDragMove() {
  if (sliderDiagnostics.value) sliderProbe.acceptedMoves++
}

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

/**
 * 贴边弹层（真机 2026-11-05 缺陷的正对场景）：
 * 时间选择器 / Picker 是 position=bottom 的弹层，Dialog 是 center，
 * notify 悬浮态靠左右内缩——三者曾一起被拉到屏幕左上角。
 */
const pickerVisible = ref(false)
const pickerValue = ref<string[]>(['a'])
const pickerColumns = ref([
  ['a', 'b', 'c'],
  ['x', 'y', 'z']
])
const datetimeVisible = ref(false)
const datetimeValue = ref(Date.now())
const notifyVisible = ref(false)

function openPopup(position: 'top' | 'bottom' | 'center') {
  popupPosition.value = position
  popupVisible.value = true
}

function onPopupModel(value: boolean) {
  overlayEvent.value = `update:modelValue: ${value}`
}

function showAlert() {
  // alert / confirm / prompt 都返回 Promise，**取消路径是 reject**
  // （与 wot-ui 一致，fail 回调同样会触发）。不接 catch 时点「取消 / 关闭 /
  // 遮罩」就是一个 unhandled rejection——真机上被 Sentry 记成
  // USER_RUNTIME_ERROR（错误码 201/20100，message 为
  // `unhandled rejection: {"action":"cancel"}`），清单页第 4 组因此判红。
  dialogRef.value
    ?.alert({
      title: '提示',
      msg: '这是一个对话框',
      confirm: () => {
        overlayEvent.value = 'dialog alert: confirm'
      }
    })
    ?.catch(() => {
      // 关闭 / 遮罩取消：本演示只关心确认分支
    })
}

function showConfirm() {
  dialogRef.value
    ?.confirm({
      title: '确认操作',
      msg: '确定要执行该操作吗？',
      confirm: (result: any) => {
        overlayEvent.value = `dialog confirm: ${result.action}`
      },
      cancel: (result: any) => {
        overlayEvent.value = `dialog cancel: ${result.action}`
      }
    })
    ?.catch(() => {
      // 回调里已记录取消结果，这里只负责吞掉 Promise 的 reject
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
  { url: demoImage, text: '1' },
  { url: demoImage, text: '2' }
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
  <wd-config-provider :theme="themeMode" custom-class="app-root" @tap="closeOutside">
    <scroll-view id="device-test-page" scroll-orientation="vertical" :scroll-enable="!pageScrollLocked" :enable-scroll="!pageScrollLocked" class="page">
      <!-- ============ 头部：设备信息 ============ -->
      <view class="header">
        <text class="header__title">wot-lynx-ui 真机测试</text>
        <text class="header__sub">Vue Lynx · 106 组件逐页 + 8 组交互验收 · 共 {{ totalItems }} 项</text>
        <text class="header__sub">{{ buildTag }}</text>
        <view class="header__device">
          <text class="header__device-item">平台 {{ deviceInfo.platform }}</text>
          <text class="header__device-item">屏幕 {{ deviceInfo.width }}×{{ deviceInfo.height }}</text>
          <text class="header__device-item">DPR {{ deviceInfo.dpr }}</text>
          <text class="header__device-item">引擎 {{ deviceInfo.engine }}</text>
        </view>
        <!-- 模式切换：组件目录（默认，106 页）/ 交互验收（8 组手写卡）。
             两种模式同时只挂载一个，切走即卸载，弹层不会跨模式残留。 -->
        <view class="header__modes">
          <view id="device-mode-catalog" class="mode" :class="mode === 'catalog' ? 'mode--on' : ''" @tap="mode = 'catalog'">
            <text :class="mode === 'catalog' ? 'mode__text mode__text--on' : 'mode__text'">组件目录（106 页）</text>
          </view>
          <view id="device-mode-interaction" class="mode" :class="mode === 'interaction' ? 'mode--on' : ''" @tap="mode = 'interaction'">
            <text :class="mode === 'interaction' ? 'mode__text mode__text--on' : 'mode__text'">交互验收（8 组）</text>
          </view>
        </view>
        <!-- 亮暗切换放头部：组件目录页同样需要验暗色令牌，不必为了切主题
             退回交互验收的第 8 组。根 provider 受控，两种模式都生效。 -->
        <view class="header__modes">
          <view class="mode" :class="themeMode === 'light' ? 'mode--on' : ''" @tap="themeMode = 'light'">
            <text :class="themeMode === 'light' ? 'mode__text mode__text--on' : 'mode__text'">亮色</text>
          </view>
          <view class="mode" :class="themeMode === 'dark' ? 'mode--on' : ''" @tap="themeMode = 'dark'">
            <text :class="themeMode === 'dark' ? 'mode__text mode__text--on' : 'mode__text'">暗色</text>
          </view>
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

      <!-- ============ 组件目录（默认落地）：一个组件一页 ============ -->
      <!-- 与主 demo 共用同一份 Showcase；每页渲染该组件真实演示，「真机检查」
           卡挂 component-checks.ts 的对应检查项（checkMap 按节名匹配）。
           普通浏览只挂载当前页；显式「全量压力模式」才全部同显。 -->
      <Showcase v-if="mode === 'catalog'" :browse="!demoProps.stress" :header="false" initial-section="wd-button" :check-map="checkMap" :checked="checked" scroll-target="#device-test-page" @check-toggle="toggle" />

      <!-- ============ 交互验收（8 组手写卡） ============ -->
      <ShowcaseLayout v-else :browse="!demoProps.stress" id-prefix="device-tests" scroll-target="#device-test-page" @section-change="resetTransientTests">
      <DemoSection name="button" :title="testSections[0].title" v-slot="{ title }">
      <view class="card">
        <text class="card__title">{{ title }}</text>
        <text class="card__hint">{{ testSections[0].hint }}</text>
        <view class="row">
          <wd-button type="primary">主要</wd-button>
          <wd-button type="success">成功</wd-button>
          <wd-button type="danger">危险</wd-button>
          <wd-button type="warning">警告</wd-button>
          <wd-button type="info">信息</wd-button>
        </view>
        <view class="row">
          <wd-button type="primary" variant="plain">朴素</wd-button>
          <wd-button type="primary" variant="dashed">虚线</wd-button>
          <wd-button type="primary" variant="soft">柔和</wd-button>
          <wd-button type="primary" variant="subtle">淡雅</wd-button>
          <wd-button type="primary" variant="text">文字</wd-button>
        </view>
        <view class="row">
          <wd-button disabled>禁用</wd-button>
          <!-- 不显式传 loading-color：loading 前景色跟随按钮文字色（暗色下随
               --wot-button-main-color 翻成深色墨，白环压浅色主底会不可见） -->
          <wd-button type="primary" loading>加载中</wd-button>
          <wd-button type="danger" round>圆角</wd-button>
          <wd-button type="primary" block>块级</wd-button>
        </view>
        <ChecklistBox :items="testSections[0].items" :checked="checked" @toggle="toggle" />
      </view>
      </DemoSection>

      <!-- ============ 2. Slider ============ -->
      <DemoSection name="slider" :title="testSections[1].title" v-slot="{ title }">
      <view class="card">
        <text class="card__title">{{ title }}</text>
        <text class="card__hint">{{ testSections[1].hint }}</text>
        <view
          id="slider-native-probe"
          class="row slider-row"
          v-bind="sliderProbeBindings"
        >
          <wd-slider v-model="sliderValue" :style="{ flex: '1' }" @dragmove="sampleSliderDragMove" @layoutchange="sampleSliderLayout" />
          <text class="tag slider-value" text-maxline="1">当前 {{ sliderValue }}</text>
        </view>
        <view class="row">
          <wd-button size="small" type="info" @tap="toggleSliderDiagnostics">{{ sliderDiagnostics ? '收起滑块诊断' : '显示滑块诊断' }}</wd-button>
        </view>
        <view v-if="sliderDiagnostics">
          <text class="tag">{{ sliderProbe.phase }} · 原生移动 {{ sliderProbe.rawMoves }} / 有效移动 {{ sliderProbe.acceptedMoves }} · 控件宽 {{ sliderProbe.width }}</text>
          <text class="tag">ID {{ sliderProbe.firstId }} → {{ sliderProbe.lastId }} · x {{ sliderProbe.x }}</text>
          <text class="tag">目标 {{ sliderProbe.target }}</text>
        </view>
        <view class="row slider-row">
          <wd-slider
            v-model="sliderStep"
            :step="10"
            :marks="{ 0: '0', 50: '50', 100: '100' }"
            :style="{ flex: '1' }"
          />
        </view>
        <view class="row slider-row">
          <wd-slider v-model="sliderRange" range :style="{ flex: '1' }" />
          <text class="tag slider-value" text-maxline="1">{{ sliderRange[0] }} ~ {{ sliderRange[1] }}</text>
        </view>
        <ChecklistBox :items="testSections[1].items" :checked="checked" @toggle="toggle" />
      </view>
      </DemoSection>

      <!-- ============ 3. SwipeAction ============ -->
      <DemoSection name="swipe-action" :title="testSections[2].title" v-slot="{ title }">
      <view class="card">
        <text class="card__title">{{ title }}</text>
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
      </DemoSection>

      <!-- ============ 4. 弹层 ============ -->
      <DemoSection name="overlay" :title="testSections[3].title" v-slot="{ title }">
      <view class="card">
        <text class="card__title">{{ title }}</text>
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
        <!-- 贴边弹层：真机上曾整片贴到屏幕左上角（fixed + flex 收缩） -->
        <view class="row">
          <wd-button size="small" @tap="datetimeVisible = true">时间选择器</wd-button>
          <wd-button size="small" @tap="pickerVisible = true">Picker</wd-button>
          <wd-button size="small" @tap="notifyVisible = true">Notify 悬浮</wd-button>
        </view>
        <text class="tag">事件：{{ overlayEvent }}</text>
        <ChecklistBox :items="testSections[3].items" :checked="checked" @toggle="toggle" />
      </view>
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
      <wd-picker v-model="pickerValue" v-model:visible="pickerVisible" :columns="pickerColumns" title="选择器" />
      <wd-datetime-picker v-model="datetimeValue" v-model:visible="datetimeVisible" type="datetime" title="日期时间" />
      <wd-notify v-model:visible="notifyVisible" message="Notify 悬浮：贴顶 + 左右内缩" variant="floating" position="top" />
      </DemoSection>

      <!-- ============ 5. 表单 ============ -->
      <DemoSection name="form" :title="testSections[4].title" v-slot="{ title }">
      <view class="card">
        <text class="card__title">{{ title }}</text>
        <text class="card__hint">{{ testSections[4].hint }}</text>
        <view class="row">
          <wd-password-input :model-value="payValue" :length="6" />
          <wd-button size="small" @tap="keyboardVisible = true">弹起键盘</wd-button>
        </view>
        <view class="row">
          <wd-input v-model="inputValue" placeholder="请输入（受控回显）" clearable :style="{ flex: '1' }" />
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
      <wd-keyboard v-model="payValue" v-model:visible="keyboardVisible" />
      </DemoSection>

      <!-- ============ 6. Cell 列表 ============ -->
      <DemoSection name="cell" :title="testSections[5].title" v-slot="{ title }">
      <view class="card">
        <text class="card__title">{{ title }}</text>
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
      </DemoSection>

      <!-- ============ 7. 展示组件 ============ -->
      <DemoSection name="display" :title="testSections[6].title" v-slot="{ title }">
      <view class="card">
        <text class="card__title">{{ title }}</text>
        <text class="card__hint">{{ testSections[6].hint }}</text>
        <view class="row">
          <wd-icon name="close" size="20" />
          <wd-icon name="loading" size="24" color="#755FFE" />
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
          <wd-progress :percentage="60" :style="{ flex: '1' }" />
        </view>
        <wd-notice-bar text="这是一条通知栏提示" prefix="sound" />
        <wd-swiper :list="swiperList" :style="{ 'margin-top': '8px' }" />
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
      </DemoSection>

      <!-- ============ 8. 主题与适配 ============ -->
      <DemoSection name="theme" :title="testSections[7].title" v-slot="{ title }">
      <view class="card">
        <text class="card__title">{{ title }}</text>
        <text class="card__hint">{{ testSections[7].hint }}</text>
        <view class="row">
          <!-- 未选中态用 info（中性类型）而非 'default'：ButtonType 只有
               primary/success/info/warning/danger，'default' 匹配不到任何类型
               规则 → 无背景、无色文本，暗色下整粒按钮不可见（2026-11-05 截图） -->
          <wd-button size="small" :type="themeMode === 'light' ? 'primary' : 'info'" @tap="themeMode = 'light'">亮色</wd-button>
          <wd-button size="small" :type="themeMode === 'dark' ? 'primary' : 'info'" @tap="themeMode = 'dark'">暗色</wd-button>
          <text class="tag">当前：{{ themeMode }}</text>
        </view>
        <!-- themeVars 覆盖：嵌套 provider 需显式透传 theme，否则回退默认 light -->
        <wd-config-provider :theme="themeMode" :theme-vars="{ primary6: '#FF8800' }">
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
      </DemoSection>
      </ShowcaseLayout>
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

/* 模式 / 主题切换 chips：选中态用主色底，未选中用中性底 */
.header__modes {
  display: flex;
  flex-direction: row;
  gap: 8px;
  margin-top: 8px;
}

.mode {
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--wot-filled-bottom);
  border-width: 1px;
  border-style: solid;
  border-color: var(--wot-border-main);
}

.mode--on {
  background: var(--wot-primary-6);
  border-color: var(--wot-primary-6);
}

.mode__text {
  font-size: 12px;
  color: var(--wot-text-main);
}

.mode__text--on {
  color: var(--wot-text-white);
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

/* Slider 独立成行：不改按钮等演示依赖的全局 row wrap。 */
.slider-row {
  flex-wrap: nowrap;
}

.slider-value {
  flex-shrink: 0;
  line-height: 16px;
  white-space: nowrap;
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
