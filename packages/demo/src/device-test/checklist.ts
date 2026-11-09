/**
 * 真机测试清单定义。
 *
 * 每一项对应 Demo 中的一个可验证交互；id 用于勾选状态持久化。
 * expect 为真机上的预期结果，供测试人员对照。
 *
 * 两类分组：
 * 1. **交互清单**（本文件前 8 组，共 39 项）：手势跟手、弹层回调、主题切换
 *    等「必须动手操作」的场景，只覆盖 28 个组件；真机验收页逐项勾选。
 * 2. **全量渲染清单**（`component-checks.ts`，6 组 / 106 项）：一个组件
 *    一条，铺满全部 106 个组件，expect 指向该组件最可能翻车的真机行为。
 *
 * 为什么要有第 2 类：此前只有交互清单，78 个组件在真机上从未按项验过，
 * 缺陷只能等用户截图反馈（2026-10-26 那批 8 类缺陷就是这么来的）。
 * `pnpm check:device-coverage` 会断言每个组件都同时具备「主 demo 可渲染
 * 实例」和「检查项」，新增组件漏加会直接红灯。
 *
 * R19（2026-11-09）按组件分页：第 2 类恢复渲染到真机页面——每个组件在
 * 目录里独占一页（Showcase 的 DemoSection 节名即组件标签），该页渲染组件
 * 真实演示，检查项以「真机检查」卡形式挂在同一页（见 ShowcaseLayout 的
 * checkMap）。这不再是 R18 之前那种与演示分离的纯文字清单：文字与它描述
 * 的组件同页出现，勾选进度与 8 组交互卡共用（totalItems = 39 + 106 = 145）。
 */

import { componentSections } from './component-checks'

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
      { id: 'button-types', name: '五种类型渲染', expect: '主要/成功/危险/警告/信息 按钮使用 --wot-* 令牌色' },
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
    hint: '验证局部轴向手势/松手释放/气泡/步长刻度/双滑块',
    items: [
      { id: 'slider-drag', name: '拖动跟手', expect: '拖动过程中滑块与气泡即时跟随手指，无回弹、无跳变；松手后气泡收起、页面仍可正常滚动（真机 2026-11-05：松手后整页卡死/气泡常驻）' },
      { id: 'slider-popover', name: '气泡显示时机', expect: '拖动时气泡显示当前值且位于握把之外，不遮挡滑块；松手后按 popoverVisible 规则隐藏' },
      { id: 'slider-step', name: '步长与刻度', expect: 'step=10 时取值仅落在 0/10…/100；marks 的 0/50/100 完整单行显示并与刻度对齐，不逐字换行' },
      { id: 'slider-range', name: '双滑块', expect: 'range 模式两个滑块均可独立拖动，且不可相互穿越' },
      { id: 'slider-page-scroll', name: '竖滑滚页', expect: '在横向 Slider 的轨道或圆点上竖滑，页面正常滚动且不误改滑块值；松手后页面和滑块仍可继续操作' },
      { id: 'slider-pause-resume', name: '暂停再拖', expect: '拖动中按住停顿超过 1.2 秒后继续移动同一根手指，值仍持续跟手；松手后气泡收起、页面可滚动，下一次拖动也正常' },
      { id: 'slider-repeat', name: '连续多次拖动', expect: '单滑块及范围两端各连续拖动松手至少 5 次，交替方向并触及边界；每次松手气泡收起，可滚动页面且下一次仍能拖动' }
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
      // 真机 2026-11-05：贴边弹层整片塌到屏幕左上角。单独成项——「弹层能开」
      // 和「弹层在自己该在的位置」是两件事，只勾动画项会把它漏掉。
      // R10 续：justify-content 边值在真机失效，贴边弹层改为贴屏幕正中；
      // 验收词补上「底部 Popup 贴底」，别只看 Picker。
      // 真机 2026-11-06（用户截图「适配程度不一样」）：Dialog 本体居中正常，
      // 但确认弹窗按钮行里「取消」独占整行、「确定」被 overflow 裁得只剩一条
      // 色带（按钮 flex-shrink: 0 + is-block 宽度 100% 不相让）。验收词补上
      // 「Dialog 按钮行两按钮等分」——弹窗位置对不等于弹窗内部排版对。
      {
        id: 'overlay-anchor',
        name: '贴边定位',
        expect: '时间选择器 / Picker / 底部 Popup 贴屏幕底部、Dialog 屏幕正中、notify 贴顶且左右各缩 12px；面板不得缩到左上角、贴屏幕正中或只剩半截；Dialog 确认弹窗的取消/确定按钮在按钮行内等分，不得一个独占整行、另一个被裁成色带'
      },
      { id: 'overlay-mask', name: '遮罩关闭与残留', expect: '点击遮罩关闭弹层；closeOnClickModal=false 时点击不关；时间选择器取消/确认/遮罩关闭及 Toast 加载自动关闭后，左上角不残留标题、加载文案或图形，页面可滚动；再次打开显示完整' },
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
    hint: '验证内置字体图标/四类 Loading/文本模式/分割线/轮播与选项卡',
    items: [
      { id: 'display-icon', name: '内置字体图标', expect: '内置 180 个图标清晰渲染（.ttf 随包，无网络请求），color/size 实时生效' },
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
  },
  // 全量渲染清单：106 个组件各一条，见 component-checks.ts。
  // R19 起按组件分页渲染：每一项挂在 Showcase 同名组件页的「真机检查」卡上。
  ...componentSections
]

export const totalItems = testSections.reduce((sum, s) => sum + s.items.length, 0)
