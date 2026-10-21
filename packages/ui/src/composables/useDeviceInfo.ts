import { ref, computed } from 'vue-lynx'
import { getSystemInfo } from '../common/util'
import { getUniAdapter } from '../common/uniAdapter'

interface SafeArea { left: number; right: number; top: number; bottom: number; width: number; height: number }
interface CapsuleInfo { width: number; height: number; left: number; right: number; top: number; bottom: number }
const safeArea = ref<SafeArea>({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 })
const capsule = ref<CapsuleInfo>({ width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 })
const statusBarHeight = ref(0)
const screenWidth = ref(0)
const screenHeight = ref(0)
const windowWidth = ref(0)
const windowHeight = ref(0)
const hostNavBarHeight = ref(0)
const initialized = ref(false)

/** 缺失安全区时用全屏矩形，不能把 bottom=0 当作整屏高度的安全区。 */
function init() {
  try {
    const info = getSystemInfo()
    screenWidth.value = info.screenWidth
    screenHeight.value = info.screenHeight
    windowWidth.value = info.windowWidth
    windowHeight.value = info.windowHeight
    const area = info.safeArea
    safeArea.value = area ? {
      left: Math.max(0, Number(area.left) || 0),
      right: Math.max(0, info.screenWidth - Number(area.right ?? info.screenWidth)),
      top: Math.max(0, Number(area.top) || 0),
      bottom: Math.min(info.screenHeight, Math.max(0, Number(area.bottom ?? info.screenHeight))),
      width: Number(area.width) || Math.max(0, Number(area.right ?? info.screenWidth) - Number(area.left || 0)),
      height: Number(area.height) || Math.max(0, Number(area.bottom ?? info.screenHeight) - Number(area.top || 0))
    } : { left: 0, right: 0, top: 0, bottom: info.screenHeight, width: info.screenWidth, height: info.screenHeight }
    statusBarHeight.value = info.statusBarHeight
    hostNavBarHeight.value = Math.max(0, Number(info.navBarHeight) || 0)
    const capsuleInfo = getUniAdapter('getMenuButtonBoundingClientRect')?.()
    capsule.value = capsuleInfo && Number(capsuleInfo.height) > 0 ? {
      width: Number(capsuleInfo.width) || 0,
      height: Number(capsuleInfo.height) || 0,
      left: Number(capsuleInfo.left) || 0,
      right: Math.max(0, info.screenWidth - Number(capsuleInfo.right ?? info.screenWidth)),
      top: Number(capsuleInfo.top) || 0,
      bottom: Number(capsuleInfo.bottom) || 0
    } : { width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 }
    initialized.value = true
  } catch (error) {
    console.error('获取设备信息失败', error)
  }
}
function update() { init() }
export function useDeviceInfo() {
  if (!initialized.value) init()
  const safeAreaBottomHeight = computed(() => Math.max(0, screenHeight.value - safeArea.value.bottom))
  const safeAreaTopHeight = computed(() => safeArea.value.top)
  // 没有胶囊的 Lynx 宿主不可套用小程序公式，否则 statusBarHeight>0 得到负高。
  const navBarHeight = computed(() => capsule.value.height > 0
    ? Math.max(0, capsule.value.height + (capsule.value.top - statusBarHeight.value) * 2)
    : hostNavBarHeight.value)
  const navBarTotalHeight = computed(() => navBarHeight.value + statusBarHeight.value)
  return { safeArea, capsule, statusBarHeight, screenWidth, screenHeight, windowWidth, windowHeight,
    initialized, safeAreaBottomHeight, safeAreaTopHeight, navBarHeight, navBarTotalHeight, init, update }
}
