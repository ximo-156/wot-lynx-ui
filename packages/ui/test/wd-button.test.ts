import { describe, it, expect } from 'vitest'
import { render } from './render'
import { fireEvent } from './fire-event'
import WdButton from '../src/components/wd-button/wd-button.vue'

describe('wd-button', () => {
  it('渲染按钮文本与类型类名', () => {
    const { container } = render(WdButton, {
      type: 'primary',
      text: '主要按钮'
    })
    const button = container.querySelector('.wd-button')
    expect(button).toBeTruthy()
    expect(button!.classList.contains('is-primary')).toBe(true)
    expect(button!.textContent).toContain('主要按钮')
  })

  it('点击时触发 click 事件', async () => {
    let clicked = 0
    const Wrapper = {
      components: { WdButton },
      setup() {
        return {
          onClick: () => {
            clicked++
          }
        }
      },
      template: `<wd-button type="success" @click="onClick">点击</wd-button>`
    }
    const { container } = render(Wrapper)
    const button = container.querySelector('.wd-button')
    expect(button).toBeTruthy()
    fireEvent.tap(button!)
    await new Promise((r) => setTimeout(r, 50))
    expect(clicked).toBe(1)
  })

  it('禁用状态不触发 click', async () => {
    let clicked = 0
    const Wrapper = {
      components: { WdButton },
      setup() {
        return {
          onClick: () => {
            clicked++
          }
        }
      },
      template: `<wd-button disabled @click="onClick">禁用</wd-button>`
    }
    const { container } = render(Wrapper)
    const button = container.querySelector('.wd-button')
    expect(button!.classList.contains('is-disabled')).toBe(true)
    fireEvent.tap(button!)
    await new Promise((r) => setTimeout(r, 50))
    expect(clicked).toBe(0)
  })
})
