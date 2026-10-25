/*
 * wd-watermark — 水印
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点，核心为 canvas 平台降级）：
 * - 参考源以 Canvas 2D（离屏 / 在屏 / H5 document.createElement 三条路径）
 *   绘制单元水印后 canvasToTempFilePath 生成 dataURL，再由根节点
 *   background-image + background-repeat 平铺；Lynx 引擎不提供 Canvas 2D
 *   API（common/canvasHelper 为占位降级），故平铺改由图层内重复的真实
 *   元素承担：文本模式渲染 text 元素、图片模式渲染原生 image 元素
 *   （CONVENTIONS §8：图片用原生 image 元素，不用背景图/内嵌 SVG）；
 * - 单元占位 = 内容 + gutter（width+gutterX / height+gutterY），与参考源
 *   canvas 尺寸一致；layout=staggered 时奇数行右移半个单元宽度，等效于
 *   参考源 2×2 离屏画布错位绘制的砖墙效果；
 * - 参考源根节点为纯遮罩（absolute/fixed + inset 0 + pointer-events none），
 *   无插槽；本地根节点同时承载插槽内容（存量结构，demo 依赖），故保持
 *   position: relative 容器：全屏语义（参考源根 position: fixed）改由水印
 *   图层在 is-fullscreen 下 position: fixed 承担（Lynx 的 fixed 节点会被
 *   提升到页面根节点，天然覆盖整个视口，CONVENTIONS §9）；
 * - 参考源 rootStyle 的 backgroundImage 依赖 canvas dataURL（Lynx 无），
 *   opacity 若下发到根节点会同时淡化插槽内容（参考源根无插槽无此问题），
 *   故 opacity 移至水印图层（图层 SCSS 以 --wot-watermark-opacity 兜底，
 *   props.opacity 经内联覆盖，与参考源「SCSS 默认值 + prop 内联覆盖」
 *   的两级结构一致）；backgroundSize / zIndex 仍按参考源下发到根节点；
 * - 参考源的 pixelRatio 放大绘制为 canvas 位图清晰度服务，Lynx 文本/图片
 *   由引擎按设备像素比渲染，无需该乘数；
 * - 平铺行列数按图层尺寸一次性度量后缓存（getRect 经实例唯一 id 选择器，
 *   避免同页多实例串台；度量失败回退常见屏幕尺寸 375×667），props 变化时
 *   经 computed 重算网格，不走参考源的 doReset 重绘流程；
 * - 平铺节点数钳制在 MAX_TILES 上限内（小单元 + 大容器时防止铺出数千
 *   节点冻结渲染，见 test/perf-guards.test.ts）；
 * - 原生优先重写（NATIVE-REWRITE §3）：本组件为纯展示（无跟手交互，不涉及
 *   MTS），根节点经 SCSS 显式补全三件套（display: flex + flex-direction:
 *   column）——插槽内容纵向堆叠，水印图层绝对定位不参与流；图层四边 0 +
 *   flex 铺满（wrap 平铺），单元容器 justify-content + align-items 成对
 *   居中，文本节点另加 text-align: center 对齐参考源 canvas 的居中绘制；
 * - 平铺单元样式经 defineStyleKeys + resolveStyle 输出完整键集
 *   （CONVENTIONS §20 Style Funnel 迁移：marginLeft 中性值 0px，
 *   staggered → grid 切换不留残移）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, ref } from 'vue-lynx'
import { watermarkProps } from './types'
import { addUnit, getRect, isDef, parseStyle, filterStyle, uuid } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(watermarkProps)
const isAlive = useAlive()

// 实例唯一 id 前缀：getRect 按 id 度量图层，同页多实例避免选择器串台
const instanceId = `wd-watermark-${uuid()}`

/** 容器尺寸（度量失败 / 未度量时回退常见手机屏幕尺寸） */
const FALLBACK_WIDTH = 375
const FALLBACK_HEIGHT = 667
const containerSize = ref({ width: 0, height: 0 })

/** 平铺节点总数上限：小尺寸水印 + 大容器（整页水印）时防止铺出数千节点 */
const MAX_TILES = 1000

onMounted(() => {
  getRect(`#${instanceId}-layer`).then((rect: any) => {
    // 度量回调晚于卸载落地时丢弃（真机 9902 晚到 patch 家族）
    if (!isAlive()) return
    const width = Number(rect && rect.width) || 0
    const height = Number(rect && rect.height) || 0
    if (width > 0 || height > 0) {
      containerSize.value = { width, height }
    }
  })
})

/**
 * 水印css类
 */
const rootClass = computed(() => {
  let classess: string = 'wd-watermark'
  if (props.fullScreen) {
    classess = `${classess} is-fullscreen`
  }
  return `${classess} ${props.customClass}`
})

/**
 * 水印样式
 */
const rootStyle = computed(() => {
  let width = props.width + props.gutterX
  if (props.layout === 'staggered') {
    width *= 2
  }
  const style: Record<string, string> = {
    backgroundSize: addUnit(width),
    zIndex: `${props.zIndex}`
  }
  return { ...style, ...parseStyle(props.customStyle) }
})

/**
 * 平铺单元可切换样式键 + 中性值（CONVENTIONS §20：每帧输出完整键集）。
 * marginLeft 中性值取 0px（视觉上等同于不设置）——layout 由 staggered 切回
 * grid 时奇数行的右移位移不留残值。
 */
const TILE_STYLE = defineStyleKeys({
  width: '0px',
  height: '0px',
  marginLeft: '0px'
})

/** 平铺网格：单元占位含 gutter，按图层尺寸算行列数铺满整个图层 */
const tiles = computed(() => {
  const unitWidth = Math.max(props.width + props.gutterX, 1)
  const unitHeight = Math.max(props.height + props.gutterY, 1)
  const containerWidth = containerSize.value.width || FALLBACK_WIDTH
  const containerHeight = containerSize.value.height || FALLBACK_HEIGHT
  let cols = Math.max(1, Math.ceil(containerWidth / unitWidth))
  let rows = Math.max(1, Math.ceil(containerHeight / unitHeight))
  // 节点数超限时按同一比例缩小行列（等比 → 间距均匀），把总量钳到上限。
  // 代价是极端参数（单元极小 + 容器极大）下右下角可能留白；相比无上限时
  // 数千节点导致的渲染冻结，这是有意的取舍。
  if (cols * rows > MAX_TILES) {
    const scale = Math.sqrt(MAX_TILES / (cols * rows))
    cols = Math.max(1, Math.floor(cols * scale))
    rows = Math.max(1, Math.floor(rows * scale))
  }
  const result: Array<{ style: Record<string, string> }> = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // staggered：奇数行右移半个单元宽度（参考源 2×2 离屏画布错位绘制的等效铺贴）；
      // 非错位行经 resolveStyle 回落中性值 0px，键集完整
      const staggeredOffset = props.layout === 'staggered' && r % 2 === 1 ? `${unitWidth / 2}px` : ''
      result.push({
        style: resolveStyle(TILE_STYLE, {
          width: `${unitWidth}px`,
          height: `${unitHeight}px`,
          marginLeft: staggeredOffset
        })
      })
    }
  }
  return result
})

/** 水印图层样式（Style Funnel，§20：键集每帧完整）。
 *  - opacity 由有值转无值时必须显式写中性值 ''，省略键会让旧透明度残留；
 *  - z-index 直接下发到图层：全屏态图层是真正 fixed 的节点（提升到页面根），
 *    打在根 view 上的 props.zIndex 够不到它，此前该 prop 在全屏模式失效。 */
const layerStyle = computed(() => {
  return {
    opacity: isDef(props.opacity) ? `${props.opacity}` : '',
    'z-index': String(props.zIndex)
  }
})

/** 图片水印样式（原生 image 元素，尺寸取 imageWidth / imageHeight） */
const imageStyle = computed(() => {
  return filterStyle({
    width: addUnit(props.imageWidth),
    height: addUnit(props.imageHeight)
  })
})

/** 文本水印样式：字号 / 颜色 / 字体 / 旋转角度（参考源 canvas 绘制参数） */
const textStyle = computed(() => {
  return filterStyle({
    'font-size': addUnit(props.size),
    color: props.color,
    'font-style': props.fontStyle,
    'font-weight': `${props.fontWeight}`,
    'font-family': props.fontFamily,
    'text-align': 'center',
    transform: `rotate(${props.rotate}deg)`
  })
})
</script>

<template>
  <view :class="rootClass" :style="rootStyle">
    <slot />
    <view :id="`${instanceId}-layer`" class="wd-watermark__layer" :style="layerStyle">
      <view v-for="(tile, index) in tiles" :key="index" class="wd-watermark__unit" :style="tile.style">
        <image v-if="image" class="wd-watermark__image" :src="image" :style="imageStyle" />
        <text v-else-if="content" class="wd-watermark__text" :style="textStyle">{{ content }}</text>
      </view>
    </view>
  </view>
</template>
