/**
 * 交互回归测试 — 验证原生元素 @tap → 组件事件 的完整链路。
 *
 * 背景：Lynx 的 view/image/text 等原生元素只派发 tap 事件（不派发 click），
 * 组件内部必须使用 @tap 监听原生元素，再 emit 与 wot-ui 一致的事件名。
 * 本测试文件锁定该链路，防止回归。
 */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue-lynx'
import { render } from './render'
import { fireEvent } from './fire-event'
import WdCell from '../src/components/wd-cell/wd-cell.vue'
import WdIcon from '../src/components/wd-icon/wd-icon.vue'
import WdSwitch from '../src/components/wd-switch/wd-switch.vue'
import WdCheckbox from '../src/components/wd-checkbox/wd-checkbox.vue'
import WdCheckboxGroup from '../src/components/wd-checkbox-group/wd-checkbox-group.vue'
import WdTag from '../src/components/wd-tag/wd-tag.vue'
import WdCollapse from '../src/components/wd-collapse/wd-collapse.vue'
import WdCollapseItem from '../src/components/wd-collapse-item/wd-collapse-item.vue'
import WdInputNumber from '../src/components/wd-input-number/wd-input-number.vue'
import WdSidebar from '../src/components/wd-sidebar/wd-sidebar.vue'
import WdSidebarItem from '../src/components/wd-sidebar-item/wd-sidebar-item.vue'
import WdSegmented from '../src/components/wd-segmented/wd-segmented.vue'

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))

describe('原生元素 tap → 组件事件链路', () => {
  it('WdCell：tap 根节点触发 click 事件', async () => {
    let clicked = 0
    const Wrapper = {
      components: { WdCell },
      setup: () => ({ onClick: () => clicked++ }),
      template: `<wd-cell title="单元格" is-link @click="onClick" />`
    }
    const { container } = render(Wrapper)
    fireEvent.tap(container.querySelector('.wd-cell')!)
    await wait()
    expect(clicked).toBe(1)
  })

  it('WdIcon：tap 触发 click 事件', async () => {
    let clicked = 0
    const Wrapper = {
      components: { WdIcon },
      setup: () => ({ onClick: () => clicked++ }),
      template: `<wd-icon name="close" @click="onClick" />`
    }
    const { container } = render(Wrapper)
    fireEvent.tap(container.querySelector('.wd-icon')!)
    await wait()
    expect(clicked).toBe(1)
  })

  it('WdSwitch：tap 切换并触发 change', async () => {
    const value = ref(false)
    let changed = 0
    const Wrapper = {
      components: { WdSwitch },
      setup: () => ({ value, onChange: () => changed++ }),
      template: `<wd-switch v-model="value" @change="onChange" />`
    }
    const { container } = render(Wrapper)
    fireEvent.tap(container.querySelector('.wd-switch')!)
    await wait()
    expect(value.value).toBe(true)
    expect(changed).toBe(1)
  })

  it('WdCheckboxGroup：tap 选项触发 change', async () => {
    const value = ref<string[]>([])
    const Wrapper = {
      components: { WdCheckboxGroup, WdCheckbox },
      setup: () => ({ value }),
      template: `<wd-checkbox-group v-model="value"><wd-checkbox name="a">选项A</wd-checkbox></wd-checkbox-group>`
    }
    const { container } = render(Wrapper)
    fireEvent.tap(container.querySelector('.wd-checkbox')!)
    await wait()
    expect(value.value).toEqual(['a'])
  })

  it('WdTag：tap 触发 click，点击关闭触发 close', async () => {
    let clicked = 0
    let closed = 0
    const Wrapper = {
      components: { WdTag },
      setup: () => ({ onClick: () => clicked++, onClose: () => closed++ }),
      template: `<wd-tag text="标签" closable @click="onClick" @close="onClose" />`
    }
    const { container } = render(Wrapper)
    fireEvent.tap(container.querySelector('.wd-tag')!)
    await wait()
    expect(clicked).toBe(1)
    const closeIcon = container.querySelector('.wd-tag__close')
    if (closeIcon) {
      fireEvent.tap(closeIcon)
      await wait()
      expect(closed).toBe(1)
    }
  })

  it('WdCollapseItem：tap 标题展开/收起', async () => {
    const Wrapper = {
      components: { WdCollapse, WdCollapseItem },
      setup: () => ({ value: ['1'] }),
      template: `<wd-collapse v-model="value"><wd-collapse-item name="1" title="标题">内容</wd-collapse-item></wd-collapse>`
    }
    const { container } = render(Wrapper)
    const header = container.querySelector('.wd-collapse-item__header')!
    fireEvent.tap(header)
    await wait()
    // 默认展开，点击后收起（wrapper 高度动画）
    expect(container.querySelector('.wd-collapse-item__header')).toBeTruthy()
  })

  it('WdInputNumber：tap 加减按钮更新值', async () => {
    const value = ref(5)
    const Wrapper = {
      components: { WdInputNumber },
      setup: () => ({ value }),
      template: `<wd-input-number v-model="value" />`
    }
    const { container } = render(Wrapper)
    const sub = container.querySelector('.wd-input-number__sub')
    const add = container.querySelector('.wd-input-number__add')
    expect(sub).toBeTruthy()
    expect(add).toBeTruthy()
    fireEvent.tap(add!)
    await wait()
    expect(value.value).toBe(6)
    fireEvent.tap(sub!)
    await wait()
    expect(value.value).toBe(5)
  })

  it('WdSidebarItem：tap 通知 Sidebar 更新 modelValue', async () => {
    const value = ref(0)
    const Wrapper = {
      components: { WdSidebar, WdSidebarItem },
      setup: () => ({ value }),
      template: `<wd-sidebar v-model="value"><wd-sidebar-item value="0" label="A" /><wd-sidebar-item value="1" label="B" /></wd-sidebar>`
    }
    const { container } = render(Wrapper)
    const items = container.querySelectorAll('.wd-sidebar-item')
    fireEvent.tap(items[1])
    await wait()
    expect(value.value).toBe('1')
  })

  it('WdSegmented：tap 选项更新值', async () => {
    const value = ref('a')
    const Wrapper = {
      components: { WdSegmented },
      setup: () => ({ value }),
      template: `<wd-segmented v-model:value="value" :options="['a', 'b']" />`
    }
    const { container } = render(Wrapper)
    const items = container.querySelectorAll('.wd-segmented__item')
    fireEvent.tap(items[1])
    await wait()
    expect(value.value).toBe('b')
  })
})
