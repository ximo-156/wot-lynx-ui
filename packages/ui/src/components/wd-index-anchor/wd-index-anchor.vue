/*
 * wd-index-anchor — 索引锚点
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 经 useParent 向 wd-index-bar 注册自身（indexBarInjectionKey），并读取
 *   父级 props.sticky 与 anchorState.activeIndex 计算吸顶态——与参考源一致：
 *   仅「索引栏开启 sticky 且自身是当前激活索引」时吸顶；
 * - 挂载后 getRect 实测自身 top 并经 defineExpose({ top }) 暴露，供 index-bar
 *   的滚动联动（hanleScroll）比较锚点位置；度量回调经 useAlive 守卫
 *   （真机 9902 防护）；
 * - DOM id 取父 index-bar 下发的唯一前缀派生（${prefix}-anchor-${index}），
 *   与 index-bar 侧 scrollIntoView 的拼接口径一致；父级缺失（独立使用）时
 *   退化为实例自身 uuid。历史上按裸 index 派生，两个 index-bar 的 anchor id
 *   完全重复，会撞引擎 id→签名注册表（真机 9902 removeNode 家族）；
 * - 参考源的 MP-DINGTALK 专属包裹结构（wd-index-anchor-ding）为条件编译，
 *   Lynx 无对应平台，删除；
 * - customStyle 经 parseStyle 归一为对象后绑定（CONVENTIONS §19）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, ref } from 'vue-lynx'
import { indexAnchorProps } from './types'
import { indexBarInjectionKey } from '../wd-index-bar/types'
import { getRect, isDef, parseStyle, uuid } from '../../common/util'
import { useParent } from '../../composables/useParent'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(indexAnchorProps)
const isAlive = useAlive()

const { parent: indexBar } = useParent(indexBarInjectionKey)

// DOM id 前缀：优先取父 index-bar 下发的唯一前缀（同页多个 index-bar 时
// anchor id 不重复，与 index-bar 侧 scrollIntoView 的拼接口径一致）；
// 父级缺失（独立使用）时退化为实例自身 uuid。
const anchorIdPrefix = indexBar.value?.id || `wd-index-anchor-${uuid()}`

const indexAnchorId = ref<string>(`${anchorIdPrefix}-anchor-${props.index}`)

const { proxy } = getCurrentInstance()!

const top = ref<number>(0)

const isSticky = computed(() => {
  return Boolean(indexBar.value && indexBar.value.props.sticky && indexBar.value.anchorState.activeIndex === props.index)
})

function getInfo() {
  getRect(`#${indexAnchorId.value}`, false, proxy).then((res) => {
    if (!isAlive()) return
    if (isDef(indexBar.value)) {
      top.value = Math.floor(res.top!)
    }
  })
}

onMounted(() => {
  getInfo()
})

defineExpose({
  top
})
</script>

<template>
  <view :class="`wd-index-anchor ${isSticky ? 'is-sticky' : ''} ${customClass}`" :style="parseStyle(customStyle)" :id="indexAnchorId">
    <slot>
      <text>{{ index }}</text>
    </slot>
  </view>
</template>
