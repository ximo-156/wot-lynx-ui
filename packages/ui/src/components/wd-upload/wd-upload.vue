/*
 * wd-upload — 上传
 *
 * Lynx 实现说明：
 * - 选文件 / 上传 / 中断经 composables/useUpload + common/uni 兼容层，
 *   宿主可注入媒体选择与上传能力，未注入时统一降级；
 * - 预览列表：图片 / 视频 / 文件三种形态，状态（pending/loading/success/fail）
 *   经 statusKey 字段驱动；
 * - beforeUpload / beforeRemove / beforePreview / beforeChoose 拦截器
 *   经 common/interceptor 下发。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import { context, deepClone, isDef, isEqual, isImageUrl, isPromise, isVideoUrl, uuid, parseStyle } from '../../common/util'
import { callInterceptor } from '../../common/interceptor'
import { useTranslate } from '../../composables/useTranslate'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { useUpload } from '../../composables/useUpload'
import { useAlive } from '../../composables/useAlive'
import {
  uploadProps,
  type UploadExpose,
  type UploadFileItem
} from './types'

const props = defineProps(uploadProps)
const isDisabled = useFormDisabled(props)

const emit = defineEmits<{
  (e: 'fail', value: any): void
  (e: 'change', value: any): void
  (e: 'success', value: any): void
  (e: 'progress', value: any): void
  (e: 'oversize', value: any): void
  (e: 'chooseerror', value: any): void
  (e: 'remove', value: any): void
  (e: 'update:fileList', value: UploadFileItem[]): void
}>()

defineExpose<UploadExpose>({
  submit: () => startUploadFiles(),
  abort: () => abort()
})

const { translate } = useTranslate('upload')

// 选文件（宿主相册 UI，耗时不可控）/ buildFormData Promise / 上传回调均可能
// 晚于组件卸载落地；续写 uploadFiles 或在已销毁树上 emit 会触发 vue-lynx
// 继续 patch，产生晚到的 remove/insert（真机 9902 removeNode 家族）。
const isAlive = useAlive()

const uploadFiles = ref<UploadFileItem[]>([])

const showUpload = computed(() => !props.limit || uploadFiles.value.length < props.limit)

const { startUpload, abort, chooseFile, UPLOAD_STATUS } = useUpload()

watch(
  () => props.fileList,
  (val) => {
    const { statusKey } = props
    if (isEqual(val, uploadFiles.value)) return
    // 先浅拷贝再补默认值：不得直接改写消费方传入的 prop 对象
    // （deep watch 内改写被监听 props 还有自触发循环风险）
    const uploadFileList: UploadFileItem[] = (val as UploadFileItem[]).map((item) => {
      const copy = { ...item, uid: context.id++ } as UploadFileItem
      copy[statusKey] = copy[statusKey] || 'success'
      copy.response = copy.response || ''
      return copy
    })
    uploadFiles.value = uploadFileList
  },
  { deep: true, immediate: true }
)

function emitFileList() {
  emit('update:fileList', uploadFiles.value)
}

/** 开始上传全部 pending 文件 */
function startUploadFiles() {
  const { buildFormData, formData = {}, statusKey } = props
  const { action, name, header = {}, accept, successStatus, uploadMethod } = props
  const statusCode = isDef(successStatus) ? successStatus : 200

  for (const uploadFile of uploadFiles.value) {
    if (uploadFile[statusKey] !== UPLOAD_STATUS.PENDING) continue

    const runUpload = (fd: Record<string, any>) => {
      // buildFormData 的 Promise 可能晚于卸载 settle
      if (!isAlive()) return
      startUpload(uploadFile, {
        action,
        header,
        name,
        formData: fd,
        fileType: accept === 'video' ? 'video' : 'image',
        statusCode,
        abortPrevious: false,
        uploadMethod,
        onSuccess: (res: any, file: UploadFileItem, data: Record<string, any>) => {
          file[statusKey] = UPLOAD_STATUS.SUCCESS
          emit('success', { file, response: res, formData: data })
          emitFileList()
        },
        onError: (res: any, file: UploadFileItem, data: Record<string, any>) => {
          file[statusKey] = UPLOAD_STATUS.FAIL
          emit('fail', { file, error: res })
          emitFileList()
        },
        onProgress: (res: any, file: UploadFileItem) => {
          file.percent = res.progress
          emit('progress', { file, progress: res.progress })
        }
      })
    }

    if (buildFormData) {
      const res = buildFormData({ file: uploadFile, formData })
      if (isPromise(res)) {
        res.then((newFormData) => newFormData && runUpload(newFormData))
      } else if (res) {
        runUpload(res)
      }
    } else {
      runUpload(formData)
    }
  }
}

/** 选择文件 */
async function handleChoose() {
  if (isDisabled.value) return
  const chooseOptions = {
    accept: props.accept,
    multiple: props.multiple,
    sizeType: props.sizeType,
    sourceType: props.sourceType,
    maxCount: props.limit ? props.limit - uploadFiles.value.length : 9
  }

  callInterceptor(props.beforeChoose, {
    args: [chooseOptions],
    done: async () => {
      try {
        const files = await chooseFile(chooseOptions)
        // 相册 UI 停留期间页面可能已卸载
        if (!isAlive()) return
        onFilesChosen(files)
      } catch (error) {
        emit('chooseerror', error)
      }
    }
  })
}

function onFilesChosen(files: any[]) {
  // beforeChoose / beforeUpload 的拦截器 done 可能晚于卸载落地
  if (!isAlive()) return
  const { statusKey, maxSize } = props
  const newFiles: UploadFileItem[] = []

  for (const file of files) {
    const item: UploadFileItem = {
      uid: context.id++,
      url: file.path || file.url || '',
      name: file.name || '',
      size: file.size,
      type: file.type || 'image',
      thumb: file.thumb || file.path || ''
    }
    item[statusKey] = UPLOAD_STATUS.PENDING

    if (item.size && maxSize && item.size > maxSize) {
      emit('oversize', { file: item, maxSize })
      continue
    }
    newFiles.push(item)
  }

  if (newFiles.length === 0) return

  const merged = [...uploadFiles.value, ...newFiles]
  const finalFiles = props.limit ? merged.slice(0, props.limit) : merged

  const pending = finalFiles.filter((f) => f[statusKey] === UPLOAD_STATUS.PENDING)

  // beforeUpload 声明的签名是单文件 (file, formData)：多选文件时逐个
  // 调用，其余文件不再绕过上传前拦截器；拦截返回 false 只移除该文件
  // （此前只对 pending[0] 调用，且 false 时把全部 pending 一起移除）。
  const rejected = new Set<UploadFileItem>()
  let remaining = pending.length
  let settled = false

  const settle = () => {
    if (settled) return
    settled = true
    // beforeUpload 可返回未决 Promise：确认期间组件/页面可能已卸载
    if (!isAlive()) return
    const accepted = finalFiles.filter((f) => !rejected.has(f))
    uploadFiles.value = accepted
    emitFileList()
    emit('change', { fileList: accepted })
    // 立即开始上传
    startUploadFiles()
  }

  if (pending.length === 0) {
    // 无待上传文件（如 limit 截断）：仅应用列表变更
    settle()
    return
  }

  for (const file of pending) {
    callInterceptor(props.beforeUpload, {
      args: [file, props.formData],
      done: () => {
        // beforeUpload 可返回未决 Promise：确认期间组件/页面可能已卸载
        if (!isAlive()) return
        remaining--
        if (remaining <= 0) settle()
      },
      canceled: () => {
        // 拦截：仅移除该文件
        if (!isAlive()) return
        rejected.add(file)
        remaining--
        if (remaining <= 0) settle()
      }
    })
  }
}

/** 删除文件 */
function onRemove(file: UploadFileItem, index: number) {
  if (isDisabled.value) return
  const fileList = deepClone(uploadFiles.value)
  fileList.splice(index, 1)
  callInterceptor(props.beforeRemove, {
    args: [file, fileList],
    done: () => {
      // beforeRemove 可返回未决 Promise：确认期间组件可能已卸载
      if (!isAlive()) return
      uploadFiles.value = fileList
      emitFileList()
      emit('remove', { file, index, fileList })
      emit('change', { fileList })
    }
  })
}

/** 预览：beforePreview 拦截通过后由原生 image / video 元素承接预览 */
function onPreview(file: UploadFileItem, index: number) {
  callInterceptor(props.beforePreview, {
    args: [{ file, index }],
    done: () => {}
  })
}

const isImage = (file: UploadFileItem) => file.type === 'image' || (!file.type && isImageUrl(file.url || ''))
const isVideo = (file: UploadFileItem) => file.type === 'video' || (!file.type && isVideoUrl(file.url || ''))
const isFail = (file: UploadFileItem) => file[props.statusKey] === UPLOAD_STATUS.FAIL

const limitText = computed(() => {
  if (!props.limit || !props.showLimitNum) return ''
  return `${uploadFiles.value.length}/${props.limit}`
})
</script>

<template>
  <view :class="['wd-upload', customClass]" :style="parseStyle(customStyle)">
    <!-- 预览列表：key 用 file.uid 而非 index——删除中间项时 index 会错配复用 -->
    <view
      v-for="(file, index) in uploadFiles"
      :key="file.uid"
      :class="['wd-upload__preview', customPreviewClass]"
    >
      <view class="wd-upload__status-content">
        <image
          v-if="isImage(file)"
          :src="file.url"
          :mode="imageMode"
          class="wd-upload__picture"
          @tap="onPreview(file, index)"
        />
        <view v-else-if="isVideo(file)" class="wd-upload__video" @tap="onPreview(file, index)">
          <image v-if="file.thumb" :src="file.thumb" :mode="imageMode" class="wd-upload__picture" />
          <wd-icon name="play" custom-class="wd-upload__video-play" />
        </view>
        <view v-else class="wd-upload__file" @tap="onPreview(file, index)">
          <wd-icon name="file" custom-class="wd-upload__file-icon" />
          <text class="wd-upload__file-name">{{ file.name || translate('file') }}</text>
        </view>

        <!-- 加载中 -->
        <view v-if="file[statusKey] === 'loading'" class="wd-upload__loading">
          <wd-loading :type="loadingType" custom-class="wd-upload__loading-icon" />
        </view>

        <!-- 失败蒙层 -->
        <view v-if="isFail(file)" class="wd-upload__fail-mask" @tap="onRemove(file, index)">
          <text class="wd-upload__fail-text">{{ translate('retry') }}</text>
        </view>

        <!-- 删除按钮 -->
        <view v-if="!isDisabled && !disabled" class="wd-upload__delete" @tap="onRemove(file, index)">
          <wd-icon name="close" custom-class="wd-upload__delete-icon" />
        </view>
      </view>
    </view>

    <!-- 上传按钮 -->
    <view v-if="showUpload && !isDisabled && !disabled" class="wd-upload__upload" @tap="handleChoose">
      <wd-icon name="add" custom-class="wd-upload__add" />
      <text v-if="limitText" class="wd-upload__limit">{{ limitText }}</text>
    </view>
  </view>
</template>
