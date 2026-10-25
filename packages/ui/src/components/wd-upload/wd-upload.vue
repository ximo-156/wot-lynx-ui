/*
 * wd-upload — 上传
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 模板结构逐节点对齐参考源：根 view → 预览列表（图片 / 视频 / 文件三种
 *   形态 + 状态蒙层 + 关闭按钮 + preview-cover 插槽）→ 唤起项（默认插槽或
 *   相机图标唤起按钮）；
 * - 参考源的 uni-app 条件编译分支（MP-WEIXIN 的 previewMedia / APP-PLUS 的
 *   video-camera 图标）全部移除：视频预览统一走本地 wd-video-preview 组件
 *   （非 MP 分支的等价实现），文件图标按平台能力取舍；
 * - 事件映射：@click → @tap（CONVENTIONS §6，Lynx view 不派发 click）；
 * - uni.pageScrollTo / uni.previewImage / uni.openDocument / uni.previewMedia
 *   等平台调用经 common/uni 适配层下发（宿主可经 configureUniAdapter 注入
 *   真实能力，未注入时降级并 warning），getImageInfo 同理；
 * - 文件选择 / 上传 / 中断经 composables/useUpload（宿主媒体能力适配层）；
 * - customStyle 为字符串，经 parseStyle 归一为对象语法（CONVENTIONS §19：
 *   字符串 :style 会被 vue-lynx 静默丢弃）；
 * - 参考源 view 承载的裸文本（file-name / evoke-num）包进 text 元素
 *   （CONVENTIONS §4）；
 * - fileList watch 内先浅拷贝再补默认值：不直接改写消费方传入的 prop 对象
 *   （deep watch 内改写被监听 props 有自触发循环风险）；
 * - 异步入口（选文件 Promise、拦截器 done、上传回调）加 isAlive 守卫：
 *   回调晚于组件卸载落地时续写 uploadFiles 会触发 vue-lynx 在已销毁树上
 *   patch（真机 9902 removeNode 家族）；
 * - 图标名 camera-fill / play-circle-fill / close-circle / video-camera 在
 *   本地 iconfont 集中无对应字形，经 resolveIconName 取最近似字形
 *   （camera / play / close / film），消费者显式传入的其它名字原样下发；
 * - 布局居中（NATIVE-REWRITE §3）：根 view 显式 display: flex +
 *   flex-direction: row + flex-wrap: wrap（预览项 / 唤起项横向换行）；
 *   __evoke / __file / __video / __status-content 均为 flex 纵排 + 双轴居中
 *   容器；__file-name / __evoke-num / __progress-txt 补 text-align: center；
 *   播放图标（__video-play）由参考源的 top/left 50% + translate(-50%, -50%)
 *   改为四边 0 + flex 居中（图标根 view 自身即居中载体，不加包裹元素）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onUnmounted, ref, watch } from 'vue-lynx'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import WdLoading from '../../primitives/wd-loading/wd-loading.vue'
import WdVideoPreview from '../wd-video-preview/wd-video-preview.vue'
import { context, deepClone, isDef, isEqual, isImageUrl, isPromise, isVideoUrl, parseStyle, uuid } from '../../common/util'
import { callInterceptor } from '../../common/interceptor'
import { useTranslate } from '../../composables/useTranslate'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { useUpload } from '../../composables/useUpload'
import { useAlive } from '../../composables/useAlive'
import { uni } from '../../common/uni'
import { hasIcon } from '../../icons/registry'
import {
  uploadProps,
  type ChooseFile,
  type UploadExpose,
  type UploadFileItem
} from './types'
import { useVideoPreview } from '../wd-video-preview'

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
  abort: (task) => abort(task)
})

const { translate } = useTranslate('upload')

// 选文件（宿主相册 UI，耗时不可控）/ buildFormData Promise / 上传回调均可能
// 晚于组件卸载落地；续写 uploadFiles 或在已销毁树上 emit 会触发 vue-lynx
// 继续 patch，产生晚到的 remove/insert（真机 9902 removeNode 家族）。
const isAlive = useAlive()

const uploadFiles = ref<UploadFileItem[]>([])
const preparingUploads = new Set<number>()
onUnmounted(() => abort())

const showUpload = computed(() => !props.limit || uploadFiles.value.length < props.limit)

const videoPreviewId = ref<string>(`videoPreview${uuid()}`)
const { previewVideo } = useVideoPreview(videoPreviewId.value)

const { startUpload, abort, chooseFile, UPLOAD_STATUS } = useUpload()

watch(
  () => props.fileList,
  (val) => {
    const { statusKey } = props
    if (isEqual(val, uploadFiles.value)) return
    const uploadFileList: UploadFileItem[] = (val as UploadFileItem[]).map((item) => {
      // 先浅拷贝再补默认值：不得直接改写消费方传入的 prop 对象
      const copy = { ...item, uid: isDef(item.uid) ? item.uid : context.id++ } as UploadFileItem
      copy[statusKey] = copy[statusKey] || 'success'
      copy.response = copy.response || ''
      return copy
    })
    uploadFiles.value = uploadFileList
  },
  {
    deep: true,
    immediate: true
  }
)

watch(
  () => props.limit,
  (val) => {
    if (val && val < uploadFiles.value.length) {
      console.error('[wot-design]Error: props limit must less than fileList.length')
    }
  },
  {
    deep: true,
    immediate: true
  }
)

function emitFileList() {
  emit('update:fileList', uploadFiles.value)
}

/**
 *  开始上传文件
 */
function startUploadFiles() {
  if (!isAlive() || isDisabled.value) return
  const { buildFormData, formData = {}, statusKey } = props
  const { action, name, header = {}, accept, successStatus, uploadMethod } = props
  const statusCode = isDef(successStatus) ? successStatus : 200

  for (const uploadFile of uploadFiles.value) {
    if (uploadFile[statusKey] !== UPLOAD_STATUS.PENDING || preparingUploads.has(uploadFile.uid)) continue
    preparingUploads.add(uploadFile.uid)
    const uid = uploadFile.uid
    // 上传适配层会原地更新 file；给它普通快照，晚到回调不可修改已卸载的响应式列表。
    const fileSnapshot = { ...uploadFile }
    const beginUpload = (data: Record<string, any>) => {
      preparingUploads.delete(uid)
      const current = uploadFiles.value.find((item) => item.uid === uid)
      if (!isAlive() || isDisabled.value || !current || current[statusKey] !== UPLOAD_STATUS.PENDING || !data) return
      current[statusKey] = UPLOAD_STATUS.LOADING
      emitFileList()
      try {
        const result = startUpload(fileSnapshot, {
          action, header, name, formData: data,
          fileType: accept as 'image' | 'video' | 'audio', statusCode, statusKey, uploadMethod,
          onSuccess: handleSuccess, onError: handleError, onProgress: handleProgress
        })
        if (isPromise(result)) {
          result.catch((error) => handleError(error as Record<string, any>, fileSnapshot, data))
        }
      } catch (error) {
        handleError(error as Record<string, any>, fileSnapshot, data)
      }
    }
    try {
      const data = buildFormData ? buildFormData({ file: fileSnapshot, formData }) : formData
      if (isPromise(data)) {
        data.then((value) => beginUpload(value)).catch((error) => {
          preparingUploads.delete(uid)
          handleError(error as Record<string, any>, fileSnapshot, formData)
        })
      } else {
        beginUpload(data)
      }
    } catch (error) {
      preparingUploads.delete(uid)
      handleError(error as Record<string, any>, fileSnapshot, formData)
    }
  }
}

/**
 * 获取图片信息
 * @param img
 */
function getImageInfo(img: string) {
  return new Promise<any>((resolve, reject) => {
    uni.getImageInfo({
      src: img,
      success: (res: any) => {
        resolve(res)
      },
      fail: (error: any) => {
        reject(error)
      }
    })
  })
}

/**
 * @description 初始化文件数据
 * @param {Object} file 上传的文件
 */
function initFile(file: ChooseFile, currentIndex?: number) {
  if (!isAlive() || isDisabled.value) return
  if (!isDef(currentIndex) && props.limit && uploadFiles.value.length >= props.limit) return
  const { statusKey } = props
  // 状态初始化
  const initState: UploadFileItem = {
    uid: context.id++,
    // 仅h5支持 name
    name: file.name || '',
    thumb: file.thumb || '',
    [statusKey]: 'pending',
    size: file.size || 0,
    url: file.path,
    percent: 0
  }
  if (typeof currentIndex === 'number') {
    uploadFiles.value.splice(currentIndex, 1, initState)
  } else {
    uploadFiles.value.push(initState)
  }
  emit('change', { fileList: uploadFiles.value })
  emitFileList()
  if (props.autoUpload) {
    startUploadFiles()
  }
}

/**
 * @description 上传失败捕获
 * @param {Object} err 错误返回信息
 * @param {Object} file 上传的文件
 */
function handleError(err: Record<string, any>, file: UploadFileItem, formData: Record<string, any>) {
  if (!isAlive()) return
  const { statusKey } = props
  const index = uploadFiles.value.findIndex((item) => item.uid === file.uid)
  if (index > -1) {
    uploadFiles.value[index][statusKey] = 'fail'
    uploadFiles.value[index].error = err.errMsg || err.message || translate('error')
    uploadFiles.value[index].response = err
    emit('fail', { error: err, file: uploadFiles.value[index], formData })
    emitFileList()
  }
}

/**
 * @description 上传成功捕获
 * @param {Object} res 接口返回信息
 * @param {Object} file 上传的文件
 */
function handleSuccess(res: Record<string, any>, file: UploadFileItem, formData: Record<string, any>) {
  if (!isAlive()) return
  const { statusKey } = props
  const index = uploadFiles.value.findIndex((item) => item.uid === file.uid)
  if (index > -1) {
    uploadFiles.value[index][statusKey] = 'success'
    uploadFiles.value[index].response = res.data
    emit('change', { fileList: uploadFiles.value })
    emit('success', { file: uploadFiles.value[index], fileList: uploadFiles.value, formData })
    emitFileList()
  }
}

/**
 * @description 上传中捕获
 * @param {Object} res 接口返回信息
 * @param {Object} file 上传的文件
 */
function handleProgress(res: any, file: UploadFileItem) {
  if (!isAlive()) return
  const index = uploadFiles.value.findIndex((item) => item.uid === file.uid)
  if (index > -1) {
    uploadFiles.value[index].percent = res.progress
    emit('progress', { response: res, file: uploadFiles.value[index] })
    emitFileList()
  }
}

/**
 * @description 选择文件的实际操作，将chooseFile自己用promise包了一层
 */
function onChooseFile(currentIndex?: number) {
  if (!isAlive() || isDisabled.value || (!isDef(currentIndex) && !showUpload.value)) return
  const { multiple, maxSize, accept, sizeType, limit, sourceType, compressed, maxDuration, camera, beforeUpload, extension } = props
  chooseFile({
    multiple: isDef(currentIndex) ? false : multiple,
    sizeType,
    sourceType,
    maxCount: isDef(currentIndex) ? 1 : limit ? limit - uploadFiles.value.length : limit,
    accept,
    compressed,
    maxDuration,
    camera,
    extension
  })
    .then((res) => {
      // 相册 UI 停留期间页面可能已卸载
      if (!isAlive()) return
      // 成功选择初始化file
      let files = res
      // 单选只有一个
      if (!multiple) {
        files = files.slice(0, 1)
      }
      // 遍历列表逐个初始化上传参数
      const mapFiles = async (files: ChooseFile[]) => {
        for (let index = 0; index < files.length; index++) {
          if (!isAlive() || isDisabled.value) return
          const file = files[index]
          if (file.type === 'image' && !file.size) {
            const imageInfo = await getImageInfo(file.path)
            if (!isAlive() || isDisabled.value) return
            file.size = imageInfo.width * imageInfo.height
          }
          // 与参考源语义一致：size > maxSize 才判超限。size 缺失（宿主
          // 适配层未回填的非图片文件）放行——Number(undefined) 为 NaN，
          // `NaN <= maxSize` 恒 false 会把缺 size 的文件误判超限丢弃。
          const size = Number(file.size)
          if (Number.isFinite(size) && size > maxSize) {
            emit('oversize', { file })
          } else {
            initFile(file, currentIndex)
          }
        }
      }

      // 上传前的钩子
      callInterceptor(beforeUpload, {
        args: [{ files, fileList: uploadFiles.value }],
        done: () => {
          if (!isAlive() || isDisabled.value) return
          mapFiles(files).catch((error) => { if (isAlive()) emit('chooseerror', { error }) })
        }
      })
    })
    .catch((error) => {
      if (isAlive()) emit('chooseerror', { error })
    })
}

/**
 * @description 处理唤起选择文件的点击事件
 */
function onEvokeClick() {
  handleChoose()
}

/**
 * @description 选择文件，内置拦截选择操作
 */
function handleChoose(index?: number) {
  if (isDisabled.value) return
  const { beforeChoose } = props

  // 选择图片前的钩子
  callInterceptor(beforeChoose, {
    args: [{ fileList: uploadFiles.value }],
    done: () => { if (isAlive() && !isDisabled.value) onChooseFile(index) }
  })
}

/**
 * @description 移除文件
 * @param {Object} file 上传的文件
 */
function handleRemove(file: UploadFileItem) {
  if (!isAlive() || isDisabled.value || !file) return
  const index = uploadFiles.value.findIndex((item) => item.uid === file.uid)
  if (index < 0) return
  uploadFiles.value.splice(index, 1)
  emit('change', {
    fileList: uploadFiles.value
  })
  emit('remove', { file })
  emitFileList()
}

function removeFile(index: number) {
  if (isDisabled.value || !uploadFiles.value[index]) return
  const { beforeRemove } = props
  const intIndex: number = index
  const file = uploadFiles.value[intIndex]
  callInterceptor(beforeRemove, {
    args: [{ file, index: intIndex, fileList: uploadFiles.value }],
    done: () => handleRemove(file)
  })
}

/**
 * 预览文件
 * @param file
 */
function handlePreviewFile(file: UploadFileItem) {
  uni.openDocument({
    filePath: file.url,
    showMenu: true
  })
}

/**
 * 预览图片
 * @param index
 * @param lists
 */
function handlePreviewImage(index: number, lists: string[]) {
  const { onPreviewFail } = props
  uni.previewImage({
    urls: lists,
    current: lists[index],
    fail() {
      if (onPreviewFail) {
        onPreviewFail({
          index,
          imgList: lists
        })
      } else {
        uni.showToast({ title: '预览图片失败', icon: 'none' })
      }
    }
  })
}

/**
 * 预览视频
 * @param index
 * @param lists
 */
function handlePreviewVieo(index: number, lists: UploadFileItem[]) {
  // Lynx 适配：MP-WEIXIN 的 uni.previewMedia 分支移除，统一走本地
  // wd-video-preview 组件（参考源非 MP 分支的等价实现）。
  previewVideo({ url: lists[index].url, poster: lists[index].thumb, title: lists[index].name })
}

function onPreviewImage(file: UploadFileItem) {
  const { beforePreview, reupload } = props
  const fileList = deepClone(uploadFiles.value)
  const index: number = fileList.findIndex((item) => item.url === file.url)
  const imgList = fileList.filter((file) => isImage(file)).map((file) => file.url)
  const imgIndex: number = imgList.findIndex((item) => item === file.url)
  if (reupload) {
    handleChoose(index)
  } else {
    callInterceptor(beforePreview, {
      args: [{ file, index, fileList, imgList }],
      done: () => { if (isAlive()) handlePreviewImage(imgIndex, imgList) }
    })
  }
}

function onPreviewVideo(file: UploadFileItem) {
  const { beforePreview, reupload } = props
  const fileList = deepClone(uploadFiles.value)
  const index: number = fileList.findIndex((item) => item.url === file.url)
  const videoList = fileList.filter((file) => isVideo(file))
  const videoIndex: number = videoList.findIndex((item) => item.url === file.url)
  if (reupload) {
    handleChoose(index)
  } else {
    callInterceptor(beforePreview, {
      args: [{ file, index, fileList, imgList: [] }],
      done: () => { if (isAlive()) handlePreviewVieo(videoIndex, videoList) }
    })
  }
}

function onPreviewFile(file: UploadFileItem) {
  const { beforePreview, reupload } = props
  const fileList = deepClone(uploadFiles.value)
  const index: number = fileList.findIndex((item) => item.url === file.url)
  if (reupload) {
    handleChoose(index)
  } else {
    callInterceptor(beforePreview, {
      args: [{ file, index, fileList, imgList: [] }],
      done: () => { if (isAlive()) handlePreviewFile(file) }
    })
  }
}

function isVideo(file: UploadFileItem) {
  return (file.name && isVideoUrl(file.name)) || isVideoUrl(file.url)
}

function isImage(file: UploadFileItem) {
  return (file.name && isImageUrl(file.name)) || isImageUrl(file.url)
}

/** wot-ui 图标名 → 本地 iconfont 集字形名映射（本地集缺少这些字形） */
const ICON_NAME_ALIAS: Record<string, string> = {
  'camera-fill': 'camera',
  'play-circle-fill': 'play',
  'close-circle': 'close',
  'video-camera': 'film'
}

/** 图标名归一：命中本地集（或宿主注册的扩展集）时原样使用，否则取最近似字形 */
function resolveIconName(name: string) {
  if (!name || hasIcon(name)) return name
  return ICON_NAME_ALIAS[name] || name
}
</script>

<template>
  <view :class="['wd-upload', customClass]" :style="parseStyle(customStyle)">
    <!-- 预览列表 -->
    <view :class="['wd-upload__preview', customPreviewClass]" v-for="(file, index) in uploadFiles" :key="index">
      <!-- 成功时展示图片 -->
      <view class="wd-upload__status-content">
        <image v-if="isImage(file)" :src="file.url" :mode="imageMode" class="wd-upload__picture" @tap="onPreviewImage(file)" />
        <template v-else-if="isVideo(file)">
          <view class="wd-upload__video" v-if="file.thumb" @tap="onPreviewVideo(file)">
            <image :src="file.thumb" :mode="imageMode" class="wd-upload__picture" />
            <WdIcon :name="resolveIconName('play-circle-fill')" custom-class="wd-upload__video-play"></WdIcon>
          </view>
          <view v-else class="wd-upload__video" @tap="onPreviewVideo(file)">
            <video
              :src="file.url"
              :title="file.name || '视频' + index"
              object-fit="contain"
              :controls="false"
              :poster="file.thumb"
              :autoplay="false"
              :show-center-play-btn="false"
              :show-fullscreen-btn="false"
              :show-play-btn="false"
              :show-loading="false"
              :show-progress="false"
              :show-mute-btn="false"
              :enable-progress-gesture="false"
              :enableNative="true"
              class="wd-upload__video"
            ></video>
            <WdIcon :name="resolveIconName('play-circle-fill')" custom-class="wd-upload__video-play"></WdIcon>
          </view>
        </template>

        <view v-else class="wd-upload__file" @tap="onPreviewFile(file)">
          <WdIcon name="file" custom-class="wd-upload__file-icon"></WdIcon>
          <text class="wd-upload__file-name">{{ file.name || file.url }}</text>
        </view>
      </view>

      <view v-if="file[props.statusKey] !== 'success'" class="wd-upload__mask">
        <!-- loading时展示loading图标和进度 -->
        <view v-if="file[props.statusKey] === 'loading'" class="wd-upload__status-content">
          <WdLoading :type="loadingType" :size="loadingSize" :color="loadingColor" />
          <text class="wd-upload__progress-txt">{{ file.percent }}%</text>
        </view>
        <!-- 失败时展示失败图标以及失败信息 -->
        <view v-if="file[props.statusKey] === 'fail'" class="wd-upload__status-content">
          <WdIcon :name="resolveIconName('close-circle')" custom-class="wd-upload__icon"></WdIcon>
          <text class="wd-upload__progress-txt">{{ file.error || translate('error') }}</text>
        </view>
      </view>
      <!-- 上传状态为上传中时不展示移除按钮 -->
      <view class="wd-upload__close" v-if="file[props.statusKey] !== 'loading' && !isDisabled" @tap="removeFile(index)">
        <WdIcon name="close" custom-class="wd-upload__close-icon"></WdIcon>
      </view>
      <!-- 自定义预览样式 -->
      <slot name="preview-cover" v-if="$slots['preview-cover']" :file="file" :index="index"></slot>
    </view>

    <template v-if="showUpload">
      <view :class="['wd-upload__evoke-slot', customEvokeClass]" v-if="$slots.default" @tap="onEvokeClick">
        <slot></slot>
      </view>
      <!-- 唤起项 -->
      <view v-else @tap="onEvokeClick" :class="['wd-upload__evoke', isDisabled ? 'is-disabled' : '', customEvokeClass]">
        <!-- 唤起项图标 -->
        <WdIcon :name="resolveIconName('camera-fill')" custom-class="wd-upload__evoke-icon"></WdIcon>
        <!-- 有限制个数时确认是否展示限制个数 -->
        <text v-if="limit && showLimitNum" class="wd-upload__evoke-num">（{{ uploadFiles.length }}/{{ limit }}）</text>
      </view>
    </template>
  </view>
  <WdVideoPreview :selector="videoPreviewId"></WdVideoPreview>
</template>
