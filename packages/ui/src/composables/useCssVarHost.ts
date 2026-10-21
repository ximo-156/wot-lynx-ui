/**
 * CSS 自定义属性宿主（CSS custom properties host）。
 *
 * 平台事实（vue-lynx 0.5.1 + Lynx SET_STYLE）：`el.style[key] = value` 的逐属性
 * 写入会被 CSSOM 丢弃 `--custom-property`（jsdom 同语义，真机 SET_STYLE 亦按
 * 属性名合并）。唯一在两个宿主都生效的通道是把声明拼成 `style` 属性字符串下发：
 * `style="--wot-primary-6:#755FFE;..."`。
 *
 * 因此主题变量走属性通道，普通样式仍走 `:style` 对象通道；两路按「变量键 /
 * 普通键」互不重叠。收回的变量输出空声明（`--k:;`）以覆盖继承值。
 *
 * 元素定位：模板根是原生节点，没有可读的单节点 ref（`__GetElementByUniqueId`
 * 只认原生实例，且对已移除节点仍返回对象），故给根节点绑定一次性 uid 标记
 * `wd-css-vars="<uuid>"`，按「属性 + 值」精确定位本实例的节点，避免同页多个
 * provider / portal 或上一用例残留节点被错写。
 *
 * 标记用自定义属性名而非 `data-*`：后者在 vue-lynx 里走 dataset 专用 PAPI。
 */
import { computed, onMounted, onUpdated, watch } from 'vue-lynx'
import { sanitizeCssVariableText, uuid } from '../common/util'

export const CSS_VAR_HOST_ATTR = 'wd-css-vars'

export type CssVarLayers = Array<Record<string, unknown> | undefined | null>

/** camelCase → kebab-case（style 属性串必须是 CSS 属性名） */
function toCssProperty(key: string): string {
  if (key.startsWith('--')) return key
  return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
}

/** 普通样式对象 → CSS 声明串 */
function serializePlain(style: Record<string, unknown> | undefined | null): string {
  if (!style) return ''
  return Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${toCssProperty(key)}:${String(value)};`)
    .join('')
}

export function useCssVarHost(getLayers: () => CssVarLayers, getPlain?: () => Record<string, unknown> | undefined) {
  const hostId = uuid()
  const knownKeys = new Set<string>()

  const varText = computed(() => {
    const parts: string[] = []
    const present = new Set<string>()
    for (const layer of getLayers()) {
      if (!layer) continue
      for (const [key, value] of Object.entries(layer)) {
        if (!key.startsWith('--')) continue
        knownKeys.add(key)
        present.add(key)
        // 空值输出空声明，清除继承（不能省略键）
        parts.push(`${key}:${sanitizeCssVariableText(value)};`)
      }
    }
    for (const key of knownKeys) {
      if (!present.has(key)) parts.push(`${key}:;`)
    }
    return parts.join('')
  })

  /** 无 DOM 的宿主（纯原生渲染）返回 null，变量由 wot-theme-* 类兜底 */
  function resolveElement(): any {
    if (typeof document === 'undefined') return null
    const selector = `[${CSS_VAR_HOST_ATTR}="${hostId}"]`
    const shadow = (document.querySelector('lynx-view') as any)?.shadowRoot
    const found = shadow?.querySelector(selector) || document.querySelector(selector)
    return found || null
  }

  function applyVars() {
    // 属性是整串写入：必须把普通样式一起带上，否则会覆盖 :style 对象通道
    // 已下发的 padding 等普通声明
    const text = serializePlain(getPlain?.()) + varText.value
    if (!text) return
    const el = resolveElement()
    if (!el) return
    try {
      el.setAttribute('style', text)
    } catch {
      // 宿主不可写时变量由 wot-theme-* 类兜底
    }
  }

  onMounted(applyVars)
  onUpdated(applyVars)
  watch(varText, applyVars, { flush: 'post' })

  return { hostId, varText }
}
