/**
 * 命令式预览组件回归测试。
 *
 * 背景：wd-video-preview 的 open() 曾只写入 options 而遗漏 state.show = true，
 * 导致命令式打开时遮罩（wd-overlay）不显示。此处对 video / image 两个预览
 * 组件的 open() 行为做回归锁定：open() 后 overlay 必须进入入场态。
 */
import { describe, it, expect } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import VideoPreview from '../src/components/wd-video-preview/wd-video-preview.vue'
import ImagePreview from '../src/components/wd-image-preview/wd-image-preview.vue'

function renderWithExposed(comp: any, props: Record<string, any>, target: Ref<any>) {
  return render({
    setup() {
      return () => h(comp, { ...props, ref: target })
    }
  } as any)
}

/** 等待过渡入场（pause 约 33ms 一帧，enter 需 2 帧置类名） */
async function waitEnterFrames() {
  await pause()
  await pause()
  await pause()
}

describe('命令式预览 open() 回归', () => {
  it('WdVideoPreview.open() 后 overlay 进入入场态（修复遗漏 show=true）', async () => {
    const previewRef = ref<any>(null)
    const { container } = renderWithExposed(VideoPreview, { selector: 'test-video-preview' }, previewRef)

    previewRef.value.open({ url: 'https://example.com/a.mp4', title: '测试视频' })
    await waitEnterFrames()

    const overlay = container.querySelector('.wd-overlay')
    expect(overlay, 'overlay 应渲染').not.toBeNull()
    expect(
      overlay!.classList.contains('wd-transition--fade-enter-active'),
      'overlay 应处于 fade 入场态'
    ).toBe(true)
    cleanup()
  })

  it('WdVideoPreview.close() 后 overlay 离场', async () => {
    const previewRef = ref<any>(null)
    const { container } = renderWithExposed(VideoPreview, { selector: 'test-video-preview' }, previewRef)

    previewRef.value.open({ url: 'https://example.com/a.mp4' })
    await waitEnterFrames()
    previewRef.value.close()
    // leave 为异步状态机：先 await enterPromise，再逐帧推进类名
    await pause()
    await pause()
    await pause()

    const overlay = container.querySelector('.wd-overlay')
    expect(overlay, 'overlay 应渲染').not.toBeNull()
    expect(
      overlay!.classList.contains('wd-transition--fade-leave') ||
        overlay!.classList.contains('wd-transition--fade-leave-active'),
      'overlay 应处于 fade 离场态'
    ).toBe(true)
    cleanup()
  })

  it('WdImagePreview.open() 后 overlay 进入入场态（与 video 行为对齐）', async () => {
    const previewRef = ref<any>(null)
    const { container } = renderWithExposed(
      ImagePreview,
      { selector: 'test-image-preview', images: ['https://example.com/a.png'] },
      previewRef
    )

    previewRef.value.open({ images: ['https://example.com/a.png', 'https://example.com/b.png'], startPosition: 0 })
    await waitEnterFrames()

    const overlay = container.querySelector('.wd-overlay')
    expect(overlay, 'overlay 应渲染').not.toBeNull()
    expect(
      overlay!.classList.contains('wd-transition--fade-enter-active'),
      'overlay 应处于 fade 入场态'
    ).toBe(true)
    cleanup()
  })
})
