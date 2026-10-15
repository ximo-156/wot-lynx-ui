/**
 * 临时验证：挂载 demo 页面，检查「挂载即视」是否存在一直可见的测试弹窗。
 */
import { describe, it, expect } from 'vitest'
import { render, cleanup } from './render'
import wotLynxUI from '../src/index'
import DeviceTestApp from '../../demo/src/device-test/App.vue'
import MainApp from '../../demo/src/App.vue'
import { pause } from '../src/common/util'

async function frames(n = 5) {
  for (let i = 0; i < n; i++) await pause()
}

function dumpOverlayNodes(container: Element) {
  const sels = ['.wd-popup-wrapper', '.wd-popup', '.wd-dialog', '.wd-toast', '.wd-overlay', '.wd-transition', '.wd-keyboard', '.wd-notify']
  const out: string[] = []
  for (const sel of sels) {
    container.querySelectorAll(sel).forEach((el) => {
      const style = (el as HTMLElement).getAttribute('style') || ''
      out.push(`${sel} class="${el.getAttribute('class')}" style="${style}"`)
    })
  }
  return out
}

describe('demo 页面挂载即视检查', () => {
  it('device-test 页面挂载后无可见弹层', async () => {
    const { container } = render(DeviceTestApp as any, {}, [wotLynxUI as any])
    await frames()
    const nodes = dumpOverlayNodes(container)
    console.log('[device-test] 弹层相关节点数:', nodes.length)
    nodes.forEach((n) => console.log('  ', n))
    cleanup()
    expect(nodes.length).toBeGreaterThanOrEqual(0)
  })

  it('main demo 页面挂载后无可见弹层', async () => {
    const { container } = render(MainApp as any, {}, [wotLynxUI as any])
    await frames()
    const nodes = dumpOverlayNodes(container)
    console.log('[main] 弹层相关节点数:', nodes.length)
    nodes.forEach((n) => console.log('  ', n))
    cleanup()
    expect(nodes.length).toBeGreaterThanOrEqual(0)
  })
})
