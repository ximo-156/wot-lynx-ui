/* 主题样式与行为配置共享同一解析结果；Hook 使用独立注入键。
 * CSS 自定义属性与普通样式同走原生对象通道，逐元素 Style Funnel 支持撤回。
 * 不查询 DOM：组件在后台线程运行；Web 样式由主线程 WASM API 应用。
 */
<script lang="ts" setup>
import './index.css'
import { computed, getCurrentInstance, inject, onBeforeUpdate, ref } from 'vue-lynx'
import { configProviderProps } from './types'
import { parseStyle } from '../../common/util'
import { createStyleResolver } from '../../common/style'
import { useChildren } from '../../composables/useChildren'
import { useParent } from '../../composables/useParent'
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
  // theme 继承链：显式传入 > hook 注入 > 父级 ConfigProvider > props 默认值。
  // 无 hook 时不能直接落 props.theme——默认值 'light' 会把父级 dark 硬覆盖掉
  // （嵌套 Provider 的子树静默回亮色）。
  const theme = explicitTheme.value
    ? props.theme
    : (hook?.globalConfig.value.theme ?? parent.value?.globalConfig.value.theme ?? props.theme)
  return mergeConfig(base, {
    theme,
    themeVars: props.themeVars, button: props.button, tag: props.tag
  } as ConfigProviderInput)
})
const themeStyle = computed(() => mapThemeVarsToCSSVars(globalConfig.value.themeVars) || {})
const themeClass = computed(() => `wd-config-provider wot-theme-${globalConfig.value.theme}${props.customClass ? ' ' + props.customClass : ''}`)

const customStyle = computed(() => parseStyle(props.customStyle))
const resolvePlainStyle = createStyleResolver()
/** CSS 变量和普通样式合并；所有历史覆盖键都能显式撤回。 */
const rootStyle = computed(() => resolvePlainStyle(themeStyle.value, customStyle.value))

linkChildren({ themeStyle, globalConfig })
</script>
<template>
  <!-- data-theme 需要 dataset 专用 API；主题类已承担切换。 -->
  <view :class="themeClass" :style="rootStyle"><slot /></view>
</template>
