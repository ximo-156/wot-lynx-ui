/**
 * Render the shared catalog in columns or one lazy section at a time.
 * The catalog is metadata (DemoSection VNodes with uncalled slots), not a tree
 * hidden with display:none. Switching sections unmounts their timers/observers.
 */
import { cloneVNode, defineComponent, Fragment, h, nextTick, onBeforeUnmount, ref, useSlots, type VNode } from 'vue-lynx'
import { scrollViewTo } from 'wot-lynx-ui'
import DemoSection from './DemoSection'

function flatten(nodes: VNode[]): VNode[] {
  return nodes.flatMap(node => node.type === Fragment && Array.isArray(node.children)
    ? flatten(node.children as VNode[])
    : [node])
}
function hasClass(node: VNode, name: string): boolean {
  return node.type === 'view' && String(node.props?.class || '').split(/\s+/).includes(name)
}
function isSection(node: VNode): boolean {
  return node.type === DemoSection || hasClass(node, 'demo-section')
}
function sectionName(node: VNode, index: number): string {
  return String(node.props?.name || node.key || `section-${index}`)
}

const columnStyle = { display: 'flex', 'flex-direction': 'column', width: '100%' }
const rowStyle = { display: 'flex', 'flex-direction': 'row', 'flex-wrap': 'wrap', gap: '8px', 'align-items': 'center' }
const controlStyle = { display: 'flex', 'flex-direction': 'row', 'align-items': 'center', 'justify-content': 'center', padding: '8px 10px', 'border-radius': '6px', 'background-color': 'var(--wot-filled-bottom)' }
const labelStyle = { 'font-size': '13px', 'line-height': '20px', color: 'var(--wot-text-main)' }
const hintStyle = { 'font-size': '12px', 'line-height': '18px', color: 'var(--wot-text-secondary)' }

export default defineComponent({
  name: 'ShowcaseLayout',
  props: {
    columns: { type: Number, default: 1 },
    contentWidth: { type: Number, default: 0 },
    browse: { type: Boolean, default: false },
    initialSection: { type: String, default: '' },
    idPrefix: { type: String, default: 'showcase' },
    scrollTarget: { type: String, default: '' }
  },
  emits: ['section-change'],
  setup(props, { emit }) {
    const slots = useSlots()
    const selected = ref(props.initialSection)
    const directoryOpen = ref(false)
    const stress = ref(false)
    let navigation = 0
    let alive = true
    onBeforeUnmount(() => { alive = false; navigation++ })

    function changed(name: string, all: boolean) {
      emit('section-change', { name, all })
      const request = ++navigation
      // Navigation only, never a scroll listener or a polling loop.
      void nextTick(() => {
        if (alive && request === navigation && props.scrollTarget) scrollViewTo(props.scrollTarget, 0, false)
      })
    }
    function choose(name: string) {
      selected.value = name
      stress.value = false
      directoryOpen.value = false
      changed(name, false)
    }
    function control(id: string, text: string, tap: () => void, disabled = false) {
      return h('view', {
        id: `${props.idPrefix}-${id}`,
        class: 'showcase__control',
        style: { ...controlStyle, opacity: disabled ? '0.4' : '1' },
        'accessibility-role': 'button',
        'accessibility-label': text,
        onTap: () => { if (!disabled) tap() }
      }, [h('text', { style: labelStyle }, text)])
    }

    return () => {
      const nodes = flatten(slots.default?.() || [])
      const sections = nodes.filter(isSection)
      const header = nodes.filter(node => hasClass(node, 'page__header'))
      const other = nodes.filter(node => !isSection(node) && !hasClass(node, 'page__header'))
      const names = sections.map(sectionName)
      const activeIndex = Math.max(0, names.indexOf(selected.value))
      const activeName = names[activeIndex] || ''
      const all = !props.browse || stress.value
      const columns = all ? Math.min(3, Math.max(1, Math.floor(props.columns))) : 1
      const gap = columns > 1 ? 20 : 0
      const columnWidth = props.contentWidth > 0
        ? `${Math.max(1, (props.contentWidth - gap * (columns - 1)) / columns)}px`
        : `${100 / columns}%`
      const groups = Array.from({ length: columns }, () => [] as VNode[])
      sections.forEach((node, index) => {
        if (!all && index !== activeIndex) return
        groups[(all ? index : 0) % columns].push(cloneVNode(node, { key: `demo-${names[index]}`, all }))
      })
      const title = String(sections[activeIndex]?.props?.title || activeName)
      const browser = props.browse ? h('view', {
        class: 'showcase__browser',
        'render-mode': all ? 'stress' : 'single',
        'active-section': activeName,
        style: { ...columnStyle, gap: '8px', 'margin-bottom': '16px' }
      }, [
        h('view', { style: rowStyle }, [
          control('directory-toggle', directoryOpen.value ? '收起目录' : `目录（${sections.length} 项）`, () => { directoryOpen.value = !directoryOpen.value }),
          control('previous', '上一项', () => choose(names[activeIndex - 1]), activeIndex === 0),
          control('next', '下一项', () => choose(names[activeIndex + 1]), activeIndex >= sections.length - 1),
          control('stress-toggle', all ? '返回逐项测试' : '全量压力模式', () => {
            stress.value = !stress.value
            directoryOpen.value = false
            changed(activeName, stress.value)
          })
        ]),
        h('text', { style: hintStyle }, all
          ? '压力模式：全部同时挂载，可能卡顿；不代表单组件性能。'
          : `${activeIndex + 1}/${sections.length} · ${title}（其它项目未挂载；填写值保留，内部动画/临时状态会重置）`),
        directoryOpen.value ? h('view', { class: 'showcase__directory', style: columnStyle },
          sections.map((node, index) => h('view', {
            key: names[index], id: `${props.idPrefix}-select-${names[index]}`,
            class: 'showcase__directory-item', 'section-name': names[index],
            'accessibility-role': 'button', 'accessibility-label': String(node.props?.title || names[index]),
            style: { ...controlStyle, 'justify-content': 'flex-start', 'margin-bottom': '4px' },
            onTap: () => choose(names[index])
          }, [h('text', { style: { ...labelStyle, color: index === activeIndex ? 'var(--wot-primary-6)' : 'var(--wot-text-main)' } }, String(node.props?.title || names[index]))]))) : null
      ]) : null
      return h('view', {
        class: ['showcase', `showcase--${columns}-columns`], style: columnStyle
      }, [
        ...header,
        browser,
        h('view', {
          class: 'showcase__columns',
          style: { display: 'flex', 'flex-direction': 'row', 'align-items': 'flex-start', gap: `${gap}px`, width: '100%' }
        }, groups.map((children, index) => h('view', {
          key: `column-${index}`, class: 'showcase__column',
          style: { ...columnStyle, 'flex-shrink': '0', 'min-width': '0px', width: columnWidth }
        }, children))),
        ...other
      ])
    }
  }
})
