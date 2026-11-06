/**
 * 全量组件真机渲染检查清单（106/106 覆盖）。
 *
 * 为什么单独一份：`checklist.ts` 的 8 个分组是**交互清单**（手势跟手、
 * 弹层回调、主题切换），只覆盖 28 个组件；其余 78 个组件在真机上从没被
 * 按项验过，缺陷只能靠用户截图发现（2026-10-26 那批 8 类缺陷就是这么来的）。
 *
 * 本清单按「一个组件一条」铺满全部 106 个组件，`expect` 不是空泛的
 * 「渲染正常」，而是写该组件**最可能翻车的真机行为**——依据是
 * CONVENTIONS §19 的真机引擎差异清单（currentColor 不解析、visibility
 * 不生效、flex-wrap 高度只算前两行、display:block 被丢弃、内联 min-width
 * 不生效、圆角容器 overflow:hidden 裁空内容、text 不继承等）。
 *
 * 维护约定：新增组件必须同步加一条，否则 `pnpm check:device-coverage`
 * 会红（见 scripts/check-device-coverage.mjs）。
 */

import type { TestSection } from './checklist'

export const componentSections: TestSection[] = [
  {
    id: 'render-primitives',
    title: '基础件渲染（12）',
    hint: 'Button / Cell / Icon / Img / Input / Textarea / Loading / Overlay / Popup / RootPortal / Transition',
    items: [
      { id: 'r-wd-button', name: 'Button 按钮', expect: '五种类型底色与文字色对比正确；六种变体描边可见；loading 时紫底上能看到白色转圈；按压即时变色' },
      { id: 'r-wd-cell', name: 'Cell 单元格', expect: '标题/描述/右侧值三级文字颜色都可见（text 不继承祖先 color）；is-link 箭头不歪；按压背景有反馈' },
      { id: 'r-wd-cell-group', name: 'CellGroup 单元格组', expect: '组内细分割线在、首尾不多线；insert 卡片模式左右留白与圆角正常' },
      { id: 'r-wd-icon', name: 'Icon 图标', expect: '抽查 20 个图标（含 expand-full / delete / left-circle）字形完整无豆腐块；size/color 实时生效' },
      { id: 'r-wd-img', name: 'Img 图片', expect: '宽高不塌陷；圆角与 mode 裁剪正确；加载中占位可见' },
      { id: 'r-wd-input', name: 'Input 输入框', expect: 'placeholder 颜色可见；clearable 清除图标不隐形；聚焦时键盘弹起不遮挡输入行' },
      { id: 'r-wd-textarea', name: 'Textarea 文本域', expect: '多行高度正确；showWordLimit 的 n/max 计数在右下角可见' },
      { id: 'r-wd-loading', name: 'Loading 加载', expect: 'circular 圆环 / spinner 十二小棒 / dots 三点 / wave 四柱 四种都能看见并转动（不是空白）' },
      { id: 'r-wd-overlay', name: 'Overlay 遮罩', expect: '遮罩半透明覆盖全屏；点击遮罩关闭；内容不被遮罩吃掉' },
      { id: 'r-wd-popup', name: 'Popup 弹出层', expect: 'top/bottom/left/right/center 五个方向动画方向正确；round 圆角只在上/对应侧' },
      { id: 'r-wd-root-portal', name: 'RootPortal 根节点容器', expect: '内容挂载到页面根节点，脱离父级 overflow 裁剪' },
      { id: 'r-wd-transition', name: 'Transition 过渡', expect: '进出场动画时长与位移正确，无残影、无闪白' }
    ]
  },
  {
    id: 'render-form',
    title: '表单渲染（20）',
    hint: 'Form / InputNumber / Search / Switch / Radio / Checkbox / Slider / Rate / Segmented / Keyboard / PasswordInput / SlideVerify / Signature / ImgCropper / Upload',
    items: [
      { id: 'r-wd-form', name: 'Form 表单', expect: 'schema 校验错误提示出现在对应项下方；重置后错误态清空' },
      { id: 'r-wd-form-item', name: 'FormItem 表单项', expect: '标题宽度与右对齐正确；必填星号在；错误文案红色可见' },
      { id: 'r-wd-input-number', name: 'InputNumber 步进器', expect: '减号与加号横竖条都可见（不是空白灰块）；数字居中；禁用态变灰；点加减数字要跟着变（2026-11-05 用户复报「加减没有鸟用」：模型变了但输入框文本不刷新——value 属性通道刷不了 IME 接管后的输入框，必须走 setValue，见 CONVENTIONS §19 第 12 条）；键入越界值（如 max=10 时输 33）后点加减应回落到边界值' },
      { id: 'r-wd-search', name: 'Search 搜索框', expect: '只有一份「搜索」占位（封面与 input 不同时出现）；放大镜在框内居中；取消按钮不压输入框' },
      { id: 'r-wd-switch', name: 'Switch 开关', expect: '轨道是完整胶囊不是月牙；滑块圆在轨道内不溢出；开/关切换位移正确' },
      { id: 'r-wd-radio', name: 'Radio 单选框', expect: '未选中圆环可见；选中圆点可见；按钮模式下选中态形状不隐形' },
      { id: 'r-wd-radio-group', name: 'RadioGroup 单选框组', expect: '同组互斥；横向排列不换行错位；禁用项不可点' },
      { id: 'r-wd-checkbox', name: 'Checkbox 多选框', expect: '未选中方框可见；选中勾可见；按钮模式选中态形状不隐形' },
      { id: 'r-wd-checkbox-group', name: 'CheckboxGroup 多选框组', expect: '可多选；横向排列换行后每行对齐；全选/半选图标正确' },
      { id: 'r-wd-slider', name: 'Slider 滑块', expect: '滑块圆点可见（白底上能看到手柄图标）；拖动跟手无延迟；气泡数值正确' },
      { id: 'r-wd-rate', name: 'Rate 评分', expect: '实心/空心星形都可见；点击回写分值；禁用态变灰' },
      { id: 'r-wd-segmented', name: 'Segmented 分段器', expect: '每段文字可见（不是空白灰块）；选中滑块位置与宽度贴合当前项' },
      { id: 'r-wd-keyboard', name: 'Keyboard 键盘', expect: '数字键/自定义/车牌三种模式的按键文字与删除键都可见；底部安全区适配' },
      { id: 'r-wd-password-input', name: 'PasswordInput 密码输入框', expect: '未输入的格子是空的（不显示圆点）；已输入的格子显示圆点；光标闪烁位置正确' },
      { id: 'r-wd-slide-verify', name: 'SlideVerify 滑动验证', expect: '左侧白色圆角滑块按钮可见（双箭头图标）；按住拖到最右松手 → 轨道变绿 + 成功文案；拖到一半松手回弹；刷新后立刻拖动也要能通过（2026-11-05 用户复报「没有滑动按钮、又没有正常的效果」：首屏 onMounted 度量拿到 0，轨道内联宽度 0px 把滑块裁掉、maxPosition 为 0 永远判不过——已按 R11 补 layoutchange / 补测 / min-width 四层兜底）' },
      { id: 'r-wd-signature', name: 'Signature 签名', expect: '画布可绘制且笔迹跟手；清空按钮生效；画布尺寸不塌陷' },
      { id: 'r-wd-img-cropper', name: 'ImgCropper 图片裁剪', expect: '图片加载后不被拉伸；裁剪框可拖动缩放；确认后回传图片' },
      { id: 'r-wd-upload', name: 'Upload 上传', expect: '点「+」弹系统相册；已选图片缩略图可见；删除按钮可点；+ 唤起项不换行错位（选图为 Lynx 原生 input[type=file]，只兼容真机；Web 预览不可用）' },
      { id: 'r-wd-calendar', name: 'Calendar 日历', expect: '月份标题不插进日期网格中间；日期按周对齐；选中/区间底色正确' },
      { id: 'r-wd-calendar-view', name: 'CalendarView 日历视图', expect: '每周一行、每行 7 格；月初空格对齐到正确星期列；月份标题独立成行' }
    ]
  },
  {
    id: 'render-picker',
    title: '选择器渲染（12）',
    hint: 'Picker / PickerView / DatetimePicker / DatetimePickerView / SelectPicker / Cascader / DropMenu / DropMenuItem',
    items: [
      { id: 'r-wd-picker', name: 'Picker 选择器', expect: '工具栏「取消 / 标题 / 完成」三者互不重叠；滚轮列只有一份内容' },
      { id: 'r-wd-picker-view', name: 'PickerView 选择器视图', expect: '列内容单份、选中项居中；上下遮罩渐隐正常；拖动跟手' },
      { id: 'r-wd-datetime-picker', name: 'DatetimePicker 日期时间', expect: '「取消」不压「日期时间」标题；五列（年月日时分）内容不叠印' },
      { id: 'r-wd-datetime-picker-view', name: 'DatetimePickerView 视图', expect: '各列独立滚动互不干扰；type 切换后列数正确' },
      { id: 'r-wd-select-picker', name: 'SelectPicker 下拉选择', expect: '多选勾选态可见；已选标签不换行溢出；确认回传数组' },
      { id: 'r-wd-cascader', name: 'Cascader 级联选择', expect: '多列联动正确；父列变化后子列重建；确认值层级完整' },
      { id: 'r-wd-drop-menu', name: 'DropMenu 下拉菜单', expect: '展开一项时其他项收起；遮罩随展开出现；菜单不被页面裁剪' },
      { id: 'r-wd-drop-menu-item', name: 'DropMenuItem 下拉菜单项', expect: '选项文字与勾选态可见；禁用项变灰不可点' },
      { id: 'r-wd-sort-button', name: 'SortButton 排序按钮', expect: '升/降序箭头切换正确；文字与箭头间距正常' },
      { id: 'r-wd-pagination', name: 'Pagination 分页器', expect: '页码与左右箭头都可见；当前页高亮；点击切页正确' },
      { id: 'r-wd-tabs', name: 'Tabs 选项卡', expect: '标签可横向滚动；下划线跟随当前项；内容区切换正确' },
      { id: 'r-wd-tab', name: 'Tab 选项卡面板', expect: '面板内容按需渲染；懒加载模式切换后内容出现' }
    ]
  },
  {
    id: 'render-display',
    title: '展示渲染（24）',
    hint: 'Avatar / Badge / Tag / Progress / Circle / CountDown / CountTo / Skeleton / Empty / Loadmore / NoticeBar / Divider / Text / Gap / Card / Watermark / Table / QrCode / BarCode',
    items: [
      { id: 'r-wd-avatar', name: 'Avatar 头像', expect: '图片圆形裁剪正确；文字头像居中且不被裁空；图标头像可见' },
      { id: 'r-wd-avatar-group', name: 'AvatarGroup 头像组', expect: '头像层叠间距与描边正确；超出部分的 +N 可见' },
      { id: 'r-wd-badge', name: 'Badge 徽标', expect: '红点/数字徽标定位在右上角；数值超过 max 显示 +N' },
      { id: 'r-wd-tag', name: 'Tag 标签', expect: '五种类型底色与文字色对比正确；plain/round/可关闭样式正常' },
      { id: 'r-wd-progress', name: 'Progress 进度条', expect: '进度宽度随百分比变化；文字在条内/条外位置正确；不出现 0 宽' },
      { id: 'r-wd-circle', name: 'Circle 环形进度', expect: '圆环绘制完整不缺口；百分比文字居中' },
      { id: 'r-wd-count-down', name: 'CountDown 倒计时', expect: '秒数递减；格式化（mm:ss）正确；结束后触发 finish' },
      { id: 'r-wd-count-to', name: 'CountTo 数字滚动', expect: '数字从起始值滚动到目标值；千分位分隔符正确' },
      { id: 'r-wd-skeleton', name: 'Skeleton 骨架屏', expect: '灰块占位形状与真实内容一致；闪烁动画不抖' },
      { id: 'r-wd-empty', name: 'Empty 空状态', expect: '插画/图标可见；描述文字可见；底部操作按钮可点' },
      { id: 'r-wd-loadmore', name: 'Loadmore 加载更多', expect: 'loading/finished/error 三种状态文案与图标都可见' },
      { id: 'r-wd-notice-bar', name: 'NoticeBar 通知栏', expect: '横向滚动文字不截断；左右图标可见；可关闭时关闭按钮可点' },
      { id: 'r-wd-divider', name: 'Divider 分割线', expect: 'center/left/right 三种位置正确；虚线样式正常；文字不被线覆盖' },
      { id: 'r-wd-text', name: 'Text 文本', expect: '语义色、price 千分位、phone 脱敏、date 格式化都正确；lines 省略生效' },
      { id: 'r-wd-gap', name: 'Gap 间距', expect: '垂直/水平间距与传入值一致' },
      { id: 'r-wd-card', name: 'Card 卡片', expect: '标题栏与内容区分隔线可见；圆角与投影正常' },
      { id: 'r-wd-watermark', name: 'Watermark 水印', expect: '文字水印在容器内平铺可见（默认 opacity 0.6）；不遮挡交互' },
      { id: 'r-wd-table', name: 'Table 表格', expect: '表头与单元格列宽按 column 配置；边框线完整；横向滚动不串列' },
      { id: 'r-wd-table-column', name: 'TableColumn 表格列', expect: '列宽/对齐/自定义渲染生效' },
      { id: 'r-wd-qr-code', name: 'QRCode 二维码', expect: '二维码完整可扫（无缺块）；尺寸正确' },
      { id: 'r-wd-bar-code', name: 'BarCode 条形码', expect: '条码清晰无模糊；下方文字可读' },
      { id: 'r-wd-image-preview', name: 'ImagePreview 图片预览', expect: '命令式 open 后遮罩与图片出现；左右滑动切图；关闭返回' },
      { id: 'r-wd-video-preview', name: 'VideoPreview 视频预览', expect: '命令式 open 后视频可播放；关闭按钮可点' },
      { id: 'r-wd-curtain', name: 'Curtain 幕帘', expect: '幕帘图片覆盖全屏；点击/上滑后关闭并回调' }
    ]
  },
  {
    id: 'render-layout-nav',
    title: '布局与导航渲染（24）',
    hint: 'Row / Col / Grid / GridItem / Sidebar / Steps / Navbar / Tabbar / IndexBar / Sticky / Fab / Backtop / Swiper',
    items: [
      { id: 'r-wd-row', name: 'Row 行布局', expect: 'gutter 间距生效；wrap 换行后每行高度一致不错位' },
      { id: 'r-wd-col', name: 'Col 列布局', expect: 'span 宽度正确（1/24 栅格）；offset 偏移生效' },
      { id: 'r-wd-grid', name: 'Grid 宫格', expect: '按 column 均分；多行换行后高度正确；边框线完整' },
      { id: 'r-wd-grid-item', name: 'GridItem 宫格子项', expect: '图标与文字都可见；ellipsis 时省略号正常（不是只剩 2 个字符）' },
      { id: 'r-wd-sidebar', name: 'Sidebar 侧边导航', expect: '选中项左侧竖条与高亮背景可见；可纵向滚动' },
      { id: 'r-wd-sidebar-item', name: 'SidebarItem 侧边导航项', expect: '文字居中可见；选中/禁用态颜色正确' },
      { id: 'r-wd-steps', name: 'Steps 步骤条', expect: '连接线贯通；已完成/进行中/未开始三态颜色正确' },
      { id: 'r-wd-step', name: 'Step 步骤条子项', expect: '序号圆与标题对齐；描述文字在标题下方不重叠' },
      { id: 'r-wd-navbar', name: 'Navbar 导航栏', expect: '左右插槽与标题三栏不重叠；固定定位时内容不被遮挡' },
      { id: 'r-wd-navbar-capsule', name: 'NavbarCapsule 导航胶囊', expect: '胶囊按钮与宿主状态栏对齐；图标可见' },
      { id: 'r-wd-tabbar', name: 'Tabbar 标签栏', expect: '固定底部；图标与文字都可见；安全区内边距生效' },
      { id: 'r-wd-tabbar-item', name: 'TabbarItem 标签栏项', expect: '选中态变色；角标位置正确' },
      { id: 'r-wd-index-bar', name: 'IndexBar 索引栏', expect: '右侧字母索引可点；点击后列表滚动到对应锚点' },
      { id: 'r-wd-index-anchor', name: 'IndexAnchor 索引锚点', expect: '吸顶标题出现时机正确；不遮挡首个单元格' },
      { id: 'r-wd-sticky', name: 'Sticky 粘性布局', expect: '滚动到阈值后吸顶；离开容器后恢复' },
      { id: 'r-wd-sticky-box', name: 'StickyBox 粘性容器', expect: '多个 sticky 子项不重叠；容器高度正确' },
      { id: 'r-wd-fab', name: 'Fab 悬浮按钮', expect: '点击展开子项；拖动后吸附边缘；不遮挡页面内容' },
      { id: 'r-wd-backtop', name: 'Backtop 回到顶部', expect: '滚动超过阈值后出现；点击回顶；图标可见' },
      { id: 'r-wd-swiper', name: 'Swiper 轮播图', expect: '自动轮播；左右滑动跟手；指示点位置正确' },
      { id: 'r-wd-swiper-nav', name: 'SwiperNav 轮播导航', expect: '指示点/进度条类型都可见；当前项高亮' },
      { id: 'r-wd-collapse', name: 'Collapse 折叠面板', expect: '展开/收起动画正确；手风琴模式互斥' },
      { id: 'r-wd-collapse-item', name: 'CollapseItem 折叠面板项', expect: '标题与箭头对齐；内容区展开后高度正确' },
      { id: 'r-wd-resize', name: 'Resize 尺寸监听', expect: '容器尺寸变化回调触发；内部内容仍可点击（探测层不吞触摸）' },
      { id: 'r-wd-config-provider', name: 'ConfigProvider 全局配置', expect: 'themeVars 覆盖后子组件颜色即时变化；暗色主题无亮色残留' }
    ]
  },
  {
    id: 'render-overlay-biz',
    title: '弹层与业务渲染（14）',
    hint: 'Dialog / ActionSheet / Notify / Toast / Popover / Tooltip / Tour / FloatingPanel / SwipeAction / ShareSheet / Coupon / AddressEdit / SubmitBar / PullRefresh',
    items: [
      { id: 'r-wd-dialog', name: 'Dialog 对话框', expect: 'alert/confirm 文案与按钮可见；确认/取消回调正确；遮罩关闭策略生效' },
      { id: 'r-wd-action-sheet', name: 'ActionSheet 动作面板', expect: '选项列表可见；取消按钮独立成块；危险项变红' },
      { id: 'r-wd-notify', name: 'Notify 消息通知', expect: '顶部滑入；文字与关闭按钮可见；自动消失时间正确' },
      { id: 'r-wd-toast', name: 'Toast 轻提示', expect: '居中显示；图标与文字都可见；不阻塞页面' },
      { id: 'r-wd-popover', name: 'Popover 气泡弹出', expect: '气泡只出现一份（度量副本不叠印）；箭头指向正确；点击外部关闭' },
      { id: 'r-wd-tooltip', name: 'Tooltip 文字提示', expect: '气泡只出现一份；三个方向定位正确；长按/点击触发符合配置' },
      { id: 'r-wd-tour', name: 'Tour 新手引导', expect: '高亮框对准目标；步骤切换正确；最后一步 finish' },
      { id: 'r-wd-floating-panel', name: 'FloatingPanel 浮动面板', expect: '三个锚点高度可切换；拖动跟手；吸顶后内容不被裁' },
      { id: 'r-wd-swipe-action', name: 'SwipeAction 滑动操作', expect: '横滑展开按钮跟手；纵向滑动不误触；展开一项收起其他项' },
      { id: 'r-wd-share-sheet', name: 'ShareSheet 分享面板', expect: '选项图标与文字都可见；点击回传对应项；取消关闭' },
      { id: 'r-wd-coupon', name: 'Coupon 优惠券', expect: '满减券面值与单位正确；折扣券显示折；选中态边框/角标可见' },
      { id: 'r-wd-address-edit', name: 'AddressEdit 地址编辑', expect: '各输入项有值；地区选择可点；保存按钮不被底部遮挡' },
      { id: 'r-wd-submit-bar', name: 'SubmitBar 提交栏', expect: '价格按分换算正确（含小数位）；按钮可见可点；底部安全区适配' },
      { id: 'r-wd-pull-refresh', name: 'PullRefresh 下拉刷新', expect: '下拉时提示文案跟随；松手后转圈并回调；刷新结束回弹' }
    ]
  }
]

export const componentCheckCount = componentSections.reduce((sum, s) => sum + s.items.length, 0)
