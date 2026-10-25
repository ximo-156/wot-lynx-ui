<script setup lang="ts">
import { computed, ref } from 'vue-lynx'
import { listIcons, useToast } from 'wot-lynx-ui'
import { demoBrokenImage, demoImage } from './assets/demo-images'

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
// ---- Keyboard 键盘 Demo 状态（默认数字键盘 / 自定义键盘 / 车牌键盘） ----
const customKeyboardVisible = ref(false)
const customKeyboardValue = ref('')
const carKeyboardVisible = ref(false)
const carKeyboardValue = ref('')
const verifyPassed = ref(false)
const slideVerifyRef = ref<any>(null)
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
const swiperList2 = ref([
  { url: demoImage, text: '1' },
  { url: demoImage, text: '2' }
])
const dialogRef = ref<any>(null)
const actionSheetRef = ref<any>(null)
const notifyRef = ref<any>(null)
const asVisible = ref(false)

// 内置图标画廊：当前全部注册图标经 wd-pagination 分页展示（每页 30 个 = 5 列 × 6 行）
const allIcons = listIcons()
const iconPageSize = 30
const iconTotalPage = Math.ceil(allIcons.length / iconPageSize)
const iconPage = ref(1)
const pagedIcons = computed(() => allIcons.slice((iconPage.value - 1) * iconPageSize, iconPage.value * iconPageSize))

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
  { url: demoImage, title: '图片一' },
  { url: demoImage, title: '图片二' },
  { url: demoImage, title: '图片三' }
])
const swiperNavIconItems = ref([
  { icon: 'home', title: '首页' },
  { icon: 'camera', title: '相机' },
  { icon: 'picture', title: '图片' }
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
// 悬浮按钮是否挂载：fixed 节点会一直浮在整页之上，演示页默认不渲染
const fabDemoVisible = ref(false)

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
  { iconClass: 'setting', content: '选项一' },
  { iconClass: 'picture', content: '选项二' },
  { iconClass: 'film', content: '选项三' }
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
const panelVisible = ref(false)
const panelHeight = ref(200)
function onPanelHeightChange(e: any) {
  panelHeight.value = e.height
}
// Toast 轻提示（命令式 hook，与 wd-toast 的 selector 配对）
const toast = useToast('demo-toast')
// ImagePreview / VideoPreview 命令式 API（ref + selector）
const imagePreviewRef = ref<any>(null)
const previewImages = ref([
  demoImage,
  demoImage,
  demoImage
])
function showImagePreview() {
  imagePreviewRef.value?.open({ images: previewImages.value, startPosition: 0 })
}
const videoPreviewRef = ref<any>(null)
const demoVideoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4'
function showVideoPreview() {
  videoPreviewRef.value?.open({ url: demoVideoUrl, poster: demoImage, title: '示例视频' })
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
            <wd-button type="primary" icon="setting">设置</wd-button>
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
          <text class="demo-panel__label">内置图标（{{ allIcons.length }} 个，wd-pagination 分页展示）</text>
          <wd-grid :column="5">
            <wd-grid-item v-for="name in pagedIcons" :key="name" :icon="name" :text="name" ellipsis />
          </wd-grid>
          <view class="demo-row" :style="{ 'justify-content': 'center', 'margin-top': '4px' }">
            <wd-pagination v-model="iconPage" :total-page="iconTotalPage" show-icon />
          </view>
          <text class="demo-panel__label">Loading 加载</text>
          <view class="demo-row">
            <wd-loading type="circular" size="24px" />
            <wd-loading type="spinner" size="24px" />
            <wd-loading type="dots" size="24px" />
            <wd-loading type="wave" size="24px" />
          </view>
          <view class="demo-row">
            <wd-loading type="circular" size="20px" color="#755FFE" text="加载中" />
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
            <wd-cell title="图标 + 箭头" prefix-icon="setting" is-link value="跳转" />
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
            <wd-input v-model="inputValue" placeholder="请输入" clearable :style="{ flex: '1' }" />
          </view>
          <view class="demo-row">
            <wd-textarea v-model="textareaValue" placeholder="多行输入" :show-word-limit="true" :maxlength="50" :style="{ flex: '1' }" />
          </view>
          <view class="demo-row">
            <wd-input-number v-model="numberValue" :min="0" :max="10" />
            <wd-search v-model="inputValue" placeholder="搜索" :style="{ flex: '1' }" />
          </view>

          <text class="demo-panel__label">Slider / Rate / Segmented</text>
          <view class="demo-row">
            <wd-slider v-model="sliderValue" :style="{ flex: '1' }" />
          </view>
          <view class="demo-row">
            <wd-rate v-model="rateValue" />
            <wd-segmented v-model="segmentedValue" :options="['日', '周', '月']" :style="{ flex: '1' }" />
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

          <text class="demo-panel__label">SlideVerify / Signature / Upload</text>
          <view class="demo-row">
            <wd-slide-verify ref="slideVerifyRef" @success="verifyPassed = true" @fail="verifyPassed = false" />
          </view>
          <view class="demo-row">
            <wd-signature :style="{ flex: '1' }" />
          </view>
          <view class="demo-row">
            <wd-upload v-model:file-list="uploadFiles" :limit="3" action="" />
          </view>
        </view>
      </view>

      <!-- Keyboard 键盘（独立成节：数字 / 自定义 / 车牌三种模式） -->
      <view class="demo-section">
        <text class="demo-section__title">Keyboard 键盘</text>
        <view class="demo-panel">
          <text class="demo-panel__label">默认数字键盘 + PasswordInput（支付密码场景，maxlength=6）</text>
          <view class="demo-row">
            <wd-password-input :model-value="payValue" :length="6" />
            <wd-button type="primary" size="small" @tap="keyboardVisible = true">弹出键盘</wd-button>
          </view>

          <text class="demo-panel__label">自定义键盘（mode="custom"，extraKey 左侧小数点，右侧删除/关闭）</text>
          <view class="demo-row">
            <wd-input v-model="customKeyboardValue" placeholder="点右侧按钮弹起自定义键盘" readonly :style="{ flex: '1' }" />
            <wd-button size="small" @tap="customKeyboardVisible = true">弹起键盘</wd-button>
          </view>
          <view class="demo-row">
            <text class="demo-tag">已输入：{{ customKeyboardValue || '（空）' }}</text>
          </view>

          <text class="demo-panel__label">车牌键盘（mode="car"，autoSwitchLang 输入首位后自动切换英文）</text>
          <view class="demo-row">
            <wd-input v-model="carKeyboardValue" placeholder="点右侧按钮弹起车牌键盘" readonly :style="{ flex: '1' }" />
            <wd-button size="small" @tap="carKeyboardVisible = true">弹起键盘</wd-button>
          </view>
          <view class="demo-row">
            <text class="demo-tag">车牌：{{ carKeyboardValue || '（空）' }}</text>
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
      <wd-keyboard v-model="customKeyboardValue" v-model:visible="customKeyboardVisible" mode="custom" extra-key="." close-text="关闭" />
      <wd-keyboard v-model="carKeyboardValue" v-model:visible="carKeyboardVisible" mode="car" :maxlength="8" auto-switch-lang />

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
            <wd-progress :percentage="progressValue" :style="{ flex: '1' }" />
          </view>

          <text class="demo-panel__label">Tabs 选项卡</text>
          <wd-tabs v-model="tabValue">
            <wd-tab title="标签一"><text class="demo-panel__label">标签一内容</text></wd-tab>
            <wd-tab title="标签二"><text class="demo-panel__label">标签二内容</text></wd-tab>
          </wd-tabs>

          <text class="demo-panel__label">Sidebar 侧边导航</text>
          <view class="demo-row" :style="{ height: '120px' }">
            <wd-sidebar v-model="sidebarValue" :style="{ height: '100%' }">
              <wd-sidebar-item label="选项一" value="a" />
              <wd-sidebar-item label="选项二" value="b" />
            </wd-sidebar>
            <view :style="{ flex: '1', padding: '12px' }">
              <text class="demo-panel__label">当前：{{ sidebarValue }}</text>
            </view>
          </view>

          <text class="demo-panel__label">Pagination / CountDown / NoticeBar / Skeleton / Card / Grid</text>
          <view class="demo-row">
            <wd-pagination v-model="pageValue" :total-page="5" />
            <wd-count-down :time="60000" format="mm:ss" />
          </view>
          <wd-notice-bar text="这是一条通知栏提示" prefix="notification" />
          <wd-card title="卡片标题" :style="{ 'margin-top': '8px' }">卡片内容</wd-card>
          <wd-grid :column="3" :style="{ 'margin-top': '8px' }">
            <wd-grid-item icon="picture" text="图片" />
            <wd-grid-item icon="film" text="视频" />
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
          <!-- Table 的列是 wd-table-column 子组件（无 columns prop，传了会被
               当作透传属性静默忽略、整表只剩序号列） -->
          <wd-table :data="tableData" :custom-style="{ 'margin-bottom': '8px' }">
            <wd-table-column prop="name" label="姓名" :width="80" />
            <wd-table-column prop="age" label="年龄" :width="60" />
            <wd-table-column prop="city" label="城市" :width="80" />
          </wd-table>
          <wd-steps :active="1">
            <wd-step title="步骤一" />
            <wd-step title="步骤二" />
            <wd-step title="步骤三" />
          </wd-steps>
          <wd-swiper :list="swiperList2" :style="{ 'margin-top': '8px' }" />
          <wd-collapse v-model="collapseActive" :style="{ 'margin-top': '8px' }">
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

      <!-- 导航类组件（Tier 5 补齐） -->
      <view class="demo-section">
        <text class="demo-section__title">Navbar 导航栏</text>
        <view class="demo-panel">
          <text class="demo-panel__label">标题 + 左侧箭头 + 下边框</text>
          <wd-navbar title="标题" left-arrow bordered @click-left="() => console.log('[demo] navbar 左侧')" @click-right="() => console.log('[demo] navbar 右侧')" />
          <text class="demo-panel__label">左侧文字 + 右侧文字</text>
          <wd-navbar title="标题" left-text="返回" right-text="设置" @click-left="() => console.log('[demo] navbar 左侧')" @click-right="() => console.log('[demo] navbar 右侧')" />
          <text class="demo-panel__label">胶囊按钮（capsule 插槽）</text>
          <wd-navbar title="标题">
            <template #capsule>
              <wd-navbar-capsule @back="() => console.log('[demo] navbar 胶囊返回')" @home="() => console.log('[demo] navbar 胶囊首页')" />
            </template>
          </wd-navbar>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">NavbarCapsule 导航胶囊</text>
        <view class="demo-panel">
          <text class="demo-panel__label">返回 + 首页 / 仅返回（show-home=false + border）</text>
          <view class="demo-row">
            <wd-navbar-capsule @back="() => console.log('[demo] capsule 返回')" @home="() => console.log('[demo] capsule 首页')" />
            <wd-navbar-capsule :show-home="false" border @back="() => console.log('[demo] capsule 返回')" />
          </view>
          <text class="demo-panel__label">自定义颜色（bg-color / color）</text>
          <view class="demo-row">
            <wd-navbar-capsule bg-color="#755FFE" color="#FFFFFF" />
            <wd-navbar-capsule :show-back="false" bg-color="#9A89FF" color="#2D273D" />
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">SortButton 排序按钮</text>
        <view class="demo-panel">
          <view class="demo-row">
            <wd-sort-button v-model="sortValue" title="价格" @change="(e: any) => console.log('[demo] sort change', e)" />
            <text class="demo-tag">当前状态：{{ sortValue }}</text>
          </view>
          <text class="demo-panel__label">allow-reset 可重置 / desc-first 降序优先 / line 下划线</text>
          <view class="demo-row">
            <wd-sort-button v-model="sortResetValue" title="可重置" allow-reset />
            <wd-sort-button v-model="sortDescValue" title="降序优先" desc-first />
            <wd-sort-button v-model="sortLineValue" title="带下划线" line />
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">SwiperNav 轮播导航</text>
        <view class="demo-panel">
          <text class="demo-panel__label">图片导航（type="image"）</text>
          <wd-swiper-nav :items="swiperNavItems" @click="(e: any) => { swiperNavIndex.value = e.index; console.log('[demo] swiper-nav click', e) }" />
          <text class="demo-panel__label">图标导航（type="icon"）</text>
          <wd-swiper-nav type="icon" :items="swiperNavIconItems" @click="(e: any) => { swiperNavIndex.value = e.index; console.log('[demo] swiper-nav click', e) }" />
          <view class="demo-row">
            <text class="demo-tag">点击索引：{{ swiperNavIndex }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Tabbar 标签栏</text>
        <view class="demo-panel">
          <text class="demo-panel__label">基础用法（v-model + bordered + change 事件）</text>
          <wd-tabbar v-model="tabbarValue" bordered @change="(e: any) => console.log('[demo] tabbar change', e)">
            <wd-tabbar-item title="首页" icon="home" />
            <wd-tabbar-item title="消息" icon="comment" />
            <wd-tabbar-item title="我的" icon="user" />
          </wd-tabbar>
          <text class="demo-panel__label">圆角形状（shape="round"）+ 自定义激活色</text>
          <wd-tabbar v-model="tabbarRoundValue" shape="round" active-color="#755FFE" :style="{ 'margin-top': '8px' }">
            <wd-tabbar-item title="首页" icon="home" active-icon="home-filling" />
            <wd-tabbar-item title="消息" icon="comment" />
            <wd-tabbar-item title="我的" icon="user" />
          </wd-tabbar>
          <view class="demo-row">
            <text class="demo-tag">当前：{{ tabbarValue }} / {{ tabbarRoundValue }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">TabbarItem 标签栏项</text>
        <view class="demo-panel">
          <text class="demo-panel__label">icon / active-icon / value 徽标 / is-dot 圆点 / max 上限</text>
          <wd-tabbar v-model="tabbarItemValue">
            <wd-tabbar-item title="首页" icon="home" active-icon="home-filling" />
            <wd-tabbar-item title="相机" icon="camera" />
            <wd-tabbar-item title="消息" icon="comment" :value="8" />
            <wd-tabbar-item title="通知" icon="notification" is-dot />
            <wd-tabbar-item title="我的" icon="user" :name="99" :value="150" :max="99" />
          </wd-tabbar>
          <view class="demo-row">
            <text class="demo-tag">当前选中：{{ tabbarItemValue }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Loadmore 加载更多</text>
        <view class="demo-panel">
          <view class="demo-row">
            <wd-button size="small" @tap="cycleLoadmoreState">切换状态</wd-button>
            <text class="demo-tag">state: {{ loadmoreState }}</text>
          </view>
          <wd-loadmore :state="loadmoreState" loading-text="努力加载中..." finished-text="没有更多了" error-text="加载失败，点击重试" @reload="() => console.log('[demo] loadmore reload')" />
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">IndexAnchor 索引锚点</text>
        <view class="demo-panel">
          <text class="demo-panel__label">index 必填；无插槽内容时回退显示索引字符</text>
          <view :style="{ height: '300px' }">
            <wd-index-bar>
              <wd-index-anchor index="A" />
              <wd-index-anchor index="B">
                <view class="demo-row">
                  <text class="demo-tag">北京</text>
                  <text class="demo-tag">蚌埠</text>
                </view>
              </wd-index-anchor>
            </wd-index-bar>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">IndexBar 索引栏</text>
        <view class="demo-panel">
          <text class="demo-panel__label">城市列表（外层容器固定 300px，触摸右侧索引条跳转，sticky 吸顶）</text>
          <view :style="{ height: '300px' }">
            <wd-index-bar sticky>
              <wd-index-anchor v-for="group in indexBarData" :key="group.index" :index="group.index">
                <text class="demo-panel__label" :style="{ margin: '0' }">{{ group.index }}</text>
                <view v-for="city in group.cities" :key="city" :style="{ padding: '6px 0' }">
                  <text class="demo-tag">{{ city }}</text>
                </view>
              </wd-index-anchor>
            </wd-index-bar>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Fab 悬浮按钮</text>
        <view class="demo-panel">
          <view class="demo-row">
            <wd-button size="small" @tap="fabDemoVisible = !fabDemoVisible">{{ fabDemoVisible ? '隐藏悬浮按钮' : '显示悬浮按钮' }}</wd-button>
            <wd-button size="small" @tap="fabActive = true">展开</wd-button>
            <wd-button size="small" @tap="fabActive = false">收起</wd-button>
            <text class="demo-tag">active: {{ fabActive }}</text>
          </view>
          <text class="demo-panel__label">右下角向上展开（默认）；左上角向下展开（position="left-top" + direction="bottom"）</text>
          <!-- 悬浮按钮是 position: fixed，会固定悬浮在整页之上；演示页默认不挂载，
               避免它压住其它章节的内容（需要时点「显示悬浮按钮」） -->
          <text class="demo-panel__label">当前：{{ fabDemoVisible ? '已显示（页面右下 / 左上各一枚）' : '未显示' }}</text>
        </view>
        <view v-if="fabDemoVisible">
          <wd-fab v-model:active="fabActive" @click="() => console.log('[demo] fab click')">
            <wd-button size="small" @tap="() => console.log('[demo] fab 菜单一')">菜单一</wd-button>
            <wd-button size="small" @tap="() => console.log('[demo] fab 菜单二')">菜单二</wd-button>
          </wd-fab>
          <wd-fab v-model:active="fabActiveLeft" position="left-top" direction="bottom" type="warning" inactive-icon="edit">
            <wd-button size="small" type="warning" @tap="() => console.log('[demo] fab 左上菜单')">编辑</wd-button>
          </wd-fab>
        </view>
      </view>

      <!-- 展示 / 布局类组件（Tier 5 补齐） -->
      <view class="demo-section">
        <text class="demo-section__title">Img 图片</text>
        <view class="demo-panel">
          <text class="demo-panel__label">mode 裁剪模式</text>
          <view class="demo-row">
            <wd-img :src="demoImage" width="110" height="80" mode="aspectFill" />
            <wd-img :src="demoImage" width="110" height="80" mode="aspectFit" />
            <wd-img :src="demoImage" width="110" height="80" mode="widthFix" />
          </view>
          <text class="demo-panel__label">圆形 / 圆角 / 懒加载 / 预览</text>
          <view class="demo-row">
            <wd-img :src="demoImage" width="72" height="72" round />
            <wd-img :src="demoImage" width="72" height="72" radius="8" />
            <wd-img :src="demoImage" width="72" height="72" lazy-load />
            <wd-img :src="demoImage" width="72" height="72" enable-preview show-menu-by-longpress @load="(e: any) => console.log('[demo] img load', e)" />
          </view>
          <text class="demo-panel__label">错误态 / 点击</text>
          <view class="demo-row">
            <wd-img :src="demoBrokenImage" width="72" height="72" @error="(e: any) => console.log('[demo] img error', e)" />
            <wd-img :src="demoImage" width="72" height="72" round @tap="(e: any) => console.log('[demo] img tap', e)" />
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Empty 空状态</text>
        <view class="demo-panel">
          <text class="demo-panel__label">基础用法</text>
          <wd-empty tip="暂无数据" />
          <text class="demo-panel__label">icon / iconSize 自定义</text>
          <view class="demo-row" :style="{ 'align-items': 'flex-start' }">
            <wd-empty icon="delete" :icon-size="56" tip="购物车是空的" :style="{ flex: '1' }" />
            <wd-empty icon="setting" :icon-size="56" tip="没有搜索结果" :style="{ flex: '1' }" />
          </view>
          <text class="demo-panel__label">底部插槽</text>
          <wd-empty tip="还没有订单" icon="picture" :icon-size="56">
            <template #bottom>
              <wd-button size="small" type="primary">去下单</wd-button>
            </template>
          </wd-empty>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Skeleton 骨架屏</text>
        <view class="demo-panel">
          <text class="demo-panel__label">animation 动画类型</text>
          <view class="demo-row" :style="{ 'align-items': 'flex-start' }">
            <wd-skeleton animation="gradient" :style="{ flex: '1' }" />
            <wd-skeleton animation="flashing" :style="{ flex: '1' }" />
            <wd-skeleton animation="pulse" :style="{ flex: '1' }" />
            <wd-skeleton animation="none" :style="{ flex: '1' }" />
          </view>
          <text class="demo-panel__label">rowCol 行列配置 / round</text>
          <wd-skeleton :row-col="skeletonRowCol" animation="flashing" round />
          <text class="demo-panel__label">loading 控制真实内容</text>
          <wd-skeleton :loading="skeletonLoading" :row-col="[2]">
            <text class="demo-tag">内容加载完成</text>
          </wd-skeleton>
          <view class="demo-row">
            <wd-button size="small" @tap="skeletonLoading = !skeletonLoading">切换 loading</wd-button>
            <text class="demo-tag">loading: {{ skeletonLoading }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">CountTo 数字滚动</text>
        <view class="demo-panel">
          <text class="demo-panel__label">type 主题 / prefix / suffix / decimals</text>
          <view class="demo-row">
            <wd-count-to :key="countToKey" type="primary" :start-val="0" :end-val="2024" :duration="2000" prefix="¥" @finish="onCountToFinish" />
            <wd-count-to type="success" :start-val="0" :end-val="99.99" :decimals="2" :duration="2000" suffix="%" />
            <wd-count-to type="error" :start-val="0" :end-val="666" :duration="2000" />
          </view>
          <text class="demo-panel__label">separator 千分位 / color / autoStart 手动开始</text>
          <view class="demo-row">
            <wd-count-to :start-val="0" :end-val="1234567" :duration="3000" color="#755FFE" />
            <wd-count-to :auto-start="false" :start-val="0" :end-val="8888" :duration="1500" separator="," />
          </view>
          <view class="demo-row">
            <wd-button size="small" @tap="replayCountTo">重新播放</wd-button>
            <text class="demo-tag">finish 已触发：{{ countToDone }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Backtop 回到顶部</text>
        <view class="demo-panel">
          <text class="demo-panel__label">scroll-view 滚动超过 top 阈值显示</text>
          <scroll-view scroll-orientation="vertical" :style="{ height: '220px' }" :scroll-top="backtopScrollTop" @scroll="onBacktopScroll">
            <view :style="{ padding: '12px' }">
              <wd-backtop :scroll-top="backtopScrollTop" :top="60" text="顶部" shape="square" :bottom="24" :right="24" @tap="onBacktopTap" />
              <text class="demo-panel__label">scrollTop: {{ backtopScrollTop }}（阈值 60）</text>
              <view v-for="item in 12" :key="item" :style="{ padding: '10px 0' }">
                <text class="demo-tag">滚动内容 {{ item }}</text>
              </view>
            </view>
          </scroll-view>
          <view class="demo-row">
            <text class="demo-tag">shape="square"</text>
            <text class="demo-tag">text="顶部" / bottom / right 可配</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Col 列布局</text>
        <view class="demo-panel">
          <text class="demo-panel__label">span 占据数（24 制）</text>
          <wd-row :style="{ 'margin-bottom': '8px' }">
            <wd-col :span="24" :style="{ background: '#EEEBFF', padding: '8px', 'border-radius': '6px' }"><text class="demo-tag">span 24</text></wd-col>
          </wd-row>
          <wd-row :style="{ 'margin-bottom': '8px' }">
            <wd-col :span="12" :style="{ background: '#EEEBFF', padding: '8px', 'border-radius': '6px' }"><text class="demo-tag">span 12</text></wd-col>
            <wd-col :span="12" :style="{ background: '#EEEBFF', padding: '8px', 'border-radius': '6px' }"><text class="demo-tag">span 12</text></wd-col>
          </wd-row>
          <text class="demo-panel__label">offset 左侧偏移</text>
          <wd-row :style="{ 'margin-bottom': '8px' }">
            <wd-col :span="6" :offset="6" :style="{ background: '#EEEBFF', padding: '8px', 'border-radius': '6px' }"><text class="demo-tag">offset 6</text></wd-col>
            <wd-col :span="6" :offset="6" :style="{ background: '#EEEBFF', padding: '8px', 'border-radius': '6px' }"><text class="demo-tag">offset 6</text></wd-col>
          </wd-row>
          <wd-row>
            <wd-col :span="4" :offset="4" :style="{ background: '#EEEBFF', padding: '8px', 'border-radius': '6px' }"><text class="demo-tag">4</text></wd-col>
            <wd-col :span="4" :offset="8" :style="{ background: '#EEEBFF', padding: '8px', 'border-radius': '6px' }"><text class="demo-tag">4</text></wd-col>
          </wd-row>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Row 行布局</text>
        <view class="demo-panel">
          <text class="demo-panel__label">gutter 列间距</text>
          <wd-row :gutter="12" :style="{ 'margin-bottom': '8px' }">
            <wd-col :span="8" :style="{ background: '#EEEBFF', padding: '8px', 'border-radius': '6px' }"><text class="demo-tag">8</text></wd-col>
            <wd-col :span="8" :style="{ background: '#EEEBFF', padding: '8px', 'border-radius': '6px' }"><text class="demo-tag">8</text></wd-col>
            <wd-col :span="8" :style="{ background: '#EEEBFF', padding: '8px', 'border-radius': '6px' }"><text class="demo-tag">8</text></wd-col>
          </wd-row>
          <text class="demo-panel__label">justify 水平排列</text>
          <wd-row justify="space-between" :style="{ 'margin-bottom': '8px' }">
            <wd-col :span="6" :style="{ background: '#EEEBFF', padding: '8px', 'border-radius': '6px' }"><text class="demo-tag">6</text></wd-col>
            <wd-col :span="6" :style="{ background: '#EEEBFF', padding: '8px', 'border-radius': '6px' }"><text class="demo-tag">6</text></wd-col>
          </wd-row>
          <wd-row justify="center" :style="{ 'margin-bottom': '8px' }">
            <wd-col :span="8" :style="{ background: '#EEEBFF', padding: '8px', 'border-radius': '6px' }"><text class="demo-tag">居中</text></wd-col>
          </wd-row>
          <text class="demo-panel__label">align 垂直对齐</text>
          <wd-row align="bottom" :style="{ height: '64px', background: '#f7f8fa' }">
            <wd-col :span="12" :style="{ background: '#EEEBFF', padding: '8px', 'border-radius': '6px' }"><text class="demo-tag">底部对齐</text></wd-col>
            <wd-col :span="12" :style="{ background: '#EEEBFF', padding: '8px', 'border-radius': '6px' }"><text class="demo-tag">align="bottom"</text></wd-col>
          </wd-row>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Resize 尺寸监听</text>
        <view class="demo-panel">
          <text class="demo-panel__label">内容尺寸变化时触发 resize</text>
          <wd-resize @resize="onResize">
            <!-- 对象语法：字符串 :style 会被 vue-lynx 静默丢弃（CONVENTIONS §19），
                 高度变化必须真实生效才能触发 wd-resize -->
            <view :style="{ height: `${resizeHeight}px`, background: '#EEEBFF', 'border-radius': '8px', padding: '12px' }">
              <text class="demo-tag">高度 {{ resizeHeight }}px · resize 触发 {{ resizeCount }} 次</text>
            </view>
          </wd-resize>
          <view class="demo-row">
            <wd-button size="small" @tap="toggleResizeHeight">切换高度</wd-button>
            <text class="demo-tag">事件参数含 width / height</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Sticky 粘性布局</text>
        <view class="demo-panel">
          <text class="demo-panel__label">滚动容器内吸顶（zIndex / offsetTop）</text>
          <scroll-view scroll-orientation="vertical" :style="{ height: '200px' }">
            <view :style="{ padding: '12px' }">
              <view :style="{ height: '32px', background: '#f7f8fa' }" />
              <wd-sticky :offset-top="0" :z-index="10">
                <view :style="{ background: '#755FFE', padding: '10px', 'border-radius': '8px' }">
                  <text :style="{ color: '#ffffff', 'font-size': '13px' }">吸顶标题 A（offsetTop 0）</text>
                </view>
              </wd-sticky>
              <view :style="{ height: '260px', background: '#f7f8fa', padding: '12px' }"><text class="demo-tag">滚动内容区</text></view>
              <wd-sticky :offset-top="12" :z-index="9">
                <view :style="{ background: '#ff8800', padding: '10px', 'border-radius': '8px' }">
                  <text :style="{ color: '#ffffff', 'font-size': '13px' }">吸顶标题 B（offsetTop 12）</text>
                </view>
              </wd-sticky>
              <view :style="{ height: '260px', background: '#f7f8fa', padding: '12px' }"><text class="demo-tag">更多内容</text></view>
            </view>
          </scroll-view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">StickyBox 粘性容器</text>
        <view class="demo-panel">
          <text class="demo-panel__label">offsetTop 偏移（容器高度由外层样式承担）</text>
          <wd-sticky-box :style="{ height: '180px' }">
            <view :style="{ padding: '12px' }">
              <wd-sticky :offset-top="0" :z-index="10">
                <view :style="{ background: '#755FFE', padding: '10px', 'border-radius': '8px' }">
                  <text :style="{ color: '#ffffff', 'font-size': '13px' }">offsetTop 0</text>
                </view>
              </wd-sticky>
              <view :style="{ height: '24px' }" />
              <view :style="{ height: '220px', background: '#f7f8fa', padding: '12px' }"><text class="demo-tag">容器内滚动内容</text></view>
              <wd-sticky :offset-top="8">
                <view :style="{ background: '#ff8800', padding: '10px', 'border-radius': '8px' }">
                  <text :style="{ color: '#ffffff', 'font-size': '13px' }">offsetTop 8</text>
                </view>
              </wd-sticky>
              <view :style="{ height: '220px', background: '#f7f8fa', padding: '12px' }"><text class="demo-tag">继续滚动</text></view>
            </view>
          </wd-sticky-box>
        </view>
      </view>

      <!-- 选择器 / 表单类组件（Tier 5 补齐） -->
      <view class="demo-section">
        <text class="demo-section__title">Cascader 级联选择</text>
        <view class="demo-panel">
          <text class="demo-panel__label">弹层形态（v-model:visible，三级选项）</text>
          <view class="demo-row">
            <wd-button type="primary" size="small" @tap="cascaderVisible = true">选择地区</wd-button>
            <text class="demo-tag">当前：{{ cascaderLabel() }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">SelectPicker 下拉选择</text>
        <view class="demo-panel">
          <text class="demo-panel__label">多选弹层（type="checkbox"，v-model:visible）</text>
          <view class="demo-row">
            <wd-button type="primary" size="small" @tap="selectPickerVisible = true">选择分类</wd-button>
            <text class="demo-tag">已选：{{ selectPickerValue.join('、') || '无' }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">DropMenu 下拉菜单</text>
        <view class="demo-panel">
          <wd-drop-menu>
            <wd-drop-menu-item
              v-model="dropSortValue"
              title="排序方式"
              :options="dropSortOptions"
              @change="onSortChange"
            />
            <wd-drop-menu-item
              v-model="dropPriceValue"
              title="价格区间"
              :options="dropPriceOptions"
              @change="onPriceChange"
            />
          </wd-drop-menu>
          <view class="demo-row">
            <text class="demo-tag">排序：{{ dropSortLabel || '未选择' }}</text>
            <text class="demo-tag">价格：{{ dropPriceLabel || '未选择' }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">DropMenuItem 下拉菜单项</text>
        <view class="demo-panel">
          <wd-drop-menu>
            <wd-drop-menu-item
              v-model="dropCustomValue"
              title="自定义字段"
              :options="dropCustomOptions"
              value-key="id"
              label-key="name"
              @change="onCustomChange"
            />
            <wd-drop-menu-item v-model="dropDisabledValue" title="禁用项" :options="dropSortOptions" disabled />
          </wd-drop-menu>
          <view class="demo-row">
            <text class="demo-tag">valueKey/labelKey：id / name</text>
            <text class="demo-tag">已选：{{ dropCustomLabel || '未选择' }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">CalendarView 日历视图</text>
        <view class="demo-panel">
          <text class="demo-panel__label">内嵌视图（type="date"，无弹层）</text>
          <wd-calendar-view v-model="calendarViewValue" :style="{ height: '400px' }" />
          <view class="demo-row">
            <text class="demo-tag">选中：{{ calendarViewValue ? new Date(calendarViewValue).toLocaleDateString() : '未选择' }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">DateTimePickerView 日期时间视图</text>
        <view class="demo-panel">
          <text class="demo-panel__label">内嵌视图（type="datetime"，无弹层）</text>
          <view :style="{ height: '280px' }">
            <wd-datetime-picker-view v-model="datetimePickerViewValue" />
          </view>
          <view class="demo-row">
            <text class="demo-tag">{{ new Date(datetimePickerViewValue).toLocaleString() }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">ImgCropper 图片裁剪</text>
        <view class="demo-panel">
          <text class="demo-panel__label">基础裁剪（网络图，aspectRatio="1:1"）</text>
          <view class="demo-row">
            <wd-button type="primary" size="small" @tap="cropperVisible = true">打开裁剪</wd-button>
            <text class="demo-tag">{{ cropperResult || '未裁剪' }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">AvatarGroup 头像组</text>
        <view class="demo-panel">
          <text class="demo-panel__label">层叠叠加（max-count=3 折叠，cascading 默认 left-up，超出收进折叠头像）</text>
          <view class="demo-row">
            <wd-avatar-group :max-count="3" :size="40" collapse-avatar="+5">
              <wd-avatar v-for="name in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']" :key="name" :size="40" :text="name" bg-color="#755FFE" />
            </wd-avatar-group>
          </view>
          <text class="demo-panel__label">方形层叠（shape="square" 统一形状）</text>
          <view class="demo-row">
            <wd-avatar-group shape="square" :size="40">
              <wd-avatar :size="40" :src="demoImage" />
              <wd-avatar :size="40" :src="demoImage" />
              <wd-avatar :size="40" :src="demoImage" />
            </wd-avatar-group>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">SwipeAction 滑动操作</text>
        <view class="demo-panel">
          <text class="demo-tag">{{ swipeTip }}</text>
          <wd-swipe-action v-for="(cell, index) in swipeCells" :key="index" v-model="cell.status">
            <template #left>
              <wd-button size="small" type="warning" @tap="swipeTip = cell.title + '：收藏'">收藏</wd-button>
            </template>
            <wd-cell :title="cell.title" :value="cell.status" />
            <template #right>
              <wd-button size="small" type="danger" @tap="swipeTip = cell.title + '：删除'">删除</wd-button>
            </template>
          </wd-swipe-action>
          <view class="demo-row">
            <text class="demo-tag">状态：{{ swipeCells.map((c) => c.status).join(' / ') }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">TableColumn 表格列</text>
        <view class="demo-panel">
          <text class="demo-panel__label">作用域插槽自定义列（status 渲染为标签）</text>
          <!-- 自定义单元格：在具体列上写 #value 作用域插槽（row 为该行数据）；
               wd-table 的默认插槽用于摆放列组件，不是带 row/column 参数的作用域插槽 -->
          <wd-table :data="tableColData">
            <wd-table-column prop="name" label="姓名" :width="80" />
            <wd-table-column prop="status" label="状态" :width="90">
              <template #value="{ row }">
                <text class="demo-tag">{{ row.status }}</text>
              </template>
            </wd-table-column>
            <wd-table-column prop="score" label="得分" :width="80" />
          </wd-table>
          <view class="demo-row">
            <text class="demo-tag">插槽参数：row / index</text>
            <text class="demo-tag">TableColumn：prop / label / width</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Watermark 水印</text>
        <view class="demo-panel">
          <text class="demo-panel__label">文字水印（content，固定高度容器）</text>
          <view :style="{ height: '180px', 'border-radius': '12px', overflow: 'hidden' }">
            <!-- opacity 不传：默认走 --wot-watermark-opacity（0.6）。此前显式传
               0.15，灰字叠白底在真机上几乎不可见，被误判为「水印不渲染」 -->
          <wd-watermark content="wot-lynx-ui" :font-size="14" :full-screen="false" :style="{ height: '100%' }">
              <view :style="{ padding: '12px' }">
                <text class="demo-panel__label">被水印覆盖的内容区域</text>
              </view>
            </wd-watermark>
          </view>
        </view>
      </view>

      <!-- 弹层反馈类组件（Tier 5 补齐） -->
      <view class="demo-section">
        <text class="demo-section__title">Popup 弹出层</text>
        <view class="demo-panel">
          <text class="demo-panel__label">弹出位置（v-model 受控，round + closable）</text>
          <view class="demo-row">
            <wd-button size="small" @tap="openPopup('top')">top</wd-button>
            <wd-button size="small" @tap="openPopup('bottom')">bottom</wd-button>
            <wd-button size="small" @tap="openPopup('center')">center</wd-button>
            <wd-button size="small" @tap="openPopup('left')">left</wd-button>
            <wd-button size="small" @tap="openPopup('right')">right</wd-button>
          </view>
          <view class="demo-row">
            <text class="demo-tag">position: {{ popupPosition }}</text>
            <text class="demo-tag">visible: {{ popupVisible }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Overlay 遮罩</text>
        <view class="demo-panel">
          <text class="demo-panel__label">基础遮罩（:show 控制，点击遮罩关闭）</text>
          <view class="demo-row">
            <wd-button size="small" @tap="overlayVisible = true">显示遮罩</wd-button>
            <text class="demo-tag">show: {{ overlayVisible }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Popover 气泡弹出</text>
        <view class="demo-panel">
          <text class="demo-panel__label">normal 模式（点击目标切换，Lynx 无 hover）</text>
          <view class="demo-row">
            <wd-popover v-model="popoverVisible" content="普通气泡内容" placement="top">
              <wd-button size="small">点我弹出</wd-button>
            </wd-popover>
          </view>
          <text class="demo-panel__label">menu 模式（content 为菜单项数组）</text>
          <view class="demo-row">
            <wd-popover mode="menu" :content="popoverMenu" placement="bottom" @menuclick="(e: any) => console.log('[demo] popover menuclick', e)">
              <wd-button size="small">菜单气泡</wd-button>
            </wd-popover>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Tooltip 文字提示</text>
        <view class="demo-panel">
          <text class="demo-panel__label">纯文本提示（点击目标切换可见性）</text>
          <view class="demo-row">
            <wd-tooltip v-model="tooltipVisible" content="这是文字提示内容" placement="top">
              <wd-button size="small">显示提示</wd-button>
            </wd-tooltip>
            <text class="demo-tag">visible: {{ tooltipVisible }}</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Tour 新手引导</text>
        <view class="demo-panel">
          <text class="demo-panel__label">分步引导（steps: element / title / content）</text>
          <view class="demo-row">
            <wd-button size="small" @tap="tourVisible = true">开始引导</wd-button>
          </view>
          <view class="demo-row">
            <view id="tour-target-1" :style="{ padding: '8px 12px', 'background-color': '#EEEBFF', 'border-radius': '8px' }">
              <text class="demo-tag">引导目标 1</text>
            </view>
            <view id="tour-target-2" :style="{ padding: '8px 12px', 'background-color': '#EEEBFF', 'border-radius': '8px' }">
              <text class="demo-tag">引导目标 2</text>
            </view>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Curtain 幕帘</text>
        <view class="demo-panel">
          <text class="demo-panel__label">横幅幕布广告（src + width + closePosition + to）</text>
          <view class="demo-row">
            <wd-button size="small" @tap="curtainVisible = true">打开幕帘</wd-button>
            <text class="demo-tag">closePosition: bottom</text>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">FloatingPanel 浮动面板</text>
        <view class="demo-panel">
          <text class="demo-panel__label">拖动手柄改变高度，松手吸附到最近锚点</text>
          <view class="demo-row">
            <wd-button size="small" @tap="panelVisible = !panelVisible">{{ panelVisible ? '关闭面板' : '打开面板' }}</wd-button>
            <text class="demo-tag">height: {{ panelHeight }}px</text>
            <text class="demo-tag">anchors: 120 / 200 / 280</text>
          </view>
          <!-- 固定浮层仅在用户打开此项时挂载，避免常驻遮挡图标画廊和分页。 -->
          <view v-if="panelVisible" :style="{ 'border-width': '1px', 'border-style': 'solid', 'border-color': '#e4e7ed', 'border-radius': '12px', overflow: 'hidden' }">
            <wd-floating-panel :height="panelHeight" :anchors="[120, 200, 280]" safe-area-inset-bottom @height-change="onPanelHeightChange">
              <view :style="{ padding: '12px' }">
                <wd-button size="small" variant="text" @tap="panelVisible = false">关闭面板</wd-button>
                <text class="demo-panel__label">面板内容区（内容可滚动）</text>
                <text class="demo-panel__label">当前高度：{{ panelHeight }}px</text>
              </view>
            </wd-floating-panel>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">Toast 轻提示</text>
        <view class="demo-panel">
          <text class="demo-panel__label">命令式 API：useToast(selector)（模块级注入单例）</text>
          <view class="demo-row">
            <wd-button size="small" @tap="toast.success('保存成功')">success</wd-button>
            <wd-button size="small" @tap="toast.error('操作失败')">error</wd-button>
            <!-- loading 命令式语义为 cover + duration 0（需调用方主动 close）；遮罩会挡住
                 下方 close 按钮，演示页降级为两秒自动收起，避免把页面永久挡住 -->
            <wd-button size="small" @tap="toast.loading({ msg: '加载中', duration: 2000 })">loading</wd-button>
          </view>
          <view class="demo-row">
            <wd-button size="small" @tap="toast.warning('请注意规范')">warning</wd-button>
            <wd-button size="small" @tap="toast.info('这是一条提示')">info</wd-button>
            <wd-button size="small" @tap="toast.close()">close</wd-button>
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">ImagePreview 图片预览</text>
        <view class="demo-panel">
          <text class="demo-panel__label">命令式 API：ref.open({ images, startPosition })</text>
          <view class="demo-row">
            <wd-button size="small" @tap="showImagePreview">预览图片</wd-button>
            <text class="demo-tag">共 {{ previewImages.length }} 张</text>
          </view>
          <view class="demo-row">
            <wd-img :src="demoImage" width="64" height="64" mode="aspectFill" round />
          </view>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">VideoPreview 视频预览</text>
        <view class="demo-panel">
          <text class="demo-panel__label">命令式 API：ref.open({ url, poster, title })</text>
          <view class="demo-row">
            <wd-button size="small" @tap="showVideoPreview">播放视频</wd-button>
            <text class="demo-tag">closePosition: right-top</text>
          </view>
          <!-- <video> 是 Lynx 的 XElement：当前演示宿主未注册 video 原生组件
               （capabilities.videoContext = false），直接创建节点会抛引擎级
               990200 / 60301。组件在此类宿主上自动降级为「封面 + 播放图标」，
               注入了 createVideoContext 的宿主才挂载真正的 <video> -->
          <text class="demo-panel__label">宿主未注入视频能力时显示封面占位（不创建 video 节点）</text>
        </view>
      </view>

      <view class="demo-section">
        <text class="demo-section__title">RootPortal 根节点容器</text>
        <view class="demo-panel">
          <text class="demo-panel__label">fixed 内容经 RootPortal 提升至页面根节点，主题令牌保持继承</text>
          <view class="demo-row">
            <wd-button size="small" @tap="portalBarVisible = !portalBarVisible">{{ portalBarVisible ? '隐藏' : '显示' }}底部固定条</wd-button>
          </view>
          <wd-root-portal v-if="portalBarVisible">
            <view :style="{ position: 'fixed', left: '0', right: '0', bottom: '0', padding: '12px', 'background-color': '#755FFE' }">
              <text :style="{ color: '#ffffff', 'font-size': '13px' }">经 RootPortal 挂载的底部固定条</text>
            </view>
          </wd-root-portal>
        </view>
      </view>

      <!-- 不可见弹层实例（命令式 / 受控显隐，集中在 scroll-view 末尾） -->
      <wd-cascader
        v-model="cascaderValue"
        v-model:visible="cascaderVisible"
        :options="cascaderOptions"
        title="选择地区"
        @confirm="(e: any) => console.log('[demo] cascader confirm', e)"
      />
      <wd-select-picker
        v-model="selectPickerValue"
        v-model:visible="selectPickerVisible"
        :columns="selectPickerColumns"
        title="选择分类"
        @confirm="(e: any) => console.log('[demo] select-picker confirm', e)"
      />
      <wd-img-cropper
        v-model="cropperVisible"
        :img-src="demoImage"
        aspect-ratio="1:1"
        @confirm="onCropperConfirm"
      />
      <wd-popup v-model="popupVisible" :position="popupPosition" round closable>
        <view :style="{ padding: '24px', 'min-width': '200px' }">
          <text class="demo-panel__label">position = {{ popupPosition }}</text>
          <text class="demo-panel__label">点击遮罩或关闭按钮退出</text>
        </view>
      </wd-popup>
      <wd-overlay :show="overlayVisible" @click="overlayVisible = false">
        <!-- 遮罩内容不能用 position: fixed：Lynx 会把 fixed 节点提升到页面根节点，
             它就不再是遮罩的子节点——遮罩隐藏时它照样常驻、点击也不会冒泡到遮罩
             （2026-10-19 演示页实测「点任意处关闭」失效）。这里用撑满 + flex 居中。 -->
        <view class="overlay-center">
          <view class="overlay-box">
            <text class="demo-panel__label">遮罩内容（点击任意处关闭）</text>
          </view>
        </view>
      </wd-overlay>
      <wd-tour v-model="tourVisible" :steps="tourSteps" @finish="() => console.log('[demo] tour finish')" />
      <wd-curtain
        v-model="curtainVisible"
        :src="demoImage"
        :width="260"
        close-position="bottom"
        to="/pages/demo/index"
      />
      <wd-toast selector="demo-toast" />
      <wd-image-preview ref="imagePreviewRef" selector="demo-image-preview" />
      <wd-video-preview ref="videoPreviewRef" selector="demo-video-preview" close-position="right-top" />
    </scroll-view>
  </wd-config-provider>
</template>

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
  color: #2D273D;
}

.page__subtitle {
  font-size: 13px;
  color: #979797;
  margin-top: 4px;
}

.demo-section {
  margin-bottom: 20px;
}

.demo-section__title {
  font-size: 15px;
  font-weight: 600;
  color: #2D273D;
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
  color: #979797;
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
  color: #755FFE;
  background: #EEEBFF;
  border-radius: 6px;
  padding: 4px 8px;
}

.demo-transition-box {
  background: #755FFE;
  border-radius: 12px;
  padding: 16px;
}

.demo-transition-box__text {
  color: #ffffff;
  font-size: 13px;
}

/* Overlay 演示：撑满遮罩 + flex 居中（禁止对内容用 position: fixed） */
.overlay-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.overlay-box {
  padding: 20px;
  background-color: #ffffff;
  border-radius: 12px;
}
</style>
