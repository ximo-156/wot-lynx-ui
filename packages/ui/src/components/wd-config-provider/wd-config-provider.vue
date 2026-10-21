/* 主题样式与行为配置共享同一解析结果；Hook 使用独立注入键。
 * 修正官方 Hook theme/button/tag 未被组件消费、嵌套 portal 丢失外层变量的缺口。
 *
 * 通道划分（见 composables/useCssVarHost）：CSS 自定义属性走 `style` 属性字符串
 * （vue-lynx SET_STYLE 的逐属性写入会丢弃 `--x`），普通 customStyle 走 `:style`
 * 对象通道，两路键集互不重叠；撤回的变量输出空声明。
 */
<script lang="ts" setup>
import './index.css'
import { computed, getCurrentInstance, inject, onBeforeUpdate, ref } from 'vue-lynx'
import { configProviderProps } from './types'
import { parseStyle } from '../../common/util'
import { createStyleResolver } from '../../common/style'
import { useChildren } from '../../composables/useChildren'
import { useParent } from '../../composables/useParent'
import { useCssVarHost } from '../../composables/useCssVarHost'
import { mapThemeVarsToCSSVars, USE_CONFIG_PROVIDER_KEY } from '../../composables/useConfigProvider'
import { CONFIG_PROVIDER_KEY, mergeConfig, type ConfigProviderInput, type ConfigProviderProvide, type GlobalConfig } from '../../composables/global-config'

const props = defineProps(configProviderProps)
const instance = getCurrentInstance()!
const hook = inject<ConfigProviderProvide | null>(USE_CONFIG_PROVIDER_KEY, null)
// theme 显式传入（含 undefined 以外的任何值）才覆盖 Hook 主题；undefined 视为继承
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
const resolvePlainStyle = createStyleResolver()
/** 普通内联样式（对象通道）；变量键由属性通道负责，二者不重叠 */
const rootStyle = computed(() => resolvePlainStyle(themeStyle.value as Record<string, any>, customStyle.value))
const { hostId } = useCssVarHost(() => [themeStyle.value, customStyle.value], () => rootStyle.value)

linkChildren({ themeStyle, globalConfig })
</script>
<template>
  <!-- data-theme 在 vue-lynx 0.5.1 上走 dataset 专用 PAPI 会抛错；主题类承担切换。
       根节点带一次性 uid 标记，供变量属性通道精确定位本实例节点。 -->
  <view :class="themeClass" :style="rootStyle" :wd-css-vars="hostId"><slot /></view>
</template>
