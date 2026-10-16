/**
 * demo-registry — 组件文档页 H5 预览的演示装载器。
 *
 * 解析优先级：
 * 1. 手工编写的高保真演示：`./demos/<slug>.vue`（slug 与文档文件名一致，
 *    如 button.md → demos/button.vue）；
 * 2. 通用兜底演示：按组件 props 推断示例值渲染真实组件（组件缺失必填
 *    props 时由 H5Preview 的错误边界降级为提示文案）。
 *
 * 新增手工演示只需在 demos/ 下新建 <slug>.vue 并默认导出一个组件，
 * 无需改动本文件（import.meta.glob 自动发现）。
 */
import { defineAsyncComponent, h, type Component } from 'vue'

const curatedDemos = import.meta.glob<{ default: Component }>('./demos/*.vue')
const componentModules = import.meta.glob<{ default: Component }>(
  '../../../packages/ui/src/components/*/wd-*.vue'
)

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

/** 兜底演示统一渲染入口（读组件 props 声明，注入已知文本类示例值） */
export function createGenericDemo(slug: string): Component {
  const loader = componentModules[
    `../../../packages/ui/src/components/wd-${slug}/wd-${slug}.vue`
  ]
  if (!loader) {
    return defineAsyncComponent({
      loader: () =>
        Promise.resolve({
          default: {
            name: 'DemoPlaceholder',
            render() {
              return h(
                'view',
                { class: 'wd-h5-placeholder' },
                [h('text', { class: 'wd-h5-placeholder__text' }, `未找到组件源码：wd-${slug}`)]
              )
            }
          } as Component
        }),
      delay: 0
    })
  }
  return defineAsyncComponent({
    loader: async () => {
      const mod = await loader()
      const Comp = mod.default
      const declared = (Comp as any).props || {}
      const sample: Record<string, unknown> = {}
      for (const key of Object.keys(declared)) {
        if (key in SAMPLE_TEXT) sample[key] = SAMPLE_TEXT[key]
      }
      const Wrapper = {
        name: `GenericDemo-${slug}`,
        render() {
          return h('view', { class: 'wd-h5-generic' }, [h(Comp as Component, sample)])
        }
      }
      return { default: Wrapper }
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
