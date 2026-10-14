/**
 * 真机测试清单定义（Tier 1：基础组件）。
 *
 * 每一项对应 Demo 中的一个可验证交互；id 用于勾选状态持久化。
 * expect 为真机上的预期结果，供测试人员对照。
 *
 * 注：完整清单（表单/弹层/导航/绘制等）随组件重写进度逐 tier 回归。
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
    id: 'icon-loading',
    title: 'Icon / Loading',
    hint: '验证 SVG 图标渲染与四类加载指示器',
    items: [
      { id: 'icon-builtin', name: '内置 SVG 图标', expect: '302 个内置图标清晰渲染，无字体加载闪烁' },
      { id: 'icon-color-size', name: '颜色/尺寸', expect: 'color/size 实时生效' },
      { id: 'loading-circular', name: 'circular 圆环', expect: 'border 圆环 0.8s 匀速旋转' },
      { id: 'loading-spinner', name: 'spinner 十二点', expect: '12 点环绕 + 透明度阶梯 + 容器旋转' },
      { id: 'loading-dots', name: 'dots 三点', expect: '三点错峰呼吸' },
      { id: 'loading-wave', name: 'wave 四柱', expect: '四柱错峰缩放' }
    ]
  },
  {
    id: 'cell',
    title: 'Cell 单元格',
    hint: '验证分组配置/箭头/星号/布局',
    items: [
      { id: 'cell-group-border', name: '分组分割线', expect: '组内单元格间 1ppx 细线，首块无线' },
      { id: 'cell-link', name: '箭头与按压', expect: 'is-link 显示箭头，:active 按压背景' },
      { id: 'cell-label', name: '描述文本', expect: 'label 在标题下方次级色展示' },
      { id: 'cell-insert', name: '卡片分组', expect: 'insert 模式圆角 + 水平边距' },
      { id: 'cell-vertical', name: '垂直布局', expect: 'layout=vertical 时右侧内容上下排列' }
    ]
  },
  {
    id: 'text-divider',
    title: 'Text / Divider / Gap',
    hint: '验证文本模式与分割线',
    items: [
      { id: 'text-types', name: '语义色文本', expect: 'primary/success/warning/error 四色正确' },
      { id: 'text-modes', name: '处理模式', expect: 'price 千分位 / phone 脱敏 / date 格式化' },
      { id: 'text-lines', name: '行数省略', expect: 'lines=N 时 N 行后省略' },
      { id: 'divider-positions', name: '分割线位置', expect: 'center/left/right 与虚线、细线正确' }
    ]
  }
]

export const totalItems = testSections.reduce((sum, s) => sum + s.items.length, 0)
