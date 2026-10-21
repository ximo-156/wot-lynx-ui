/* 主题样式与行为配置共享同一解析结果；Hook 使用独立注入键。
 * 修正官方 Hook theme/button/tag 未被组件消费、嵌套 portal 丢失外层变量的缺口。
 * CSS 变量与普通 customStyle 同走原生样式对象通道，逐元素 Style Funnel 支持撤回。
 * 不访问 document：组件运行于后台线程，真实 Web 的样式由主线程 WASM API 应用。
 */
<script lang="ts" setup>
import './index.css'
import { computed, getCurrentInstance, inject, onBeforeUpdate, onMounted, onUpdated, ref, watch } from 'vue-lynx'
import { configProviderProps } from './types'
import { parseStyle, sanitizeCssVariableText } from '../../common/util'
import { createStyleResolver } from '../../common/style'
import { useChildren } from '../../composables/useChildren'
import { useParent } from '../../composables/useParent'
import { mapThemeVarsToCSSVars, USE_CONFIG_PROVIDER_KEY } from '../../composables/useConfigProvider'
import { CONFIG_PROVIDER_KEY, mergeConfig, type ConfigProviderInput, type ConfigProviderProvide, type GlobalConfig } from '../../composables/global-config'

const props = defineProps(configProviderProps)
const instance = getCurrentInstance()!
const hook = inject<ConfigProviderProvide | null>(USE_CONFIG_PROVIDER_KEY, null)
const hasTheme = () => instance.vnode.props?.theme !== undefined
const explicitTheme = ref(hasTheme())
onBeforeUpdate(() => { explicitTheme.value = hasTheme() })
const { linkChildren } = useChildren(CONFIG_PROVIDER_KEY)
const { parent } = useParent(CONFIG_PROVIDER_KEY)
const globalConfig = computed<GlobalConfig>(() => {
  const inherited = parent.value?.globalConfig.value || null
  const base = hook ? mergeConfig(inherited, hook.globalConfig.value) : inherited
  return mergeConfig(base, {
    theme: hook && !explicitTheme.value ? hook.globalConfig.value.theme : props.theme,
    themeVars: props.themeVars, button: props.button, tag: props.tag
  } as ConfigProviderInput)
})
const themeStyle = computed(() => mapThemeVarsToCSSVars(globalConfig.value.themeVars) || {})
const themeClass = computed(() => `wd-config-provider wot-theme-${globalConfig.value.theme}${props.customClass ? ' ' + props.customClass : ''}`)

const customStyle = computed(() => parseStyle(props.customStyle))
/** 变量宿主标记属性（原生节点透传，不参与渲染） */
const MARKER = 'wd-css-vars'
const isVar = (key: string) => key.startsWith('--')
/** 普通内联样式（对象通道） */
const resolvePlainStyle = createStyleResolver()
const rootStyle = computed(() => {
  const resolved = resolvePlainStyle(themeStyle.value as Record<string, unknown>, customStyle.value)
  return Object.fromEntries(Object.entries(resolved).filter(([key]) => !isVar(key)))
})
/** 变量声明串：主题变量 + customStyle 中的 --* 键；撤回键输出空声明 */
const knownVarKeys = new Set<string>()
const varText = computed(() => {
  const layers = [themeStyle.value, customStyle.value] as Array<Record<string, unknown>>
  const parts: string[] = []
  const present = new Set<string>()
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (!isVar(key)) continue
      knownVarKeys.add(key)
      present.add(key)
      const text = sanitizeCssVariableText(value)
      // 空值也要输出（`--k:;` 清除继承），不能省略键
      parts.push(`${key}:${text};`)
    }
  }
  // 曾经下发、本帧已撤回的键：同一声明串内补空声明，避免被 :style 通道覆盖后残留
  for (const key of knownVarKeys) {
    if (!present.has(key)) parts.push(`${key}:;`)
  }
  return parts.join('')
})

/**
 * 元素定位：模板根节点是原生元素，本身没有单节点 ref（__GetElementByUniqueId
 * 只认原生实例），故用标记属性在宿主 document（或 lynx-view shadow root）内
 * 查找；无 DOM 的宿主返回 null，变量由 wot-theme-* 类兜底。标记用自定义属性
 * 名而非 `data-*`：后者走 dataset 专用 PAPI，测试环境会拒绝。
 */
function resolveElement(): any {
  if (typeof document === 'undefined') return null
  const roots: any[] = []
  const shadow = (document.querySelector('lynx-view') as any)?.shadowRoot
  if (shadow) roots.push(shadow)
  roots.push(document)
  for (const root of roots) {
    const el = root.querySelector(`[${MARKER}]`)
    if (el) return el
  }
  return null
}
function applyVars() {
  const text = varText.value
  // 无变量时不得清空样式：:style 通道单独管理普通键
  if (!text) return
  const el = resolveElement()
  if (!el) return
  try {
    el.setAttribute('style', text)
  } catch {
    // 宿主不可写（纯原生渲染）时变量由 wot-theme-* 类兜底
  }
}
onMounted(applyVars)
onUpdated(applyVars)
watch(varText, applyVars, { flush: 'post' })

linkChildren({ themeStyle, globalConfig })
</script>
<template>
  <!-- vue-lynx 0.5.1 的 SET_PROP 不走 __SetDataset，data-theme 会抛错；主题类承担切换。
       模板 class 对原生元素是静态类（最终类由运行时合并），故用自定义属性标记
       变量宿主（原生节点原样透传，不参与渲染）。 -->
  <view :class="themeClass" :style="rootStyle" wd-css-vars=""><slot /></view>
</template>
