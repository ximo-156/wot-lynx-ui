<template>
  <view :class="`wd-index-anchor-ding ${isSticky ? 'is-sticky' : ''}`">
    <view :class="`wd-index-anchor ${isSticky ? 'is-sticky' : ''} ${customClass}`" :style="styleToObject(customStyle)" :id="indexAnchorId">
      <slot>
        <text>{{ index }}</text>
      </slot>
    </view>
    </view>
  </template>

<script setup lang="ts">
import './index.css'
import { indexAnchorProps } from './type'
import { onMounted, getCurrentInstance, ref, computed } from 'vue-lynx'
import { indexBarInjectionKey } from '../wd-index-bar/type'
import { styleToObject, getRect, isDef, uuid } from '../../common/util'
import { useParent } from '../../composables/useParent'

const props = defineProps(indexAnchorProps)

const { parent: indexBar } = useParent(indexBarInjectionKey)

const indexAnchorId = ref<string>(`indexBar${uuid()}`)

const { proxy } = getCurrentInstance()!

const top = ref<number>(0)

const isSticky = computed(() => {
  return indexBar.value && indexBar.value.props.sticky && indexBar.value.anchorState.activeIndex === props.index
})

function getInfo() {
  getRect(`#${indexAnchorId.value}`, false, proxy)
    .then((res) => {
      if (isDef(indexBar.value)) {
        top.value = Math.floor(res.top!)
      }
    })
    .catch((error) => {
      // 节点度量失败（无匹配节点 / 宿主不支持 SelectorQuery）时保留默认位置，
      // 避免未处理的 Promise 拒绝被 Sentry 上报为 USER_RUNTIME_ERROR。
    })
}

onMounted(() => {
  getInfo()
})

defineExpose({
  top
})
</script>

