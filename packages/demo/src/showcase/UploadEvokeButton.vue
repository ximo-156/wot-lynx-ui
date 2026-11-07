<script setup lang="ts">
import './UploadEvokeButton.css'

/*
 * UploadEvokeButton — wd-upload 的原生唤起项（真机选图）。
 *
 * 为什么替换组件内置的「+ 唤起项」（2026-11-05 真机反馈「点击没反应、
 * 无法调用系统相册」）：内置唤起项点击后走的是组件内部选文件链路
 * （useUpload().chooseFile → common/uni.ts 的 uni.chooseMedia 兼容层）。
 * Lynx 引擎**不内置**相册/选图 API，宿主不注入时整条链路静默降级
 * （warning + fail → chooseerror），页面上什么都看不到。
 *
 * 现在的做法（Vue Lynx 原生能力）：唤起项就是一枚原生 <input type="file">，
 * 全屏覆盖在视觉按钮之上。点击由**引擎原生**直接唤起系统相册，选完经
 * change 事件回传文件——不经过任何兼容层 / 适配器 / 宿主注入。
 *
 * 两个平台事实：
 *   - input[type=file] **只兼容原生端**：Lynx Web 的 x-input 会把 type
 *     透传给 shadow DOM 里的真实 input（能弹选择器），但不派发文件事件，
 *     选完拿不到文件。Web 预览里选图不可用，真机验收为准；
 *   - @tap.stop 编译为 catchtap（Lynx catch 语义，见 wd-slide-verify 的
 *     touchmove 同款用法）：阻止点击冒泡到 wd-upload 唤起槽的外层 view，
 *     否则会误触组件内部的 chooseFile 降级链路，弹出一个没有意义的
 *     chooseerror。
 */
import { ref } from 'vue-lynx'

/** 归一后的选中文件：path 为本地临时路径，直接作为 <image src> 使用 */
type PickedFile = {
  path: string
  size: number
  name: string
}

defineProps<{
  /** 已选个数（唤起项上的 n/limit 计数） */
  count: number
  /** 上限个数 */
  limit: number
}>()

const emit = defineEmits<{
  (e: 'picked', files: PickedFile[]): void
}>()

/** 事件载荷的形状随引擎版本可能不同（files / tempFiles / 单文件 path），统一防御性归一 */
function pickString(...values: any[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value) return value
  }
  return ''
}

function normalizeFiles(detail: any): PickedFile[] {
  if (!detail) return []
  const singlePath = pickString(detail.path, detail.tempFilePath, detail.filePath, detail.url)
  const list: any[] = Array.isArray(detail.files)
    ? detail.files
    : Array.isArray(detail.tempFiles)
      ? detail.tempFiles
      : detail.file
        ? [detail.file]
        : singlePath
          ? [detail]
          : []
  return list
    .map((item: any) => {
      const path = pickString(
        item?.path,
        item?.tempFilePath,
        item?.filePath,
        item?.url,
        typeof item === 'string' ? item : ''
      )
      const name = pickString(item?.name, item?.fileName) || (path ? path.split('/').pop() || '' : '')
      return { path, size: Number(item?.size) || 0, name }
    })
    .filter((file) => !!file.path)
}

/**
 * change 与 input 都可能被派发（引擎版本差异），同一批文件只处理一次：
 * 以路径拼接串为签名去重。首次触发打印原始载荷——真机 DevTool 里一眼确认
 * 引擎回传的文件结构，形状对不上时按日志调整 normalizeFiles 即可。
 */
const lastSignature = ref('')

function onFileEvent(event: any) {
  const detail = event?.detail ?? event
  try {
    console.log('[demo] input[type=file] 事件载荷：', JSON.stringify(detail))
  } catch {
    console.log('[demo] input[type=file] 事件载荷（不可序列化）：', detail)
  }
  const files = normalizeFiles(detail)
  const signature = files.map((file) => file.path).join('|')
  if (!signature || signature === lastSignature.value) return
  lastSignature.value = signature
  if (!files.length) {
    console.warn('[demo] input[type=file] 未解析到文件，请对照上面的原始载荷调整归一逻辑')
    return
  }
  emit('picked', files)
}
</script>

<template>
  <!-- 布局：视觉层在下、命中层在上。透明 view 盒覆盖唤起项，input 填满盒子。
       Web 的 x-input 强制 display:contents，不能只靠 input 自身 opacity 隐藏；
       view 盒负责透明合成，两端仍由原生 input 承接点击与选图。 -->
  <view class="demo-upload-evoke">
    <view class="demo-upload-evoke__body">
      <wd-icon name="camera" custom-class="demo-upload-evoke__icon" />
      <text class="demo-upload-evoke__num">（{{ count }}/{{ limit }}）</text>
    </view>
    <view class="demo-upload-evoke__input-wrap">
      <input
        class="demo-upload-evoke__input"
        type="file"
        accept="image/*"
        @tap.stop
        @change="onFileEvent"
        @input="onFileEvent"
      />
    </view>
  </view>
</template>
