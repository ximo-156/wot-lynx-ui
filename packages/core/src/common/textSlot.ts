import { cloneVNode, defineComponent, Fragment, h, Text, type PropType, type VNodeChild } from 'vue-lynx'
import type { StyleObject } from './style'

export interface TextSlotOptions {
  textClass?: string
  textStyle?: StyleObject | StyleObject[]
  textMaxline?: string | number
}

/**
 * Vue Text VNodes become anonymous Lynx text elements (CREATE_TEXT), but carry
 * no class/style/maxline contract. Give label-like slots explicit text props.
 * Normalize only the slot boundary: caller-owned views/components are untouched.
 * Fragment keys survive; their block fast path must not patch the old raw VNodes.
 */
export function normalizeTextSlot(nodes: readonly VNodeChild[], options: TextSlotOptions): VNodeChild[] {
  const text = (value: string, key?: PropertyKey | null) => h('text', {
    key: key ?? undefined,
    class: options.textClass,
    style: options.textStyle,
    'text-maxline': options.textMaxline
  }, value)
  return nodes.map((node) => {
    if (Array.isArray(node)) return normalizeTextSlot(node, options)
    // h(Fragment, ..., ['label', 0]) need not pre-normalize its children.
    if (typeof node === 'string' || typeof node === 'number') return node === '' ? node : text(String(node))
    if (!node || typeof node !== 'object') return node
    if (node.type === Text) {
      // Empty Text VNodes are also used as fragment/slot anchors. Giving them
      // label metrics creates an otherwise nonexistent line or flex gap.
      if (node.children === '') return node
      return text(node.children as string, node.key)
    }
    if (node.type === Fragment && Array.isArray(node.children)) {
      const fragment = cloneVNode(node) as typeof node & { dynamicChildren: VNodeChild[] | null }
      fragment.children = normalizeTextSlot(node.children, options)
      // BAIL (-2): a compiled Fragment's dynamicChildren still refer to the
      // caller's anonymous Text VNodes. Traverse normalized children on updates.
      fragment.patchFlag = -2
      fragment.dynamicChildren = null
      return fragment
    }
    return node
  })
}

/** Native text boundary for label-like slots; not a wrapper around structured content. */
export const WdTextSlot = defineComponent({
  name: 'WdTextSlot',
  inheritAttrs: false,
  props: {
    textClass: String,
    textStyle: [Object, Array] as PropType<StyleObject | StyleObject[]>,
    textMaxline: [String, Number]
  },
  setup(props, { slots }) {
    return () => normalizeTextSlot(slots.default?.() || [], props)
  }
})
