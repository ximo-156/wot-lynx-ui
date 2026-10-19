/**
 * preview-host — 文档站 H5 预览的「宿主能力」注入。
 *
 * 组件库的媒体选择 / 上传走 common/uni 兼容层：宿主可通过
 * `configureUniAdapter` 注入真实能力，未注入时统一降级为 warning +
 * fail 回调。文档预览此前没有注入任何适配器，于是：
 * - wd-upload 点上传按钮只得到一条 console.warn，选文件 / 上传全流程
 *   在预览里不可见；
 *
 * 这里以「宿主应用」身份注入浏览器等价实现：
 * - chooseMedia / chooseMessageFile / chooseFile：隐藏 `<input type=file>`
 *   唤起真实文件选择，选中文件以 object URL 回填（预览即时可见）；
 * - uploadFile：本地模拟上传（进度回调 + 成功回调），让
 *   pending → loading → success 状态链在预览里完整可观察；
 * - previewImage：新标签页打开图片（wd-img 预览的浏览器等价物）。
 *
 * 仅服务于文档预览，不进入组件库产物。
 */
import { configureUniAdapter } from '../../../packages/ui/src/common/uni'

let installed = false

/** 唤起文件选择；用户取消时 reject（与 uni fail 语义对齐） */
function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.display = 'none'
    let settled = false
    const done = (fn: () => void) => {
      if (settled) return
      settled = true
      input.remove()
      fn()
    }
    input.addEventListener('change', () => {
      const files = Array.from(input.files || [])
      done(() => (files.length ? resolve(files) : reject({ errMsg: 'chooseMedia:fail cancel' })))
    })
    // cancel 事件：Chrome 113+/Safari 16.4+/Firefox 91+ 支持；
    // 不支持的浏览器里取消时 Promise 保持未决（预览场景无副作用）
    input.addEventListener('cancel', () => done(() => reject({ errMsg: 'chooseMedia:fail cancel' })))
    document.body.appendChild(input)
    input.click()
  })
}

function acceptFor(mediaType?: string[]): string {
  const types = mediaType && mediaType.length ? mediaType : ['image', 'video']
  return types.map((t) => (t === 'video' ? 'video/*' : 'image/*')).join(',')
}

/** chooseMedia / chooseImage 的成功回执形状 */
function mediaResult(files: File[]) {
  return {
    tempFiles: files.map((file) => ({
      tempFilePath: URL.createObjectURL(file),
      fileType: file.type.startsWith('video') ? 'video' : 'image',
      size: file.size,
      name: file.name
    }))
  }
}

/** chooseMessageFile / chooseFile 的成功回执形状（组件直接消费 tempFiles） */
function fileResult(files: File[]) {
  return {
    tempFiles: files.map((file) => ({
      path: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      type: 'file'
    }))
  }
}

/** 本地模拟上传任务：进度回调 + 成功回调 + abort */
function fakeUploadTask(options: any) {
  let progress = 0
  let progressCb: ((res: { progress: number }) => void) | null = null
  const timer = setInterval(() => {
    progress = Math.min(100, progress + 25)
    progressCb?.({ progress })
    if (progress >= 100) {
      clearInterval(timer)
      options.success?.({ statusCode: 200, data: '{}', errMsg: 'ok' })
    }
  }, 100)
  return {
    abort() {
      clearInterval(timer)
    },
    onProgressUpdate(cb: (res: { progress: number }) => void) {
      progressCb = cb
    },
    offProgressUpdate() {
      progressCb = null
    },
    onHeadersReceived() {},
    offHeadersReceived() {}
  }
}

/**
 * 注入浏览器预览的宿主能力（幂等）。
 * 在 H5Preview 挂载演示前调用，保证组件内 uni.* 调用拿到浏览器等价实现。
 */
export function installPreviewHostCapabilities(): void {
  if (installed || typeof document === 'undefined') return
  installed = true

  configureUniAdapter({
    chooseMedia: (options: any) => {
      pickFiles(acceptFor(options?.mediaType), (options?.count || 1) > 1).then(
        (files) => options.success?.(mediaResult(files)),
        (err) => options.fail?.(err)
      )
    },
    chooseImage: (options: any) => {
      pickFiles('image/*', (options?.count || 1) > 1).then(
        (files) =>
          options.success?.({
            tempFiles: files.map((file) => ({
              path: URL.createObjectURL(file),
              size: file.size
            }))
          }),
        (err) => options.fail?.(err)
      )
    },
    chooseMessageFile: (options: any) => {
      pickFiles('', (options?.count || 1) > 1).then(
        (files) => options.success?.(fileResult(files)),
        (err) => options.fail?.(err)
      )
    },
    chooseFile: (options: any) => {
      pickFiles('', (options?.count || 1) > 1).then(
        (files) => options.success?.(fileResult(files)),
        (err) => options.fail?.(err)
      )
    },
    uploadFile: (options: any) => fakeUploadTask(options),
    previewImage: (options: any) => {
      const url = options?.urls?.[options.current ?? 0] ?? options?.urls?.[0]
      if (url) window.open(url, '_blank')
      options?.success?.({ errMsg: 'ok' })
      options?.complete?.({ errMsg: 'ok' })
    }
  })
}
