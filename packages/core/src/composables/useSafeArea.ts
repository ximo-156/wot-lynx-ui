import { computed } from 'vue-lynx'
import { getSafeAreaInsets, type SafeAreaEdge } from '../common/safe-area'
import { useViewportSize } from './useWideViewport'

/** Shared window-relative safe area, refreshed with the existing viewport lifecycle. */
export function useSafeArea() {
  const viewport = useViewportSize()
  const insets = computed(() => {
    void viewport.revision.value
    return getSafeAreaInsets()
  })

  /**
   * Explicit host values (including 0) win. Otherwise let the layout engine resolve
   * env(); do not guess a phone model from pixelHeight or bake in status-bar sizes.
   * Lynx's env parser does not support the Web comma-fallback form.
   */
  function inset(edge: SafeAreaEdge, spacing = 0): string {
    const area = insets.value
    if (area.known[edge]) return `${area[edge] + spacing}px`
    const environment = `env(safe-area-inset-${edge})`
    return spacing ? `calc(${spacing}px + ${environment})` : environment
  }

  /** Bound a panel inside the safe viewport; env() also works inside native calc(). */
  function remaining(size: number, edges: SafeAreaEdge[]): string {
    const area = insets.value
    let pixels = size
    const environment: string[] = []
    for (const edge of edges) {
      if (area.known[edge]) pixels -= area[edge]
      else environment.push(`env(safe-area-inset-${edge})`)
    }
    const base = `${Math.max(1, pixels)}px`
    return environment.length ? `calc(${base} - ${environment.join(' - ')})` : base
  }

  return { ...viewport, insets, inset, remaining }
}
