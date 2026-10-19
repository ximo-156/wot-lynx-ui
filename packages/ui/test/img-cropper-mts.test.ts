/**
 * wd-img-cropper MTS 跟手测试（原生优先重写版，参照 slider-mts.test.ts）。
 *
 * 覆盖「主线程 transform 直改 + 后台同公式落定」的完整链路：
 * 1. **跟手直改**：单指拖动 / 双指缩放经主线程 worklet 直改图片
 *    transform（含 wot-ui 边界钳制），零线程跨越；
 * 2. **落定一致**：touchend 后台把累积态写入 ref，Vue 接管的
 *    imageStyle 与 worklet 直改值一致（无跳变）；
 * 3. **几何属性桥接**：中心 / 显示尺寸 / 缩放 / 角度 / 裁剪框经图片
 *    元素属性下发给主线程（slider 的 left-bound 同款）；
 * 4. **事件链路**：confirm（裁剪几何）/ cancel / imgloaded /
 *    imgloaderror 与 moving 拖动态（is-highlight）；
 * 5. **旋转**：revertIsAnimation / setRotate 经暴露方法与旋转按钮驱动。
 *
 * 派发路径说明（jsdom 不模拟冒泡）：图片元素绑主线程 touchstart /
 * touchmove 与后台 touchend；包裹器 __wrapper（图片父元素）绑后台
 * touchstart / touchmove。真机上图片触摸冒泡到 __wrapper 即触发其
 * 处理器，测试中向两个元素分别派发验证。
 *
 * 环境说明：jsdom 无布局，getSystemInfo 走默认值（375×812）；
 * uni.getImageInfo 经 configureUniAdapter 注入（图片 200×100）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import { fireEvent } from './fire-event'
import { configureUniAdapter } from '../src/common/uni'
import ImgCropper from '../src/components/wd-img-cropper/wd-img-cropper.vue'

const IMG_W = 200
const IMG_H = 100

// 测试环境 SystemInfo：windowWidth=390, windowHeight=844（@lynx-js/testing-environment）
// → 裁剪框 390-40=350（1:1 高 350）、距顶 (844*0.85-350)/2=183.7、距左 20；
// 图片 200×100（ratio 2）填入 1:1 → 700×350、缩放 1、初始中心 (195, 358.7)
const CUT_W = 350
const CUT_H = 350
const CUT_LEFT = 20
const CUT_TOP = 183.7
const PIC_W = 700
const PIC_H = 350
const CENTER_X = 195
const CENTER_Y = 358.7

/** 解析图片内联 transform：translate(x, y) scale(s) rotate(a) */
function parseTransform(el: Element | null) {
  const style = el ? el.getAttribute('style') || '' : ''
  const m = style.match(/transform:\s*translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([\d.]+)\)\s*rotate\(([-\d.]+)deg\)/)
  if (!m) return null
  return { x: Number(m[1]), y: Number(m[2]), scale: Number(m[3]), angle: Number(m[4]) }
}

/** 注入 getImageInfo 适配器（图片 200×100）并挂载组件 */
function mount(extraProps: Record<string, unknown> = {}) {
  configureUniAdapter({
    getImageInfo: (opts: any) => opts.success({ width: IMG_W, height: IMG_H })
  })
  const { container } = render(ImgCropper, {
    modelValue: true,
    imgSrc: 'https://example.com/a.png',
    aspectRatio: '1:1',
    ...extraProps
  } as any)
  return container
}

/** 受控挂载（v-model 驱动）：验证 update:modelValue 与根节点卸载 */
function mountControlled(extraProps: Record<string, unknown> = {}) {
  configureUniAdapter({
    getImageInfo: (opts: any) => opts.success({ width: IMG_W, height: IMG_H })
  })
  const updates: boolean[] = []
  const { container } = render({
    setup() {
      const visible = ref(true)
      return () =>
        h(ImgCropper as any, {
          modelValue: visible.value,
          imgSrc: 'https://example.com/a.png',
          aspectRatio: '1:1',
          'onUpdate:modelValue': (v: boolean) => {
            visible.value = v
            updates.push(v)
          },
          ...extraProps
        })
    }
  } as any)
  return { container, updates }
}

/** 图片 / 包裹器元素 */
function elsOf(container: Element) {
  return {
    img: container.querySelector('.wd-img-cropper__img')!,
    wrapper: container.querySelector('.wd-img-cropper__wrapper')!
  }
}

/** 单指/双指手势（MTS 分工派发）：起笔（图片主线程 + 包裹器后台）→
 *  pause（等待 moving 重渲染 flush——真机微任务先于下一帧事件落地）→
 *  跟手（图片主线程 + 包裹器后台累积）→ 落定（图片后台） */
async function pinchOrDrag(
  container: Element,
  from: Array<[number, number]>,
  to: Array<[number, number]>
) {
  const { img, wrapper } = elsOf(container)
  const startInit = { touches: from.map(([x, y]) => ({ clientX: x, clientY: y })) }
  const moveInit = { touches: to.map(([x, y]) => ({ clientX: x, clientY: y })) }
  fireEvent.touchstart(img, startInit)
  fireEvent.touchstart(wrapper, startInit)
  await pause(10)
  fireEvent.touchmove(img, moveInit)
  fireEvent.touchmove(wrapper, moveInit)
  await pause(10)
  fireEvent.touchend(img, { touches: [], changedTouches: to.map(([x, y]) => ({ clientX: x, clientY: y })) })
  await pause(30)
}

describe('wd-img-cropper MTS 跟手', () => {
  afterEach(() => cleanup())

  it('几何经元素属性桥接下发给主线程（起笔快照来源）', async () => {
    const container = mount()
    await pause(50)

    const { img } = elsOf(container)
    expect(img.getAttribute('cut-w')).toBe(String(CUT_W))
    expect(img.getAttribute('cut-h')).toBe(String(CUT_H))
    expect(img.getAttribute('cut-left')).toBe(String(CUT_LEFT))
    expect(Number(img.getAttribute('cut-top'))).toBeCloseTo(CUT_TOP, 1)
    // 图片 200×100（ratio 2）填入 1:1 裁剪框：以高度为准 → 700×350，缩放 1
    expect(img.getAttribute('pic-w')).toBe(String(PIC_W))
    expect(img.getAttribute('pic-h')).toBe(String(PIC_H))
    expect(img.getAttribute('img-scale')).toBe('1')
    expect(img.getAttribute('img-angle')).toBe('0')
    // 初始中心 = 裁剪框中心
    expect(Number(img.getAttribute('center-x'))).toBeCloseTo(CENTER_X, 5)
    expect(Number(img.getAttribute('center-y'))).toBeCloseTo(CENTER_Y, 1)
  })

  it('单指拖动：touchmove 主线程直改 transform，touchend 落定一致', async () => {
    const container = mount()
    await pause(50)

    const { img, wrapper } = elsOf(container)
    // 初始 transform：中心 (195, 358.7) - 半图 (350, 175)
    const before = parseTransform(img)!
    expect(before.x).toBeCloseTo(CENTER_X - PIC_W / 2, 5)
    expect(before.scale).toBe(1)

    // 自中心向右拖动 50px（未触边界：中心 → 245；图高 = 裁剪框高，
    // 垂直方向无可移动量，y 保持裁剪框中心 358.7）
    fireEvent.touchstart(img, { touches: [{ clientX: CENTER_X, clientY: CENTER_Y }] })
    fireEvent.touchstart(wrapper, { touches: [{ clientX: CENTER_X, clientY: CENTER_Y }] })
    // 拖动态：包裹器后台置位 → 遮罩高亮（渲染 flush 后再派发 move）
    await pause(10)
    expect(container.querySelector('.wd-img-cropper__overlay')!.classList.contains('is-highlight')).toBe(true)

    fireEvent.touchmove(img, { touches: [{ clientX: CENTER_X + 50, clientY: CENTER_Y }] })
    await pause(10)
    const during = parseTransform(img)!
    // 跟手直改：translate(245-350, 358.7-175) = (-105, 183.7)
    expect(during.x).toBeCloseTo(-105, 5)
    expect(during.y).toBeCloseTo(CUT_TOP, 1)
    expect(during.scale).toBe(1)
    expect(during.angle).toBe(0)

    // 落定：后台累积 → ref → Vue 接管，值与 worklet 直改一致（无跳变）
    fireEvent.touchmove(wrapper, { touches: [{ clientX: CENTER_X + 50, clientY: CENTER_Y }] })
    fireEvent.touchend(img, { touches: [], changedTouches: [{ clientX: CENTER_X + 50, clientY: CENTER_Y }] })
    await pause(30)
    const after = parseTransform(img)!
    expect(after.x).toBeCloseTo(-105, 5)
    expect(after.y).toBeCloseTo(CUT_TOP, 1)
    // 落定后属性桥接同步（中心 245 / 358.7）
    expect(Number(img.getAttribute('center-x'))).toBeCloseTo(CENTER_X + 50, 5)
    expect(Number(img.getAttribute('center-y'))).toBeCloseTo(CENTER_Y, 1)
    // 拖动态解除
    expect(container.querySelector('.wd-img-cropper__overlay')!.classList.contains('is-highlight')).toBe(false)
  })

  it('拖动越界经边界钳制（wot-ui 公式，主线程与后台一致）', async () => {
    const container = mount()
    await pause(50)

    const { img, wrapper } = elsOf(container)
    // 大幅向左上拖动：右/下边界钳制（图片 700 宽 > 裁剪框 350）
    fireEvent.touchstart(img, { touches: [{ clientX: CENTER_X, clientY: CENTER_Y }] })
    fireEvent.touchstart(wrapper, { touches: [{ clientX: CENTER_X, clientY: CENTER_Y }] })
    await pause(10)
    fireEvent.touchmove(img, { touches: [{ clientX: -500, clientY: -500 }] })
    await pause(10)
    const during = parseTransform(img)!
    // 右边界：中心 x 钳到 cutLeft + cutW - picW*scale/2 = 20 + 350 - 350 = 20
    // → transform x = 20 - 350 = -330
    expect(during.x).toBeCloseTo(20 - PIC_W / 2, 5)
    // 下边界：中心 y 钳到 cutTop + cutH - picH*scale/2 = 183.7 + 350 - 175 = 358.7
    // → transform y = 358.7 - 175 = 183.7
    expect(during.y).toBeCloseTo(CUT_TOP, 1)

    fireEvent.touchmove(wrapper, { touches: [{ clientX: -500, clientY: -500 }] })
    fireEvent.touchend(img, { touches: [], changedTouches: [{ clientX: -500, clientY: -500 }] })
    await pause(30)
    const after = parseTransform(img)!
    expect(after.x).toBeCloseTo(20 - PIC_W / 2, 5)
    expect(after.y).toBeCloseTo(CUT_TOP, 1)
  })

  it('双指缩放：主线程跟手 scale 直改 + 落定一致', async () => {
    const container = mount()
    await pause(50)

    const { img, wrapper } = elsOf(container)
    // 起笔两指间距 100（跨初始中心 195）
    const start = {
      touches: [
        { clientX: CENTER_X - 50, clientY: CENTER_Y },
        { clientX: CENTER_X + 50, clientY: CENTER_Y }
      ]
    }
    fireEvent.touchstart(img, start)
    fireEvent.touchstart(wrapper, start)
    await pause(10)
    // 放大到间距 250 → scale = 1 * 2.5 = 2.5（未超 maxScale 3）
    const move = {
      touches: [
        { clientX: CENTER_X - 125, clientY: CENTER_Y },
        { clientX: CENTER_X + 125, clientY: CENTER_Y }
      ]
    }
    fireEvent.touchmove(img, move)
    await pause(10)
    const during = parseTransform(img)!
    expect(during.scale).toBe(2.5)
    expect(during.angle).toBe(0)

    // 落定一致（后台累积同公式）
    fireEvent.touchmove(wrapper, move)
    fireEvent.touchend(img, { touches: [], changedTouches: [{ clientX: CENTER_X + 125, clientY: CENTER_Y }] })
    await pause(30)
    const after = parseTransform(img)!
    expect(after.scale).toBe(2.5)
    expect(Number(img.getAttribute('img-scale'))).toBe(2.5)
  })

  it('confirm 落定裁剪几何（x / y / scale / angle + 导出尺寸）', async () => {
    const confirms: any[] = []
    const { container, updates } = mountControlled({
      onConfirm: (e: any) => confirms.push(e)
    })
    await pause(50)

    // 自中心向右拖动 50px 后确认
    await pinchOrDrag(container, [[CENTER_X, CENTER_Y]], [[CENTER_X + 50, CENTER_Y]])

    // 确认按钮（页脚最后一个 wd-button）
    const buttons = [...container.querySelectorAll('.wd-img-cropper__footer .wd-button')]
    fireEvent.tap(buttons[buttons.length - 1]!)
    await pause(30)

    expect(confirms.length).toBe(1)
    // x = (245 - 20 - 700*1/2) / 1 = -125
    expect(confirms[0].x).toBe(-125)
    // y = (358.7 - 183.7 - 350*1/2) / 1 ≈ 0
    expect(confirms[0].y).toBeCloseTo(0, 5)
    expect(confirms[0].scale).toBe(1)
    expect(confirms[0].angle).toBe(0)
    // 导出尺寸 = 裁剪框 × exportScale(2)
    expect(confirms[0].width).toBe(700)
    expect(confirms[0].height).toBe(700)
    expect(confirms[0].src).toBe('https://example.com/a.png')
    // Lynx 降级：不产位图，tempFilePath 恒为空串
    expect(confirms[0].tempFilePath).toBe('')
    // 确认后 modelValue 置 false → 根节点卸载
    expect(updates[updates.length - 1]).toBe(false)
    expect(container.querySelector('.wd-img-cropper')).toBeNull()
  })

  it('cancel 取消：emit cancel + update:modelValue(false) 卸载', async () => {
    const cancels: string[] = []
    const { container, updates } = mountControlled({
      onCancel: () => cancels.push('cancel')
    })
    await pause(50)

    const cancelBtn = container.querySelector('.wd-img-cropper__cancel')!
    expect(cancelBtn).not.toBeNull()
    fireEvent.tap(cancelBtn)
    await pause(30)
    expect(cancels).toEqual(['cancel'])
    expect(updates[updates.length - 1]).toBe(false)
    expect(container.querySelector('.wd-img-cropper')).toBeNull()
  })

  it('旋转按钮：setRotate 驱动 img-angle 与 transform', async () => {
    const container = mount()
    await pause(50)

    const rotate = container.querySelector('.wd-img-cropper__rotate')!
    expect(rotate).not.toBeNull()
    fireEvent.tap(rotate)
    await pause(30)

    const { img } = elsOf(container)
    expect(img.getAttribute('img-angle')).toBe('-90')
    const tf = parseTransform(img)!
    expect(tf.angle).toBe(-90)
    // 旋转后过渡动画自动关闭（transition-duration 回 0ms）
    await pause(350)
    expect(img.getAttribute('style')).toMatch(/transition-duration:\s*0ms/)
  })

  it('imgloaderror：宿主注入的 getImageInfo 失败时上报', async () => {
    configureUniAdapter({
      getImageInfo: (opts: any) => opts.fail({ errMsg: 'fail' })
    })
    const errors: any[] = []
    const { container } = render(ImgCropper, {
      modelValue: true,
      imgSrc: 'https://example.com/a.png',
      onImgloaderror: (e: any) => errors.push(e)
    } as any)
    await pause(50)
    // modelValue 与 imgSrc 两个 immediate watch 均触发 loadImg（wot-ui 端口
    // 既有行为）：失败回调至少一次，载荷正确
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(errors[0].src).toBe('https://example.com/a.png')
    expect(container.querySelector('.wd-img-cropper')).not.toBeNull()
  })
})
