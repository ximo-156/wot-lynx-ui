/** Lay out the existing showcase slot; never duplicate the component catalog. */
import { cloneVNode, defineComponent, Fragment, h, useSlots, type VNode } from 'vue-lynx'

function flatten(nodes: VNode[]): VNode[] {
  return nodes.flatMap(node => node.type === Fragment && Array.isArray(node.children)
    ? flatten(node.children as VNode[])
    : [node])
}
function hasClass(node: VNode, name: string): boolean {
  return node.type === 'view' && String(node.props?.class || '').split(/\s+/).includes(name)
}

export default defineComponent({
  name: 'ShowcaseLayout',
  props: {
    columns: { type: Number, default: 1 },
    contentWidth: { type: Number, default: 0 }
  },
  setup(props) {
    const slots = useSlots()
    return () => {
      const nodes = flatten(slots.default?.() || [])
      const sections = nodes.filter(node => hasClass(node, 'demo-section'))
      const header = nodes.filter(node => hasClass(node, 'page__header'))
      const other = nodes.filter(node => !hasClass(node, 'demo-section') && !hasClass(node, 'page__header'))
      const columns = Math.min(3, Math.max(1, Math.floor(props.columns)))
      const gap = columns > 1 ? 20 : 0
      const columnWidth = props.contentWidth > 0
        ? `${Math.max(1, (props.contentWidth - gap * (columns - 1)) / columns)}px`
        : `${100 / columns}%`
      // Explicit column containers avoid Lynx's auto-height flex-wrap differences.
      // Stable section keys preserve state within a column; parent demo models
      // remain the single source of truth when crossing a column-count breakpoint.
      const groups = Array.from({ length: columns }, () => [] as VNode[])
      sections.forEach((node, index) => groups[index % columns].push(cloneVNode(node, { key: node.key ?? `demo-section-${index}` })))
      return h('view', {
        class: ['showcase', `showcase--${columns}-columns`],
        style: { display: 'flex', 'flex-direction': 'column', width: '100%' }
      }, [
        ...header,
        h('view', {
          class: 'showcase__columns',
          style: { display: 'flex', 'flex-direction': 'row', 'align-items': 'flex-start', gap: `${gap}px`, width: '100%' }
        }, groups.map((children, index) => h('view', {
          key: `column-${index}`,
          class: 'showcase__column',
          style: { display: 'flex', 'flex-direction': 'column', 'flex-shrink': '0', 'min-width': '0px', width: columnWidth }
        }, children))),
        ...other
      ])
    }
  }
})
