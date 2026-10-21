/**
 * 原生优先重写 · 弹层家族布局居中契约回归（wd-popup / wd-action-sheet /
 * wd-dialog / wd-toast / wd-notify）。
 *
 * 背景（NATIVE-REWRITE §3 / CONVENTIONS §9/§15/§19/§20）：弹层家族是「样式
 * 不居中」的重灾区——Lynx 3.x 默认 linear 布局下 flex-direction 被静默丢弃、
 * inline-block/inline-flex 不识别、left:50% + translate 居中脆弱、普通 view
 * 的 overflow 不产生原生滚动。本测试锁定本批五组件的静态契约与弹层链路：
 *
 * 1. 每个根视图（含 dialog 的 __container）显式 `display: flex` +
 *    `flex-direction`（根节点三件套）；
 * 2. 需要居中处 `justify-content` + `align-items` 成对写全，文本节点另加
 *    `text-align: center`；绝对定位居中的关闭图标用四边 0 + flex，不用
 *    top:50% + translateY(-50%)；
 * 3. 编译产物不出现 Lynx 静默丢失的 Web 专有写法（inline-flex /
 *    inline-block / float / vertical-align / cursor / user-select /
 *    outline / -webkit-*）；
 * 4. 横向滚动轨道（action-sheet 面板）与超高内容区（dialog 内容）用原生
 *    scroll-view，不用 view + overflow；
 * 5. wd-toast 定位根为「四边 0 + flex 成对居中」（禁 top:50% + translate），
 *    position 变体偏移在居中基准上经 transform 施加；
 * 6. 内联样式经 Style Funnel 输出完整键集（popup 的 z-index/padding-bottom、
 *    notify 的 padding-top/left/right），条件翻转不留残值；
 * 7. DOM 结构（BEM 类名 / 层级 / 原生元素）与 wot-ui 2.3.2 对齐不回退，
 *    命令式与受控两条通道的弹层链路（遮罩关闭 / select / confirm / notify
 *    tap 双轨）保持可用。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import { fireEvent } from './fire-event'
import Popup from '../src/components/wd-popup/wd-popup.vue'
import ActionSheet from '../src/components/wd-action-sheet/wd-action-sheet.vue'
import Dialog from '../src/components/wd-dialog/wd-dialog.vue'
import Toast from '../src/components/wd-toast/wd-toast.vue'
import Notify from '../src/components/wd-notify/wd-notify.vue'
import { useToast } from '../src/components/wd-toast'

const SRC = path.resolve(__dirname, '..', 'src/components')
const css = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8')

/** 抽取指定选择器的声明体（编译产物为压缩单行，按选择器精确切分） */
function ruleOf(cssText: string, selector: string): string {
  const re = new RegExp(`(?:^|[,}])\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^{}]*)\\}`, 'm')
  const m = cssText.match(re)
  if (!m) throw new Error(`selector not found in compiled css: ${selector}`)
  return m[1]
}

/** 根节点三件套：display: flex + 显式 flex-direction */
function expectRootFlex(cssText: string, selector: string, direction: 'row' | 'column') {
  const body = ruleOf(cssText, selector)
  expect(body, `${selector} 必须显式 display: flex`).toMatch(/(^|;)display:flex(;|$)/)
  expect(body, `${selector} 必须显式 flex-direction: ${direction}`).toMatch(new RegExp(`(^|;)flex-direction:${direction}(;|$)`))
}

/** 居中成对：justify-content + align-items 同时出现 */
function expectCenterPair(cssText: string, selector: string) {
  const body = ruleOf(cssText, selector)
  expect(body, `${selector} 需要 justify-content: center`).toMatch(/(^|;)justify-content:center(;|$)/)
  expect(body, `${selector} 需要 align-items: center`).toMatch(/(^|;)align-items:center(;|$)/)
}

/** 交叉轴居中（行容器的垂直居中 / 列容器的水平居中） */
function expectCrossCenter(cssText: string, selector: string) {
  const body = ruleOf(cssText, selector)
  expect(body, `${selector} 需要 align-items: center`).toMatch(/(^|;)align-items:center(;|$)/)
}

/** Lynx 不识别、写了即静默丢失的 Web 专有写法 */
/** Lynx 不识别、写了即静默丢失的 Web 专有写法。前缀需含 `{`：编译产物为压缩
 *  单行，规则内首个声明紧跟选择器的 `{`，只认 `;`/行首会漏掉首声明 */
const SILENTLY_DROPPED = [
  /(^|[{;])display:inline-flex/,
  /(^|[{;])display:inline-block/,
  /(^|[{;])display:block(;|$)/,
  /(^|[{;])float:/,
  /(^|[{;])vertical-align:/,
  /(^|[{;])cursor:/,
  /(^|[{;])user-select:/,
  /(^|[{;])outline:/,
  /-webkit-/
]

const BATCH_CSS = [
  'wd-popup/index.css',
  'wd-action-sheet/index.css',
  'wd-dialog/index.css',
  'wd-toast/index.css',
  'wd-notify/index.css'
]

/** 等待过渡入场（pause 约 33ms 一帧，enter 需 2 帧置 display） */
async function frames(n = 6) {
  for (let i = 0; i < n; i++) await pause()
}

function isHidden(el: Element | null): boolean {
  if (!el) return true
  return /display:\s*none/.test((el as HTMLElement).getAttribute('style') || '')
}

function firstMatch(container: Element, selector: string): Element | null {
  return container.querySelector(selector)
}

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

describe('原生优先重写 · 弹层家族布局居中契约（popup / action-sheet / dialog / toast / notify）', () => {
  afterEach(() => cleanup())

  it('编译产物不含 Lynx 静默丢失的 Web 专有写法', () => {
    for (const rel of BATCH_CSS) {
      const text = css(rel)
      for (const re of SILENTLY_DROPPED) {
        expect(re.test(text), `${rel} 含 Lynx 不识别写法: ${re}`).toBe(false)
      }
    }
  })

  it('根节点三件套：popup / action-sheet / dialog__container 纵向，toast / notify 横向', () => {
    expectRootFlex(css('wd-popup/index.css'), '.wd-popup', 'column')
    expectRootFlex(css('wd-action-sheet/index.css'), '.wd-action-sheet', 'column')
    expectRootFlex(css('wd-dialog/index.css'), '.wd-dialog__container', 'column')
    expectRootFlex(css('wd-toast/index.css'), '.wd-toast', 'row')
    expectRootFlex(css('wd-notify/index.css'), '.wd-notify', 'row')
    // 弹层为 flex column 容器后，直接子视图不允许被按比例压缩（§19 附记）
    expect(ruleOf(css('wd-action-sheet/index.css'), '.wd-action-sheet')).toMatch(/(^|;)flex-shrink:0(;|$)/)
    expect(ruleOf(css('wd-dialog/index.css'), '.wd-dialog__container')).toMatch(/(^|;)flex-shrink:0(;|$)/)
    expect(ruleOf(css('wd-notify/index.css'), '.wd-notify')).toMatch(/(^|;)flex-shrink:0(;|$)/)
  })

  it('居中成对：操作项 / 取消 / 标题 / 面板 + 文本居中', () => {
    const sheet = css('wd-action-sheet/index.css')
    // 操作项：图标（loading）+ 名称 + 描述纵向成对居中
    expectCenterPair(sheet, '.wd-action-sheet__action')
    expect(ruleOf(sheet, '.wd-action-sheet__action')).toMatch(/(^|;)text-align:center(;|$)/)
    // 取消按钮与标题：横向成对居中 + 文本居中
    expectCenterPair(sheet, '.wd-action-sheet__cancel')
    expect(ruleOf(sheet, '.wd-action-sheet__cancel')).toMatch(/(^|;)text-align:center(;|$)/)
    expectCenterPair(sheet, '.wd-action-sheet__title')
    expect(ruleOf(sheet, '.wd-action-sheet__title')).toMatch(/(^|;)text-align:center(;|$)/)
    // 面板：图标 + 标题纵向成对居中（替代 margin: 0 auto）
    expectCenterPair(sheet, '.wd-action-sheet__panel')
    // 对话框标题 / 通知行：交叉轴居中
    expectCrossCenter(css('wd-dialog/index.css'), '.wd-dialog__title')
    expect(ruleOf(css('wd-dialog/index.css'), '.wd-dialog__title')).toMatch(/(^|;)text-align:center(;|$)/)
    expectCrossCenter(css('wd-notify/index.css'), '.wd-notify')
    // toast 图标 + 文本行：横向成对居中
    expectCenterPair(css('wd-toast/index.css'), '.wd-toast--with-icon')
  })

  it('绝对定位居中改四边 0 + flex：关闭图标不用 top:50% + translate', () => {
    const close = ruleOf(css('wd-action-sheet/index.css'), '.wd-action-sheet .wd-action-sheet__close')
    expect(close, '关闭图标应四边 0 中的 top/bottom 撑满').toMatch(/(^|;)top:0(;|$)/)
    expect(close).toMatch(/(^|;)bottom:0(;|$)/)
    expect(close).toMatch(/(^|;)align-items:center(;|$)/)
    expect(close, '禁止 translate 居中').not.toMatch(/translate/)
    // toast 的 --middle 变体同样不再用 translateY(-50%) 找中心
    expect(ruleOf(css('wd-toast/index.css'), '.wd-toast--middle')).toMatch(/(^|;)transform:none(;|$)/)
  })

  it('原生滚动：面板横向轨道与对话框内容区为 scroll-view（禁 view + overflow）', async () => {
    // action-sheet 面板轨道
    const sheet = render(ActionSheet as any, {
      modelValue: true,
      panels: [[{ icon: 'menu', title: '面板一' }, { icon: 'menu', title: '面板二' }, { icon: 'menu', title: '面板三' }]],
      cancelText: '取消'
    } as any)
    await frames()
    const track = firstMatch(sheet.container, '.wd-action-sheet__panels-content')
    expect(track, '面板轨道应渲染').not.toBeNull()
    expect(track!.tagName.toLowerCase(), '面板轨道应为原生 scroll-view').toBe('scroll-view')
    expect(track!.getAttribute('scroll-x'), 'scroll-view 应开启横向滚动').toBe('true')
    expect(ruleOf(css('wd-action-sheet/index.css'), '.wd-action-sheet__panels-content')).not.toMatch(/overflow/)
    cleanup()

    // dialog 内容区（prompt / 长消息）
    const dialogRef = ref<any>(null)
    const dialog = render({
      setup() {
        return () => h(Dialog as any, { selector: 'native-first-dialog', ref: dialogRef })
      }
    } as any)
    dialogRef.value.alert({ title: '提示', msg: '这是一段很长的消息内容' })
    await frames()
    const content = firstMatch(dialog.container, '.wd-dialog__content')
    expect(content, '对话框内容区应渲染').not.toBeNull()
    expect(content!.tagName.toLowerCase(), '内容区应为原生 scroll-view').toBe('scroll-view')
    expect(content!.getAttribute('scroll-y')).toBe('true')
    cleanup()
  })

  it('wd-toast：定位根四边 0 + flex 成对居中（禁 top:50% + translate）', async () => {
    const { container } = render({
      setup() {
        const toast = useToast('native-first-toast')
        return () => [h('view', { class: 'trigger', onTap: () => toast.show('你好') }, ['show']), h(Toast as any, { selector: 'native-first-toast' })]
      }
    } as any)

    fireEvent.tap(firstMatch(container, '.trigger')!)
    await frames()

    const root = Array.from(container.querySelectorAll('.wd-transition')).find((el) => el.querySelector('.wd-toast'))!
    expect(root, 'toast 过渡根应渲染').toBeTruthy()
    const style = styleOf(root)
    // 四边 0 + flex 成对居中（NATIVE-REWRITE §3.2 / CONVENTIONS §9）
    expect(style).toMatch(/position:\s*fixed/)
    expect(style).toMatch(/left:\s*0px/)
    expect(style).toMatch(/right:\s*0px/)
    expect(style).toMatch(/top:\s*0px/)
    expect(style).toMatch(/bottom:\s*0px/)
    expect(style).toMatch(/display:\s*flex/)
    expect(style).toMatch(/flex-direction:\s*column/)
    expect(style).toMatch(/align-items:\s*center/)
    expect(style).toMatch(/justify-content:\s*center/)
    // 禁用 left/top 50% + translate 找中心；宽度由四边 0 决定
    expect(style, '禁止 top: 50% 定位').not.toMatch(/(^|;)\s*top:\s*50%/)
    expect(style, '禁止 width: 100% 兜底').not.toMatch(/width:\s*100%/)
    // z-index 每帧写全（默认 100）
    expect(style).toMatch(/z-index:\s*100/)
    cleanup()
  })

  it('Style Funnel：弹层内联样式完整键集，条件翻转不留残值', async () => {
    // popup：z-index 与 padding-bottom 恒在场
    const popup = render(Popup as any, {
      modelValue: true,
      zIndex: 66,
      customStyle: 'background: red',
      safeAreaInsetBottom: true
    } as any)
    await frames()
    const popupRoot = firstMatch(popup.container, '.wd-popup-wrapper > .wd-transition.wd-popup')
    const popupStyle = styleOf(popupRoot)
    expect(popupStyle).toMatch(/z-index:\s*66/)
    expect(popupStyle, 'safeAreaInsetBottom 无安全区数据时 padding-bottom 回落中性值 0px').toMatch(/padding-bottom:\s*0px/)
    expect(popupStyle, 'customStyle 经 parseStyle 归一后仍生效').toMatch(/background:\s*red/)
    cleanup()

    // notify：position 由 top 切 bottom、variant 由 floating 切 filled，
    // padding-top / left / right 都必须回落中性值而不是保留旧值
    const notifyTop = render(Notify as any, {
      visible: true,
      position: 'top',
      variant: 'floating',
      safeHeight: 44,
      message: '顶部通知'
    } as any)
    await frames()
    const topStyle = styleOf(firstMatch(notifyTop.container, '.wd-popup-wrapper > .wd-transition.wd-popup'))
    expect(topStyle).toMatch(/padding-top:\s*44px/)
    expect(topStyle).toMatch(/left:\s*12px/)
    expect(topStyle).toMatch(/right:\s*12px/)
    cleanup()

    const notifyBottom = render(Notify as any, { visible: true, position: 'bottom', message: '底部通知' } as any)
    await frames()
    const bottomStyle = styleOf(firstMatch(notifyBottom.container, '.wd-popup-wrapper > .wd-transition.wd-popup'))
    expect(bottomStyle, 'top 的 padding-top 不得残留').toMatch(/padding-top:\s*0px/)
    expect(bottomStyle, 'floating 的 left/right 不得残留').toMatch(/left:\s*0px/)
    expect(bottomStyle).toMatch(/right:\s*0px/)
    cleanup()
  })

  it('DOM 对齐与链路：popup 遮罩关闭 + 关闭按钮', async () => {
    const show = ref(true)
    const updates: boolean[] = []
    const closes: number[] = []
    const { container } = render({
      setup() {
        return () =>
          h(
            Popup as any,
            {
              modelValue: show.value,
              position: 'center',
              round: true,
              closable: true,
              'onUpdate:modelValue': (val: boolean) => {
                show.value = val
                updates.push(val)
              },
              onClose: () => closes.push(1)
            },
            { default: () => h('view', { class: 'popup-content' }, ['内容']) }
          )
      }
    } as any)
    await frames()

    const transition = firstMatch(container, '.wd-popup-wrapper > .wd-transition.wd-popup')!
    expect(transition.className, '居中弹层类名与 wot-ui 一致').toContain('wd-popup--center')
    expect(transition.className).toContain('is-round')
    expect(isHidden(transition), '弹层应可见').toBe(false)

    // 关闭按钮（绝对定位图标）tap → close + update:modelValue(false)
    fireEvent.tap(firstMatch(container, '.wd-popup__close')!)
    await frames()
    expect(closes.length, '关闭按钮应触发 close').toBe(1)
    expect(updates, '关闭按钮应触发 update:modelValue(false)').toContain(false)
    cleanup()
  })

  it('DOM 对齐与链路：action-sheet 选项 / 面板 select 与取消', async () => {
    const sheetRef = ref<any>(null)
    const selects: any[] = []
    const cancels: number[] = []
    const visible = ref(false)
    const { container } = render({
      setup() {
        return () =>
          h(ActionSheet as any, {
            ref: sheetRef,
            modelValue: visible.value,
            actions: [{ name: '选项一' }, { name: '选项二' }],
            panels: [[{ icon: 'menu', title: '面板一' }, { icon: 'menu', title: '面板二' }]],
            cancelText: '取消',
            title: '标题',
            // 点选项不自动收起，便于连续验证操作项 / 面板 / 取消三条链路
            closeOnClickAction: false,
            'onUpdate:modelValue': (val: boolean) => {
              visible.value = val
            },
            onSelect: (e: any) => selects.push(e),
            onCancel: () => cancels.push(1)
          })
      }
    } as any)
    await frames()

    expect(typeof sheetRef.value?.open, '应暴露 open').toBe('function')
    sheetRef.value.open()
    await frames()
    expect(visible.value, 'open 后受控通道应置 true').toBe(true)

    // 结构与 wot-ui 一致：标题 / 操作项 / 面板 / 取消
    expect(container.textContent).toContain('标题')
    expect(container.textContent).toContain('选项一')
    expect(container.textContent).toContain('面板一')
    expect(container.textContent).toContain('取消')

    fireEvent.tap(firstMatch(container, '.wd-action-sheet__action')!)
    await frames()
    expect(selects.length, '点击操作项应触发 select').toBe(1)
    expect(selects[0].index).toBe(0)

    fireEvent.tap(firstMatch(container, '.wd-action-sheet__panel')!)
    await frames()
    expect(selects.length, '点击面板应触发 select').toBe(2)

    fireEvent.tap(firstMatch(container, '.wd-action-sheet__cancel')!)
    await frames()
    expect(cancels.length, '点击取消应触发 cancel').toBe(1)
    cleanup()
  })

  it('DOM 对齐与链路：dialog 命令式 alert/confirm', async () => {
    const dialogRef = ref<any>(null)
    const { container } = render({
      setup() {
        return () => h(Dialog as any, { selector: 'native-first-dialog-2', ref: dialogRef })
      }
    } as any)

    expect(typeof dialogRef.value?.alert, '应暴露 alert').toBe('function')
    dialogRef.value.alert({ title: '提示', msg: '这是一个对话框' })
    await frames()

    const transition = firstMatch(container, '.wd-popup-wrapper > .wd-transition.wd-popup')!
    expect(isHidden(transition), 'alert 后对话框应可见').toBe(false)
    // 弹层背景透明由 .wd-popup.wd-dialog 承担，容器自身承载背景令牌
    expect(transition.className).toContain('wd-dialog')
    const box = firstMatch(container, '.wd-dialog__container')!
    expect(box.tagName.toLowerCase()).toBe('view')
    expect(container.textContent).toContain('提示')
    expect(container.textContent).toContain('这是一个对话框')
    // 确认按钮（block 形态）在场
    const confirmBtn = firstMatch(container, '.wd-dialog__actions .wd-button')
    expect(confirmBtn, '确认按钮应渲染').not.toBeNull()

    fireEvent.tap(confirmBtn!)
    await frames(2)
    expect(
      firstMatch(container, '.wd-popup-wrapper > .wd-transition.wd-popup')!.className,
      '确认后应立即开始离场，而不是跳过动画'
    ).toContain('wd-transition--zoom-in-leave-active')
    // 200ms 时长从双 rAF 的 to 态开始计时；6×33ms 不足以完整离场。
    await pause(300)
    expect(
      isHidden(firstMatch(container, '.wd-popup-wrapper > .wd-transition.wd-popup')),
      '确认后对话框应关闭'
    ).toBe(true)
    cleanup()
  })

  it('DOM 对齐与链路：toast 命令式 show（含遮罩）与 notify tap 双轨', async () => {
    const { container } = render({
      setup() {
        const toast = useToast('native-first-toast-2')
        return () => [
          h('view', { class: 'trigger', onTap: () => toast.show({ msg: '带遮罩的提示', cover: true }) }, ['show']),
          h(Toast as any, { selector: 'native-first-toast-2' })
        ]
      }
    } as any)

    fireEvent.tap(firstMatch(container, '.trigger')!)
    await frames()
    const toastBox = firstMatch(container, '.wd-toast')!
    expect(toastBox.className, 'middle 位置类名与 wot-ui 一致').toContain('wd-toast--middle')
    expect(container.textContent).toContain('带遮罩的提示')
    // cover 模式渲染透明遮罩（pointer-events: auto 拦截触摸）
    const overlay = firstMatch(container, '.wd-overlay')
    expect(overlay, 'cover 模式应渲染遮罩').not.toBeNull()
    cleanup()

    // notify：showNotify 命令式 + 根 view tap 双轨（click + tap，CONVENTIONS §14）
    const notifyRef = ref<any>(null)
    const clicks: number[] = []
    const taps: number[] = []
    const notify = render({
      setup() {
        return () =>
          h(Notify as any, {
            ref: notifyRef,
            type: 'primary',
            closable: true,
            message: '消息通知',
            onClick: () => clicks.push(1),
            onTap: () => taps.push(1)
          })
      }
    } as any)
    notifyRef.value.showNotify({ message: '消息通知', type: 'primary' })
    await frames()

    const notifyBox = firstMatch(notify.container, '.wd-notify')!
    expect(notifyBox.className).toContain('wd-notify--primary')
    expect(firstMatch(notify.container, '.wd-notify__prefix'), '前缀图标应渲染').not.toBeNull()
    expect(firstMatch(notify.container, '.wd-notify__content'), '内容区应渲染').not.toBeNull()
    expect(firstMatch(notify.container, '.wd-notify__close'), '关闭按钮应渲染').not.toBeNull()
    expect(notify.container.textContent).toContain('消息通知')

    fireEvent.tap(notifyBox)
    await frames()
    expect(clicks.length, 'tap 应触发 click').toBe(1)
    expect(taps.length, 'tap 应触发 tap').toBe(1)
    cleanup()
  })
})
