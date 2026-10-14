<template>
  <template v-if="sticky">
    <WdStickyBox>
      <view
        :class="`wd-tabs ${customClass} ${innerSlidable ? 'is-slide' : ''} ${mapNum < children.length && mapNum !== 0 ? 'is-map' : ''} ${
          !showScrollbar ? 'is-hide-scrollbar' : ''
        }`"
        :style="styleToObject(customStyle)"
      >
        <WdSticky :offset-top="offsetTop">
          <view class="wd-tabs__nav wd-tabs__nav--sticky">
            <view class="wd-tabs__nav--wrap">
              <scroll-view :scroll-x="innerSlidable" scroll-with-animation :scroll-left="state.scrollLeft">
                <view class="wd-tabs__nav-container">
                  <view
                    @tap="handleSelect(index)"
                    v-for="(item, index) in children"
                    :key="index"
                    :class="`wd-tabs__nav-item  ${state.activeIndex === index ? 'is-active' : ''} ${item.disabled ? 'is-disabled' : ''}`"
                    :style="styleToObject(getTabItemStyle(index))"
                  >
                    <WdBadge v-if="item.badgeProps" v-bind="item.badgeProps">
                      <text class="wd-tabs__nav-item-text"><text>{{ item.title }}</text></text>
                    </WdBadge>
                    <text v-else class="wd-tabs__nav-item-text"><text>{{ item.title }}</text></text>

                    <view
                      :class="`wd-tabs__line ${state.activeIndex === index && state.useInnerLine ? 'is-' + lineTheme : ''} wd-tabs__line--inner`"
                      v-if="state.activeIndex === index && state.useInnerLine"
                    ></view>
                  </view>
                  <view :class="`wd-tabs__line ${'is-' + lineTheme}`" :style="styleToObject(state.lineStyle)"></view>
                </view>
              </scroll-view>
            </view>
            <view class="wd-tabs__map" v-if="mapNum < children.length && mapNum !== 0">
              <view :class="`wd-tabs__map-btn  ${state.animating ? 'is-open' : ''}`" @tap="toggleMap">
                <!-- Lynx 适配：wot-ui 用 ::before 绘制按钮左侧渐隐遮罩，Lynx 无伪元素，改为真实元素。 -->
                <view class="wd-tabs__map-btn-fade" />
                <view :class="`wd-tabs__map-arrow  ${state.animating ? 'is-open' : ''}`">
                  <WdIcon name="down" custom-class="wd-tabs__map-arrow-icon" />
                </view>
              </view>
              <view class="wd-tabs__map-header" :style="styleToObject(mapHeaderStyle)">
                <text>{{ mapTitle || translate('all') }}</text>
              </view>
              <view :class="`wd-tabs__map-body  ${state.animating ? 'is-open' : ''}`" :style="styleToObject(state.mapShow ? '' : 'display:none')">
                <!-- Lynx 适配：:nth-child(3n)/:nth-last-child(-n+3) 不受支持
                     （CONVENTIONS §4.3），行末/末行由索引生成 is-row-end/is-last-row。 -->
                <view
                  :class="`wd-tabs__map-nav-item${(index + 1) % 3 === 0 ? ' is-row-end' : ''}${
                    index >= children.length - 3 ? ' is-last-row' : ''
                  }`"
                  v-for="(item, index) in children"
                  :key="index"
                  @tap="handleSelect(index)"
                >
                  <view
                    :class="`wd-tabs__map-nav-btn ${state.activeIndex === index ? 'is-active' : ''}  ${item.disabled ? 'is-disabled' : ''}`"
                    :style="styleToObject(getMapTabStyle(index))"
                  >
                    <text>{{ item.title }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </WdSticky>

        <view class="wd-tabs__container" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchEnd">
          <view :class="['wd-tabs__body', animated ? 'is-animated' : '']" :style="styleToObject(bodyStyle)">
            <slot />
          </view>
        </view>

        <view class="wd-tabs__mask" :style="styleToObject(mapHeaderStyle)" @tap="toggleMap"></view>
      </view>
    </WdStickyBox>
  </template>

  <template v-else>
    <view
      :class="`wd-tabs ${customClass} ${innerSlidable ? 'is-slide' : ''} ${mapNum < children.length && mapNum !== 0 ? 'is-map' : ''} ${
        !showScrollbar ? 'is-hide-scrollbar' : ''
      }`"
    >
      <view class="wd-tabs__nav">
        <view class="wd-tabs__nav--wrap">
          <scroll-view :scroll-x="innerSlidable" scroll-with-animation :scroll-left="state.scrollLeft">
            <view class="wd-tabs__nav-container">
              <view
                v-for="(item, index) in children"
                @tap="handleSelect(index)"
                :key="index"
                :class="`wd-tabs__nav-item ${state.activeIndex === index ? 'is-active' : ''} ${item.disabled ? 'is-disabled' : ''}`"
                :style="styleToObject(getTabItemStyle(index))"
              >
                <WdBadge custom-class="wd-tabs__nav-item-badge" v-if="item.badgeProps" v-bind="item.badgeProps">
                  <text class="wd-tabs__nav-item-text"><text>{{ item.title }}</text></text>
                </WdBadge>
                <text v-else class="wd-tabs__nav-item-text"><text>{{ item.title }}</text></text>
                <view
                  :class="`wd-tabs__line ${state.activeIndex === index && state.useInnerLine ? 'is-' + lineTheme : ''} wd-tabs__line--inner`"
                  v-if="state.activeIndex === index && state.useInnerLine"
                ></view>
              </view>
              <view :class="`wd-tabs__line ${'is-' + lineTheme}`" :style="styleToObject(state.lineStyle)"></view>
            </view>
          </scroll-view>
        </view>
        <view class="wd-tabs__map" v-if="mapNum < children.length && mapNum !== 0">
          <view class="wd-tabs__map-btn" @tap="toggleMap">
            <!-- Lynx 适配：wot-ui 用 ::before 绘制按钮左侧渐隐遮罩，Lynx 无伪元素，改为真实元素。 -->
            <view class="wd-tabs__map-btn-fade" />
            <view :class="`wd-tabs__map-arrow ${state.animating ? 'is-open' : ''}`">
              <WdIcon name="down" custom-class="wd-tabs__map-arrow-icon" />
            </view>
          </view>
          <view class="wd-tabs__map-header" :style="styleToObject(mapHeaderStyle)">
            <text>{{ mapTitle || translate('all') }}</text>
          </view>
          <view :class="`wd-tabs__map-body ${state.animating ? 'is-open' : ''}`" :style="styleToObject(state.mapShow ? '' : 'display:none')">
            <view
              :class="`wd-tabs__map-nav-item${(index + 1) % 3 === 0 ? ' is-row-end' : ''}${
                index >= children.length - 3 ? ' is-last-row' : ''
              }`"
              v-for="(item, index) in children"
              :key="index"
              @tap="handleSelect(index)"
            >
              <view :class="`wd-tabs__map-nav-btn ${state.activeIndex === index ? 'is-active' : ''}  ${item.disabled ? 'is-disabled' : ''}`">
                <text>{{ item.title }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="wd-tabs__container" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchEnd">
        <view :class="['wd-tabs__body', animated ? 'is-animated' : '']" :style="styleToObject(bodyStyle)">
          <slot />
        </view>
      </view>

      <view class="wd-tabs__mask" :style="styleToObject(mapHeaderStyle)" @tap="toggleMap"></view>
    </view>
  </template>
</template>
<script setup lang="ts">
import './index.css'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdBadge from '../wd-badge/wd-badge.vue'
import WdSticky from '../wd-sticky/wd-sticky.vue'
import WdStickyBox from '../wd-sticky-box/wd-sticky-box.vue'
import {computed, getCurrentInstance, onMounted, watch, nextTick, reactive} from 'vue-lynx'
import { styleToObject, type CSSProperties, addUnit, checkNumRange, debounce, getRect, isDef, isNumber, objToStyle } from '../../common/util'
import { useTouch } from '../../composables/useTouch'
import { TABS_KEY, tabsProps, type TabsExpose } from './types'
import { useChildren } from '../../composables/useChildren'
import { useTranslate } from '../../composables/useTranslate'

const $item = '.wd-tabs__nav-item'
const $itemText = '.wd-tabs__nav-item-text'
const $container = '.wd-tabs__nav-container'

const props = defineProps(tabsProps)
const emit = defineEmits(['change', 'disabled', 'click', 'update:modelValue'])

const { translate } = useTranslate('tabs')

const state = reactive({
  /** 选中值的索引，默认第一个 */
  activeIndex: 0,
  /** 激活项边框线样式 */
  lineStyle: 'display:none;',
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

const touch = useTouch()

/**
 * 内部是否可滑动
 */
const innerSlidable = computed(() => {
  return props.slidable === 'always' || children.length > props.slidableNum
})

/**
 * map 动画样式
 */
const mapHeaderStyle = computed(() => {
  const style: CSSProperties = {}
  if (!state.mapShow) {
    style.display = 'none'
  }
  if (state.animating) {
    style.opacity = 1
  }
  return objToStyle(style)
})

/**
 * body 样式
 */
const bodyStyle = computed(() => {
  if (!props.animated) {
    return ''
  }

  return objToStyle({
    left: -100 * state.activeIndex + '%',
    'transition-duration': props.duration + 'ms',
    '-webkit-transition-duration': props.duration + 'ms'
  })
})

/**
 * 获取 tab 的 name
 * @param tab tab实例
 * @param index 索引
 */
const getTabName = (tab: any, index: number) => {
  return isDef(tab.name) ? tab.name : index
}

// 默认索引也是绑定标识；在子项完成注册、排序后统一检查，并跟踪动态变化。
watch(
  () => children.map(getTabName),
  async (names, _oldNames, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    // useParent 在 onUnmounted 中注销子项，等待注销完成，避免对中间状态误报。
    await nextTick()
    if (cancelled) return
    names.forEach((name, index) => {
      // 非法类型由 wd-tab 诊断，避免格式化 bigint 或循环引用对象时再次抛错。
      if (typeof name !== 'string' && typeof name !== 'number') return
      const firstIndex = names.indexOf(name)
      if (firstIndex >= 0 && firstIndex !== index) {
        console.warn(
          `[wot ui] warning(wd-tabs): duplicate tab identifier ${JSON.stringify(
            name
          )} at indices ${firstIndex} and ${index}; use unique names for reliable v-model binding`
        )
      }
    })
  },
  { flush: 'post' }
)

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
  return objToStyle(style)
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
  return objToStyle(style)
}

/**
 * 更新激活项
 * @param value 激活值
 * @param init 是否已初始化
 * @param setScroll 是否设置scroll-view滚动
 * @param byIndex 是否直接使用内部交互的物理索引
 */
const updateActive = (value: number | string = 0, init: boolean = false, setScroll: boolean = true, byIndex: boolean = false) => {
  // 没有tab子元素，不执行任何操作
  if (children.length === 0) return

  const index = byIndex ? (value as number) : getActiveIndex(value)
  // 防抖等待期间子项可能被移除，执行时再次检查索引和禁用状态。
  if (!Number.isInteger(index) || index < 0 || index >= children.length || children[index].disabled) return
  state.activeIndex = index
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
const debouncedUpdateActive = debounce(updateActive, 100, { leading: true })
const setActive = (value: number | string = 0, init: boolean = false, setScroll: boolean = true) => {
  debouncedUpdateActive(value, init, setScroll)
}

/** 内部交互已确定目标位置，无须再次按名称解析。 */
const setActiveByIndex = (index: number) => {
  debouncedUpdateActive(index, false, true, true)
}

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

// watch(
//   () => children.length,
//   () => {
//     if (state.inited) {
//       nextTick(() => {
//         // setActive(props.modelValue)
//       })
//     }
//   }
// )

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
        // Lynx 适配：节点未就绪时 rects 为空数组，直接返回
        if (!textRects[state.activeIndex]) return
        const textWidth = Number(textRects[state.activeIndex].width)
        lineStyle.width = addUnit(textWidth)
      } else if (lineTheme === 'underline') {
        const rects = await getRect($item, true, proxy)
        if (!rects[state.activeIndex]) return
        const rectWidth = Number(rects[state.activeIndex].width)
        lineStyle.width = addUnit(rectWidth)
      }
    }
    if (isDef(lineHeight)) {
      lineStyle.height = addUnit(lineHeight)
      lineStyle.borderRadius = `calc(${addUnit(lineHeight)} / 2)`
    }
    const rects = await getRect($item, true, proxy)
    const rect = rects[state.activeIndex]
    // Lynx 适配：节点未就绪时 rects 为空数组，直接返回
    if (!rect) return
    let left = rects.slice(0, state.activeIndex).reduce((prev: any, curr: any) => prev + Number(curr.width), 0) + Number(rect.width) / 2
    if (left) {
      lineStyle.transform = `translateX(${left}px) translateX(-50%)`
      if (animation) {
        lineStyle.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);'
      }
      state.useInnerLine = false
      state.lineStyle = objToStyle(lineStyle)
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
  Promise.all([getRect($item, true, proxy), getRect($container, false, proxy)])
    .then(([navItemsRects, navRect]) => {
      // 选中元素（Lynx 适配：节点未就绪时为空数组，直接返回）
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
    .catch((error) => {
      // 节点度量失败（无匹配节点 / 宿主不支持 SelectorQuery）时保持当前滚动位置。
      // 必须 catch：调用链 updateActive -> scrollIntoView -> getRect 均无上层兜底，
      // 未处理的 Promise 拒绝会被 Sentry 上报为 USER_RUNTIME_ERROR
      // "unhandled rejection: createSelectorQuery is not available"。
    })
}

/**
 * 单击 tab 的处理
 * @param index 索引
 */
function handleSelect(index: number) {
  const tab = children[index]
  if (!tab) return
  const { disabled } = tab
  const name = getTabName(tab, index)

  if (disabled) {
    emit('disabled', {
      index,
      name
    })
    return
  }
  state.mapShow && toggleMap()
  setActiveByIndex(index)
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
    const index = state.activeIndex + (deltaX.value > 0 ? -1 : 1)
    const tab = children[index]
    // 标签可能在滑动期间被移除，切换前先检查目标是否存在。
    if (!tab) return
    setActiveByIndex(index)
  }
}

/**
 * 获取激活的索引
 * @param {number | string} value 绑定值
 */
function getActiveIndex(value: number | string) {
  // 先匹配显式名称，避免未命名标签的默认索引遮蔽同值名称。
  const index = children.findIndex((item) => isDef(item.name) && item.name === value)
  if (index !== -1) {
    return index
  }

  // 兼容通过索引选择具名标签；非法索引或未匹配的名称回退到首项。
  if (isNumber(value)) {
    if (Number.isInteger(value) && value >= 0 && value < children.length) {
      return value
    }
    console.error('[wot ui] warning(wd-tabs): the tab index should be an integer within the range of its children')
  }

  return 0
}

defineExpose<TabsExpose>({
  setActive,
  scrollIntoView,
  updateLineStyle
})
</script>
