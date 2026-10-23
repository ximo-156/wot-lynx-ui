#!/usr/bin/env node
/**
 * 从 `packages/ui/meta.json` 生成 VitePress 组件文档与文档站侧边栏。
 *
 * ## 为什么改成读 meta（P3.2，ADR-017）
 *
 * 旧版用正则**反解析** `types.ts`，为此打了三个补丁：
 *
 *   1. tempered token（`(?:(?!\*\/)[\s\S])*?`）避免贪婪吞掉多个注释块；
 *   2. `<` / `>` 转义成 HTML 实体（markdown 会把 `Partial<X>` 当标签）；
 *   3. 对象默认值包 code span（`{ top: 16 }` 会被 markdown 当属性语法）。
 *
 * 三个补丁都只在「解析时」生效，于是**转义后的字符串被存进了中间产物**，
 * 而真正该转义的是「渲染时」。现在 meta 存干净的原文，转义集中在 `cell()`
 * 与 `code()` 两个函数里，解析与渲染分层。
 *
 * 旧版还有三处硬编码，全部改为从 meta 推导：
 *
 *   - `customStyle` / `customClass` 手写（且 `unshift` 两次导致顺序反了）
 *     → meta 里已由 `...baseProps` 展开带入，顺序正确。
 *   - Events 表格写死两行假数据（`update:modelValue` / `click · change · confirm 等`），
 *     106 个组件完全一样，与真实事件无关 → 改为 meta.events。
 *   - 完全没有 Slots 表格 → 改为 meta.slots。
 *
 * ## 事件说明为什么是空的
 *
 * 事件描述只存在于 `types.ts` 的 `XxxEmits` 类型 JSDoc 里，而全仓只有 6 个
 * 组件这样定义（其中 4 个写了 JSDoc）。其余组件的 `defineEmits` 只有事件名
 * 与参数类型，**代码里没有描述**。按 ADR-006「猜出来的比没有更糟」，这里
 * 只填两个协议级说明（`update:modelValue` / `update:current` 的 v-model 语义），
 * 业务含义一律留 `-`。
 *
 * ## 产物
 *
 *   docs/components/*.md                  （gitignore，docs:build 前自动生成）
 *   docs/.vitepress/components-sidebar.ts （入库，被 config.ts 引用）
 *
 * 侧边栏入库是因为 `config.ts` 直接 import 它；md 不入库是因为它是纯生成物，
 * 且 `docs:build` / `docs:dev` 的 pre 脚本会保证它存在。
 *
 * 用法：
 *   node scripts/gen-docs.mjs            生成全部
 *   node scripts/gen-docs.mjs wd-button  只生成指定组件（侧边栏仍全量）
 *   node scripts/gen-docs.mjs --check    只校验入库产物（侧边栏）是否最新
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const META_PATH = path.join(root, 'packages/ui/meta.json')
const DOCS_DIR = path.join(root, 'docs/components')
const SIDEBAR_PATH = path.join(root, 'docs/.vitepress/components-sidebar.ts')

/**
 * 组件中文名（人工语义，代码里没有，因此是**唯一**需要人工维护的部分）。
 *
 * 必须覆盖 meta 里的每个组件：`gen-docs` 会断言覆盖完整，缺一个就退出 1，
 * 避免标题悄悄退化成裸 PascalCase。
 */
const NAMES = {
  'wd-action-sheet': 'ActionSheet 动作面板',
  'wd-address-edit': 'AddressEdit 地址编辑',
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
  'wd-coupon': 'Coupon 优惠券',
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
  'wd-pull-refresh': 'PullRefresh 下拉刷新',
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
  'wd-share-sheet': 'ShareSheet 分享面板',
  'wd-sidebar': 'Sidebar 侧边导航',
  'wd-sidebar-item': 'SidebarItem 侧边导航项',
  'wd-signature': 'Signature 签名',
  'wd-skeleton': 'Skeleton 骨架屏',
  'wd-slide-verify': 'SlideVerify 滑动验证',
  'wd-slider': 'Slider 滑块',
  'wd-sort-button': 'SortButton 排序按钮',
  'wd-step': 'Step 步骤条子项',
  'wd-steps': 'Steps 步骤条',
  'wd-sticky': 'Sticky 粘性布局',
  'wd-sticky-box': 'StickyBox 粘性容器',
  'wd-submit-bar': 'SubmitBar 提交订单栏',
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

/** `update:*` 的说明是 Vue 的 v-model 协议语义，不是业务猜测 */
const EVENT_NOTES = {
  'update:modelValue': 'v-model 双向绑定的值更新',
  'update:current': '`v-model:current` 绑定的当前项更新'
}

const pascal = (name) =>
  name
    .replace(/^wd-/, '')
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')

// ---------------------------------------------------------------------------
// 渲染（转义集中在这里，不污染 meta）
// ---------------------------------------------------------------------------

/** 普通单元格：`|` 断列、`<`/`>` 被当 HTML 标签、换行断行，全部要处理 */
function cell(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 行内代码单元格：GFM 表格里 code span 内的 `|` 仍需转义，否则断列 */
function code(value) {
  return `\`${String(value).replace(/`/g, "'").replace(/\|/g, '\\|')}\``
}

/** 按**未转义**的 `|` 切分表格行（`\|` 是字面竖线） */
function splitRow(row) {
  const cells = []
  let cur = ''
  let escaped = false
  for (const ch of row) {
    if (escaped) {
      cur += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      cur += ch
      escaped = true
      continue
    }
    if (ch === '|') {
      cells.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  cells.push(cur)
  return cells.slice(1, -1)
}

/**
 * 生成后自检：每个表格的每一行列数必须等于表头列数。
 *
 * 旧版有个真实 bug——`可选值: 'primary' | 'success' | …` 被直接拼进单元格，
 * 竖线被 markdown 当成列分隔符，`wd-button` 的 type 行裂成 8 列，整张表错位。
 * 那版没有自检，错误一路进到文档站。这里让非法产物**无法落地**。
 */
function assertTableShape(fileName, md) {
  const lines = md.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('|')) continue
    const expected = splitRow(lines[i]).length
    for (let j = i + 1; j < lines.length && lines[j].startsWith('|'); j++) {
      const actual = splitRow(lines[j]).length
      if (actual !== expected) {
        throw new Error(
          `${fileName} 第 ${j + 1} 行表格列数 ${actual} ≠ 表头 ${expected}：${lines[j].slice(0, 100)}`
        )
      }
    }
  }
}

/** 说明列 = 描述 + （可选值） */
function describe(prop) {
  const desc = (prop.description ?? '').trim()
  if (!prop.options) return desc
  const sep = desc && !/[。.；;]$/.test(desc) ? '。' : ''
  return `${desc}${sep}可选值：${prop.options}`
}

function renderProps(props) {
  const lines = ['| 参数 | 说明 | 类型 | 默认值 |', '| --- | --- | --- | --- |']
  for (const p of props) {
    const def = p.default === undefined ? '-' : code(p.default)
    lines.push(`| ${code(p.name)} | ${cell(describe(p)) || '-'} | ${cell(p.type ?? '-')} | ${def} |`)
  }
  return lines
}

function renderEvents(events) {
  const lines = ['| 事件名 | 说明 |', '| --- | --- |']
  for (const e of events) lines.push(`| ${code(e)} | ${cell(EVENT_NOTES[e] ?? '-')} |`)
  return lines
}

function renderSlots(slots) {
  const lines = ['| 插槽名 | 说明 |', '| --- | --- |']
  for (const s of slots) {
    const note = s === 'default' ? '默认插槽' : '-'
    lines.push(`| ${code(s)} | ${note} |`)
  }
  return lines
}

function genDoc(name, comp) {
  const full = NAMES[name] ?? pascal(name)
  const cn = full.split(' ').slice(1).join(' ') || pascal(name)
  const lines = [`# ${full}`, '']

  lines.push(`组件导入名：\`${pascal(name)}\`，模板中使用 \`<${pascal(name)}>\`。`, '')
  lines.push('## 介绍', '')
  lines.push(
    `${cn}组件，API 与 wot-ui 对齐；样式基于与 wot-ui 2.3.2 同源的 \`--wot-*\` 设计令牌。`
  )
  lines.push('')

  const hasProps = comp.props.length > 0
  if (hasProps || comp.events.length > 0 || comp.slots.length > 0) {
    lines.push('## API', '')
  }
  if (hasProps) {
    lines.push('### Props', '', ...renderProps(comp.props), '')
  }
  if (comp.events.length > 0) {
    lines.push('### Events', '', ...renderEvents(comp.events), '')
  }
  if (comp.slots.length > 0) {
    lines.push('### Slots', '', ...renderSlots(comp.slots), '')
  }
  return lines.join('\n')
}

/**
 * 侧边栏。这是组件清单的**第三份拷贝**（另两份是 meta 与 barrel），
 * 手写必然漂移——改动前它写着「全部组件（101 个）」，而 meta 已有 106 个，
 * 且缺 5 个组件的条目（点进去 404）。改为生成。
 */
function renderSidebar(names) {
  const lines = [
    '// 由 scripts/gen-docs.mjs 生成，勿手改。',
    '// 数据源：packages/ui/meta.json（组件清单）+ scripts/gen-docs.mjs 的 NAMES（中文名）。',
    '',
    'export interface ComponentSidebarGroup {',
    '  text: string',
    '  collapsed: boolean',
    '  items: { text: string; link: string }[]',
    '}',
    '',
    'export const componentsSidebar: ComponentSidebarGroup = {',
    `  text: '全部组件（${names.length} 个）',`,
    '  collapsed: false,',
    '  items: ['
  ]
  for (const name of names) {
    const text = (NAMES[name] ?? pascal(name)).replace(/'/g, "\\'")
    lines.push(`    { text: '${text}', link: '/components/${name.replace(/^wd-/, '')}' },`)
  }
  lines.push('  ]', '}', '')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
if (!existsSync(META_PATH)) {
  console.error('✖ packages/ui/meta.json 不存在。先运行 pnpm gen:meta 生成组件契约。')
  process.exit(1)
}
const meta = JSON.parse(readFileSync(META_PATH, 'utf8'))
const allNames = Object.keys(meta).sort()

// NAMES 必须全覆盖：缺一个就退出，避免标题悄悄退化成裸 PascalCase
const missingNames = allNames.filter((n) => !NAMES[n])
const staleNames = Object.keys(NAMES).filter((n) => !meta[n])
if (missingNames.length > 0 || staleNames.length > 0) {
  if (missingNames.length > 0) {
    console.error(`✖ NAMES 缺少 ${missingNames.length} 个组件的中文名：${missingNames.join(', ')}`)
  }
  if (staleNames.length > 0) {
    console.error(`✖ NAMES 里有 ${staleNames.length} 个组件在 meta 中不存在：${staleNames.join(', ')}`)
  }
  process.exit(1)
}

const argv = process.argv.slice(2)
const checkMode = argv.includes('--check')
const only = argv.filter((a) => !a.startsWith('--'))
const targets = only.length > 0 ? allNames.filter((n) => only.includes(n)) : allNames

// 侧边栏永远全量生成（即使只重生成部分文档）
const sidebar = renderSidebar(allNames)

if (checkMode) {
  // 只有侧边栏入库，md 是纯生成物（见文件头）。所以 --check 只校验侧边栏。
  const current = existsSync(SIDEBAR_PATH) ? readFileSync(SIDEBAR_PATH, 'utf8') : null
  if (current !== sidebar) {
    console.error(
      '✖ docs/.vitepress/components-sidebar.ts 与 meta 不一致。\n' +
        '  运行 node scripts/gen-docs.mjs 重新生成后提交。'
    )
    process.exit(1)
  }
  console.log(`✅ 组件文档侧边栏与 meta 一致（${allNames.length} 项）`)
} else {
  mkdirSync(DOCS_DIR, { recursive: true })
  for (const name of targets) {
    const fileName = `${name.replace(/^wd-/, '')}.md`
    const md = genDoc(name, meta[name])
    assertTableShape(fileName, md)
    writeFileSync(path.join(DOCS_DIR, fileName), md)
  }

  writeFileSync(SIDEBAR_PATH, sidebar)

  const propCount = allNames.reduce((n, name) => n + meta[name].props.length, 0)
  console.log(
    `generated ${targets.length} component docs（${propCount} 个 prop）+ 侧边栏（${allNames.length} 项）`
  )
}
