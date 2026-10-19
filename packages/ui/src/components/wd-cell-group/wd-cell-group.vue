/*
 * wd-cell-group — 单元格组
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 经 useChildren 向子单元格提供共享配置（border/center/size/
 *   titleWidth/layout/valueAlign），子单元格 props 优先；
 * - rootStyle：参考源直接绑定 customStyle 字符串，改为 parseStyle() 归一
 *   的对象语法（CONVENTIONS §19，字符串 :style 会被静默丢弃）；
 * - insert 模式为卡片式分组（圆角容器 + 水平外边距）；
 * - **根节点三件套 + 居中补全**（NATIVE-REWRITE §3.1 / §3.2）：根 view 显式
 *   display: flex + flex-direction: column；标题区为 flex 行 +
 *   align-items: center + justify-content: space-between（左标题 / 右辅助
 *   文字两端对齐且同行居中）；左右文本容器同为 flex 行 + 交叉轴居中；
 *   单元格区为 flex 列。
 */
<script lang="ts" setup>
import './index.css'

import { parseStyle } from '../../common/util'

import { cellGroupProps } from './types'
import { useChildren } from '../../composables/useChildren'
import { CELL_GROUP_KEY } from '../../composables/useCell'

const props = defineProps(cellGroupProps)

const { linkChildren } = useChildren(CELL_GROUP_KEY)

// 向子组件提供共享属性
linkChildren({ props })
</script>

<template>
  <view :class="['wd-cell-group', border ? 'is-border' : '', customClass, insert ? 'wd-cell-group--insert' : '']" :style="parseStyle(customStyle)">
    <view v-if="title || value || $slots.title || $slots.value" class="wd-cell-group__title">
      <!--左侧标题-->
      <view class="wd-cell-group__left">
        <text v-if="!$slots.title">{{ title }}</text>
        <slot v-else name="title"></slot>
      </view>
      <!--右侧标题-->
      <view class="wd-cell-group__right">
        <text v-if="!$slots.value">{{ value }}</text>
        <slot v-else name="value"></slot>
      </view>
    </view>
    <view class="wd-cell-group__body">
      <slot></slot>
    </view>
  </view>
</template>
