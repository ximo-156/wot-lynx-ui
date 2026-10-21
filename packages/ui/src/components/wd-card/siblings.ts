import { Fragment, Comment, Text, onMounted, onUpdated, onBeforeUnmount, ref, getCurrentInstance, type ComponentInternalInstance, type Ref, type VNode } from 'vue-lynx'

const groups = new WeakMap<ComponentInternalInstance, Map<number, { instance: ComponentInternalInstance; last: Ref<boolean> }>>()
function elements(nodes: any): VNode[] {
  const result: VNode[] = []
  for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
    if (!node || typeof node !== 'object' || node.type === Comment || node.type === Text) continue
    if (Array.isArray(node) || node.type === Fragment) result.push(...elements(Array.isArray(node) ? node : node.children))
    else result.push(node)
  }
  return result
}
function hasFollowing(root: VNode, uid: number): boolean | undefined {
  if (root.component?.uid === uid) return false
  const list = elements(root.children)
  const position = list.findIndex((node) => node.component?.uid === uid)
  if (position !== -1) return position < list.length - 1
  for (const node of list) {
    const found = hasFollowing(node, uid)
    if (found !== undefined) return found
  }
}
/** Match :not(:last-child) against the actual sibling elements without native structural selectors. */
export function useCardLastSibling() {
  const instance = getCurrentInstance()!
  const parent = instance.parent
  const last = ref(true)
  if (!parent) return last
  let children = groups.get(parent)
  if (!children) {
    children = new Map()
    groups.set(parent, children)
    const reconcile = () => {
      for (const child of groups.get(parent)?.values() || []) {
        child.last.value = !hasFollowing(parent.subTree, child.instance.uid)
      }
    }
    onMounted(reconcile, parent)
    onUpdated(reconcile, parent)
  }
  children.set(instance.uid, { instance, last })
  onMounted(() => { last.value = !hasFollowing(parent.subTree, instance.uid) })
  onBeforeUnmount(() => { children?.delete(instance.uid) })
  return last
}
