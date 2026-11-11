import { computed, onBeforeUnmount, ref } from 'vue-lynx'
import { useRaf } from './useRaf'

export type CurrentTime = {
  days: number
  hours: number
  total: number
  minutes: number
  seconds: number
  milliseconds: number
}

export type UseCountDownOptions = {
  time: number
  millisecond?: boolean
  onChange?: (current: CurrentTime) => void
  onFinish?: () => void
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function normalizeTime(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}
function parseTime(time: number): CurrentTime {
  return {
    total: time,
    days: Math.floor(time / DAY),
    hours: Math.floor((time % DAY) / HOUR),
    minutes: Math.floor((time % HOUR) / MINUTE),
    seconds: Math.floor((time % MINUTE) / SECOND),
    milliseconds: Math.floor(time % SECOND)
  }
}

/**
 * The options may use property getters so component props stay live without changing
 * the public number/boolean contract. A completed/reset cycle emits finish at most
 * once; paused sub-second time and late callbacks must not restart an old cycle.
 */
export function useCountDown(options: UseCountDownOptions) {
  let endTime = 0
  let counting = false
  let finished = false
  let alive = true
  let revision = 0
  const remain = ref(normalizeTime(options.time))
  const current = computed(() => parseTime(remain.value))
  const { start: startRaf, cancel: cancelRaf } = useRaf(tick)

  function pause() {
    if (!alive) return
    if (counting) remain.value = Math.max(0, endTime - Date.now())
    counting = false
    revision++
    cancelRaf()
  }
  function tick() {
    if (!alive || !counting) return
    const version = revision
    const value = Math.max(0, endTime - Date.now())
    if (options.millisecond || Math.floor(value / SECOND) !== Math.floor(remain.value / SECOND) || value === 0) {
      remain.value = value
      if (value === 0) {
        counting = false
        finished = true
        cancelRaf()
      }
      // Events are immutable-by-ownership snapshots, not the slot's cached object.
      options.onChange?.({ ...current.value })
      if (!alive || version !== revision) return
      if (value === 0) options.onFinish?.()
    }
    if (alive && counting && version === revision) startRaf()
  }
  function start() {
    if (!alive || counting || finished) return
    endTime = Date.now() + remain.value
    counting = true
    revision++
    startRaf()
  }
  function reset(totalTime: number = options.time) {
    if (!alive) return
    pause()
    finished = false
    remain.value = normalizeTime(totalTime)
  }
  onBeforeUnmount(() => {
    alive = false
    counting = false
    revision++
    cancelRaf()
  })
  return { start, pause, reset, current }
}
