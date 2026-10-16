import {
  provide,
  reactive,
  getCurrentInstance,
  type VNode,
  type InjectionKey,
  type ComponentPublicInstance,
  type ComponentInternalInstance
} from 'vue-lynx'

function isVNode(value: any): value is VNode {
  return value ? value.__v_isVNode === true : false
}

export function flattenVNodes(children: VNode) {
  const result: VNode[] = []

  const traverse = (children: VNode | any) => {
    const vNode = Array.isArray(children) ? children : [children]
    vNode.forEach((child) => {
      if (Array.isArray(child)) {
        traverse(child)
      } else if (isVNode(child) && child.component?.subTree) {
        result.push(child)
        traverse(child.component.subTree)
      } else if (isVNode(child) && Array.isArray(child.children)) {
        traverse(child.children)
      } else if (isVNode(child)) {
        result.push(child)
      }
    })
  }

  traverse(children)

  return result
}

export function sortChildren(
  parent: ComponentInternalInstance,
  publicChildren: ComponentPublicInstance[],
  internalChildren: ComponentInternalInstance[]
) {
  const vnodes = parent && parent.subTree && parent.subTree.children ? flattenVNodes(parent.subTree) : []

  // 索引映射：把原先比较器内的 O(N) 线性查找（indexOf / findIndex）降为 O(1)，
  // 避免收集 N 个子组件（每次 link 都调用本函数）时退化为 O(N²) 次查找。
  const vnodeIndexMap = new Map<VNode, number>()
  for (let i = 0; i < vnodes.length; i++) {
    // 只记录首次出现，与 Array.prototype.indexOf 语义一致
    if (!vnodeIndexMap.has(vnodes[i])) vnodeIndexMap.set(vnodes[i], i)
  }
  const indexOfVNode = (vnode: VNode): number => {
    const direct = vnodeIndexMap.get(vnode)
    if (direct !== undefined) return direct
    // 兼容回退：按 type + key 匹配（与旧 findVNodeIndex 的兜底分支等价）
    return vnodes.findIndex((item) => vnode.key !== undefined && vnode.key !== null && item.type === vnode.type && item.key === vnode.key)
  }

  internalChildren.sort((a, b) => indexOfVNode(a.vnode) - indexOfVNode(b.vnode))

  const orderedPublicChildren = internalChildren.map((item) => item.proxy!)

  const orderMap = new Map<number, number>()
  for (let i = 0; i < orderedPublicChildren.length; i++) {
    const comp = orderedPublicChildren[i]
    // 只记录首次出现，与旧 getIndex 的 findIndex 语义一致
    if (comp && !orderMap.has(comp.$.uid)) orderMap.set(comp.$.uid, i)
  }

  publicChildren.sort((a, b) => {
    // 未命中返回 -1（与旧 findIndex 一致）
    const indexA = orderMap.get(a.$.uid) ?? -1
    const indexB = orderMap.get(b.$.uid) ?? -1
    return indexA - indexB
  })
}

export function useChildren<
  // eslint-disable-next-line
  Child extends ComponentPublicInstance = ComponentPublicInstance<{}, any>,
  ProvideValue = never
>(key: InjectionKey<ProvideValue>) {
  const publicChildren: Child[] = reactive([])
  const internalChildren: ComponentInternalInstance[] = reactive([])
  const parent = getCurrentInstance()!

  const linkChildren = (value?: ProvideValue) => {
    const link = (child: ComponentInternalInstance) => {
      if (child.proxy) {
        if (internalChildren.indexOf(child) === -1) {
          internalChildren.push(child)
          publicChildren.push(child.proxy as Child)
          sortChildren(parent, publicChildren, internalChildren)
        }
      }
    }

    const unlink = (child: ComponentInternalInstance) => {
      const index = internalChildren.indexOf(child)
      // 未注册（重复 unlink / link 前卸载的异常路径）时 indexOf 为 -1，
      // splice(-1, 1) 会误删最后一个子组件
      if (index === -1) return
      publicChildren.splice(index, 1)
      internalChildren.splice(index, 1)
    }

    provide(
      key,
      Object.assign(
        {
          link,
          unlink,
          children: publicChildren,
          internalChildren
        },
        value
      )
    )
  }

  return {
    children: publicChildren,
    linkChildren
  }
}
