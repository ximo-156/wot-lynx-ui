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

const uploadFiles = ref<UploadFileItem[]>([])

const showUpload = computed(() => !props.limit || uploadFiles.value.length < props.limit)

const { startUpload, abort, chooseFile, UPLOAD_STATUS } = useUpload()

watch(
  () => props.fileList,
  (val) => {
    const { statusKey } = props
    if (isEqual(val, uploadFiles.value)) return
    const uploadFileList: UploadFileItem[] = (val as UploadFileItem[]).map((item) => {
      item[statusKey] = item[statusKey] || 'success'
      item.response = item.response || ''
      return { ...item, uid: context.id++ }
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
        onFilesChosen(files)
      } catch (error) {
        emit('chooseerror', error)
      }
    }
  })
}

function onFilesChosen(files: any[]) {
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
  callInterceptor(props.beforeUpload, {
    args: [pending[0], props.formData],
    done: () => {
      uploadFiles.value = finalFiles
      emitFileList()
      emit('change', { fileList: finalFiles })
      // 立即开始上传
      startUploadFiles()
    },
    canceled: () => {
      // 拦截：移除待上传文件
      uploadFiles.value = uploadFiles.value.filter((f) => f[statusKey] !== UPLOAD_STATUS.PENDING)
      emitFileList()
    }
  })
}

/** 删除文件 */
function onRemove(file: UploadFileItem, index: number) {
  if (isDisabled.value) return
  const fileList = deepClone(uploadFiles.value)
  fileList.splice(index, 1)
  callInterceptor(props.beforeRemove, {
    args: [file, fileList],
    done: () => {
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
    <!-- 预览列表 -->
    <view
      v-for="(file, index) in uploadFiles"
      :key="index"
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
          <wd-icon name="play-circle-fill" custom-class="wd-upload__video-play" />
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
      <wd-icon name="plus" custom-class="wd-upload__add" />
      <text v-if="limitText" class="wd-upload__limit">{{ limitText }}</text>
    </view>
  </view>
</template>
