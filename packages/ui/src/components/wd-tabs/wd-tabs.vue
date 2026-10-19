/*
 * wd-tabs — 选项卡
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 结构：sticky 分支（wd-sticky-box + wd-sticky）与非 sticky 分支的节点层级、
 *   类名、分支顺序与参考源一致；子 wd-tab 经 useChildren/useParent 注册
 *   （TABS_KEY 提供 state/props），激活索引由 state.activeIndex 维护；
 * - 【导航项数据源】参考源模板直接 v-for 子组件实例数组（useChildren 的
 *   children）：子组件 link 发生在父组件挂载阶段（晚于父级首帧渲染），
 *   首帧导航为空、指示线与地图按钮晚一帧出现；且模板读子组件
 *   badgeProps（对象 prop）会跟踪子组件 props，消费方插槽里的对象字面量
 *   每次重渲染写回即触发父级重渲染 → 无限循环（CONVENTIONS §13）。
 *   故导航项改从默认插槽的 vnode 直读（非跟踪读取），首帧即可渲染，
 *   选中 / 禁用 / 地图 / 滑动阈值等逻辑的数据来源与参考源完全一致；
 * - 事件：@click → @tap（CONVENTIONS §6）；scroll-with-animation /
 *   show-scrollbar / enhanced 为 uni-app 专有属性（Lynx scroll-view 不支持，
 *   程序化定位瞬时生效），删除；
 * - 样式：参考源以 objToStyle 拼字符串后绑定（state.lineStyle /
 *   mapHeaderStyle / bodyStyle / map-body 的 display:none），Lynx 的字符串
 *   :style 会被静默丢弃（CONVENTIONS §19），全部改为对象语法，并经
 *   Style Funnel（defineStyleKeys + resolveStyle）输出完整键集，避免
 *   「省略键 → 上一帧值残留」（§20：line 的 display、body 的 left/
 *   transition-duration、map 的 display/opacity 均会随状态翻转）；
 * - 导航地图按钮的 ::before 渐变遮罩（linear-gradient，Web 专有）与
 *   when(hide-scrollbar) 的 ::-webkit-scrollbar 删除；map-header 的
 *   &::after { z-index: 3 } 为伪元素规则，删除；
 * - map-nav-item 的 :nth-child(3n) / :nth-last-child(-n+3) 结构伪类 Lynx
 *   不支持，改为 map-body 容器 gap + flex-basis 计算（三列等分、行列同距，
 *   语义等价，PORTING §4.5）；
 * - 指示线宽度/位置经 getRect 一次性度量（切换时），touchmove 热路径不度量
 *   （CONVENTIONS §16）；度量回调经 useAlive 守卫（真机 9902 防护）；
 * - color / inactiveColor 经内联样式下发（与参考源一致），为 prop 驱动的
 *   单向样式：prop 由有值改为空值时内联色不会自动清除（Lynx SET_STYLE 为
 *   逐属性合并，无「未设置」中立值可写），与 wot-ui 行为相同；
 * - 箭头图标：参考源传 name="down"，本地内置图标集无该字形，映射到
 *   arrow-down-bold（CONVENTIONS §8）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, nextTick, onMounted, reactive, useSlots, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdBadge from '../wd-badge/wd-badge.vue'
import WdSticky from '../wd-sticky/wd-sticky.vue'
import WdStickyBox from '../wd-sticky-box/wd-sticky-box.vue'
import { addUnit, checkNumRange, debounce, getRect, isDef, isNumber, isString, parseStyle, type CSSProperties } from '../../common/util'
import { useTouch } from '../../composables/useTouch'
import { TABS_KEY, tabsProps, type TabsExpose } from './types'
import { useChildren } from '../../composables/useChildren'
import { useTranslate } from '../../composables/useTranslate'
import { useAlive } from '../../composables/useAlive'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const $item = '.wd-tabs__nav-item'
const $itemText = '.wd-tabs__nav-item-text'
const $container = '.wd-tabs__nav-container'

const props = defineProps(tabsProps)
const emit = defineEmits(['change', 'disabled', 'click', 'update:modelValue'])

const { translate } = useTranslate('tabs')

/** 组件存活守卫：getRect 回调晚于卸载落地时丢弃（真机 9902 防护） */
const isAlive = useAlive()

/**
 * 指示线可切换的全部样式键 + 中性值（CONVENTIONS §20）。
 *
 * 中性值取 `.wd-tabs__line` 类声明的默认值（normal 主题、未传 lineHeight），
 * 使「JS 未下发的键」与「类样式生效」视觉一致；display 的中性值为 linear
 * （Lynx view 的默认布局，等同不设置），可见态同样写 linear —— 参考源
 * 只在隐藏时写 display:none，Lynx 的逐属性合并语义下必须显式写回可见值，
 * 否则上一帧的 none 会残留（同类缺陷参见 wd-transition 的 display）。
 */
const LINE_STYLE = defineStyleKeys({
  display: 'linear',
  width: 'var(--wot-tabs-nav-line-width, var(--wot-n-24, 24px))',
  height: 'var(--wot-tabs-nav-line-height, var(--wot-n-4, 4px))',
  'border-radius': 'calc(var(--wot-tabs-nav-line-height, var(--wot-n-4, 4px)) / 2)',
  transform: 'translateX(0px)',
  transition: 'none'
})

const state = reactive({
  /** 选中值的索引，默认第一个 */
  activeIndex: 0,
  /** 激活项边框线样式（对象语法；display:none 为未度量前的初始态） */
  lineStyle: resolveStyle(LINE_STYLE, { display: 'none' }),
  /** 是否使用内部激活项边框线，当外部激活下划线未成功渲染时显示内部定位的 */
  useInnerLine: false,
  /** 是否初始化 */
  inited: false,
  /** 是否动画中 */
  animating: false,
  /** map的开关 */
  mapShow: false,
  /** scroll-view偏移量 */
  scrollLeft: 0
})

const { children, linkChildren } = useChildren(TABS_KEY)
linkChildren({ state, props })

const { proxy } = getCurrentInstance() as any

const slots = useSlots()

const touch = useTouch()

/** 导航项数据（从默认插槽的 vnode 直读，非跟踪读取，见文件头说明） */
type NavItem = { title: any; disabled: boolean; badgeProps: any; name: any }

function navItems(): NavItem[] {
  const vnodes = slots.default ? slots.default() : []
  const items: NavItem[] = []
  for (const vnode of vnodes as any[]) {
    const p = vnode && vnode.props
    if (!p) continue
    items.push({
      title: p.title,
      disabled: Boolean(p.disabled),
      badgeProps: p.badgeProps,
      name: p.name
    })
  }
  return items
}

/**
 * 内部是否可滑动（与参考源 computed 语义一致；取导航项数量，首帧即可判定）
 */
function innerSlidable(): boolean {
  return props.slidable === 'always' || navItems().length > props.slidableNum
}

/**
 * 是否显示导航地图（与参考源 computed 语义一致）
 */
function showMap(): boolean {
  return props.mapNum < navItems().length && props.mapNum !== 0
}

/** map 头部样式：display / opacity 键集完整（Style Funnel） */
const MAP_HEADER_STYLE = defineStyleKeys({ display: 'linear', opacity: '0' })

const mapHeaderStyle = computed(() =>
  resolveStyle(MAP_HEADER_STYLE, {
    display: state.mapShow ? 'linear' : 'none',
    opacity: state.animating ? '1' : undefined
  })
)

/** map 内容样式：display 键集完整（Style Funnel）；可见态与类样式的 flex 一致 */
const MAP_BODY_STYLE = defineStyleKeys({ display: 'flex' })

const mapBodyStyle = computed(() =>
  resolveStyle(MAP_BODY_STYLE, {
    display: state.mapShow ? 'flex' : 'none'
  })
)

/** body 样式：left / transition-duration 键集完整（Style Funnel） */
const BODY_STYLE = defineStyleKeys({ left: '0%', 'transition-duration': '0ms' })

const bodyStyle = computed(() =>
  resolveStyle(
    BODY_STYLE,
    props.animated
      ? {
          left: `${-100 * state.activeIndex}%`,
          'transition-duration': `${props.duration}ms`
        }
      : undefined
  )
)

/**
 * 获取 tab 的 name
 * @param tab tab实例
 * @param index 索引
 */
const getTabName = (tab: any, index: number) => {
  return isDef(tab.name) ? tab.name : index
}

/**
 * 获取 tab item 的样式
 * @param index 索引
 */
const getTabItemStyle = (index: number) => {
  const { color, inactiveColor } = props
  const style: CSSProperties = {}
  if (state.activeIndex === index) {
    if (color) {
      style.color = color
    }
  } else {
    if (inactiveColor) {
      style.color = inactiveColor
    }
  }
  return style
}

/**
 * 获取 map tab 的样式
 * @param index 索引
 */
const getMapTabStyle = (index: number) => {
  const { color, inactiveColor } = props
  const style: CSSProperties = {}
  if (state.activeIndex === index) {
    if (color) {
      style.color = color
      style.borderColor = color
    }
  } else {
    if (inactiveColor) {
      style.color = inactiveColor
    }
  }
  return style
}

/**
 * 更新激活项
 * @param value 激活值
 * @param init 是否已初始化
 * @param setScroll 是否设置scroll-view滚动
 */
const updateActive = (value: number | string = 0, init: boolean = false, setScroll: boolean = true) => {
  // 没有tab子元素，不执行任何操作
  if (children.length === 0) return

  value = getActiveIndex(value)
  // 被禁用，不执行任何操作
  if (children[value].disabled) return
  state.activeIndex = value
  if (setScroll) {
    updateLineStyle(init === false)
    scrollIntoView()
  }
  setActiveTab()
}

/**
 * 修改选中的 tab Index
 * @param {string | number} value 绑定值或 tab 索引，默认值 0
 * @param {boolean} init 是否伴随初始化操作
 */
const setActive = debounce(updateActive, 100, { leading: true })

watch(
  () => props.modelValue,
  (newValue) => {
    const index = getActiveIndex(newValue)
    setActive(newValue, false, index !== state.activeIndex)
  },
  {
    immediate: false,
    deep: true
  }
)

watch(
  () => props.slidableNum,
  (newValue) => {
    checkNumRange(newValue, 'slidableNum')
  }
)

watch(
  () => props.mapNum,
  (newValue) => {
    checkNumRange(newValue, 'mapNum')
  }
)

onMounted(() => {
  state.inited = true
  nextTick(() => {
    updateActive(props.modelValue, true)
    state.useInnerLine = true
  })
})

/**
 * 切换 map 显示状态
 */
function toggleMap() {
  if (state.mapShow) {
    state.animating = false
    setTimeout(() => {
      state.mapShow = false
    }, 300)
  } else {
    state.mapShow = true
    setTimeout(() => {
      state.animating = true
    }, 100)
  }
}

/**
 * 更新 underline 的偏移量
 * @param {boolean} animation 是否开启动画
 */
async function updateLineStyle(animation: boolean = true) {
  if (!state.inited) return
  const { lineWidth, lineHeight, lineTheme } = props
  try {
    const lineStyle: CSSProperties = {}
    if (isDef(lineWidth)) {
      lineStyle.width = addUnit(lineWidth)
    } else {
      if (lineTheme === 'text') {
        const textRects = await getRect($itemText, true, proxy)
        const textWidth = Number(textRects[state.activeIndex].width)
        lineStyle.width = addUnit(textWidth)
      } else if (lineTheme === 'underline') {
        const rects = await getRect($item, true, proxy)
        const rectWidth = Number(rects[state.activeIndex].width)
        lineStyle.width = addUnit(rectWidth)
      }
    }
    if (isDef(lineHeight)) {
      lineStyle.height = addUnit(lineHeight)
      lineStyle.borderRadius = `calc(${addUnit(lineHeight)} / 2)`
    }
    const rects = await getRect($item, true, proxy)
    if (!isAlive()) return
    const rect = rects[state.activeIndex]
    let left = rects.slice(0, state.activeIndex).reduce((prev: number, curr: any) => prev + Number(curr.width), 0) + Number(rect.width) / 2
    if (left) {
      lineStyle.transform = `translateX(${left}px) translateX(-50%)`
      if (animation) {
        lineStyle.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }
      state.useInnerLine = false
      // 对象语法 + Style Funnel：display 由 none 切换为可见时必须显式写回
      // linear（Lynx view 的默认布局），否则上一帧的 display:none 会残留
      // （SET_STYLE 为逐属性合并）
      state.lineStyle = resolveStyle(LINE_STYLE, { ...lineStyle, display: 'linear' })
    }
  } catch (error) {
    console.error('[wot ui] error(wd-tabs): update line style failed', error)
  }
}

/**
 * 设置激活的 tab
 */
function setActiveTab() {
  if (!state.inited) return
  const name = getTabName(children[state.activeIndex], state.activeIndex)
  if (name !== props.modelValue) {
    emit('change', {
      index: state.activeIndex,
      name: name
    })
    emit('update:modelValue', name)
  }
}

/**
 * 滚动到视图
 */
function scrollIntoView() {
  if (!state.inited) return
  Promise.all([getRect($item, true, proxy), getRect($container, false, proxy)]).then(([navItemsRects, navRect]) => {
    if (!isAlive()) return
    // 选中元素
    const selectItem = navItemsRects[state.activeIndex]
    if (!selectItem) return
    // 选中元素之前的节点的宽度总和
    const offsetLeft = (navItemsRects as any).slice(0, state.activeIndex).reduce((prev: any, curr: any) => prev + curr.width, 0)
    // scroll-view滑动到selectItem的偏移量
    const left = offsetLeft - ((navRect as any).width - Number(selectItem.width)) / 2
    if (left === state.scrollLeft) {
      state.scrollLeft = left + Math.random() / 10000
    } else {
      state.scrollLeft = left
    }
  })
}

/**
 * 单击 tab 的处理
 * @param index 索引
 */
function handleSelect(index: number) {
  if (index === undefined) return
  const item = navItems()[index]
  const name = getTabName(item, index)

  if (item.disabled) {
    emit('disabled', {
      index,
      name
    })
    return
  }
  state.mapShow && toggleMap()
  setActive(index)
  emit('click', {
    index,
    name
  })
}
function onTouchStart(event: any) {
  if (!props.swipeable) return
  touch.touchStart(event)
}
function onTouchMove(event: any) {
  if (!props.swipeable) return
  touch.touchMove(event)
}
function onTouchEnd() {
  if (!props.swipeable) return
  const { direction, deltaX, offsetX } = touch
  const minSwipeDistance = 50
  if (direction.value === 'horizontal' && offsetX.value >= minSwipeDistance) {
    if (deltaX.value > 0 && state.activeIndex !== 0) {
      setActive(state.activeIndex - 1)
    } else if (deltaX.value < 0 && state.activeIndex !== navItems().length - 1) {
      setActive(state.activeIndex + 1)
    }
  }
}

/**
 * 获取激活的索引
 * @param {number | string} value 绑定值
 */
function getActiveIndex(value: number | string) {
  const items = navItems()
  // name代表的索引超过了children长度的边界，自动用0兜底
  if (isNumber(value) && value >= items.length) {
    console.error("[wot ui] warning(wd-tabs): the type of tabs' value is Number shouldn't be less than its children")
    value = 0
  }
  // 如果是字符串直接匹配，匹配不到用0兜底
  if (isString(value)) {
    const index = items.findIndex((item) => item.name === value)
    value = index === -1 ? 0 : index
  }

  return value
}

defineExpose<TabsExpose>({
  setActive,
  scrollIntoView,
  updateLineStyle
})
</script>

<template>
  <template v-if="sticky">
    <wd-sticky-box>
      <view
        :class="`wd-tabs ${customClass} ${innerSlidable() ? 'is-slide' : ''} ${showMap() ? 'is-map' : ''} ${
          !showScrollbar ? 'is-hide-scrollbar' : ''
        }`"
        :style="parseStyle(customStyle)"
      >
        <wd-sticky :offset-top="offsetTop">
          <view class="wd-tabs__nav wd-tabs__nav--sticky">
            <view class="wd-tabs__nav--wrap">
              <scroll-view :scroll-x="innerSlidable()" :scroll-left="state.scrollLeft">
                <view class="wd-tabs__nav-container">
                  <view
                    @tap="handleSelect(index)"
                    v-for="(item, index) in navItems()"
                    :key="index"
                    :class="`wd-tabs__nav-item  ${state.activeIndex === index ? 'is-active' : ''} ${item.disabled ? 'is-disabled' : ''}`"
                    :style="getTabItemStyle(index)"
                  >
                    <wd-badge v-if="item.badgeProps" v-bind="item.badgeProps">
                      <text class="wd-tabs__nav-item-text">{{ item.title }}</text>
                    </wd-badge>
                    <text v-else class="wd-tabs__nav-item-text">{{ item.title }}</text>

                    <view
                      :class="`wd-tabs__line ${state.activeIndex === index && state.useInnerLine ? 'is-' + lineTheme : ''} wd-tabs__line--inner`"
                      v-if="state.activeIndex === index && state.useInnerLine"
                    ></view>
                  </view>
                  <view :class="`wd-tabs__line ${'is-' + lineTheme}`" :style="state.lineStyle"></view>
                </view>
              </scroll-view>
            </view>
            <view class="wd-tabs__map" v-if="showMap()">
              <view :class="`wd-tabs__map-btn  ${state.animating ? 'is-open' : ''}`" @tap="toggleMap">
                <view :class="`wd-tabs__map-arrow  ${state.animating ? 'is-open' : ''}`">
                  <wd-icon name="arrow-down-bold" custom-class="wd-tabs__map-arrow-icon" />
                </view>
              </view>
              <view class="wd-tabs__map-header" :style="mapHeaderStyle">
                <text>{{ mapTitle || translate('all') }}</text>
              </view>
              <view :class="`wd-tabs__map-body  ${state.animating ? 'is-open' : ''}`" :style="mapBodyStyle">
                <view class="wd-tabs__map-nav-item" v-for="(item, index) in navItems()" :key="index" @tap="handleSelect(index)">
                  <view
                    :class="`wd-tabs__map-nav-btn ${state.activeIndex === index ? 'is-active' : ''}  ${item.disabled ? 'is-disabled' : ''}`"
                    :style="getMapTabStyle(index)"
                  >
                    <text>{{ item.title }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </wd-sticky>

        <view class="wd-tabs__container" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchEnd">
          <view :class="['wd-tabs__body', animated ? 'is-animated' : '']" :style="bodyStyle">
            <slot />
          </view>
        </view>

        <view class="wd-tabs__mask" :style="mapHeaderStyle" @tap="toggleMap"></view>
      </view>
    </wd-sticky-box>
  </template>

  <template v-else>
    <view
      :class="`wd-tabs ${customClass} ${innerSlidable() ? 'is-slide' : ''} ${showMap() ? 'is-map' : ''} ${
        !showScrollbar ? 'is-hide-scrollbar' : ''
      }`"
      :style="parseStyle(customStyle)"
    >
      <view class="wd-tabs__nav">
        <view class="wd-tabs__nav--wrap">
          <scroll-view :scroll-x="innerSlidable()" :scroll-left="state.scrollLeft">
            <view class="wd-tabs__nav-container">
              <view
                v-for="(item, index) in navItems()"
                @tap="handleSelect(index)"
                :key="index"
                :class="`wd-tabs__nav-item ${state.activeIndex === index ? 'is-active' : ''} ${item.disabled ? 'is-disabled' : ''}`"
                :style="getTabItemStyle(index)"
              >
                <wd-badge custom-class="wd-tabs__nav-item-badge" v-if="item.badgeProps" v-bind="item.badgeProps">
                  <text class="wd-tabs__nav-item-text">{{ item.title }}</text>
                </wd-badge>
                <text v-else class="wd-tabs__nav-item-text">{{ item.title }}</text>
                <view
                  :class="`wd-tabs__line ${state.activeIndex === index && state.useInnerLine ? 'is-' + lineTheme : ''} wd-tabs__line--inner`"
                  v-if="state.activeIndex === index && state.useInnerLine"
                ></view>
              </view>
              <view :class="`wd-tabs__line ${'is-' + lineTheme}`" :style="state.lineStyle"></view>
            </view>
          </scroll-view>
        </view>
        <view class="wd-tabs__map" v-if="showMap()">
          <view class="wd-tabs__map-btn" @tap="toggleMap">
            <view :class="`wd-tabs__map-arrow ${state.animating ? 'is-open' : ''}`">
              <wd-icon name="arrow-down-bold" custom-class="wd-tabs__map-arrow-icon" />
            </view>
          </view>
          <view class="wd-tabs__map-header" :style="mapHeaderStyle">
            <text>{{ mapTitle || translate('all') }}</text>
          </view>
          <view :class="`wd-tabs__map-body ${state.animating ? 'is-open' : ''}`" :style="mapBodyStyle">
            <view class="wd-tabs__map-nav-item" v-for="(item, index) in navItems()" :key="index" @tap="handleSelect(index)">
              <view :class="`wd-tabs__map-nav-btn ${state.activeIndex === index ? 'is-active' : ''}  ${item.disabled ? 'is-disabled' : ''}`" :style="getMapTabStyle(index)">
                <text>{{ item.title }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="wd-tabs__container" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchEnd">
        <view :class="['wd-tabs__body', animated ? 'is-animated' : '']" :style="bodyStyle">
          <slot />
        </view>
      </view>

      <view class="wd-tabs__mask" :style="mapHeaderStyle" @tap="toggleMap"></view>
    </view>
  </template>
</template>
