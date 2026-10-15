/**
 * 真机测试清单定义。
 *
 * 每一项对应 Demo 中的一个可验证交互；id 用于勾选状态持久化。
 * expect 为真机上的预期结果，供测试人员对照。
 *
 * 分组与 docs/guide/device-testing.md「按清单逐项验证」一节保持一致：
 * 8 个分组 / 35 个测试项，覆盖 Tier 1 基础组件 + 手势核心（Slider /
 * SwipeAction）+ 弹层 + 表单 + 主题适配。
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
      { id: 'button-types', name: '五种类型渲染', expect: '主要/成功/危险/警告/信息 按钮使用 --wd-* 令牌色' },
      { id: 'button-variants', name: '六种变体渲染', expect: '实心/朴素/虚线/柔和/淡雅/文字 变体样式正确' },
      { id: 'button-active', name: '按压缩态（:active）', expect: '手指按下时背景色即时变深，松开恢复，无 JS 延迟感' },
      { id: 'button-disabled', name: '禁用态', expect: '禁用按钮不可点击，无按压反馈' },
      { id: 'button-loading', name: '加载态', expect: 'loading 时指示器旋转，点击不触发业务回调' },
      { id: 'button-round-block', name: '圆角/块级', expect: 'round 全圆角，block 撑满容器宽度' }
    ]
  },
  {
    id: 'slider',
    title: 'Slider 滑块',
    hint: '验证拖动跟手（核心）/气泡/步长刻度/双滑块',
    items: [
      { id: 'slider-drag', name: '拖动跟手', expect: '拖动过程中滑块与气泡即时跟随手指，无回弹、无跳变' },
      { id: 'slider-popover', name: '气泡显示时机', expect: '拖动时气泡常驻显示当前值；松手后按 popoverVisible 规则隐藏' },
      { id: 'slider-step', name: '步长与刻度', expect: 'step=10 时取值仅落在 0/10…/100；marks 刻度文字与位置对齐' },
      { id: 'slider-range', name: '双滑块', expect: 'range 模式两个滑块均可独立拖动，且不可相互穿越' }
    ]
  },
  {
    id: 'swipe-action',
    title: 'SwipeAction 滑动操作',
    hint: '验证横滑跟手（核心）/纵向不冲突/阈值/互斥',
    items: [
      { id: 'swipe-follow', name: '横滑跟手', expect: '手指横滑时按钮区即时展开，松手后按位移决定开合' },
      { id: 'swipe-vertical', name: '纵向不冲突', expect: '在单元格上纵向滑动时页面正常滚动，不误触横滑' },
      { id: 'swipe-threshold', name: '开启阈值', expect: '位移超过阈值自动展开，未超过则回弹收起' },
      { id: 'swipe-mutex', name: '互斥收起', expect: '展开一个单元格时，其他已展开的单元格自动收起' }
    ]
  },
  {
    id: 'overlay',
    title: '弹层 Popup / Dialog / Toast',
    hint: '验证遮罩/动画/回调/弹层级联',
    items: [
      { id: 'overlay-mask', name: '遮罩关闭', expect: '点击遮罩关闭弹层；closeOnClickModal=false 时点击不关' },
      { id: 'overlay-anim', name: '弹出动画', expect: '各方向入场动画方向正确；round 圆角与 closable 关闭按钮正常' },
      { id: 'overlay-callback', name: '打开/关闭回调', expect: 'update:modelValue 与 enter/leave 过渡事件按序触发，事件日志实时刷新' },
      { id: 'overlay-stack', name: '弹层级联', expect: 'popup 之上再开 dialog：dialog 位于上层，确认/取消回调正确返回' }
    ]
  },
  {
    id: 'form',
    title: '表单体系 Form',
    hint: '验证键盘/受控回显/清除/单选多选/评分',
    items: [
      { id: 'form-keyboard', name: '键盘弹起与收起', expect: '数字键盘弹起/收起正常，safeAreaInsetBottom 底部适配生效' },
      { id: 'form-controlled', name: '受控回显', expect: '输入内容实时同步到外部状态并回显到页面' },
      { id: 'form-clear', name: '一键清除', expect: 'clearable 输入后出现清除按钮，点击后清空且重新聚焦' },
      { id: 'form-choice', name: '单选/多选', expect: 'radio 同组互斥、checkbox 可多选，选中态与禁用态正确' },
      { id: 'form-rate', name: '评分', expect: 'rate 点击正确回写分值，支持半分（如实现）' }
    ]
  },
  {
    id: 'cell',
    title: 'Cell 列表',
    hint: '验证分组分割线/箭头按压/卡片与垂直布局/长列表滚动',
    items: [
      { id: 'cell-border', name: '分组分割线', expect: '组内单元格间 1ppx 细线，首块无线' },
      { id: 'cell-link', name: '箭头与按压', expect: 'is-link 显示箭头，:active 按压背景即时反馈' },
      { id: 'cell-insert-vertical', name: '卡片分组与垂直布局', expect: 'insert 模式圆角 + 水平边距；layout=vertical 时右侧内容上下排列' },
      { id: 'cell-longlist', name: '长列表滚动', expect: '30 行列表滚动流畅，无白屏、无单元格错位' }
    ]
  },
  {
    id: 'display',
    title: '展示组件 Icon / Loading / Text / Divider',
    hint: '验证 SVG 图标/四类 Loading/文本模式/分割线/轮播与选项卡',
    items: [
      { id: 'display-icon', name: '内置 SVG 图标', expect: '内置图标清晰渲染（无字体加载闪烁），color/size 实时生效' },
      { id: 'display-loading', name: '四类 Loading', expect: 'circular 圆环 / spinner 十二点 / dots 三点 / wave 四柱 动画正确' },
      { id: 'display-text', name: 'Text 文本', expect: '语义四色正确；price 千分位 / phone 脱敏 / date 格式化；lines=N 行数省略' },
      { id: 'display-divider', name: 'Divider 分割线', expect: 'center/left/right 位置与虚线样式正确' },
      { id: 'display-misc', name: '进度/通知/轮播/选项卡', expect: 'progress 百分比、notice-bar 滚动、swiper 轮播、tabs 切换均正常' }
    ]
  },
  {
    id: 'theme',
    title: '主题与适配',
    hint: '验证亮暗切换/令牌无残留/rpx 与安全区',
    items: [
      { id: 'theme-toggle', name: '亮暗切换', expect: '切换 theme 后全局组件令牌即时翻转，页面背景同步跟随' },
      { id: 'theme-tokens', name: '令牌无残留', expect: '暗色下无亮色残留（文字/边框/按压态），themeVars 覆盖生效' },
      { id: 'theme-rpx-safe', name: 'rpx 与安全区', expect: 'rpx 在 Lynx 中不受支持（解析为 0，样式须用 px）；安全区数据由宿主注入，裸跑为 0 属预期' }
    ]
  }
]

export const totalItems = testSections.reduce((sum, s) => sum + s.items.length, 0)
