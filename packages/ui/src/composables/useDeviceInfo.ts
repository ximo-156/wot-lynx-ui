import { ref, computed } from 'vue-lynx'
import { getSystemInfo } from '../common/util'

interface SafeArea {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

interface CapsuleInfo {
  width: number
  height: number
  left: number
  right: number
  top: number
  bottom: number
}

const safeArea = ref<SafeArea>({
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  width: 0,
  height: 0
})

const capsule = ref<CapsuleInfo>({
  width: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  bottom: 0
})

const statusBarHeight = ref<number>(0)
const screenWidth = ref<number>(0)
const screenHeight = ref<number>(0)
const windowWidth = ref<number>(0)
const windowHeight = ref<number>(0)
const initialized = ref<boolean>(false)

/**
 * 初始化设备信息（Lynx SystemInfo）
 */
function init() {
  try {
    const systemInfo = getSystemInfo()
    // 更新安全区域信息（Lynx 未提供安全区数据，置零处理）
    if (systemInfo.safeArea) {
      safeArea.value = {
        left: systemInfo.safeArea.left,
        right: systemInfo.screenWidth - systemInfo.safeArea.right,
        top: systemInfo.safeArea.top,
        bottom: systemInfo.safeArea.bottom,
        width: systemInfo.safeArea.width,
        height: systemInfo.safeArea.height
      }
    }

    statusBarHeight.value = systemInfo.statusBarHeight || 0

    screenWidth.value = systemInfo.screenWidth
    screenHeight.value = systemInfo.screenHeight
    windowWidth.value = systemInfo.windowWidth
    windowHeight.value = systemInfo.windowHeight

    initialized.value = true
  } catch (error) {
    console.error('获取设备信息失败', error)
  }
}

/**
 * 更新设备信息
 */
function update() {
  init()
}

export function useDeviceInfo() {
  // 确保至少初始化一次
  if (!initialized.value) {
    init()
  }

  // 获取底部安全区域高度
  const safeAreaBottomHeight = computed(() => screenHeight.value - safeArea.value.bottom)

  // 获取顶部安全区域高度（包含状态栏）
  const safeAreaTopHeight = computed(() => safeArea.value.top)

  // 获取导航栏高度（不包含状态栏）
  const navBarHeight = computed(() => capsule.value.height + (capsule.value.top - statusBarHeight.value) * 2)

  // 获取导航栏整体高度（包含状态栏）
  const navBarTotalHeight = computed(() => navBarHeight.value + statusBarHeight.value)

  return {
    safeArea,
    capsule,
    statusBarHeight,
    screenWidth,
    screenHeight,
    windowWidth,
    windowHeight,
    initialized,
    safeAreaBottomHeight,
    safeAreaTopHeight,
    navBarHeight,
    navBarTotalHeight,
    init,
    update
  }
}
