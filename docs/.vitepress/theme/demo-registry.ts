/**
 * demo-registry — 组件文档页 H5 预览的演示装载器。
 *
 * 解析优先级：
 * 1. 手工编写的高保真演示：`./demos/<slug>.vue`（slug 与文档文件名一致，
 *    如 button.md → demos/button.vue）；
 * 2. 通用兜底演示：按组件 props 推断示例值渲染真实组件。弹层类组件默认
 *    以打开态渲染（picker/calendar/keyboard…），容器子组件自动套上典型
 *    父组件（tab → tabs、grid-item → grid…），使每个文档页都有可见预览。
 *
 * 新增手工演示只需在 demos/ 下新建 <slug>.vue 并默认导出一个组件，
 * 无需改动本文件（import.meta.glob 自动发现）。
 */
import { defineAsyncComponent, h, onMounted, ref, type Component, type VNodeChild } from 'vue'

const curatedDemos = import.meta.glob<{ default: Component }>('./demos/*.vue')
const componentModules = import.meta.glob<{ default: Component }>(
  '../../../packages/ui/src/components/*/wd-*.vue'
)

const compPath = (slug: string) => `../../../packages/ui/src/components/wd-${slug}/wd-${slug}.vue`

/** 常见文本类 props 的示例值（兜底演示用） */
const SAMPLE_TEXT: Record<string, string> = {
  text: '按钮文字',
  title: '标题',
  label: '描述信息',
  placeholder: '请输入内容',
  value: '内容',
  tip: '暂无数据',
  content: '内容',
  msg: '消息内容',
  message: '消息内容',
  name: '姓名',
  'error-text': '错误提示',
  'loading-text': '努力加载中...',
  'finished-text': '没有更多了',
  'error-message': '加载失败',
  'confirm-button-text': '确定',
  'cancel-button-text': '取消'
}

/** 内联 SVG 占位图（离线可渲染，避免外链图片 404） */
const PLACEHOLDER_IMG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320"><rect width="640" height="320" fill="#7F5CFF"/><text x="320" y="172" font-size="36" fill="#fff" text-anchor="middle">预览图片</text></svg>'
  )

const PICKER_COLUMNS = ['选项一', '选项二', '选项三', '选项四']
const SELECT_COLUMNS = [
  { value: 'fruit', label: '水果' },
  { value: 'veg', label: '蔬菜' },
  { value: 'meat', label: '肉类' }
]
const CASCADER_OPTIONS = [
  {
    value: 'zj',
    text: '浙江省',
    children: [
      { value: 'hz', text: '杭州市', children: [{ value: 'xh', text: '西湖区' }] },
      { value: 'nb', text: '宁波市' }
    ]
  },
  { value: 'js', text: '江苏省', children: [{ value: 'nj', text: '南京市' }] }
]

/** 兜底演示规格：props 示例值 / 父组件包裹 / 默认插槽文本 */
interface FallbackSpec {
  props?: Record<string, unknown>
  /** 包裹父组件 slug（如 tab → tabs） */
  wrap?: string
  wrapProps?: Record<string, unknown>
  /** 默认插槽文本 */
  childText?: string
}

const FALLBACK_SPECS: Record<string, FallbackSpec> = {
  // ---- 弹层类：默认以打开态渲染 ----
  picker: { props: { columns: PICKER_COLUMNS, visible: true, title: '选择器' } },
  'datetime-picker': { props: { visible: true, type: 'datetime', title: '日期时间' } },
  calendar: { props: { visible: true, title: '日历' } },
  keyboard: { props: { visible: true, title: '数字键盘' } },
  overlay: { props: { show: true } },
  curtain: { props: { modelValue: true, src: PLACEHOLDER_IMG } },
  'select-picker': { props: { visible: true, columns: SELECT_COLUMNS, title: '单选' } },
  cascader: { props: { visible: true, options: CASCADER_OPTIONS, title: '级联选择' } },
  'img-cropper': { props: { modelValue: true } },
  notify: { props: { modelValue: true, message: '消息通知', type: 'primary' } },
  'floating-panel': { props: { height: 200 }, childText: '浮动面板内容（可拖拽）' },
  popover: { props: { content: '气泡内容' }, childText: '点我弹出' },
  tooltip: { props: { content: '文字提示' }, childText: '点我提示' },
  // ---- 数据驱动类 ----
  'picker-view': { props: { columns: PICKER_COLUMNS, modelValue: ['选项一'] } },
  'calendar-view': { props: { modelValue: Date.now() } },
  'datetime-picker-view': { props: { modelValue: Date.now() } },
  'swiper-nav': {
    props: {
      items: [
        { icon: 'home', title: '首页' },
        { icon: 'camera', title: '相机' },
        { icon: 'picture', title: '图片' },
        { icon: 'user', title: '我的' }
      ]
    }
  },
  'sort-button': { props: { title: '价格', modelValue: 0 } },
  backtop: { props: { scrollTop: 200, top: 60 } },
  'count-to': { props: { startVal: 0, endVal: 2024, duration: 2000 } },
  'password-input': { props: { modelValue: '123456', length: 6 } },
  upload: { props: { fileList: [] } },
  watermark: { props: { content: 'wot-lynx-ui' } },
  loadmore: { props: { state: 'loading' } },
  'bar-code': { props: { text: '1234567890128', width: 180, height: 60 } },
  // ---- 需要插槽子节点 ----
  'root-portal': { childText: '根节点容器内容（弹层挂载点）' },
  'sticky-box': { childText: '粘性容器内容' },
  checkbox: { childText: '选项 A' },
  radio: { childText: '选项 A' },
  resize: { childText: '监听这块区域的尺寸变化' },
  sticky: { props: { offsetTop: 0 }, childText: '吸顶内容' },
  transition: { props: { show: true }, childText: '过渡内容' },
  'swipe-action': { childText: '单元格（左右横滑）' },
  // ---- 容器子组件：套典型父组件 ----
  tab: { wrap: 'tabs', wrapProps: { modelValue: 0 }, props: { title: '标签一' }, childText: '标签一的内容' },
  'tabbar-item': {
    wrap: 'tabbar',
    wrapProps: { modelValue: 0 },
    props: { title: '首页', icon: 'home' }
  },
  'grid-item': { wrap: 'grid', wrapProps: { column: 3 }, props: { icon: 'picture', text: '图片' } },
  step: {
    wrap: 'steps',
    wrapProps: { active: 1 },
    props: { title: '步骤一', description: '填写信息' }
  },
  'collapse-item': { wrap: 'collapse', props: { name: '1', title: '折叠面板' }, childText: '折叠内容' },
  'sidebar-item': { wrap: 'sidebar', wrapProps: { modelValue: 'a' }, props: { label: '选项一', value: 'a' } },
  'index-anchor': { wrap: 'index-bar', props: { index: 'A' } },
  'drop-menu-item': {
    wrap: 'drop-menu',
    wrapProps: { modelValue: '' },
    props: { value: 'new', options: SELECT_COLUMNS }
  },
  'form-item': {
    wrap: 'form',
    wrapProps: {
      model: { name: '' },
      schema: {
        validate(model: Record<string, any>) {
          const issues: Array<{ path: string[]; message: string }> = []
          if (!model.name) issues.push({ path: ['name'], message: '请输入姓名' })
          return issues
        }
      }
    },
    props: { prop: 'name', title: '姓名', required: true },
    childText: '表单项内容'
  },
  'table-column': {
    wrap: 'table',
    wrapProps: {
      data: [
        { name: '张三', age: 28 },
        { name: '李四', age: 34 }
      ],
      columns: [
        { prop: 'name', label: '姓名' },
        { prop: 'age', label: '年龄' }
      ]
    },
    props: { prop: 'name', label: '姓名' }
  }
}

/** 读组件 props 声明，合并已知文本类示例值 */
function sampleProps(Comp: Component, extra?: Record<string, unknown>): Record<string, unknown> {
  const declared = (Comp as any).props || {}
  const sample: Record<string, unknown> = { ...(extra || {}) }
  for (const key of Object.keys(declared)) {
    if (!(key in sample) && key in SAMPLE_TEXT) sample[key] = SAMPLE_TEXT[key]
  }
  return sample
}

/** 兜底演示统一渲染入口（异步加载组件 + 规格化 props） */
export function createGenericDemo(slug: string): Component {
  const loader = componentModules[compPath(slug)]
  if (!loader) {
    return defineAsyncComponent({
      loader: () =>
        Promise.resolve({
          name: 'DemoPlaceholder',
          render() {
            return h(
              'view',
              { class: 'wd-h5-placeholder' },
              [h('text', { class: 'wd-h5-placeholder__text' }, `未找到组件源码：wd-${slug}`)]
            )
          }
        } as Component),
      delay: 0
    })
  }
  const spec = FALLBACK_SPECS[slug] || {}
  const wrapLoader = spec.wrap ? componentModules[compPath(spec.wrap)] : undefined

  return defineAsyncComponent({
    loader: async () => {
      const Comp = (await loader()).default
      const WrapComp = wrapLoader ? (await wrapLoader()).default : undefined
      const props = sampleProps(Comp, spec.props)

      // 部分弹层组件（cascader / select-picker）的 visible watcher 无
      // immediate，挂载时置 true 不触发打开——改为挂载后翻转为 true
      const openKey: 'visible' | 'modelValue' | null =
        spec.props?.visible === true ? 'visible' : spec.props?.modelValue === true ? 'modelValue' : null

      // 注意：defineAsyncComponent 的 loader 直接返回组件对象（它不会解包
      // 普通 { default } 对象，仅识别带 __esModule/Module 标记的模块）
      return {
        name: `GenericDemo-${slug}`,
        setup() {
          const open = ref(false)
          if (openKey) onMounted(() => (open.value = true))
          return { open }
        },
        render(this: any) {
          const merged = openKey ? { ...props, [openKey]: this.open } : props
          const innerNode = (): VNodeChild =>
            h(
              Comp as Component,
              merged,
              spec.childText ? { default: () => h('text', spec.childText) } : undefined
            )
          const node = WrapComp
            ? h(WrapComp as Component, sampleProps(WrapComp, spec.wrapProps), { default: innerNode })
            : innerNode()
          return h('view', { class: 'wd-h5-generic' }, [node])
        }
      } as Component
    },
    delay: 0
  })
}

/** 装载指定组件的预览演示（优先手工演示，其次通用兜底） */
export async function loadDemo(slug: string): Promise<Component> {
  const curated = curatedDemos[`./demos/${slug}.vue`]
  if (curated) {
    const mod = await curated()
    return mod.default
  }
  return createGenericDemo(slug)
}
