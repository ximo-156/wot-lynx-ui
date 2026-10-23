/*
 * wd-rate — 评分（原生优先重写版）
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - **滑动评分走主线程（声明式 MTS）**：每个星星项（wd-rate__item）绑定
 *   `main-thread-bindtouchstart` / `main-thread-bindtouchmove` 两个 'main thread'
 *   worklet——touchstart 时经 `MainThread.Element.invoke('boundingClientRect')`
 *   一次性度量全部星星矩形并缓入 MainThreadRef（CONVENTIONS §16：不在
 *   touchmove 热路径重复度量），touchmove 时用触点坐标按 wot-ui 的包含域
 *   公式换算评分值，并 `setStyleProperty('color')` 直改全部星星图标节点——
 *   零线程跨越，低端机跟手无滞后（CONVENTIONS §10）；
 * - **落定走后台**：根 view 的 `@touchend` / `@touchcancel`（后台绑定）
 *   用同一公式由 changedTouches 坐标重算终值并 commit（update:modelValue
 *   + change），提交逻辑（含 readonly / disabled 守卫）留在后台、可单测；
 * - **分工边界**：move 跟手走主线程（item 上的 worklet）、end 落定走后台
 *   （root 上的 @touchend）——同名事件不双绑；根 view 的后台 `@touchmove`
 *   转发原生事件并按官方每次 move 提交 update:modelValue + change；
 *   已有 move 提交时 end 不重复，仅为缺失冒泡的宿主保留落定恢复；
 * - **真机冒泡语义**：手指在星星项上按下后，touchmove / touchend 目标固定
 *   为该星星项并向上冒泡到根 view，故根 view 的后台处理器可收到提交事件
 *   （jsdom 不模拟冒泡，测试中直接派发到根元素验证，同 slider 范本）；
 *   手势起始于星星间隙（根 view 自身）时主线程 worklet 不参与，仅有落定
 *   提交、无跟手反馈（间隙约 4px，属可接受边界）；
 * - **颜色直改与渲染的一致性**：worklet 直改的 color 与后台渲染下发的
 *   custom-style color 取同一组表达式（prop 显式色或 --wot-rate-* 令牌
 *   var() 链，与 index.scss 类声明逐值一致），且后台每次渲染都对全部星星
 *   写完整颜色键集（CONVENTIONS §20：省略键等于保留旧值），保证拖拽后的
 *   程序化改值不被 worklet 的直改值残留污染；
 * - worklet 捕获的 itemRefs / starRefs / halfRefs / geomRef 为 setup 期
 *   创建的稳定数组与 MainThreadRef（就地增删件，替换数组引用会脱离 worklet
 *   的 _c 捕获）；num / allowHalf / readonly / disabled / 颜色经
 *   根元素属性实时读取，运行期变化无需重建实例；
 * - wot-ui 默认图标 star-fill 在本地 iconfont 集中无对应字形，解析不到时
 *   回退到同语义的 favorite-filling（实心星），props 默认值仍保持 'star-fill'
 *   与参考源一致；
 * - `:not(:last-child)` 的项间距无 Lynx 兄弟选择器等价物，改为按索引输出的
 *   内联 margin-right（末项为 0），默认值经 var(--wot-rate-item-space, 4px)
 *   表达以保留 CSS 变量定制能力；
 * - `display: inline-block` → display: flex + row；`touch-action` /
 *   `cursor` / `-webkit-background-clip` 等 Web 专有属性删除；
 * - 半星用左半裁剪容器叠加（overflow: hidden + width: 50%）；
 * - customStyle 经 parseStyle 归一为对象（CONVENTIONS §19）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, ref, watch, useMainThreadRef } from 'vue-lynx'
import type { MainThreadRef } from 'vue-lynx'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import { rateProps } from './types'
import { addUnit, getRect, isDef, parseStyle, uuid } from '../../common/util'
import { resolveIcon } from '../../icons/registry'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(rateProps)
const emit = defineEmits(['update:modelValue', 'change', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'tap'])
const isDisabled = useFormDisabled(props)
const isAlive = useAlive()
const { proxy } = getCurrentInstance() as any

/**
 * wot-ui 默认图标 star-fill 在本地 iconfont 集中无对应字形，
 * 解析不到时回退到同语义的 favorite-filling（实心星）。
 * css-icon 模式下 name 是 CSS 类名而非注册表名字，不做回退。
 */
const ICON_FALLBACK = 'favorite-filling'

function resolveIconName(name: string): string {
  if (!name || props.cssIcon) return name
  return resolveIcon(name) ? name : ICON_FALLBACK
}

/**
 * 星星颜色回退链：与 index.scss 中 `.wd-rate__item-star` /
 * `--active` 两条类规则的编译产物逐值一致（var() 链 + 字面量兜底），
 * 供后台渲染与主线程 worklet 共用——消费者经 --wot-rate-color /
 * --wot-rate-active-color 令牌的定制在两个线程同时生效。
 */
const ACTIVE_COLOR_FALLBACK =
  'var(--wot-rate-active-color, var(--wot-classifyapplication-yellow-content, var(--wot-yellow-6, #faad14)))'
const INACTIVE_COLOR_FALLBACK =
  'var(--wot-rate-color, var(--wot-filled-extra-strong, var(--wot-coolgrey-4, #c9cbd4)))'

/** 分段激活色的取色规则（与 wot-ui 的 iconActiveStyle 一致） */
function pickActiveColor(value: number): string {
  const { activeColor } = props
  if (Array.isArray(activeColor)) {
    if (activeColor.length === 0) {
      console.error('activeColor cannot be an empty array')
      return ACTIVE_COLOR_FALLBACK
    }
    return Number(value) <= props.num * 0.6 || !activeColor[1] ? activeColor[0] : activeColor[1]
  }
  return activeColor || ACTIVE_COLOR_FALLBACK
}

/** 未激活色（color prop 或令牌回退链） */
function pickInactiveColor(): string {
  return props.color || INACTIVE_COLOR_FALLBACK
}

const rateList = ref<Array<string>>([])

/** 星星矩形缓存（left/right/width），挂载后与 num/space 变化时刷新——后台落定重算用 */
const itemRects = ref<Array<{ left: number; right: number; width: number }>>([])

/**
 * 是否已在当前「几何代次」内发起过度量。
 * 度量不可用（宿主无 createSelectorQuery / 节点未渲染 / all 模式返回 []）时
 * itemRects 恒为空数组，若无该标志，onTouchEnd 会在每次触摸结束都发起
 * 一次跨线程 SelectorQuery（CONVENTIONS §16 明令禁止）。num/space 变化会
 * 重置该标志（几何失效，需重新度量）。
 */
const rectsRequested = ref(false)

// ---------- 主线程（MTS）引用 ----------
/**
 * 主线程元素桩类型（worklet 内经 .current 取用）。
 * 与 @lynx-js/types 的 MainThread.Element 对齐的常用子集。
 */
interface MtElement {
  setStyleProperty(name: string, value: string): void
  getAttribute(name: string): string | null
  invoke(method: string, params?: any): Promise<any>
}

/**
 * 星星项 / 主星 / 半星的主线程引用（元素桩经 .current 取用）。
 *
 * 三个数组在 setup 期创建、之后只做**就地增删件**（push / pop）——生产构建
 * 的 SWC worklet 转换把数组引用捕获进 worklet 的 _c，替换数组引用会脱离
 * 捕获；主线程派发时 _c 内的数组成员被逐个解析成 refMap 条目，
 * `refs[i].current` 即主线程元素桩（与 slider 的单引用捕获同机制）。
 */
type MtRef = MainThreadRef<MtElement | null>

const itemRefs: MtRef[] = []
const starRefs: MtRef[] = []
const halfRefs: MtRef[] = []

/** 按星星数量同步引用池（num 变化时保留已有引用，仅增删差额） */
function syncRefs(count: number) {
  while (itemRefs.length > count) {
    itemRefs.pop()
    starRefs.pop()
    halfRefs.pop()
  }
  while (itemRefs.length < count) {
    itemRefs.push(useMainThreadRef<MtElement | null>(null))
    starRefs.push(useMainThreadRef<MtElement | null>(null))
    halfRefs.push(useMainThreadRef<MtElement | null>(null))
  }
}

syncRefs(props.num)

watch(
  () => props.num,
  (num) => {
    syncRefs(num)
  }
)

/** 几何快照 { rects, count, lastValue }（worklet 内 .current 活值） */
const geomRef = useMainThreadRef<{ rects: any[]; count: number; lastStyle: string | null } | null>(null)

const rateRef = useMainThreadRef<MtElement | null>(null)
const activeColorA = computed(() => pickActiveColor(0))
const activeColorB = computed(() => {
  const { activeColor } = props
  return Array.isArray(activeColor) && activeColor.length ? activeColor[1] || activeColor[0] : activeColorA.value
})
const inactiveColor = computed(() => pickInactiveColor())
let rectRequest = 0
let interactionRequest = 0
let gestureMoved = false
const rateId = `wd-rate-${uuid()}`
let pendingRects: Promise<void> | undefined
function onRootTouchStart(event: any) {
  emit('touchstart', event)
  interactionRequest++
  gestureMoved = false
  refreshRects(true)
}
watch([() => props.modelValue, () => props.readonly, isDisabled, () => props.allowHalf, () => props.num], () => { interactionRequest++ }, { flush: 'sync' })

const iconSize = computed(() => {
  if (isDef(props.size)) {
    return `font-size: ${addUnit(props.size)};`
  }
  return ''
})

/** 主星内联样式：按当前值取激活/未激活色（键集恒完整，CONVENTIONS §20） */
const starColorStyle = computed(() => `color: ${pickActiveColor(Number(props.modelValue))};`)
/** 未激活色内联样式（主星未满 / 半星未及半） */
const inactiveColorStyle = computed(() => `color: ${pickInactiveColor()};`)

/** 主星 custom-style（wot-ui 同款字符串形态，经 wd-icon 的 parseStyle 归一） */
function starCustomStyle(rate: string): string {
  const color = rate === '100%' ? starColorStyle.value : inactiveColorStyle.value
  return iconSize.value ? `${color} ${iconSize.value}` : color
}

/** 半星 custom-style：非 '0' 即激活（wot-ui 语义） */
function halfCustomStyle(rate: string): string {
  const color = rate !== '0' ? starColorStyle.value : inactiveColorStyle.value
  return iconSize.value ? `${color} ${iconSize.value}` : color
}

watch(
  [() => props.num, () => props.modelValue, () => props.allowHalf],
  () => {
    computeRateList()
  },
  {
    immediate: true,
    deep: true
  }
)

watch([() => props.num, () => props.space, () => props.size, () => props.block], () => {
  refreshRects(true)
})

onMounted(() => {
  refreshRects(true)
})

// 当前选项是否为激活状态
const isActive = (rate: string) => {
  return rate !== '0'
}

const rootClass = computed(() => {
  const classes = ['wd-rate']
  if (isDisabled.value) classes.push('is-disabled')
  if (props.block) classes.push('is-block')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

/** 根节点样式：customStyle 经 parseStyle 归一为对象（CONVENTIONS §19） */
const rootStyle = computed(() => parseStyle(props.customStyle))

/**
 * 项间距：wot-ui 用 `.wd-rate__item:not(:last-child) { margin-right }`，
 * Lynx 无兄弟/伪类选择器，改为按索引输出内联 margin-right（末项为 0）。
 * 未传 space 时取 var(--wot-rate-item-space, 4px)，与 SCSS 令牌默认值等价，
 * 消费者经 CSS 变量定制依然生效。
 */
function itemStyle(index: number): Record<string, string> {
  const isLast = index === rateList.value.length - 1
  const space = isDef(props.space) ? addUnit(props.space) : 'var(--wot-rate-item-space, 4px)'
  return { 'margin-right': isLast ? '0' : space }
}

function computeRateList() {
  const { modelValue, num, allowHalf } = props
  // value和num都准备好才能计算
  if (modelValue === null || !num) { rateList.value = []; return }
  if (typeof modelValue !== 'number') {
    console.error('[wot ui] error(wd-rate): the value of wd-rate should be a number')
    return
  }
  const tempRateList: string[] = []
  const fullLength = Math.floor(modelValue)
  for (let i = 0; i < num; i++) {
    if (i < fullLength) {
      tempRateList.push('100%')
    } else if (i === fullLength && allowHalf && modelValue % 1 !== 0) {
      tempRateList.push('50%')
    } else {
      tempRateList.push('0')
    }
  }
  rateList.value = tempRateList
}

/**
 * 刷新星星矩形缓存。
 * @param force 几何失效（num/space 变化、挂载）时强制重新度量；
 *   缺省为非强制——触摸落定路径下每个代次最多尝试一次，
 *   避免度量不可用时每次 touchend 都发起跨线程查询。
 */
function refreshRects(force = false): Promise<void> {
  if (force) { rectsRequested.value = false; itemRects.value = [] }
  if (rectsRequested.value) return pendingRects || Promise.resolve()
  const request = ++rectRequest
  rectsRequested.value = true
  pendingRects = getRect(`#${rateId} .wd-rate__item`, true, proxy).then((rects) => {
    if (!isAlive() || request !== rectRequest) return
    itemRects.value = Array.isArray(rects) ? rects.slice(0, props.num) : []
  })
  return pendingRects
}

function handleClick(index: number, isHalf: boolean) {
  interactionRequest++
  const { readonly, clearable, allowHalf, modelValue } = props
  if (readonly || isDisabled.value) return
  let value = isHalf ? index + 0.5 : index + 1
  // 点击清空逻辑：当点击的值与当前modelValue相等且等于最小值时允许清空
  if (clearable) {
    const minValue = allowHalf ? 0.5 : 1
    if (value === modelValue && value === minValue) {
      value = 0
    }
  }
  updateValue(value)
}

/**
 * 设置评分值并触发事件
 */
function updateValue(value: number) {
  emit('update:modelValue', value)
  emit('change', {
    value
  })
}

/**
 * 触点横坐标 → 评分值（wot-ui 包含域公式：找触点落入的星星项，
 * 不在任何星星项内返回 null——不更新、保持原值）。
 * 主线程 worklet 的跟手判定与后台 touchend 落定共用同一公式。
 */
function valueFromRects(clientX: number, rects: Array<{ left: number; right: number; width: number }>): number | null {
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i]
    if (clientX >= rect.left && clientX <= rect.right) {
      const isHalf = props.allowHalf && clientX - rect.left < rect.width / 2
      return isHalf ? i + 0.5 : i + 1
    }
  }
  return null
}

/**
 * 根 view 触摸移动（后台）：仅转发原生事件。
 *
 * 跟手改样式已由星星项上的主线程 worklet 完成（零线程跨越），后台不再
 * 回传值；值模型与 wd-slider 一致——拖动期间只跟手、@touchend 才落定。
 * 声明并转发 'touchmove' 供消费方监听（CONVENTIONS §14：根绑 touch 的
 * 组件必须把事件名声明为 emit 并转发，避免消费方监听穿透 $attrs 与根
 * 元素同名监听合并击穿事件注册表）。
 */
async function onTouchMove(event: any) {
  emit('touchmove', event)
  gestureMoved = true
  await commitFromEvent(event)
}

/**
 * 根 view 触摸结束（后台）：同一公式重算终值并 commit。
 *
 * 真机上手指在星星项上按下后 touchend 冒泡到根 view；jsdom 不模拟冒泡，
 * 测试中直接派发到根元素验证（同 slider 的 dragmove 冒泡验证方式）。
 */
async function onTouchEnd(event: any) {
  emit('touchend', event)
  if (!gestureMoved) await commitFromEvent(event)
  gestureMoved = false
}

/**
 * 根 view 触摸取消（后台）：与 touchend 同一公式落定。
 *
 * 手势被系统取消（来电、通知打断等）时 Lynx 派发 touchcancel 而非
 * touchend，若不落定则跟手期间 worklet 直改的星星颜色与值模型不一致
 * （直至下一次重渲染才被后台颜色写回纠正）——同 slider 的 touchcancel
 * 处理。
 */
async function onTouchCancel(event: any) {
  emit('touchcancel', event)
  if (!gestureMoved) await commitFromEvent(event)
  gestureMoved = false
}

/** 触摸落定：同一包含域公式由 changedTouches 坐标重算终值并 commit */
async function commitFromEvent(event: any) {
  if (props.readonly || isDisabled.value) return
  const request = ++interactionRequest
  const clientX = Number(event.changedTouches?.[0]?.clientX ?? event.touches?.[0]?.clientX ?? event.detail?.x ?? 0)
  if (!itemRects.value.length) {
    await refreshRects()
  }
  if (!isAlive() || props.readonly || isDisabled.value || request !== interactionRequest || !Number.isFinite(clientX)) return
  const value = valueFromRects(clientX, itemRects.value)
  if (value !== null) {
    updateValue(value)
  }
}

// ---------- 主线程 worklet（跟手，零线程跨越） ----------
/*
 * 触摸开始（主线程）：一次性度量全部星星项矩形并缓入 geomRef。
 *
 * 度量挂在星星项上（手势目标元素）：同一 worklet 经 itemRefs 数组度量
 * 全部项，与后台 @touchend 落定用的 getRect('.wd-rate__item') 度量同一
 * 批节点，两个线程用同一公式、同一几何，跟手与落定结果一致。
 */
const onItemTouchStart = () => {
  'main thread'
  const items = itemRefs
  const root = rateRef.current
  if (!root || root.getAttribute('gesture-disabled') === 'true' || root.getAttribute('gesture-readonly') === 'true') { geomRef.current = null; return }
  const count = Number(root.getAttribute('gesture-count')) || 0
  const rects: any[] = []
  for (let i = 0; i < count; i++) {
    const el = items[i] && items[i].current
    if (el && typeof el.invoke === 'function') {
      el.invoke('boundingClientRect').then((rect: any) => {
        rects[i] = { left: rect.left, right: rect.right, width: rect.width }
      })
    }
  }
  geomRef.current = { rects, count, lastStyle: null }
}

/*
 * 触摸移动（主线程）：包含域公式换算评分值 + 星星颜色直改。
 *
 * 与后台落定共用 wot-ui 的包含域公式（找触点落入的星星项；不在任何项内
 * 不更新），再按值推导每颗星的满 / 半状态，setStyleProperty('color')
 * 直改主星与半星图标节点；值与上一帧相同（lastValue）时跳过直改。
 */
const onItemTouchMove = (event: any) => {
  'main thread'
  const root = rateRef.current
  if (!root || root.getAttribute('gesture-readonly') === 'true' || root.getAttribute('gesture-disabled') === 'true') return
  const cfgAllowHalf = root.getAttribute('gesture-half') === 'true'
  const cfgNum = Number(root.getAttribute('gesture-count')) || 0
  const cfgActiveColorA = root.getAttribute('gesture-active-a') || ''
  const cfgActiveColorB = root.getAttribute('gesture-active-b') || cfgActiveColorA
  const cfgInactiveColor = root.getAttribute('gesture-inactive') || ''
  const geom = geomRef.current
  if (!geom || !geom.count || geom.count !== cfgNum) return
  const touch = event.touches && event.touches[0]
  if (!touch) return
  const x = touch.clientX

  let index = -1
  for (let i = 0; i < geom.count; i++) {
    const rect = geom.rects[i]
    if (!rect) continue
    if (x >= rect.left && x <= rect.right) {
      index = i
      break
    }
  }
  if (index === -1) return

  const rect = geom.rects[index]
  const isHalf = cfgAllowHalf && x - rect.left < rect.width / 2
  const value = isHalf ? index + 0.5 : index + 1
  const styleKey = [value, cfgAllowHalf, cfgActiveColorA, cfgActiveColorB, cfgInactiveColor].join('|')
  if (geom.lastStyle === styleKey) return
  geom.lastStyle = styleKey

  // 分段激活色按跟手值实时选取（与后台 iconActiveStyle 同规则）
  const active = value <= cfgNum * 0.6 ? cfgActiveColorA : cfgActiveColorB
  for (let j = 0; j < geom.count; j++) {
    const star = starRefs[j] && starRefs[j].current
    if (star) star.setStyleProperty('color', value >= j + 1 ? active : cfgInactiveColor)
    const halfEl = halfRefs[j] && halfRefs[j].current
    if (halfEl) halfEl.setStyleProperty('color', value >= j + 0.5 ? active : cfgInactiveColor)
  }
}
</script>

<template>
  <view :id="rateId" :class="rootClass" :style="rootStyle" :main-thread-ref="rateRef" :gesture-count="String(num)" :gesture-half="String(allowHalf)" :gesture-readonly="String(readonly)" :gesture-disabled="String(isDisabled)" :gesture-active-a="activeColorA" :gesture-active-b="activeColorB" :gesture-inactive="inactiveColor" @tap="emit('tap', $event)" @touchstart="onRootTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchCancel">
    <view
      v-for="(rate, index) in rateList"
      :key="index"
      class="wd-rate__item"
      :style="itemStyle(index)"
      :main-thread-ref="itemRefs[index]"
      :main-thread-bindtouchstart="onItemTouchStart"
      :main-thread-bindtouchmove="onItemTouchMove"
    >
      <WdIcon
        :custom-class="`wd-rate__item-star ${rate === '100%' ? 'wd-rate__item-star--active' : ''}`"
        :name="resolveIconName(isActive(rate) ? activeIcon : icon)"
        :class-prefix="iconPrefix"
        :css-icon="cssIcon"
        :custom-style="starCustomStyle(rate)"
        :main-thread-ref="starRefs[index]"
        @tap="handleClick(index, false)"
      />
      <view v-if="allowHalf" class="wd-rate__item-half" @tap.stop="handleClick(index, true)">
        <WdIcon
          :custom-class="`wd-rate__item-star ${rate !== '0' ? 'wd-rate__item-star--active' : ''}`"
          :name="resolveIconName(isActive(rate) ? activeIcon : icon)"
          :class-prefix="iconPrefix"
          :css-icon="cssIcon"
          :custom-style="halfCustomStyle(rate)"
          :main-thread-ref="halfRefs[index]"
        />
      </view>
    </view>
  </view>
</template>
