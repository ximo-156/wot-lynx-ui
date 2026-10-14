<template>
  <WdTransition
    :show="show"
    name="fade"
    :custom-class="`wd-overlay ${customClass}`"
    :duration="duration"
    :custom-style="`z-index: ${zIndex}; ${customStyle}`"
    :disable-touch-move="lockScroll"
    @before-enter="emit('before-enter')"
    @enter="emit('enter')"
    @after-enter="emit('after-enter')"
    @before-leave="emit('before-leave')"
    @leave="emit('leave')"
    @after-leave="emit('after-leave')"
    @click="handleClick"
  >
    <slot></slot>
  </WdTransition>
</template>
<script setup lang="ts">
import './index.css'
import WdTransition from '../wd-transition/wd-transition.vue'
import { overlayProps } from './types'
import { useLockScroll } from '../../composables/useLockScroll'

const props = defineProps(overlayProps)

const emit = defineEmits(['click', 'before-enter', 'enter', 'after-enter', 'before-leave', 'leave', 'after-leave'])

function handleClick() {
  emit('click')
}
useLockScroll(() => props.show && props.lockScroll)
</script>

