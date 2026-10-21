/* 根节点主题镜像；使用纯 inject 不参加父子排序，动态 CSS 变量支持撤回。
 *
 * 宿主限制：vue-lynx 0.5.1 的 SET_STYLE 逐属性执行 `el.style[key] = value`，
 * CSSOM 会丢弃 `--custom-property`（jsdom 同语义，已用探针核实），因此普通
 * 内联样式仍走 :style 对象，而主题变量改经根节点的 `style` 属性字符串写入
 * （__SetInlineStyles 的字符串分支，浏览器按属性语法原样解析）。两路样式
 * 按「变量 / 普通键」互不重叠；撤回的键输出空声明覆盖继承值。
 */
<script lang="ts" setup>
import './index.css'
import { computed, getCurrentInstance, onBeforeUpdate, onMounted, onUpdated, watch } from 'vue-lynx'
import { rootPortalProps } from './types'
import { useGlobalConfig } from '../../composables/useGlobalConfig'
import { mapThemeVarsToCSSVars } from '../../composables/useConfigProvider'
import { parseStyle, sanitizeCssVariableText } from '../../common/util'
import { createStyleResolver } from '../../common/style'

const props = defineProps(rootPortalProps)
const globalConfig = useGlobalConfig()
const themeClass = computed(() => `wot-theme-${globalConfig.value.theme || 'light'}`)
const customStyle = computed(() => parseStyle(props.customStyle))
const isVar = (key: string) => key.startsWith('--')
const themeVars = () => mapThemeVarsToCSSVars((globalConfig.value.themeVars || {}) as Record<string, string>) || {}

/** 普通内联样式（对象通道，CONVENTIONS §19） */
const resolvePlainStyle = createStyleResolver()
const plainStyle = computed(() => {
  const resolved = resolvePlainStyle(themeVars(), customStyle.value)
  return Object.fromEntries(Object.entries(resolved).filter(([key]) => !isVar(key)))
})

/** 曾出现过的变量键：撤回时输出空声明覆盖旧值 */
const knownVarKeys = new Set<string>()

/** CSS 变量声明串；值经 sanitizeCssVariableText 过滤，杜绝声明注入 */
const varText = computed(() => {
  const layers: Array<Record<string, unknown>> = [themeVars(), customStyle.value]
  const parts: string[] = []
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (!isVar(key)) continue
      knownVarKeys.add(key)
      parts.push(`${key}:${sanitizeCssVariableText(value)};`)
    }
  }
  for (const key of knownVarKeys) {
    const present = layers.some((layer) => key in layer)
    if (!present) parts.push(`${key}:;`)
  }
  return parts.join('')
})

let host: any = null
function applyVars() {
  const text = varText.value
  if (typeof document === 'undefined') return
  if (!host) host = document.querySelector('.wd-root-portal')
  if (!host) return
  try {
    host.setAttribute('style', text)
  } catch {
    // 宿主不可写（真机纯原生渲染）时变量由 wot-theme-* 类兜底
  }
}
onMounted(applyVars)
onBeforeUpdate(() => { host = null })
onUpdated(applyVars)
watch(varText, applyVars, { flush: 'post' })
void props
</script>
<template>
  <view :class="`wd-root-portal ${themeClass} ${customClass}`" :style="plainStyle"><slot /></view>
</template>
