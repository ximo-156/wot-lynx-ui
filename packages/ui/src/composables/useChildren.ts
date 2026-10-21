import {
  provide, reactive, onUpdated, getCurrentInstance,
  type VNode, type InjectionKey, type ComponentPublicInstance, type ComponentInternalInstance
} from 'vue-lynx'

function isVNode(value: any): value is VNode { return value?.__v_isVNode === true }
export function flattenVNodes(children: VNode) {
  const result: VNode[] = []
  const traverse = (value: VNode | any) => {
    for (const child of Array.isArray(value) ? value : [value]) {
      if (Array.isArray(child)) traverse(child)
      else if (isVNode(child) && child.component?.subTree) { result.push(child); traverse(child.component.subTree) }
      else if (isVNode(child) && Array.isArray(child.children)) traverse(child.children)
      else if (isVNode(child)) result.push(child)
    }
  }
  traverse(children)
  return result
}

/** 子组件注册顺序不等于 keyed slot 的渲染顺序；无变化时不能改响应式数组。 */
export function sortChildren(
  parent: ComponentInternalInstance, publicChildren: ComponentPublicInstance[], internalChildren: ComponentInternalInstance[]
) {
  const vnodes = parent?.subTree ? flattenVNodes(parent.subTree) : []
  const vnodeIndex = new Map<VNode, number>()
  vnodes.forEach((vnode, index) => { if (!vnodeIndex.has(vnode)) vnodeIndex.set(vnode, index) })
  const indexOf = (vnode: VNode) => vnodeIndex.get(vnode) ?? vnodes.findIndex((item) =>
    vnode.key != null && item.type === vnode.type && item.key === vnode.key)
  const ordered = [...internalChildren].sort((a, b) => indexOf(a.vnode) - indexOf(b.vnode))
  if (ordered.some((child, index) => child.uid !== internalChildren[index]?.uid)) {
    internalChildren.splice(0, internalChildren.length, ...ordered)
  }
  const publicByUid = new Map(publicChildren.map((child) => [child.$.uid, child]))
  const orderedPublic = ordered.map((child) => publicByUid.get(child.uid) || child.proxy!).filter(Boolean)
  if (orderedPublic.some((child, index) => child.$.uid !== publicChildren[index]?.$.uid)) {
    publicChildren.splice(0, publicChildren.length, ...orderedPublic)
  }
}

export function useChildren<Child extends ComponentPublicInstance = ComponentPublicInstance<{}, any>, ProvideValue = never>(
  key: InjectionKey<ProvideValue>
) {
  const publicChildren: Child[] = reactive([])
  const internalChildren: ComponentInternalInstance[] = reactive([])
  const parent = getCurrentInstance()!
  onUpdated(() => sortChildren(parent, publicChildren, internalChildren))
  const linkChildren = (value?: ProvideValue) => {
    const link = (child: ComponentInternalInstance) => {
      if (child.proxy && internalChildren.indexOf(child) === -1) {
        internalChildren.push(child)
        publicChildren.push(child.proxy as Child)
        sortChildren(parent, publicChildren, internalChildren)
      }
    }
    const unlink = (child: ComponentInternalInstance) => {
      const index = internalChildren.indexOf(child)
      if (index === -1) return
      internalChildren.splice(index, 1)
      const publicIndex = publicChildren.findIndex((item) => item.$.uid === child.uid)
      if (publicIndex !== -1) publicChildren.splice(publicIndex, 1)
    }
    provide(key, Object.assign({ link, unlink, children: publicChildren, internalChildren }, value))
  }
  return { children: publicChildren, internalChildren, linkChildren }
}
