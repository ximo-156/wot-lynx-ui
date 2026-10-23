/**
 * 两张同尺寸 RGBA 图 → 差异统计 + 差异图。
 *
 * 纯函数，不碰文件系统，便于单测。
 */

/** 单通道允许的抖动：抗锯齿与字体光栅在同一台机器上仍可能有 ±1~3 的差异 */
export const DEFAULT_TOLERANCE = 8

/**
 * 判断截图里是否有内容。
 *
 * 有些组件在 H5 预览里默认什么都不渲染（需要点击才弹出的浮层、必须有父级的
 * 子组件、没有手工演示的兜底页）。这类组件截出来是一整片背景色，**基线永远
 * 不会回归**——留着它们会让「106 张基线」看起来覆盖很全，实际是零覆盖。
 *
 * 只看中心区域：手机屏有圆角，四角露出的是页面底色，会把「全空白」误判成
 * 「有 20 多种颜色」。
 */
export function analyzeContent(img, { margin = 0.1 } = {}) {
  const x0 = Math.floor(img.width * margin)
  const x1 = Math.ceil(img.width * (1 - margin))
  const y0 = Math.floor(img.height * margin)
  const y1 = Math.ceil(img.height * (1 - margin))
  const colors = new Set()
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * img.width + x) * 4
      colors.add((img.data[o] << 16) | (img.data[o + 1] << 8) | img.data[o + 2])
      // 超过阈值就没必要继续数了
      if (colors.size > 8) return { distinctColors: colors.size, blank: false }
    }
  }
  return { distinctColors: colors.size, blank: colors.size <= 1 }
}

/**
 * 比较两张图。
 *
 * @returns {{
 *   sizeMismatch: boolean,
 *   ratio: number,          // 变化像素 / 总像素
 *   changedPixels: number,
 *   totalPixels: number,
 *   bbox: { x, y, width, height } | null,
 *   diff: { width, height, data } | null
 * }}
 *
 * 尺寸不同直接判 100% 差异：组件区域变高变矮本身就是回归，逐像素比没有意义。
 * 差异图把未变区域压成浅灰、变化区域涂成红色——人一眼能看出哪里动了。
 */
export function diffImages(before, after, { tolerance = DEFAULT_TOLERANCE } = {}) {
  if (before.width !== after.width || before.height !== after.height) {
    return {
      sizeMismatch: true,
      ratio: 1,
      changedPixels: after.width * after.height,
      totalPixels: after.width * after.height,
      bbox: null,
      diff: null
    }
  }

  const { width, height } = before
  const totalPixels = width * height
  const diff = { width, height, data: Buffer.alloc(totalPixels * 4) }

  let changedPixels = 0
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let i = 0; i < totalPixels; i++) {
    const o = i * 4
    const dr = Math.abs(before.data[o] - after.data[o])
    const dg = Math.abs(before.data[o + 1] - after.data[o + 1])
    const db = Math.abs(before.data[o + 2] - after.data[o + 2])
    const da = Math.abs(before.data[o + 3] - after.data[o + 3])
    const delta = Math.max(dr, dg, db, da)

    if (delta > tolerance) {
      changedPixels++
      const x = i % width
      const y = (i - x) / width
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      diff.data[o] = 255
      diff.data[o + 1] = 0
      diff.data[o + 2] = 0
      diff.data[o + 3] = 255
    } else {
      // 未变区域用原图的灰阶压暗，保留轮廓以便定位
      const luma = (after.data[o] * 299 + after.data[o + 1] * 587 + after.data[o + 2] * 114) / 1000
      const dim = Math.round(200 + luma * 0.22)
      diff.data[o] = dim
      diff.data[o + 1] = dim
      diff.data[o + 2] = dim
      diff.data[o + 3] = 255
    }
  }

  return {
    sizeMismatch: false,
    ratio: totalPixels === 0 ? 0 : changedPixels / totalPixels,
    changedPixels,
    totalPixels,
    bbox: maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    diff
  }
}
