/**
 * 原生优先重写 · Dialog 横向按钮行等分契约（真机 2026-11-06 用户截图复测）。
 *
 * 背景（用户截图「这个弹窗的适配程度不一样啊」）：确认弹窗里「取消」按钮横跨
 * 整个弹窗内容宽度，「确定」按钮被挤到右侧、被 __container 的 overflow:
 * hidden 裁得只剩一条色带。根因：wd-button 基础样式带 flex-shrink: 0
 * （CONVENTIONS §19 附注：防止按钮在行内被按比例压缩），而本组按钮走
 * is-block（width: 100%）——两个 100% 按钮放进 flex 行后谁都不缩。Web 端
 * wot-ui 的按钮无 flex-shrink: 0，两个 100% 按钮默认各缩一半，所以只有
 * 真机翻车（弹窗本体居中一直正常，翻车的只是按钮行）。
 *
 * 修法：横向按钮行（.wd-dialog__actions.wd-dialog__flex:not(.wd-dialog__
 * __actions--vertical)）内的按钮显式 flex: 1 等分宽度。flex-grow 是真机
 * 可用路径（CONVENTIONS §19 差异 #11，wd-cell __left / __right 同机制）；
 * 按钮行由 __container 的 align-items 拉伸定宽，不存在 basis: 0 按内容
 * 塌缩的问题。
 *
 * 为什么只修横向行：--vertical 与 --block 均为 column 容器、高度按内容
 * 结算，flex-basis: 0 会把按钮高度算没（wd-password-input 2026-11-01
 * 同源缺陷：六格各分到 1px，整组渲染成一根竖条）。
 *
 * 本测试锁定：
 * 1. 编译产物里横向按钮行规则存在且带 flex: 1；
 * 2. 任何给 __actions-btn 下发 flex 的规则都必须限定 --flex 行容器、
 *    且排除 --vertical（防止回退成无条件 flex: 1 把纵向/单按钮场景打塌）；
 * 3. 模板下发的容器类名锚点不回退：confirm 走 --flex 且非 --vertical、
 *    纵向走 --vertical、alert 单按钮走 --block。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { pause } from '@wot-lynx/core/common/util'
import Dialog from '@wot-lynx/ui-feedback/wd-dialog'
import { compRead } from '../helpers/component-roots'

const css = (rel: string) => compRead(...rel.split('/'))

async function frames(n = 6) {
  for (let i = 0; i < n; i++) await pause()
}

function renderDialog(selector: string) {
  const dialogRef = ref<any>(null)
  const { container } = render({
    setup() {
      return () => h(Dialog as any, { selector, ref: dialogRef })
    }
  } as any)
  return { container, dialogRef }
}

describe('原生优先重写 · Dialog 横向按钮行等分（真机 2026-11-06）', () => {
  afterEach(() => cleanup())

  it('编译产物：横向按钮行规则存在且带 flex: 1', () => {
    const text = css('wd-dialog/index.css')
    const m = text.match(/\.wd-dialog__actions\.wd-dialog__flex:not\(\.wd-dialog__actions--vertical\) \.wd-dialog__actions-btn\{([^}]*)\}/)
    expect(m, '编译产物应含横向按钮行（--flex 且非 --vertical）的按钮规则').not.toBeNull()
    expect(m![1], '按钮靠 flex: 1 等分按钮行宽度').toMatch(/(^|;)flex:1(;|$)/)
  })

  it('编译产物：凡给 __actions-btn 下发 flex 的规则都必须限定横向行容器', () => {
    const text = css('wd-dialog/index.css')
    const ruleRe = /([^{}]*wd-dialog__actions-btn[^{}]*)\{([^}]*)\}/g
    let hit = 0
    for (const mm of text.matchAll(ruleRe)) {
      const [, selector, body] = mm
      if (!/(^|;)flex:/.test(body)) continue
      hit++
      expect(selector, 'flex 规则必须挂在 --flex 行容器上（--block 是 column）').toContain('wd-dialog__flex')
      expect(selector, 'flex 规则必须排除 --vertical（column 容器 basis: 0 会塌高度）').toContain(':not(.wd-dialog__actions--vertical)')
    }
    expect(hit, '至少应有一条 flex 规则命中上述断言').toBeGreaterThan(0)
  })

  it('confirm：按钮行挂 --flex 且非 --vertical，渲染取消 + 确认两个按钮', async () => {
    const { container, dialogRef } = renderDialog('dialog-actions-flex-confirm')
    dialogRef.value.confirm({ title: '确认操作', msg: '确定要执行该操作吗？' })
    await frames()

    const actions = container.querySelector('.wd-dialog__actions')!
    expect(actions, '按钮行应渲染').not.toBeNull()
    expect(actions.className, 'confirm 双按钮走 --flex 行容器').toContain('wd-dialog__flex')
    expect(actions.className, 'confirm 双按钮不是纵向').not.toContain('wd-dialog__actions--vertical')

    const btns = container.querySelectorAll('.wd-dialog__actions .wd-dialog__actions-btn')
    expect(btns.length, 'confirm 应有取消 + 确认两个按钮').toBe(2)
    cleanup()
  })

  it('vertical：按钮行挂 --vertical（column 堆叠，不参与横向等分）', async () => {
    const { container, dialogRef } = renderDialog('dialog-actions-flex-vertical')
    dialogRef.value.confirm({ title: '确认操作', msg: '确定要执行该操作吗？', actionLayout: 'vertical' })
    await frames()

    const actions = container.querySelector('.wd-dialog__actions')!
    expect(actions.className, 'actionLayout: vertical 应挂 --vertical').toContain('wd-dialog__actions--vertical')
    const btns = container.querySelectorAll('.wd-dialog__actions .wd-dialog__actions-btn')
    expect(btns.length, '纵向仍是两个按钮').toBe(2)
    cleanup()
  })

  it('alert：单按钮行挂 --block（column 容器，不被横向 flex 规则命中）', async () => {
    const { container, dialogRef } = renderDialog('dialog-actions-flex-alert')
    dialogRef.value.alert({ title: '提示', msg: '这是一个对话框' })
    await frames()

    const actions = container.querySelector('.wd-dialog__actions')!
    expect(actions.className, 'alert 单按钮走 --block').toContain('wd-dialog__block')
    expect(actions.className, 'alert 单按钮不走 --flex').not.toContain('wd-dialog__flex')
    expect(container.querySelectorAll('.wd-dialog__actions .wd-dialog__actions-btn').length, 'alert 只有一个确认按钮').toBe(1)
    cleanup()
  })
})
