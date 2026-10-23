/**
 * 弹层链路回归测试 — 真机测试中暴露的三个缺陷锁定。
 *
 * 背景（2026-10-15 真机测试核实）：
 * 1. wd-popup 在 wd-overlay 上绑 @tap，而 WdOverlay 只 emit 'click'
 *    （WdTransition 根 view 自 e2931b8 起内部点击用 @click，CONVENTIONS §14）
 *    → 遮罩点击关闭是死链，popup 打开后只能靠关闭按钮退出；
 *    【2026-10-16 订正】上述「对齐 @click」并未真正修复：Lynx 引擎只向 view
 *    派发 tap、不派发 click，遮罩点击依旧全端失效（用户真机复报）。真正的
 *    根因是 @click 本身，修法见 wd-transition / wd-overlay：根 view 绑
 *    @tap 并经 emits 转发，overlay 再重新 emit 为 click/tap。本文件 缺陷①
 *    改用 fireEvent.tap（真机派发的事件）锁定。
 * 2. wd-transition 用「键的增减」表达 display 状态（隐藏时写入 display:none，
 *    入场后从样式对象里删掉该键），但 Lynx SetStyle / __SetInlineStyles 是
 *    合并语义（引擎 PAPI 镜像与 Web 预览运行时均 Object.assign 逐属性合并），
 *    删键不会清除元素上已应用的内联属性 → lazyRender=false 的 transition
 *    （overlay / toast / popover / tooltip 及 popup 自己的遮罩）挂载即带
 *    display:none，此后永远不可见（toast / 遮罩不显示）；
 * 3. wd-dialog / wd-action-sheet 无 defineExpose，demo 的
 *    dialogRef.value.alert() / actionSheetRef.value.open() 直接 TypeError
 *    （被全局 errorGuard 吞掉），命令式按钮点了没反应。
 *
 * 本文件对三个缺陷逐一锁定；现有 event / inline-style 回归只断言「类名 /
 * 样式非空」，不断言可见性与关闭行为，所以这类回归此前抓不到。
 */
import { describe, it, expect } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { pause } from '../../src/common/util'
import { fireEvent } from '../fire-event'
import Popup from '../../src/primitives/wd-popup/wd-popup.vue'
import Overlay from '../../src/primitives/wd-overlay/wd-overlay.vue'
import Dialog from '../../src/components/wd-dialog/wd-dialog.vue'
import ActionSheet from '../../src/components/wd-action-sheet/wd-action-sheet.vue'
import Toast from '../../src/components/wd-toast/wd-toast.vue'
import { useToast } from '../../src/components/wd-toast'

/** 等待过渡入场（pause 约 33ms 一帧，enter 需 2 帧置 display） */
async function frames(n = 6) {
  for (let i = 0; i < n; i++) await pause()
}

/** 等待离场动画完整落地（duration 兜底定时器 + 框架按 v-if 卸载） */
async function settle() {
  await pause(500)
  await frames(4)
}

function isHidden(el: Element | null): boolean {
  if (!el) return true
  return /display:\s*none/.test((el as HTMLElement).getAttribute('style') || '')
}

function firstMatch(container: Element, selector: string): Element | null {
  return container.querySelector(selector)
}

describe('弹层链路回归（真机测试缺陷锁定）', () => {
  it('缺陷①：popup 遮罩 tap 可关闭（transition 根 view @tap → overlay 重 emit）', async () => {
    const show = ref(false)
    const updates: boolean[] = []
    const { container } = render({
      setup() {
        return () =>
          h(
            Popup as any,
            {
              modelValue: show.value,
              closeOnClickModal: true,
              'onUpdate:modelValue': (val: boolean) => {
                show.value = val
                updates.push(val)
              }
            },
            { default: () => h('view', { class: 'popup-content' }, ['内容']) }
          )
      }
    } as any)

    show.value = true
    await frames()
    const content = firstMatch(container, '.wd-popup-wrapper > .wd-transition')
    expect(isHidden(content), '打开后弹层内容应可见').toBe(false)

    const mask = firstMatch(container, '.wd-popup-wrapper .wd-overlay')
    expect(mask, '遮罩应渲染').not.toBeNull()
    expect(isHidden(mask), '遮罩应可见（缺陷②连带锁定）').toBe(false)

    // 真机派发的是 tap（Lynx view 无 click 事件）
    fireEvent.tap(mask!)
    await settle()
    expect(updates, '点击遮罩应触发 update:modelValue(false)').toContain(false)
    expect(isHidden(firstMatch(container, '.wd-popup-wrapper > .wd-transition')), '关闭后弹层内容应隐藏').toBe(true)
    cleanup()
  })

  it('缺陷②：overlay 显隐切换后 display 不残留（SetStyle 合并语义）', async () => {
    const show = ref(false)
    const { container } = render({
      setup() {
        return () => h(Overlay as any, { show: show.value })
      }
    } as any)

    const overlay = () => firstMatch(container, '.wd-overlay')
    expect(isHidden(overlay()), '初始隐藏（卸载或 display:none）').toBe(true)

    show.value = true
    await frames()
    expect(isHidden(overlay()), '入场后必须真正可见（旧实现残留 display:none）').toBe(false)

    show.value = false
    await settle()
    expect(isHidden(overlay()), '离场后应重新隐藏').toBe(true)
    cleanup()
  })

  it('缺陷②：toast 命令式 show 后真实可见', async () => {
    const { container } = render({
      setup() {
        const toast = useToast('regression-toast')
        return () => [
          h('view', { class: 'trigger', onTap: () => toast.show('你好') }, ['show']),
          h(Toast as any, { selector: 'regression-toast' })
        ]
      }
    } as any)

    const toastTransition = () =>
      Array.from(container.querySelectorAll('.wd-transition')).find((el) => el.querySelector('.wd-toast')) || null
    expect(isHidden(toastTransition()), '初始隐藏').toBe(true)

    fireEvent.tap(firstMatch(container, '.trigger')!)
    await frames()
    expect(isHidden(toastTransition()), 'show 后 toast 必须可见（旧实现残留 display:none）').toBe(false)
    expect(toastTransition()!.textContent).toContain('你好')
    cleanup()
  })

  it('缺陷③：dialog ref.alert() 命令式可用', async () => {
    const dialogRef = ref<any>(null)
    const { container } = render({
      setup() {
        return () => h(Dialog as any, { selector: 'regression-dialog', ref: dialogRef })
      }
    } as any)

    expect(typeof dialogRef.value?.alert, '应暴露 alert').toBe('function')
    dialogRef.value.alert({ title: '提示', msg: '这是一个对话框' })
    await frames()

    const content = firstMatch(container, '.wd-popup-wrapper > .wd-transition')
    expect(isHidden(content), 'alert 后对话框应可见').toBe(false)
    expect(container.textContent).toContain('提示')
    expect(container.textContent).toContain('这是一个对话框')
    cleanup()
  })

  it('缺陷③：action-sheet ref.open() 命令式可用', async () => {
    const sheetRef = ref<any>(null)
    const updates: boolean[] = []
    const visible = ref(false)
    const { container } = render({
      setup() {
        return () =>
          h(ActionSheet as any, {
            modelValue: visible.value,
            actions: [{ name: '选项一' }],
            cancelText: '取消',
            ref: sheetRef,
            'onUpdate:modelValue': (val: boolean) => {
              visible.value = val
              updates.push(val)
            }
          })
      }
    } as any)

    expect(typeof sheetRef.value?.open, '应暴露 open').toBe('function')
    sheetRef.value.open()
    await frames()

    expect(updates, 'open 应触发 update:modelValue(true)').toContain(true)
    const content = firstMatch(container, '.wd-popup-wrapper > .wd-transition')
    expect(isHidden(content), '打开后动作面板应可见').toBe(false)
    expect(container.textContent).toContain('选项一')
    cleanup()
  })
})
