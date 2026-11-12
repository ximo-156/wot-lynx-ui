import {
  ref,
  shallowRef,
  inject,
  computed,
  onUnmounted,
  type InjectionKey,
  getCurrentInstance,
  type ComponentPublicInstance,
  type ComponentInternalInstance,
  type Ref
} from 'vue-lynx'

type ParentProvide<T> = T & {
  link(child: ComponentInternalInstance): void
  unlink(child: ComponentInternalInstance): void
  children: ComponentPublicInstance[]
  internalChildren: ComponentInternalInstance[]
}

type UseParentResult<T> = {
  parent: Ref<ParentProvide<T> | null>
  index: Ref<number>
}

export function useParent<T>(key: InjectionKey<ParentProvide<T>>): UseParentResult<T> {
  const result: UseParentResult<T> = {
    parent: shallowRef<ParentProvide<T> | null>(null),
    index: ref<number>(-1)
  }
  // Lynx 适配：wot-ui 仅在 MP-TOUTIAO 平台将 inject 放到 onMounted（该平台子组件
  // setup 早于父组件 provide），其他平台均在 setup 阶段同步 inject。Lynx 遵循 Vue
  // 标准的 setup 顺序（子组件 setup 晚于父组件 provide），因此同步 inject，
  // 避免首帧渲染时父子关系未建立导致的状态闪误（如 tabbar/sidebar 激活态、
  // cell-group 边框、avatar 层叠间距等）。
  result.parent.value = inject(key, null)

  if (result.parent.value) {
    const instance = getCurrentInstance()!
    const { link, unlink, internalChildren } = result.parent.value

    link(instance)
    onUnmounted(() => unlink(instance))

    result.index = computed(() => internalChildren.indexOf(instance))
  }

  return result
}
