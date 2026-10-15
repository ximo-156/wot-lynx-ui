<script setup lang="ts">
import { ref } from 'vue-lynx'
import { useToast } from 'wot-lynx-ui'

// 组件通过 wotLynxUI 插件全局注册（Tier 1：基础组件）
const count = ref(0)
const switchValue = ref(true)
const radioValue = ref('a')
const checkboxValues = ref<string[]>(['a'])
const inputValue = ref('')
const textareaValue = ref('')
const numberValue = ref(5)
const sliderValue = ref(50)
const rateValue = ref(3)
const segmentedValue = ref('a')
const pickerVisible = ref(false)
const pickerValue = ref<string[]>(['a'])
const pickerColumns = ref([
  ['a', 'b', 'c'],
  ['x', 'y', 'z']
])
const datetimeVisible = ref(false)
const datetimeValue = ref(Date.now())
const calendarVisible = ref(false)
const calendarValue = ref<number | null>(null)
const keyboardVisible = ref(false)
const payValue = ref('')
const verifyPassed = ref(false)
const uploadFiles = ref<any[]>([])
const tabValue = ref(0)
const sidebarValue = ref('a')
const progressValue = ref(60)
const pageValue = ref(1)
const qrText = ref('https://wot-ui.cn')
const barText = ref('1234567890128')
const collapseActive = ref<string[]>(['1'])
const tableData = ref([
  { name: '张三', age: 28, city: '北京' },
  { name: '李四', age: 34, city: '上海' }
])
const tableColumns = ref([
  { prop: 'name', label: '姓名', width: 80 },
  { prop: 'age', label: '年龄', width: 60 },
  { prop: 'city', label: '城市', width: 80 }
])
const swiperList2 = ref([
  { url: 'https://temp.img1.lynxjs.org/close.png', text: '1' },
  { url: 'https://temp.img1.lynxjs.org/close.png', text: '2' }
])
const dialogRef = ref<any>(null)
const actionSheetRef = ref<any>(null)
const notifyRef = ref<any>(null)
const asVisible = ref(false)

function showDemoDialog() {
  dialogRef.value?.alert({ title: '提示', msg: '这是一个对话框' })
}

function showDemoActionSheet() {
  actionSheetRef.value?.open()
}

function showDemoNotify() {
  notifyRef.value?.showNotify({ message: '这是一条消息通知', type: 'primary' })
}

function onTapButton() {
  count.value++
}

// ---- Form 校验示例 ----
const formRef = ref<any>(null)
const formModel = ref({ name: '', phone: '' })
const formSchema = {
  validate(model: Record<string, any>) {
    const issues: Array<{ path: string[]; message: string }> = []
    if (!model.name) issues.push({ path: ['name'], message: '请输入姓名' })
    if (!/^1\d{10}$/.test(model.phone || '')) issues.push({ path: ['phone'], message: '手机号格式不正确' })
    return issues
  }
}

async function onValidate() {
  const result = await formRef.value?.validate()
  console.log('[demo] form validate result:', result)
}

function onReset() {
  formRef.value?.reset()
}

// ---- 导航类组件 Demo 状态（Tier 5 补齐） ----
// IndexBar 索引数据（anchor 的 index 必填，按此注册右侧索引条）
const indexBarData = ref([
  { index: 'A', cities: ['北京', '蚌埠', '保定'] },
  { index: 'B', cities: ['重庆', '成都'] },
  { index: 'C', cities: ['长沙', '长春'] },
  { index: 'D', cities: ['大连', '东莞'] }
])
// SortButton 排序状态：-1 升序 / 0 无 / 1 降序
const sortValue = ref(0)
const sortResetValue = ref(0)
const sortDescValue = ref(0)
const sortLineValue = ref(1)
// SwiperNav 数据源（image: url + title；icon: icon + title）
const swiperNavItems = ref([
  { url: 'https://temp.img1.lynxjs.org/close.png', title: '图片一' },
  { url: 'https://temp.img1.lynxjs.org/close.png', title: '图片二' },
  { url: 'https://temp.img1.lynxjs.org/close.png', title: '图片三' }
])
const swiperNavIconItems = ref([
  { icon: 'home', title: '首页' },
  { icon: 'camera', title: '相机' },
  { icon: 'image', title: '图片' }
])
const swiperNavIndex = ref(-1)
// Tabbar 选中值（与既有 tabValue 区分）
const tabbarValue = ref(0)
const tabbarRoundValue = ref(1)
// TabbarItem 演示选中值
const tabbarItemValue = ref(2)
// Loadmore 状态循环切换：loading -> error -> finished
const loadmoreState = ref<'loading' | 'error' | 'finished'>('loading')
function cycleLoadmoreState() {
  loadmoreState.value = loadmoreState.value === 'loading' ? 'error' : loadmoreState.value === 'error' ? 'finished' : 'loading'
}
// Fab 展开状态（v-model:active）
const fabActive = ref(false)
const fabActiveLeft = ref(false)

// ---- 展示 / 布局类组件 Demo 状态（Tier 5 补齐） ----
// Skeleton 骨架屏
const skeletonLoading = ref(true)
const skeletonRowCol = ref<Array<number | Record<string, string>>>([
  { width: '40%' },
  3,
  { width: '96px', height: '96px' }
])
// CountTo 数字滚动（无 expose 方法，重新播放用 :key 强制重挂载）
const countToKey = ref(0)
const countToDone = ref(false)
function onCountToFinish() {
  countToDone.value = true
}
function replayCountTo() {
  countToKey.value++
  countToDone.value = false
}
// Backtop 回到顶部（scrollTop 必填，由 scroll-view @scroll 下发）
const backtopScrollTop = ref(0)
function onBacktopScroll(e: any) {
  backtopScrollTop.value = e?.detail?.scrollTop ?? 0
}
function onBacktopTap() {
  console.log('[demo] backtop tap, 回到顶部')
  backtopScrollTop.value = 0
}
// Resize 尺寸监听
const resizeHeight = ref(60)
const resizeCount = ref(0)
function onResize(e: any) {
  resizeCount.value++
  console.log('[demo] resize', e)
}
function toggleResizeHeight() {
  resizeHeight.value = resizeHeight.value === 60 ? 140 : 60
}

// ---- 选择器 / 表单类组件 Demo 状态（Tier 5 补齐） ----
// Cascader 级联选择
const cascaderVisible = ref(false)
const cascaderValue = ref<string[]>([])
const cascaderOptions = ref([
  {
    value: 'zj',
    text: '浙江省',
    children: [
      {
        value: 'hz',
        text: '杭州市',
        children: [
          { value: 'xh', text: '西湖区' },
          { value: 'bh', text: '滨江区' }
        ]
      },
      { value: 'nb', text: '宁波市', children: [{ value: 'jb', text: '江北区' }] }
    ]
  },
  {
    value: 'js',
    text: '江苏省',
    children: [
      {
        value: 'nj',
        text: '南京市',
        children: [
          { value: 'xw', text: '玄武区' },
          { value: 'gl', text: '鼓楼区' }
        ]
      }
    ]
  }
])
function cascaderLabel() {
  let nodes: any[] = cascaderOptions.value
  const labels: string[] = []
  for (const val of cascaderValue.value) {
    const node = nodes.find((item) => item.value === val)
    if (!node) break
    labels.push(node.text)
    nodes = node.children || []
  }
  return labels.length ? labels.join(' / ') : '未选择'
}
// SelectPicker 下拉选择
const selectPickerVisible = ref(false)
const selectPickerValue = ref<string[]>(['fruit'])
const selectPickerColumns = ref([
  { value: 'fruit', label: '水果' },
  { value: 'veg', label: '蔬菜' },
  { value: 'meat', label: '肉类' },
  { value: 'drink', label: '饮品' }
])
// DropMenu 下拉菜单
const dropSortValue = ref('')
const dropPriceValue = ref('')
const dropSortOptions = ref([
  { value: 'new', label: '最新发布' },
  { value: 'sales', label: '销量优先' },
  { value: 'price', label: '价格从低到高' }
])
const dropPriceOptions = ref([
  { value: '0-50', label: '50 元以下' },
  { value: '50-100', label: '50 - 100 元' },
  { value: '100+', label: '100 元以上' }
])
const dropSortLabel = ref('')
const dropPriceLabel = ref('')
function onSortChange(e: any) {
  dropSortLabel.value = dropSortOptions.value.find((o) => o.value === e.value)?.label || ''
}
function onPriceChange(e: any) {
  dropPriceLabel.value = dropPriceOptions.value.find((o) => o.value === e.value)?.label || ''
}
// DropMenuItem 自定义字段
const dropCustomValue = ref('')
const dropCustomOptions = ref([
  { id: 1, name: '选项一' },
  { id: 2, name: '选项二' },
  { id: 3, name: '选项三' }
])
const dropDisabledValue = ref('')
const dropCustomLabel = ref('')
function onCustomChange(e: any) {
  dropCustomLabel.value = dropCustomOptions.value.find((o) => o.id === e.value)?.name || ''
}
// CalendarView / DateTimePickerView 内嵌视图
const calendarViewValue = ref<number | null>(null)
const datetimePickerViewValue = ref(Date.now())
// ImgCropper 图片裁剪
const cropperVisible = ref(false)
const cropperResult = ref('')
function onCropperConfirm(e: any) {
  cropperResult.value = `缩放 ${e.scale} · ${e.width}×${e.height}`
}
// SwipeAction 滑动操作
const swipeCells = ref([
  { title: '单元格一', status: 'close' },
  { title: '单元格二', status: 'close' },
  { title: '单元格三', status: 'close' }
])
const swipeTip = ref('左右横滑单元格，点击两侧按钮')
// TableColumn 作用域插槽自定义列
const tableColData = ref([
  { name: '张三', status: '进行中', score: 92 },
  { name: '李四', status: '已完成', score: 85 },
  { name: '王五', status: '未开始', score: 78 }
])
const tableColColumns = ref([
  { prop: 'name', label: '姓名', width: 80 },
  { prop: 'status', label: '状态', width: 90 },
  { prop: 'score', label: '得分', width: 80 }
])

// ---- 弹层反馈类组件 Demo 状态（Tier 5 补齐） ----
// Popup 弹出层（实际 API 为 modelValue / update:modelValue，无 visible prop）
const popupVisible = ref(false)
const popupPosition = ref<'center' | 'top' | 'bottom' | 'left' | 'right'>('center')
function openPopup(position: 'center' | 'top' | 'bottom' | 'left' | 'right') {
  popupPosition.value = position
  popupVisible.value = true
}
// Overlay 遮罩（仅 show prop）
const overlayVisible = ref(false)
// Popover 气泡弹出
const popoverVisible = ref(false)
const popoverMenu = ref([
  { iconClass: 'settings', content: '选项一' },
  { iconClass: 'image', content: '选项二' },
  { iconClass: 'video', content: '选项三' }
])
// Tooltip 文字提示
const tooltipVisible = ref(false)
// Tour 新手引导
const tourVisible = ref(false)
const tourSteps = ref([
  { element: '#tour-target-1', title: '第一步', content: '这里是第一步的引导说明' },
  { element: '#tour-target-2', title: '第二步', content: '这里是第二步的引导说明' }
])
// Curtain 幕帘
const curtainVisible = ref(false)
// FloatingPanel 浮动面板（无 modelValue，:height 受控 + @height-change 回写）
const panelHeight = ref(200)
function onPanelHeightChange(e: any) {
  panelHeight.value = e.height
}
// Toast 轻提示（命令式 hook，与 wd-toast 的 selector 配对）
const toast = useToast('demo-toast')
// ImagePreview / VideoPreview 命令式 API（ref + selector）
const imagePreviewRef = ref<any>(null)
const previewImages = ref([
  'https://temp.img1.lynxjs.org/close.png',
  'https://temp.img1.lynxjs.org/close.png',
  'https://temp.img1.lynxjs.org/close.png'
])
function showImagePreview() {
  imagePreviewRef.value?.open({ images: previewImages.value, startPosition: 0 })
}
const videoPreviewRef = ref<any>(null)
const demoVideoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4'
function showVideoPreview() {
  videoPreviewRef.value?.open({ url: demoVideoUrl, poster: 'https://temp.img1.lynxjs.org/close.png', title: '示例视频' })
}
// RootPortal 根节点容器
const portalBarVisible = ref(false)
</script>

<template>
  <!-- app-root 显式挂 height:100%：Lynx 中百分比高度只相对「已确定高度」的父级解析，
       若包裹层为 auto（内容高度），其下 scroll-view 的 height:100% 会解析成内容高度而非
       屏幕高度——滚动容器与内容等高即无可滚动范围（页面无法滚动）。
       链路：page 根(屏幕高，确定) > app-root(100%) > scroll-view.page(100%) > 内容。 -->
  <wd-config-provider theme="light" custom-class="app-root">
    <scroll-view scroll-orientation="vertical" class="page">
      <view class="page__header">
        <text class="page__title">wot-lynx-ui</text>
        <text class="page__subtitle">Vue Lynx 组件库 · 重写版 Tier 1 · {{ count }}</text>
      </view>

      <!-- ConfigProvider 主题切换 -->
      <view class="demo-section">
        <text class="demo-section__title">ConfigProvider 全局配置</text>
        <view class="demo-panel">
          <text class="demo-panel__label">主题（本页固定 light，暗色令牌见 theme）</text>
          <view class="demo-row">
            <text class="demo-tag">theme="light"</text>
            <text class="demo-tag">theme="dark"</text>
          </view>
        </view>
      </view>

      <!-- Button -->
      <view class="demo-section">
        <text class="demo-section__title">Button 按钮</text>
        <view class="demo-panel">
          <text class="demo-panel__label">类型</text>
          <view class="demo-row">
            <wd-button type="primary" @tap="onTapButton">主要按钮</wd-button>
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
            <wd-button type="primary" variant="dashed">虚线</wd-button>
            <wd-button type="primary" variant="soft">柔和</wd-button>
            <wd-button type="primary" variant="subtle">淡雅</wd-button>
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
            <wd-icon name="loading" size="24" color="#7F5CFF" />
            <wd-icon name="arrow-left" size="20" />
            <wd-icon name="settings" size="20" color="#FF8800" />
          </view>
          <view class="demo-row">
            <wd-loading type="circular" size="24px" />
            <wd-loading type="spinner" size="24px" />
            <wd-loading type="dots" size="24px" />
            <wd-loading type="wave" size="24px" />
          </view>
          <view class="demo-row">
            <wd-loading type="circular" size="20px" color="#7F5CFF" text="加载中" />
            <wd-loading type="dots" size="20px" direction="horizontal" text="横向" />
          </view>
        </view>
      </view>

      <!-- Cell / CellGroup -->
      <view class="demo-section">
        <text class="demo-section__title">Cell 单元格</text>
        <view class="demo-panel">
          <wd-cell-group title="基础用法" border>
            <wd-cell title="单元格" value="内容" />
            <wd-cell title="图标 + 箭头" prefix-icon="settings" is-link value="跳转" />
            <wd-cell title="描述文本" label="这是描述信息" value="内容" />
          </wd-cell-group>
          <wd-cell-group title="卡片分组" insert>
            <wd-cell title="左侧标题宽度" value="内容" title-width="120" />
            <wd-cell title="垂直布局" label="上下排列" value="内容" layout="vertical" />
          </wd-cell-group>
        </view>
      </view>

      <!-- 表单体系（Tier 2） -->
      <view class="demo-section">
        <text class="demo-section__title">Form 表单体系</text>
        <view class="demo-panel">
          <text class="demo-panel__label">Switch / Radio / Checkbox</text>
          <view class="demo-row">
            <wd-switch v-model="switchValue" />
            <wd-radio-group v-model="radioValue" direction="horizontal">
              <wd-radio value="a">选项A</wd-radio>
              <wd-radio value="b">选项B</wd-radio>
            </wd-radio-group>
          </view>
          <view class="demo-row">
            <wd-checkbox-group v-model="checkboxValues" direction="horizontal">
              <wd-checkbox name="a">多选A</wd-checkbox>
              <wd-checkbox name="b">多选B</wd-checkbox>
            </wd-checkbox-group>
          </view>

          <text class="demo-panel__label">Input / Textarea / InputNumber / Search</text>
          <view class="demo-row">
            <wd-input v-model="inputValue" placeholder="请输入" clearable style="flex: 1" />
          </view>
          <view class="demo-row">
            <wd-textarea v-model="textareaValue" placeholder="多行输入" :show-word-limit="true" :maxlength="50" style="flex: 1" />
          </view>
          <view class="demo-row">
            <wd-input-number v-model="numberValue" :min="0" :max="10" />
            <wd-search v-model="inputValue" placeholder="搜索" style="flex: 1" />
          </view>

          <text class="demo-panel__label">Slider / Rate / Segmented</text>
          <view class="demo-row">
            <wd-slider v-model="sliderValue" style="flex: 1" />
          </view>
          <view class="demo-row">
            <wd-rate v-model="rateValue" />
            <wd-segmented v-model="segmentedValue" :options="['日', '周', '月']" style="flex: 1" />
          </view>

          <text class="demo-panel__label">Form + FormItem（schema 校验）</text>
          <wd-form ref="formRef" :model="formModel" :schema="formSchema" error-type="message">
            <wd-form-item prop="name" title="姓名" required>
              <wd-input v-model="formModel.name" placeholder="请输入姓名" />
            </wd-form-item>
            <wd-form-item prop="phone" title="手机号" required>
              <wd-input v-model="formModel.phone" placeholder="请输入手机号" />
            </wd-form-item>
            <view class="demo-row">
              <wd-button type="primary" size="small" @tap="onValidate">校验</wd-button>
              <wd-button size="small" @tap="onReset">重置</wd-button>
            </view>
          </wd-form>
        </view>
      </view>

      <!-- Picker / Datetime / Calendar（Tier 2b） -->
      <view class="demo-section">
        <text class="demo-section__title">Picker 选择器 / Datetime / Calendar</text>
        <view class="demo-panel">
          <view class="demo-row">
            <wd-button type="primary" size="small" @tap="pickerVisible = true">单列选择</wd-button>
            <wd-button size="small" @tap="datetimeVisible = true">日期时间</wd-button>
            <wd-button size="small" @tap="calendarVisible = true">日历</wd-button>
          </view>
          <view class="demo-row">
            <text class="demo-tag">picker: {{ pickerValue.join('/') }}</text>
            <text class="demo-tag">calendar: {{ calendarValue ? new Date(calendarValue).toLocaleDateString() : '未选择' }}</text>
          </view>

          <text class="demo-panel__label">PickerView（内嵌）</text>
          <wd-picker-view v-model="pickerValue" :columns="pickerColumns" />

          <text class="demo-panel__label">Keyboard + PasswordInput</text>
          <view class="demo-row">
            <wd-password-input :model-value="payValue" :length="6" />
            <wd-button size="small" @tap="keyboardVisible = true">弹出键盘</wd-button>
          </view>

          <text class="demo-panel__label">SlideVerify / Signature / Upload</text>
          <view class="demo-row">
            <wd-slide-verify v-model="verifyPassed" />
          </view>
          <view class="demo-row">
            <wd-signature style="flex: 1" />
          </view>
          <view class="demo-row">
            <wd-upload v-model:file-list="uploadFiles" :limit="3" action="" />
          </view>
        </view>
      </view>

      <!-- 弹层类组件（Tier 2b） -->
      <wd-picker
        v-model="pickerValue"
        v-model:visible="pickerVisible"
        :columns="pickerColumns"
        title="选择器"
        @confirm="(e: any) => console.log('[demo] picker confirm', e)"
      />
      <wd-datetime-picker
        v-model="datetimeValue"
        v-model:visible="datetimeVisible"
        type="datetime"
        title="日期时间"
        @confirm="(e: any) => console.log('[demo] datetime confirm', e)"
      />
      <wd-calendar
        v-model="calendarValue"
        v-model:visible="calendarVisible"
        type="date"
        title="日历"
        @confirm="(e: any) => console.log('[demo] calendar confirm', e)"
      />
      <wd-keyboard v-model="payValue" v-model:visible="keyboardVisible" />

      <!-- 展示 / 布局 / 导航（Tier 3） -->
      <view class="demo-section">
        <text class="demo-section__title">展示 / 布局 / 导航</text>
        <view class="demo-panel">
          <text class="demo-panel__label">Tag / Badge / Avatar / Progress</text>
          <view class="demo-row">
            <wd-tag type="primary">主标签</wd-tag>
            <wd-tag type="success" variant="plain">朴素</wd-tag>
            <wd-tag type="danger" round closable>可关</wd-tag>
            <wd-badge :value="8"><wd-avatar size="36" text="A" /></wd-badge>
          </view>
          <view class="demo-row">
            <wd-progress :percentage="progressValue" style="flex: 1" />
          </view>

          <text class="demo-panel__label">Tabs 选项卡</text>
          <wd-tabs v-model="tabValue">
            <wd-tab title="标签一"><text class="demo-panel__label">标签一内容</text></wd-tab>
            <wd-tab title="标签二"><text class="demo-panel__label">标签二内容</text></wd-tab>
          </wd-tabs>

          <text class="demo-panel__label">Sidebar 侧边导航</text>
          <view class="demo-row" style="height: 120px">
            <wd-sidebar v-model="sidebarValue" style="height: 100%">
              <wd-sidebar-item label="选项一" value="a" />
              <wd-sidebar-item label="选项二" value="b" />
            </wd-sidebar>
            <view style="flex: 1; padding: 12px">
              <text class="demo-panel__label">当前：{{ sidebarValue }}</text>
            </view>
          </view>

          <text class="demo-panel__label">Pagination / CountDown / NoticeBar / Skeleton / Card / Grid</text>
          <view class="demo-row">
            <wd-pagination v-model="pageValue" :total-page="5" />
            <wd-count-down :time="60000" format="mm:ss" />
          </view>
          <wd-notice-bar text="这是一条通知栏提示" prefix="sound" />
          <wd-card title="卡片标题" style="margin-top: 8px">卡片内容</wd-card>
          <wd-grid :column="3" style="margin-top: 8px">
            <wd-grid-item icon="image" text="图片" />
            <wd-grid-item icon="video" text="视频" />
            <wd-grid-item icon="file" text="文件" />
          </wd-grid>
        </view>
      </view>

      <!-- 图形码 / 弹层（Tier 3d/4） -->
      <view class="demo-section">
        <text class="demo-section__title">图形码 / 弹层反馈</text>
        <view class="demo-panel">
          <text class="demo-panel__label">QrCode / BarCode / Circle（SVG 方案）</text>
          <view class="demo-row">
            <wd-qr-code :text="qrText" :size="120" />
            <wd-bar-code :text="barText" :width="160" :height="60" />
            <wd-circle :model-value="65" :size="80" text="65%" />
          </view>

          <text class="demo-panel__label">Dialog / ActionSheet / Notify（命令式）</text>
          <view class="demo-row">
            <wd-button size="small" @tap="showDemoDialog">Dialog</wd-button>
            <wd-button size="small" @tap="showDemoActionSheet">ActionSheet</wd-button>
            <wd-button size="small" @tap="showDemoNotify">Notify</wd-button>
          </view>

          <text class="demo-panel__label">Table / Steps / Swiper / Watermark / Collapse</text>
          <wd-table :data="tableData" :columns="tableColumns" style="margin-bottom: 8px" />
          <wd-steps :active="1">
            <wd-step title="步骤一" />
            <wd-step title="步骤二" />
            <wd-step title="步骤三" />
          </wd-steps>
          <wd-swiper :list="swiperList2" style="margin-top: 8px" />
          <wd-collapse v-model="collapseActive" style="margin-top: 8px">
            <wd-collapse-item name="1" title="折叠面板一">内容一</wd-collapse-item>
            <wd-collapse-item name="2" title="折叠面板二">内容二</wd-collapse-item>
          </wd-collapse>
        </view>
      </view>

      <!-- 命令式弹层实例 -->
      <wd-dialog ref="dialogRef" selector="demo-dialog" />
      <wd-action-sheet ref="actionSheetRef" v-model="asVisible" :actions="[{ name: '选项一' }, { name: '选项二' }]" cancel-text="取消" />
      <wd-notify ref="notifyRef" selector="demo-notify" />

      <!-- Text / Divider / Gap -->
      <view class="demo-section">
        <text class="demo-section__title">Text 文本 / Divider 分割线 / Gap 间距</text>
        <view class="demo-panel">
          <view class="demo-row">
            <wd-text text="主文本" />
            <wd-text text="品牌色" type="primary" />
            <wd-text text="成功" type="success" />
            <wd-text text="危险" type="error" />
            <wd-text text="粗体" bold />
          </view>
          <view class="demo-row">
            <wd-text mode="price" text="1234567.89" />
            <wd-text mode="phone" format text="22644212509" />
            <wd-text mode="date" text="1735689600000" />
          </view>
          <wd-divider>分割线</wd-divider>
          <wd-divider content-position="left">左对齐</wd-divider>
          <wd-divider dashed />
          <wd-gap height="12" bg-color="#F7F8FA" />
        </view>
      </view>

      <!-- Overlay / Transition / RootPortal -->
      <view class="demo-section">
        <text class="demo-section__title">Transition 过渡</text>
        <view class="demo-panel">
          <text class="demo-panel__label">弹层三件套的组合用法随 Tier 3（Popup/Dialog）演示回归</text>
          <view class="demo-row">
            <wd-transition :show="count > 0" name="fade-up">
              <view class="demo-transition-box">
                <text class="demo-transition-box__text">fade-up 过渡（点击主要按钮计数 > 0 时显示）</text>
              </view>
            </wd-transition>
          </view>
        </view>
      </view>


    </scroll-view>
  </wd-config-provider>
</template>

<style scoped>
<style scoped>
.app-root {
  height: 100%;
}

.page {
  height: 100%;
  padding: 16px;
}

.page__header {
  padding: 16px 4px 24px;
}

.page__title {
  font-size: 28px;
  font-weight: 600;
  color: #171b26;
}

.page__subtitle {
  font-size: 13px;
  color: #667085;
  margin-top: 4px;
}

.demo-section {
  margin-bottom: 20px;
}

.demo-section__title {
  font-size: 15px;
  font-weight: 600;
  color: #171b26;
  margin-bottom: 8px;
}

.demo-panel {
  background: #ffffff;
  border-radius: 16px;
  border-width: 1px;
  border-style: solid;
  border-color: #e4e7ed;
  padding: 12px;
}

.demo-panel__label {
  font-size: 12px;
  color: #8b93a3;
  margin: 8px 0;
}

.demo-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.demo-row--block {
  display: block;
}

.demo-tag {
  font-size: 12px;
  color: #7f5cff;
  background: #edf1ff;
  border-radius: 6px;
  padding: 4px 8px;
}

.demo-transition-box {
  background: #7f5cff;
  border-radius: 12px;
  padding: 16px;
}

.demo-transition-box__text {
  color: #ffffff;
  font-size: 13px;
}
</style>
