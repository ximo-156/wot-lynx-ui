/*
 * wd-cascader — 级联选择
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2）：
 * - 结构：wd-action-sheet（bottom，标题经 action-sheet 顶栏）+ wd-tabs/wd-tab 多列
 *   面板，每列一个 scroll-view 选项列表，与 wot-ui 一致；
 * - 选中某一级后动态展开下一列；点到叶子节点直接 confirm；checkStrictly 模式下
 *   点击仅更新路径，经右上角确认按钮提交（按钮经 action-sheet #close 槽注入）；
 * - 异步模式（lazyLoad）：逐级加载子节点并写入缓存树，支持路径数组自动回显；
 * - 事件：@click→@tap；裸文本包 text 元素；customStyle 经 parseStyle 归一为对象
 *   （CONVENTIONS §19）；
 * - beforeConfirm 可返回未决 Promise：done 落地时经 useAlive 守卫（真机 9902 防护）。
 *
 * 注意：与旧版（popup + 常驻取消/确认头部）不同，参考源默认模式无常驻确认/取消
 * 按钮——点叶子直接确认，关闭经 action-sheet 顶栏关闭图标或蒙层；仅 checkStrictly
 * 模式注入确认按钮。测试 bugfix-regression-pickers #15（断言头部 2 个 action）按
 * 参考源语义不再成立，已在交付报告中记录。
 */
<script lang="ts" setup>
import './index.css'

import { computed, nextTick, ref, watch } from 'vue-lynx'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import WdActionSheet from '../wd-action-sheet/wd-action-sheet.vue'
import WdTabs from '../wd-tabs/wd-tabs.vue'
import WdTab from '../wd-tab/wd-tab.vue'
import WdLoading from '../../primitives/wd-loading/wd-loading.vue'
import { callInterceptor } from '../../common/interceptor'
import { useAlive } from '../../composables/useAlive'
import { deepClone, isArray, isDef, parseStyle } from '../../common/util'
import { useTranslate } from '../../composables/useTranslate'
import { cascaderProps, type CascaderExpose, type CascaderOption, type CascaderTab } from './types'

const { translate } = useTranslate('cascader')

const props = defineProps(cascaderProps)
const isAlive = useAlive()
const emit = defineEmits(['close', 'update:modelValue', 'confirm', 'update:visible'])

// 本地 wd-tabs 未 defineExpose updateLineStyle（共享层缺口），以可选方法类型承接，
// 调用处 optional chaining 守卫：未暴露时静默跳过（仅影响指示线重定位，不崩）。
const tabsRef = ref<{ updateLineStyle?: () => void }>() // tabs组件实例
const pickerShow = ref<boolean>(false) // picker弹框是否出现
const tabs = ref<CascaderTab[]>([]) // 面板状态数据
const activeTab = ref<number>(0) // 当前停留的列下标
const inited = ref<boolean>(false)
const loadingTabs = ref<number[]>([]) // 正在异步加载数据的列下标集合
const innerOptions = ref<CascaderOption[]>(deepClone(props.options as CascaderOption[])) // 内部维护的选项数据（静态 + 异步缓存）
const isRestoring = ref<boolean>(false) // 是否正在执行自动逐级恢复
let dataRequest = 0
let confirmRequest = 0

/** 获取 modelValue 对应的叶子值（单值场景取值本身，数组取最后一项）。 */
function getLeafValue(): string | number | '' {
  const { modelValue } = props
  if (isArray(modelValue)) {
    return modelValue.length > 0 ? modelValue[modelValue.length - 1] : ''
  }
  return isDef(modelValue) ? modelValue : ''
}

/** 获取 modelValue 作为路径数组。 */
function getPathValues(): (string | number)[] {
  const { modelValue } = props
  if (isArray(modelValue)) return modelValue
  return isDef(modelValue) && modelValue !== '' ? [modelValue] : []
}

/** DFS 查找某父节点的已缓存子节点。 */
function getCachedChildren(parentValue: string | number): CascaderOption[] | null {
  const { valueKey, childrenKey } = props
  function dfs(options: CascaderOption[]): CascaderOption[] | null {
    for (const option of options) {
      if (option[valueKey] === parentValue) {
        const children = option[childrenKey]
        return isArray(children) ? children : null
      }
      if (option[childrenKey] && option[childrenKey].length > 0) {
        const result = dfs(option[childrenKey])
        if (result) return result
      }
    }
    return null
  }
  return innerOptions.value.length > 0 ? dfs(innerOptions.value) : null
}

/** 将异步加载的子节点挂载到缓存树中对应父节点下。 */
function attachChildrenToTree(parentValue: string | number, children: CascaderOption[]) {
  const { valueKey, childrenKey } = props
  function dfs(options: CascaderOption[]): boolean {
    for (const option of options) {
      if (option[valueKey] === parentValue) {
        option[childrenKey] = children
        return true
      }
      if (option[childrenKey] && option[childrenKey].length > 0) {
        if (dfs(option[childrenKey])) return true
      }
    }
    return false
  }
  dfs(innerOptions.value)
}

/** 从缓存树构建 tabs 结构（静态与异步模式共用）。 */
function buildTabsFromTree() {
  const { childrenKey } = props
  if (!innerOptions.value.length) {
    tabs.value = []
    return
  }

  const leafValue = getLeafValue()
  const path = leafValue !== '' ? findPathByValue(innerOptions.value, leafValue) || [] : []
  const newTabs: CascaderTab[] = []

  for (let opts: CascaderOption[] | undefined = innerOptions.value, i = 0; opts?.length; i++) {
    const selectedOption = path[i] || null
    newTabs.push({ options: opts, selectedOption })
    opts = selectedOption?.[childrenKey]?.length ? selectedOption[childrenKey] : undefined
  }

  tabs.value = newTabs
  activeTab.value = Math.max(newTabs.length - 1, 0)
}

/** 异步模式下根据路径数组逐级调用 lazyLoad 恢复选中状态。 */
function autoRestoreFromPath(pathValues: (string | number)[]) {
  const { lazyLoad, valueKey } = props
  if (!lazyLoad || pathValues.length === 0) return

  const request = ++dataRequest
  isRestoring.value = true
  const newTabs: CascaderTab[] = []

  function restoreLevel(level: number, parentOption: CascaderOption | null) {
    const targetValue = pathValues[level]
    const isLastLevel = level === pathValues.length - 1

    // 尝试从缓存获取当前级选项
    let cachedOptions: CascaderOption[] | null = null
    if (level === 0) {
      cachedOptions = innerOptions.value.length > 0 ? innerOptions.value : null
    } else if (parentOption) {
      cachedOptions = getCachedChildren(parentOption[valueKey])
    }

    if (cachedOptions) {
      // 缓存命中
      const matched = cachedOptions.find((opt) => opt[valueKey] === targetValue)
      newTabs.push({ options: cachedOptions, selectedOption: matched || null })
      tabs.value = [...newTabs]
      activeTab.value = newTabs.length - 1

      if (!matched || isLastLevel) {
        isRestoring.value = false
        return
      }
      restoreLevel(level + 1, matched)
    } else {
      // 需要异步加载
      const tabIndex = level
      newTabs.push({ options: [], selectedOption: null })
      tabs.value = [...newTabs]
      loadingTabs.value = [...loadingTabs.value, tabIndex]

      lazyLoad!(parentOption, tabIndex, (children) => {
        if (!isAlive() || request !== dataRequest) return
        loadingTabs.value = loadingTabs.value.filter((i) => i !== tabIndex)

        // 写入缓存
        if (level === 0) {
          innerOptions.value = children
        } else if (parentOption) {
          attachChildrenToTree(parentOption[valueKey], children)
        }

        if (children.length === 0) {
          // 空数据，停止恢复
          tabs.value = newTabs.slice(0, level)
          isRestoring.value = false
          return
        }

        const matched = children.find((opt) => opt[valueKey] === targetValue)
        newTabs[tabIndex] = { options: children, selectedOption: matched || null }
        tabs.value = [...newTabs]
        activeTab.value = newTabs.length - 1

        if (!matched || isLastLevel) {
          isRestoring.value = false
          return
        }
        restoreLevel(level + 1, matched)
      })
    }
  }

  restoreLevel(0, null)
}

/** 核心逻辑：根据当前的初始值或重新传入的 source 建立 tabs 结构。 */
function buildTabs() {
  const { lazyLoad } = props
  dataRequest++
  loadingTabs.value = []
  isRestoring.value = false

  if (lazyLoad) {
    // 异步模式：先尝试从缓存树恢复
    const leafValue = getLeafValue()
    if (leafValue !== '' && innerOptions.value.length > 0) {
      const path = findPathByValue(innerOptions.value, leafValue)
      if (path) {
        buildTabsFromTree()
        return
      }
    }
    // 缓存未命中，尝试路径数组逐级加载
    const pathValues = getPathValues()
    if (pathValues.length > 0) {
      autoRestoreFromPath(pathValues)
    } else if (innerOptions.value.length > 0) {
      tabs.value = [{ options: innerOptions.value, selectedOption: null }]
      activeTab.value = 0
    } else {
      tabs.value = []
    }
    return
  }

  // 静态模式
  buildTabsFromTree()
}

/** 深度优先遍历寻找单一值对应的完整节点路径。 */
function findPathByValue(options: CascaderOption[], target: string | number): CascaderOption[] | null {
  const { valueKey, childrenKey } = props
  for (const option of options) {
    if (option[valueKey] === target) {
      return [option]
    }
    if (option[childrenKey] && option[childrenKey].length > 0) {
      const path = findPathByValue(option[childrenKey], target)
      if (path) {
        return [option, ...path]
      }
    }
  }
  return null
}

/** 当前所有被选的值的数组。 */
const selectedValues = computed(() => {
  return tabs.value.map((tab: CascaderTab) => (tab.selectedOption ? tab.selectedOption[props.valueKey] : undefined)).filter(isDef)
})

/** 当前所有被选的选项对象的数组。 */
const selectedOptions = computed(() => {
  return tabs.value.map((tab: CascaderTab) => tab.selectedOption).filter(Boolean) as CascaderOption[]
})

const canStrictConfirm = computed(() => {
  return !isRestoring.value
})

const confirmButtonText = computed(() => {
  return props.confirmText || translate('confirm')
})

// props.options 变更时同步 innerOptions 并重建静态 tabs
watch(
  () => props.options,
  (newOptions) => {
    confirmRequest++
    innerOptions.value = deepClone(newOptions as CascaderOption[])
    buildTabs()
  },
  { deep: true }
)

// modelValue 变更：静态模式直接重建；异步模式尝试缓存恢复或逐级加载
watch(
  () => props.modelValue,
  () => { confirmRequest++; buildTabs() },
  { immediate: true, deep: true }
)

watch([() => props.valueKey, () => props.textKey, () => props.childrenKey, () => props.isLeafKey, () => props.lazyLoad], () => { confirmRequest++; buildTabs() }, { flush: 'sync' })

watch(
  () => props.visible,
  (val) => {
    if (val) {
      open()
    } else {
      close()
    }
  },
  { immediate: true }
)

watch(pickerShow, (val) => {
  emit('update:visible', val)
})

/** 关闭级联选择器弹窗。 */
function close() {
  confirmRequest++
  dataRequest++
  loadingTabs.value = []
  isRestoring.value = false
  pickerShow.value = false
  handlePickerClose()
}

function open() {
  if (pickerShow.value) return
  confirmRequest++
  buildTabs()
  pickerShow.value = true
  // 异步模式：弹窗打开时，有缓存直接重建，否则加载根节点
  if (props.lazyLoad && !tabs.value.length) {
    if (innerOptions.value.length > 0) {
      // 缓存已有根节点，直接构建
      buildTabsFromTree()
    } else {
      // 无缓存，加载根节点
      tabs.value = [{ options: [], selectedOption: null }]
      loadingTabs.value = [0]
      const request = ++dataRequest
      props.lazyLoad(null, 0, (children) => {
        if (!isAlive() || request !== dataRequest) return
        innerOptions.value = children
        tabs.value = [{ options: children, selectedOption: null }]
        loadingTabs.value = loadingTabs.value.filter((i) => i !== 0)
      })
    }
  }
}

function handleEnter() {
  tabsRef.value?.updateLineStyle?.()
}

function handleLeave() {
  tabsRef.value?.updateLineStyle?.()
}

function handleAfterEnter() {
  inited.value = true
  tabsRef.value?.updateLineStyle?.()
}

function handlePickerClose() {
  confirmRequest++
  dataRequest++
  emit('close')
}

function handleAfterLeave() {
  if (!isAlive() || pickerShow.value) return
  // 异步模式利用缓存树重建 tabs，静态模式直接重建
  buildTabs()
}

function handleStrictConfirm() {
  if (!canStrictConfirm.value) return
  handleFinish()
}

/**
 * 选择某一列中的一项。
 * @param tabIndex 当前点击的列下标
 * @param index 当前点击的项下标
 */
function chooseItem(tabIndex: number, index: number) {
  const currentTab = tabs.value[tabIndex]
  const item = currentTab?.options[index]

  if (!pickerShow.value || !item || item.disabled || loadingTabs.value.includes(tabIndex)) return
  const request = ++dataRequest
  confirmRequest++

  const { childrenKey, lazyLoad, isLeafKey, valueKey, checkStrictly } = props

  // checkStrictly 模式：点击已选中的项则取消选中，并清除后续列
  if (checkStrictly && currentTab.selectedOption?.[valueKey] === item[valueKey]) {
    currentTab.selectedOption = null
    tabs.value = tabs.value.slice(0, tabIndex + 1)
    return
  }

  // 设置选中状态
  currentTab.selectedOption = item

  // 显式标识为叶子节点，直接触发 confirm
  if (item[isLeafKey] === true) {
    tabs.value = tabs.value.slice(0, tabIndex + 1)
    handleFinish()
    return
  }

  if (lazyLoad) {
    // 异步模式：先检查缓存
    const cachedChildren = getCachedChildren(item[valueKey])
    if (cachedChildren !== null) {
      // 缓存命中
      if (cachedChildren.length === 0) {
        tabs.value = tabs.value.slice(0, tabIndex + 1)
        handleFinish()
      } else {
        const nextTabs = tabs.value.slice(0, tabIndex + 1)
        nextTabs.push({ options: cachedChildren, selectedOption: null })
        tabs.value = nextTabs
        nextTick(() => {
          if (!isAlive() || request !== dataRequest || !pickerShow.value) return
          activeTab.value = tabIndex + 1
        })
      }
    } else {
      // 无缓存，异步加载
      const nextTabIndex = tabIndex + 1
      const nextTabs = tabs.value.slice(0, tabIndex + 1)
      nextTabs.push({ options: [], selectedOption: null })
      tabs.value = nextTabs
      loadingTabs.value = [...loadingTabs.value, nextTabIndex]
      nextTick(() => {
        if (!isAlive() || request !== dataRequest || !pickerShow.value) return
        activeTab.value = nextTabIndex
      })
      lazyLoad(item, nextTabIndex, (children) => {
        if (!isAlive() || request !== dataRequest) return
        loadingTabs.value = loadingTabs.value.filter((i) => i !== nextTabIndex)
        // 写入缓存
        attachChildrenToTree(item[valueKey], children)
        if (children.length === 0) {
          // 返回空数组，视为叶子节点
          tabs.value = tabs.value.slice(0, tabIndex + 1)
          handleFinish()
        } else {
          if (tabs.value[nextTabIndex]) {
            tabs.value[nextTabIndex].options = children
          }
        }
      })
    }
    return
  }

  // 静态模式：检查 children
  if (item[childrenKey] && item[childrenKey].length > 0) {
    const nextTabs = tabs.value.slice(0, tabIndex + 1)
    nextTabs.push({
      options: item[childrenKey],
      selectedOption: null
    })
    tabs.value = nextTabs
    nextTick(() => {
      if (!isAlive() || request !== dataRequest || !pickerShow.value) return
      activeTab.value = tabIndex + 1
    })
  } else {
    tabs.value = tabs.value.slice(0, tabIndex + 1)
    handleFinish()
  }
}

/** 处理确认逻辑，包含 beforeConfirm 校验。 */
function handleFinish() {
  if (!pickerShow.value) return
  const request = ++confirmRequest
  const { beforeConfirm } = props
  const values = selectedValues.value
  const options = selectedOptions.value
  const finalValue = values.length > 0 ? values[values.length - 1] : ''

  callInterceptor(beforeConfirm, {
    args: [finalValue, options],
    done: () => {
      // beforeConfirm 可返回未决 Promise：done 落地时组件可能已卸载
      if (!isAlive() || request !== confirmRequest || !pickerShow.value) return
      onConfirm(values, options)
    }
  })
}

/** 最终确认并发出 confirm 事件。 */
function onConfirm(selectedValues: (string | number)[], selectedOptions: CascaderOption[]) {
  pickerShow.value = false
  tabsRef.value?.updateLineStyle?.()
  if (props.lazyLoad) {
    // 异步模式：emit 完整路径数组
    emit('update:modelValue', selectedValues)
    emit('confirm', {
      value: selectedValues,
      selectedOptions
    })
  } else {
    // 静态模式：emit 叶子值
    const finalValue = selectedValues.length > 0 ? selectedValues[selectedValues.length - 1] : ''
    emit('update:modelValue', finalValue)
    emit('confirm', {
      value: finalValue,
      selectedOptions
    })
  }
}

/** Tabs 导航项点击回调，用于切换当前显示的列。 */
function handleTabClick({ name }: { name: number }) {
  activeTab.value = name
}

defineExpose<CascaderExpose>({
  close,
  open
})
</script>

<template>
  <view :class="['wd-cascader', customClass]" :style="parseStyle(customStyle)">
    <WdActionSheet
      v-model="pickerShow"
      :title="title || translate('title')"
      :close-on-click-modal="closeOnClickModal"
      :z-index="zIndex"
      :safe-area-inset-bottom="safeAreaInsetBottom"
      :root-portal="rootPortal"
      custom-class="wd-cascader__popup"
      @enter="handleEnter"
      @after-enter="handleAfterEnter"
      @leave="handleLeave"
      @close="handlePickerClose"
      @after-leave="handleAfterLeave"
    >
      <template v-if="checkStrictly" #close>
        <view class="wd-cascader__action">
          <view
            :class="`wd-cascader__action-confirm ${!canStrictConfirm ? 'wd-cascader__action-confirm--disabled' : ''}`"
            @tap="handleStrictConfirm"
          >
            <text>{{ confirmButtonText }}</text>
          </view>
        </view>
      </template>
      <WdTabs
        ref="tabsRef"
        :model-value="activeTab"
        slidable="always"
        :animated="inited"
        @click="handleTabClick"
        :line-width="lineWidth"
        :line-height="lineHeight"
        :line-theme="lineTheme"
      >
        <WdTab
          v-for="(tab, tabIndex) in tabs"
          :key="tabIndex"
          :title="tab.selectedOption ? tab.selectedOption[textKey] : translate('select')"
          :name="tabIndex"
          :lazy="false"
        >
          <view :class="['wd-cascader__panel', { 'is-loading': loadingTabs.includes(tabIndex) }]">
            <scroll-view :scroll-y="!loadingTabs.includes(tabIndex)" class="wd-cascader__list">
              <view
                v-for="(item, index) in tab.options"
                :key="index"
                :class="[
                  'wd-cascader__list-item',
                  { 'wd-cascader__list-item--selected': tab.selectedOption && item[valueKey] === tab.selectedOption[valueKey] },
                  { 'wd-cascader__list-item--disabled': item.disabled }
                ]"
                @tap="chooseItem(tabIndex, index)"
              >
                <view class="wd-cascader__list-item-content">
                  <view class="wd-cascader__list-item-label">
                    <text>{{ item[textKey] }}</text>
                  </view>
                  <view v-if="item[tipKey]" class="wd-cascader__list-item-tip">
                    <text>{{ item[tipKey] }}</text>
                  </view>
                </view>
                <WdIcon
                  custom-class="wd-cascader__checked"
                  name="check"
                  v-if="tab.selectedOption && item[valueKey] === tab.selectedOption[valueKey]"
                />
              </view>
            </scroll-view>
            <view v-if="loadingTabs.includes(tabIndex)" class="wd-cascader__loading">
              <WdLoading custom-class="wd-cascader__loading-icon" />
            </view>
          </view>
        </WdTab>
      </WdTabs>
    </WdActionSheet>
  </view>
</template>
