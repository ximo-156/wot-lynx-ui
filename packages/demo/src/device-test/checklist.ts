/**
 * 真机测试清单定义。
 *
 * 每一项对应 Demo 中的一个可验证交互；id 用于勾选状态持久化。
 * expect 为真机上的预期结果，供测试人员对照。
 */

export interface TestItem {
  id: string
  name: string
  expect: string
}

export interface TestSection {
  id: string
  title: string
  hint: string
  items: TestItem[]
}

export const testSections: TestSection[] = [
  {
    id: 'button',
    title: 'Button 按钮',
    hint: '验证类型/变体/按压缩态/禁用/加载态',
    items: [
      { id: 'button-types', name: '五种类型渲染', expect: '主要/成功/危险/警告/信息 按钮颜色与 wot-ui 一致' },
      { id: 'button-variants', name: '六种变体渲染', expect: '实心/朴素/虚线/柔和/subtle/文字 变体样式正确' },
      { id: 'button-active', name: '按压缩态（:active）', expect: '手指按下时背景色即时变深，松开恢复，无 JS 延迟感' },
      { id: 'button-disabled', name: '禁用态', expect: '禁用按钮半透明，点击无响应' },
      { id: 'button-loading', name: '加载态', expect: 'loading 图标旋转，文字不可点' },
      { id: 'button-round', name: '圆角/细边框', expect: 'round 全圆角；hairline 为发丝线（1ppx）' }
    ]
  },
  {
    id: 'slider',
    title: 'Slider 滑块',
    hint: '核心验证项：拖动跟手',
    items: [
      { id: 'slider-drag', name: '拖动跟手', expect: '滑块严格跟随手指，无回弹抖动' },
      { id: 'slider-popover', name: '拖动气泡', expect: '拖动时上方气泡实时显示当前值' },
      { id: 'slider-step', name: '步长对齐', expect: '松开手后值对齐到 step 倍数' },
      { id: 'slider-range', name: '双滑块模式', expect: '两个滑块可分别拖动，区间进度条同步' },
      { id: 'slider-vmodel', name: 'v-model 联动', expect: '下方数值实时更新（后台线程同步生效）' }
    ]
  },
  {
    id: 'swipe',
    title: 'SwipeAction 滑动操作',
    hint: '核心验证项：横滑跟手 + 纵向滚动不冲突',
    items: [
      { id: 'swipe-reveal', name: '左滑露出按钮', expect: '手指左滑时右侧操作区平滑露出，跟手' },
      { id: 'swipe-vertical', name: '纵向滚动不干扰', expect: '上下滑动时页面正常滚动，不触发横向位移' },
      { id: 'swipe-open', name: '展开阈值', expect: '滑过按钮宽度 30% 松手保持展开，否则回弹' },
      { id: 'swipe-click', name: '点击操作/内容', expect: '点击操作按钮触发回调；点击内容区先收起' },
      { id: 'swipe-exclusive', name: '互斥展开', expect: '展开第二行时第一行自动收起' }
    ]
  },
  {
    id: 'feedback',
    title: '弹层反馈 Popup / Dialog / Toast',
    hint: '验证遮罩、动画、层级',
    items: [
      { id: 'popup-bottom', name: '底部弹出层', expect: 'slide-up 动画，圆角，遮罩点击关闭' },
      { id: 'popup-center', name: '居中弹出层', expect: 'zoom-in + fade 组合动画' },
      { id: 'dialog', name: '对话框', expect: '确认/取消回调正确，遮罩锁定滚动' },
      { id: 'action-sheet', name: '动作面板', expect: '选项列表 + 取消按钮，点击回调' },
      { id: 'toast', name: '轻提示', expect: 'toast/loading/success 样式与自动关闭' },
      { id: 'overlay-zindex', name: '层级关系', expect: '弹层浮于页面内容之上，z-index 正确' }
    ]
  },
  {
    id: 'form',
    title: '表单 Form',
    hint: '验证受控组件与键盘',
    items: [
      { id: 'input-focus', name: '输入框聚焦', expect: '点击聚焦弹出键盘，光标正常' },
      { id: 'input-controlled', name: '受控回显', expect: '输入内容实时同步到 v-model' },
      { id: 'input-clear', name: '清除按钮', expect: '有内容时显示清除图标，点击清空' },
      { id: 'switch', name: '开关', expect: '切换动画流畅，v-model 同步' },
      { id: 'radio-checkbox', name: '单选/多选', expect: '选中态、回调、分组互斥正确' },
      { id: 'rate', name: '评分', expect: '点击/拖动星级，半星支持' }
    ]
  },
  {
    id: 'list',
    title: 'Cell 列表与滚动',
    hint: '验证滚动性能与Cell样式',
    items: [
      { id: 'cell-styles', name: 'Cell 样式', expect: '标题/值/标签/箭头/图标与 wot-ui 一致' },
      { id: 'cell-border', name: '分割线', expect: '1ppx 发丝线，第二项起显示' },
      { id: 'scroll-smooth', name: '长列表滚动', expect: '100 行 Cell 滚动流畅无掉帧' },
      { id: 'cell-active', name: 'Cell 按压缩态', expect: '可点击 Cell 按下时背景高亮' }
    ]
  },
  {
    id: 'display',
    title: '展示组件',
    hint: '验证图标/动画/进度',
    items: [
      { id: 'icon-svg', name: 'SVG 图标', expect: '302 个内置图标渲染清晰，颜色/尺寸可控' },
      { id: 'loading-types', name: 'Loading 四类型', expect: 'circular/spinner/dots/wave 动画正常' },
      { id: 'progress', name: '进度条/环形', expect: '线形与环形进度，渐变动画' },
      { id: 'notice-bar', name: '通知栏', expect: '横向滚动动画，可关闭' },
      { id: 'swiper', name: '轮播图', expect: '自动播放、指示点、滑动切换' },
      { id: 'tabs', name: '选项卡', expect: '切换指示条动画，内容联动' }
    ]
  },
  {
    id: 'svg',
    title: 'SVG 化组件',
    hint: '验证 canvas 组件迁移 SVG 后的渲染与导出',
    items: [
      { id: 'qr-code', name: '二维码', expect: '矩阵清晰可扫，logo/渐变/圆点样式生效' },
      { id: 'bar-code', name: '条形码', expect: '条空比例正确，文本对齐，多格式可用' },
      { id: 'signature', name: '手写签名', expect: '触摸绘制跟手，压感线宽，撤销/清空可用，确认返回 data URI' },
      { id: 'watermark', name: '水印', expect: 'SVG data URI 平铺，旋转/间距/错位布局正确' },
      { id: 'circle', name: '环形进度', expect: 'stroke-dashoffset 进度，渐变/方向/中央文字正确' },
      { id: 'picker', name: '滚轮选择器', expect: '滚动吸附、禁用跳过、多列级联、immediate-change 均正常' }
    ]
  },
  {
    id: 'theme',
    title: '主题与适配',
    hint: '验证主题令牌与响应式',
    items: [
      { id: 'theme-light', name: '亮色主题', expect: '默认亮色，令牌与 wot-ui 一致' },
      { id: 'theme-dark', name: '暗色主题', expect: '切换后全局暗色，无残留亮色区块' },
      { id: 'rpx', name: 'rpx 适配', expect: '不同屏幕宽度下布局比例一致' },
      { id: 'safe-area', name: '底部弹出层安全区', expect: 'iPhone 底部弹出层不被小黑条遮挡' }
    ]
  }
]

export const totalItems = testSections.reduce((sum, s) => sum + s.items.length, 0)
