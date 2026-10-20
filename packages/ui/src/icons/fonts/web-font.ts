/*
 * Web 端图标字体的文档级补注册。
 *
 * 背景：Lynx 的 web 预览把整份组件库 CSS（含 @font-face）注入到
 * `<lynx-view>` 的 shadow root 里的 <style>。Chrome 不认 shadow 树内的
 * @font-face —— 既不出现在 document.fonts，也不会发起字体请求，于是
 * `<text>` 里的 PUA 码点回退到系统字体、渲染为空白，表现为「图标整片不见了，
 * 只剩图标名」。
 *
 * 处理：在文档级（document）再注册一次同名 @font-face。字体按族名解析，
 * 文档级注册对 shadow 树内的文本同样生效，且不影响原生（Lynx）端：
 * 原生环境没有 document，函数直接返回。
 *
 * 幂等：以 window 上的标记位去重，HMR / 多次 import 不会重复注册。
 */

/** 与 src/icons/sets/iconfont.ts 的 fontFamily 保持一致 */
const ICON_FONT_FAMILY = 'wd-iconfont'

/** 去重标记（挂在 window 上，跨模块重复调用也安全） */
const REGISTERED_FLAG = '__wot_iconfont_web_registered__'

/**
 * 在浏览器环境注册图标字体（原生环境为空操作）。
 *
 * 失败一律静默：字体只是渲染增强，不应因为取不到字体而打断应用启动。
 */
export function registerIconFontOnWeb(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  if (typeof FontFace === 'undefined' || !document.fonts) return

  const flag = window as unknown as Record<string, unknown>
  if (flag[REGISTERED_FLAG]) return
  flag[REGISTERED_FLAG] = true

  try {
    // 由构建器把 .ttf 发成静态资源并给出运行时 URL（与 CSS url() 同一套机制）
    const href = new URL('./iconfont.ttf', import.meta.url).href
    const face = new FontFace(ICON_FONT_FAMILY, `url("${href}") format("truetype")`)
    face
      .load()
      .then((loaded) => document.fonts.add(loaded))
      .catch(() => {
        /* 字体加载失败时退回系统字体，不阻塞渲染 */
      })
  } catch {
    /* 老环境或非打包环境下 new URL 可能抛错，忽略即可 */
  }
}
