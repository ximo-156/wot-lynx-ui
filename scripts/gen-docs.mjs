#!/usr/bin/env node
/**
 * 从组件的 types.ts 重新生成 VitePress 组件文档（API 表格部分）。
 *
 * 重写版规范：
 * - 组件导入名 PascalCase（WdButton），模板标签 <WdButton>；
 * - 设计令牌为 --wot-* 体系（与 wot-ui 2.3.2 同源，见 CONVENTIONS.md §3）；
 * - props 表格从 types.ts 的 JSDoc 注释提取。
 *
 * 用法：node scripts/gen-docs.mjs [组件名...]
 * 不带参数时生成全部。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const uiSrc = path.join(root, 'packages/ui/src')
const componentsDir = path.join(uiSrc, 'components')
const docsDir = path.join(root, 'docs/components')

/** 组件中文名 */
const NAMES = {
  'wd-action-sheet': 'ActionSheet 动作面板',
  'wd-avatar': 'Avatar 头像',
  'wd-avatar-group': 'AvatarGroup 头像组',
  'wd-backtop': 'Backtop 回到顶部',
  'wd-badge': 'Badge 徽标',
  'wd-bar-code': 'BarCode 条形码',
  'wd-button': 'Button 按钮',
  'wd-calendar': 'Calendar 日历',
  'wd-calendar-view': 'CalendarView 日历视图',
  'wd-card': 'Card 卡片',
  'wd-cascader': 'Cascader 级联选择',
  'wd-cell': 'Cell 单元格',
  'wd-cell-group': 'CellGroup 单元格组',
  'wd-checkbox': 'Checkbox 多选框',
  'wd-checkbox-group': 'CheckboxGroup 多选框组',
  'wd-circle': 'Circle 环形进度',
  'wd-col': 'Col 列布局',
  'wd-collapse': 'Collapse 折叠面板',
  'wd-collapse-item': 'CollapseItem 折叠面板项',
  'wd-config-provider': 'ConfigProvider 全局配置',
  'wd-count-down': 'CountDown 倒计时',
  'wd-count-to': 'CountTo 数字滚动',
  'wd-curtain': 'Curtain 幕帘',
  'wd-datetime-picker': 'DatetimePicker 日期时间选择器',
  'wd-datetime-picker-view': 'DatetimePickerView 日期时间选择器视图',
  'wd-dialog': 'Dialog 对话框',
  'wd-divider': 'Divider 分割线',
  'wd-drop-menu': 'DropMenu 下拉菜单',
  'wd-drop-menu-item': 'DropMenuItem 下拉菜单项',
  'wd-empty': 'Empty 空状态',
  'wd-fab': 'Fab 悬浮按钮',
  'wd-floating-panel': 'FloatingPanel 浮动面板',
  'wd-form': 'Form 表单',
  'wd-form-item': 'FormItem 表单项',
  'wd-gap': 'Gap 间距',
  'wd-grid': 'Grid 宫格',
  'wd-grid-item': 'GridItem 宫格子项',
  'wd-icon': 'Icon 图标',
  'wd-image-preview': 'ImagePreview 图片预览',
  'wd-img': 'Img 图片',
  'wd-img-cropper': 'ImgCropper 图片裁剪',
  'wd-index-anchor': 'IndexAnchor 索引锚点',
  'wd-index-bar': 'IndexBar 索引栏',
  'wd-input': 'Input 输入框',
  'wd-input-number': 'InputNumber 步进器',
  'wd-keyboard': 'Keyboard 键盘',
  'wd-loading': 'Loading 加载',
  'wd-loadmore': 'Loadmore 加载更多',
  'wd-navbar': 'Navbar 导航栏',
  'wd-navbar-capsule': 'NavbarCapsule 导航胶囊',
  'wd-notice-bar': 'NoticeBar 通知栏',
  'wd-notify': 'Notify 消息通知',
  'wd-overlay': 'Overlay 遮罩',
  'wd-pagination': 'Pagination 分页器',
  'wd-password-input': 'PasswordInput 密码输入框',
  'wd-picker': 'Picker 选择器',
  'wd-picker-view': 'PickerView 选择器视图',
  'wd-popover': 'Popover 气泡弹出',
  'wd-popup': 'Popup 弹出层',
  'wd-progress': 'Progress 进度条',
  'wd-qr-code': 'QRCode 二维码',
  'wd-radio': 'Radio 单选框',
  'wd-radio-group': 'RadioGroup 单选框组',
  'wd-rate': 'Rate 评分',
  'wd-resize': 'Resize 尺寸监听',
  'wd-root-portal': 'RootPortal 根节点容器',
  'wd-row': 'Row 行布局',
  'wd-search': 'Search 搜索框',
  'wd-segmented': 'Segmented 分段器',
  'wd-select-picker': 'SelectPicker 下拉选择',
  'wd-shide-verify': 'SlideVerify 滑动验证',
  'wd-signature': 'Signature 签名',
  'wd-skeleton': 'Skeleton 骨架屏',
  'wd-slide-verify': 'SlideVerify 滑动验证',
  'wd-slider': 'Slider 滑块',
  'wd-sort-button': 'SortButton 排序按钮',
  'wd-step': 'Step 步骤条子项',
  'wd-steps': 'Steps 步骤条',
  'wd-sticky': 'Sticky 粘性布局',
  'wd-sticky-box': 'StickyBox 粘性容器',
  'wd-swipe-action': 'SwipeAction 滑动操作',
  'wd-swiper': 'Swiper 轮播图',
  'wd-swiper-nav': 'SwiperNav 轮播导航',
  'wd-switch': 'Switch 开关',
  'wd-tab': 'Tab 选项卡面板',
  'wd-tabbar': 'Tabbar 标签栏',
  'wd-tabbar-item': 'TabbarItem 标签栏项',
  'wd-table': 'Table 表格',
  'wd-table-column': 'TableColumn 表格列',
  'wd-tabs': 'Tabs 选项卡',
  'wd-tag': 'Tag 标签',
  'wd-text': 'Text 文本',
  'wd-textarea': 'Textarea 文本域',
  'wd-toast': 'Toast 轻提示',
  'wd-tooltip': 'Tooltip 文字提示',
  'wd-tour': 'Tour 新手引导',
  'wd-transition': 'Transition 过渡',
  'wd-upload': 'Upload 上传',
  'wd-video-preview': 'VideoPreview 视频预览',
  'wd-watermark': 'Watermark 水印'
}

const pascal = (name) => name.replace('wd-', '').split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')

/** 解析 props 定义与 JSDoc 注释 */
function parseProps(typesPath) {
  const t = readFileSync(typesPath, 'utf8')
  const props = []
  // 注释体不得跨越下一个 *\/（types.ts 中类型声明与 props 注释交错时，
  // 贪婪/非贪婪的 .*? 都会把多个注释块吞成一个；用 tempered token 锁定单块）
  const pattern = /\/\*\*((?:(?!\*\/)[\s\S])*?)\*\/[ \t]*\r?\n[ \t]*(\w+):[ \t]*[^,\n]*/g
  let m
  while ((m = pattern.exec(t)) !== null) {
    const comment = m[1]
      .split('\n')
      .map((x) => x.trim().replace(/^\*\s?/, '').trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      // JSDoc 里的泛型写法（Partial<LoadingProps> 等）必须转义：
      // markdown 会把 <X> 当 HTML 标签解析，未闭合即 Vue SFC 编译错误
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // 对象字面量默认值（{ top: 16, ... }）会被 markdown 的属性语法
      // （{.class #id}）吞成 HTML 属性，包进 code span 规避
      .replace(/(默认值:\s*)(\{[^{}]*\})/g, '$1`$2`')
    props.push({ name: m[2], comment })
  }
  if (t.includes('...baseProps')) {
    props.unshift({ name: 'customStyle', comment: '自定义根节点样式' })
    props.unshift({ name: 'customClass', comment: '自定义根节点样式类' })
  }
  return props
}

function genDoc(name) {
  const typesPath = path.join(componentsDir, name, 'types.ts')
  const title = NAMES[name] || `${pascal(name)}`
  const lines = [`# ${title}`, '']
  lines.push(`组件导入名：\`${pascal(name)}\`，模板中使用 \`<${pascal(name)}>\`。`)
  lines.push('')
  lines.push('## 介绍')
  lines.push('')
  lines.push(`${title.split(' ').slice(1).join(' ') || title}组件，API 与 wot-ui 对齐；样式基于与 wot-ui 2.3.2 同源的 \`--wot-*\` 设计令牌。`)
  lines.push('')

  if (existsSync(typesPath)) {
    const props = parseProps(typesPath)
    if (props.length > 0) {
      lines.push('## API')
      lines.push('')
      lines.push('### Props')
      lines.push('')
      lines.push('| 参数 | 说明 |')
      lines.push('| --- | --- |')
      for (const p of props) {
        lines.push(`| \`${p.name}\` | ${p.comment || '-'} |`)
      }
      lines.push('')
    }
  }

  lines.push('### Events')
  lines.push('')
  lines.push('| 事件名 | 说明 |')
  lines.push('| --- | --- |')
  lines.push('| `update:modelValue` | 受控值更新（支持 v-model 时） |')
  lines.push('| `click` / `change` / `confirm` 等 | 与 wot-ui 一致 |')
  lines.push('')
  return lines.join('\n')
}

const only = process.argv.slice(2)
mkdirSync(docsDir, { recursive: true })
let count = 0
for (const entry of readdirSync(componentsDir)) {
  if (!statSync(path.join(componentsDir, entry)).isDirectory()) continue
  if (entry === 'wot-ui') continue
  if (only.length > 0 && !only.includes(entry)) continue
  const doc = genDoc(entry)
  writeFileSync(path.join(docsDir, `${entry.replace('wd-', '')}.md`), doc)
  count++
}
console.log(`generated ${count} component docs`)
