<script setup lang="ts">
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
  <!-- 布局：视觉层在下、命中层在上。input 绝对定位铺满唤起项且 opacity:0，
       承接全部点击（ Lynx 命中测试按几何区域，不按透明度）；视觉层只负责
       相机图标 + n/limit 计数，与组件内置唤起项外观一致。 -->
  <view class="demo-upload-evoke">
    <view class="demo-upload-evoke__body">
      <wd-icon name="camera" custom-class="demo-upload-evoke__icon" />
      <text class="demo-upload-evoke__num">（{{ count }}/{{ limit }}）</text>
    </view>
    <input
      class="demo-upload-evoke__input"
      type="file"
      accept="image/*"
      @tap.stop
      @change="onFileEvent"
      @input="onFileEvent"
    />
  </view>
</template>

<style scoped>
.demo-upload-evoke {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 88px;
  height: 88px;
  border-radius: var(--wot-upload-radius, 8px);
  background: var(--wot-upload-evoke-bg, var(--wot-filled-bottom, #f7f8fa));
  border-width: 1px;
  border-style: dashed;
  border-color: var(--wot-upload-border-color, var(--wot-border-main, #e5e6eb));
  overflow: hidden;
}

.demo-upload-evoke__body {
  /* 视觉层永不吞点击：命中层（input）失效时点击继续下穿，
     最终冒泡到 wd-upload 唤起槽触发 chooseerror——可见的诊断信号 */
  pointer-events: none;
}

.demo-upload-evoke__icon {
  font-size: var(--wot-upload-evoke-icon-size, 32px);
  color: var(--wot-upload-evoke-icon-color, var(--wot-icon-auxiliary, #6b7085));
}

.demo-upload-evoke__num {
  color: var(--wot-upload-evoke-color, var(--wot-text-auxiliary, #868a9c));
  font-size: var(--wot-upload-evoke-font-size, 14px);
  line-height: var(--wot-upload-evoke-line-height, 20px);
  text-align: center;
}

/* 命中层：铺满 + 全透明。声明顺序在视觉层之后即绘制在上层，无需 z-index */
.demo-upload-evoke__input {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
}
</style>
