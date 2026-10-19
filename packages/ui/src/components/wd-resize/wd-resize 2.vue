/*
 * wd-resize — 尺寸监听
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 容器度量：参考源用 uni.createSelectorQuery().in(proxy).select('#id')
 *   .boundingClientRect()（uni-app 小程序 API）。Lynx 无 uni 全局与组件
 *   作用域查询，改用本地 common/util 的 getRect()（内部映射
 *   lynx.createSelectorQuery，并提供 Web 预览 DOM 度量兜底，永不 reject）；
 * - 参考源把 onScrollHandler 定义在首次度量回调内、以闭包记录容器尺寸，
 *   依赖 let 绑定在模板中的动态重定向；本实现将 lastHeight/lastWidth 提升为
 *   setup 作用域变量、处理器保持单一稳定函数（逻辑逐行一致，避免
 *   options script 与 script setup 双块编译为非 inline 模式时 let 重定向失效）；
 * - rootStyle 与探测占位样式由参考源的字符串拼接改为对象语法
 *   （parseStyle 归一 customStyle / :style 对象，CONVENTIONS §19）；
 * - 探测机制本身沿用参考源：容器 absolute 脱离文档流，两个隐藏 scroll-view
 *   绝对定位铺满容器，滚动位置布置到远超底部后被引擎钳制，触发 scroll
 *   事件后重新度量并比对 emit；无交互、无事件转发。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, ref } from 'vue-lynx'
import { addUnit, getRect, parseStyle, uuid, type CSSProperties } from '../../common/util'
import { resizeProps } from './types'

const props = defineProps(resizeProps)
/**
 * resize 事件，容器尺寸变化时触发
 * 事件参数: { top, bottom, left, right, height, width }
 */
const emit = defineEmits<{
  (e: 'resize', detail: Record<string, string | number>): void
}>()

const expandScrollTop = ref<number>(0) // 监听容器变大时的纵向滚动距离
const shrinkScrollTop = ref<number>(0) // 监听容器变小时的纵向滚动距离
const expandScrollLeft = ref<number>(0) // 监听容器变大时的横向滚动距离
const shrinkScrollLeft = ref<number>(0) // 监听容器变小时的横向滚动距离
const height = ref<number>(0) // 容器当前高度
const width = ref<number>(0) // 容器当前宽度
const scrollEventCount = ref<number>(0) // 滚动事件计数

const resizeId = ref<string>(`resize${uuid()}`) // 容器唯一标识符

/** 闭包记录的容器尺寸（参考源定义在首次度量回调内，此处提升为 setup 作用域） */
let lastHeight = 0
let lastWidth = 0

const rootStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {
    width: addUnit(width.value),
    height: addUnit(height.value)
  }
  return { ...style, ...parseStyle(props.customStyle) }
})

/**
 * 滚动条拉到底部，重置两个 scroll-view 的滚动位置
 * 用于检测容器尺寸变化
 * @param {Object} params 参数对象
 * @param {number} params.lastWidth 上一次记录的宽度
 * @param {number} params.lastHeight 上一次记录的高度
 */
function scrollToBottom({ lastWidth, lastHeight }: { lastWidth: number; lastHeight: number }) {
  expandScrollTop.value = 100000 + lastHeight
  shrinkScrollTop.value = 3 * height.value + lastHeight
  expandScrollLeft.value = 100000 + lastWidth
  shrinkScrollLeft.value = 3 * width.value + lastWidth
}

/** 滚动事件处理函数，动态定义用于闭包记录容器尺寸 */
function onScrollHandler() {
  getRect(`#${resizeId.value}`).then((res) => {
    // 前两次滚动事件被触发，说明初始化修改已渲染，通知用户代码当前容器大小
    if (scrollEventCount.value++ === 0) {
      const result: Record<string, string | number> = {}
      ;['bottom', 'top', 'left', 'right', 'height', 'width'].forEach((propName) => {
        result[propName] = res[propName]
      })
      emit('resize', result)
    }
    // 滚动条拉到底部会触发多余的事件，前 3 次事件需要屏蔽掉初始化事件
    if (scrollEventCount.value < 3) return
    // 手动设置父容器高宽，防止父容器坍塌
    // 滚动完，重新获取容器新的高度和宽度
    const newHeight = res.height
    const newWidth = res.width
    // 立即填充父容器高宽
    height.value = newHeight
    width.value = newWidth
    // 宽高都改变时，只需要触发一次 resize 事件
    const emitStack: number[] = []
    if (newHeight !== lastHeight) {
      lastHeight = newHeight
      emitStack.push(1)
    }
    if (newWidth !== lastWidth) {
      lastWidth = newWidth
      emitStack.push(1)
    }
    if (emitStack.length !== 0) {
      const result: Record<string, any> = {}
      ;['bottom', 'top', 'left', 'right', 'height', 'width'].forEach((propName) => {
        result[propName] = res[propName]
      })
      emit('resize', result)
    }
    // 滚动条拉到底部进行新一轮的尺寸监听（如果使用 nextTick 效果更佳）
    scrollToBottom({
      lastWidth: lastWidth,
      lastHeight: lastHeight
    })
  })
}

onMounted(() => {
  // 初始化数据获取，获取容器的初始尺寸
  getRect(`#${resizeId.value}`).then((res) => {
    // 闭包记录容器高度和宽度，用于监听容器尺寸变化
    lastHeight = res.height
    lastWidth = res.width
    // 立即填充父容器高宽
    height.value = lastHeight
    width.value = lastWidth
    // 滚动条拉到底部进行初始化的尺寸监听（如果使用 nextTick 效果更佳）
    scrollToBottom({
      lastWidth: lastWidth,
      lastHeight: lastHeight
    })
  })
})
</script>

<template>
  <view :class="`wd-resize ${customClass}`" :style="rootStyle">
    <!--插槽需要脱离父容器文档流，防止父容器固宽固高，进而导致插槽大小被被父容器限制-->
    <view :id="resizeId" :class="`wd-resize__container ${customContainerClass}`">
      <!--被监听的插槽-->
      <slot />
      <!--监听插槽变大-->
      <scroll-view
        class="wd-resize__wrapper"
        :scroll-y="true"
        :scroll-top="expandScrollTop"
        :scroll-x="true"
        :scroll-left="expandScrollLeft"
        @scroll="onScrollHandler"
      >
        <view class="wd-resize__wrapper--placeholder" :style="{ height: '100000px', width: '100000px' }"></view>
      </scroll-view>
      <!--监听插槽变小-->
      <scroll-view
        class="wd-resize__wrapper"
        :scroll-y="true"
        :scroll-top="shrinkScrollTop"
        :scroll-x="true"
        :scroll-left="shrinkScrollLeft"
        @scroll="onScrollHandler"
      >
        <view class="wd-resize__wrapper--placeholder" :style="{ height: '250%', width: '250%' }"></view>
      </scroll-view>
    </view>
  </view>
</template>
