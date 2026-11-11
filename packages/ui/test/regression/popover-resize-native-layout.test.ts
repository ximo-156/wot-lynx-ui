/**
 * Android 截图回归：气泡/菜单不得塌成逐字窄列，Resize 只观察尺寸、不反向锁死布局。
 * 检查双线程渲染树、直接 SCSS 声明和原生查询生命周期；不冒充真机像素验收。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue-lynx'
import postcss from 'postcss'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path, { resolve } from 'node:path'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import { nativeRuntime, restoreNativeStubs, stubNativeQuery } from '../helpers/native-stubs'
import Popover from '@wot-lynx/ui-feedback/wd-popover'
import type { PlacementType } from '@wot-lynx/ui-feedback/wd-popover'
import Resize from '@wot-lynx/ui-layout/wd-resize'
import { compileScss } from '../helpers/scss'
import { compCss, compPath } from '../helpers/component-roots'

const sheets = new Map<string, ReturnType<typeof postcss.parse>>()
function declarations(element: Element, name: string): Record<string, string> {
  if (!sheets.has(name)) {
    const filename = compPath(name, 'index.scss')
    sheets.set(name, postcss.parse(compileScss(filename)))
  }
  const values: Record<string, string> = {}
  sheets.get(name)!.walkRules((rule) => {
    if (rule.parent?.type !== 'root' || !rule.selectors.some((selector) => element.matches(selector))) return
    rule.walkDecls((decl) => { values[decl.prop] = decl.value })
  })
  return values
}
// 只验证变量链与声明，不模拟原生绘制；支持阴影 fallback 中的 rgba()/逗号。
function resolveVars(value: string, variables: Record<string, string>, depth = 0): string {
  if (depth > 40) throw new Error('循环 CSS 变量')
  let result = value
  for (let start = result.indexOf('var('); start !== -1; start = result.indexOf('var(')) {
    let end = start + 4
    let nesting = 1
    let comma = -1
    for (; end < result.length && nesting; end++) {
      const char = result[end]
      if (char === '(') nesting++
      else if (char === ')') nesting--
      else if (char === ',' && nesting === 1 && comma === -1) comma = end
    }
    if (nesting) throw new Error(`无效 CSS 变量：${value}`)
    const name = result.slice(start + 4, comma === -1 ? end - 1 : comma).trim()
    const replacement = variables[name] ?? (comma === -1 ? undefined : result.slice(comma + 1, end - 1).trim())
    if (replacement === undefined) throw new Error(`未定义 CSS 变量：${name}`)
    result = result.slice(0, start) + resolveVars(replacement, variables, depth + 1) + result.slice(end)
  }
  return result.trim()
}

async function nativePopoverRules(component = 'wd-popover') {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const demoRequire = createRequire(path.resolve(here, '../../../demo/package.json'))
  const templatePackage = createRequire(demoRequire.resolve('vue-lynx/plugin')).resolve('@lynx-js/template-webpack-plugin/package.json')
  const serializerPath = createRequire(templatePackage).resolve('@lynx-js/css-serializer')
  const CSS = await import(pathToFileURL(serializerPath).href)
  const { genStyleInfo } = await import(pathToFileURL(path.resolve(path.dirname(templatePackage), 'lib/web/genStyleInfo.js')).href)
  const css = compCss(component)
  expect(CSS.parse(css).errors).toEqual([])
  const { cssMap } = CSS.cssChunksToMap([css], [], true)
  const rules: Array<{ sel: string[][]; decl: Array<[string, string]> }> = genStyleInfo(cssMap)['0'].rules
  return (selector: string) => {
    const matches = rules.filter((rule) => rule.sel.some((parts) => parts.flat().join('') === selector))
    expect(matches.length, `原生序列化产物缺少 ${selector}`).toBeGreaterThan(0)
    return Object.assign({}, ...matches.map((rule) => Object.fromEntries(rule.decl))) as Record<string, string>
  }
}

async function flush() {
  for (let i = 0; i < 6; i++) await nextTick()
}
function rect(width: number, height: number) {
  return { width, height, top: 10, left: 20, bottom: 10 + height, right: 20 + width }
}

afterEach(() => {
  cleanup()
  restoreNativeStubs()
})

describe('Popover 原生内容宽度', () => {
  it('普通气泡具有 intrinsic 宽度和视口上限，文字直接声明排版而非依赖 view 继承', async () => {
    stubNativeQuery((selector) => rect(selector.endsWith('-target') ? 80 : 132, 32))
    const { container } = render(Popover, { content: '普通气泡内容', modelValue: true })
    await flush()
    const positions = container.querySelectorAll('.wd-popover__pos')
    expect(positions).toHaveLength(2)
    for (const position of positions) {
      const style = declarations(position, 'wd-popover')
      expect(style.width).toBe('max-content')
      expect(style['max-width']).toBe('calc(100vw - 24px)')
      expect(style.display).toBe('flex')
      expect(style['flex-direction']).toBe('column')
      const label = position.querySelector('text.wd-popover__label')!
      expect(label.textContent).toBe('普通气泡内容')
      const textStyle = declarations(label, 'wd-popover')
      for (const key of ['font-size', 'line-height', 'color']) expect(textStyle[key]).toBeTruthy()
      expect(textStyle['white-space']).toBe('normal')
      expect(declarations(label.parentElement!, 'wd-popover')['line-height']).toBeUndefined()
    }
    expect(container.querySelector('.wd-popover__hidden')?.getAttribute('user-interaction-enabled')).toBe('false')
  })

  it('菜单的测量副本和可见副本结构一致，长短文案更新不沿用旧尺寸，菜单 tap 只触发一次', async () => {
    const { calls } = stubNativeQuery((selector) => rect(selector.endsWith('-target') ? 80 : 180, 64))
    const content = ref([{ content: '选项一', iconClass: 'setting' }, { content: '较长的菜单选项二', iconClass: 'picture' }])
    const selected: unknown[] = []
    const open = ref(true)
    const { container } = render(defineComponent(() => () => h(Popover, {
      mode: 'menu', content: content.value, modelValue: open.value,
      'onUpdate:modelValue': (value: boolean) => { open.value = value },
      onMenuclick: (value: unknown) => selected.push(value)
    })))
    await flush()
    const hidden = container.querySelector('.wd-popover__hidden .wd-popover__menu')!
    const visible = container.querySelector('.wd-transition .wd-popover__menu')!
    for (const menu of [hidden, visible]) {
      const rows = menu.querySelectorAll('.wd-popover__menu-inner')
      expect(rows).toHaveLength(2)
      expect(rows[0].classList.contains('is-first')).toBe(true)
      expect(rows[1].classList.contains('is-first')).toBe(false)
      rows.forEach((row, index) => {
        expect(row.querySelector('.wd-popover__menu-icon')).not.toBeNull()
        expect(row.querySelector('.wd-popover__text > text.wd-popover__label')?.textContent).toBe(content.value[index].content)
      })
    }
    const previous = calls.length
    content.value = [{ content: '改为更长的一条完整菜单文案', iconClass: 'setting' }]
    await flush()
    expect(calls.length).toBeGreaterThan(previous)
    expect(hidden.querySelectorAll('.wd-popover__label')).toHaveLength(1)
    expect(visible.querySelector('.wd-popover__label')?.textContent).toBe(content.value[0].content)
    fireEvent.tap(visible.querySelector('.wd-popover__menu-inner')!)
    await flush()
    expect(open.value).toBe(false)
    expect(selected).toEqual([{ item: content.value[0], index: 0 }])
    open.value = true
    content.value = [{ content: '短', iconClass: 'setting' }]
    await flush()
    expect(container.querySelector('.wd-transition .wd-popover__label')?.textContent).toBe('短')
  })

  it('Rspeedy 使用的原生样式序列化器保留内容宽度、文字和三角盒模型', async () => {
    const find = await nativePopoverRules()
    const position = find('.wd-popover .wd-popover__pos')
    expect(position.width).toBe('max-content')
    expect(position['max-width'].replace(/\s/g, '')).toBe('calc(100vw-24px)')
    expect(position.display).toBe('flex')
    const label = find('.wd-popover__label')
    expect(label['white-space']).toBe('normal')
    for (const property of ['color', 'font-size', 'line-height']) expect(label[property]).toBeTruthy()
    for (const [name, rule] of [['wd-popover', find], ['wd-tooltip', await nativePopoverRules('wd-tooltip')]] as const) {
      expect(rule(`.${name}__arrow`)['box-sizing']).toBe('content-box')
      expect(rule(`.${name}__arrow`)['--wot-triangle-arrow-size']).toContain(`--wot-${name.slice(3)}-arrow-size`)
      expect(rule(`.${name}__arrow-down`).bottom.replace(/\s/g, '')).toBe('calc(0px-var(--wot-triangle-arrow-size))')
      for (const [direction, side] of [['up', 'bottom'], ['down', 'top'], ['left', 'right'], ['right', 'left']]) {
        const arrow = rule(`.${name}__arrow-${direction}`)
        for (const property of ['width', 'style', 'color']) expect(arrow[`border-${side}-${property}`]).toBeTruthy()
      }
    }
  })

  it('原生序列化后默认阴影与层级仍可解析，允许显式覆盖和关闭阴影', async () => {
    const rule = await nativePopoverRules()
    const panel = rule('.wd-popover__container')
    const position = rule('.wd-popover .wd-popover__pos')
    const shadow = resolveVars(panel['box-shadow'], panel)
    expect(shadow).not.toBe('none')
    expect(shadow).toMatch(/rgba?\(/)
    expect(resolveVars(position['z-index'], position)).toBe('500')
    expect(Number(resolveVars(position['z-index'], position))).toBeGreaterThan(Number(rule('.wd-popover__backdrop')['z-index']))
    for (const value of ['none', '0 2px 6px rgba(0, 0, 0, 0.25)']) {
      expect(resolveVars(panel['box-shadow'], { ...panel, '--wot-popover-box-shadow': value })).toBe(value)
    }
    expect(resolveVars(position['z-index'], { ...position, '--wot-popover-z-index': '907' })).toBe('907')
  })

  it.each(['normal', 'menu'] as const)('%s 的面板有独立实色背景和外框，内容间距直接声明', async (mode) => {
    stubNativeQuery(() => rect(120, 60))
    const content = mode === 'normal' ? '普通气泡' : [{ content: '菜单选项' }]
    const { container } = render(Popover, { modelValue: true, mode, content })
    await flush()
    for (const panel of container.querySelectorAll('.wd-popover__container')) {
      const style = declarations(panel, 'wd-popover')
      expect(style['background-color']).toContain('--wot-popover-bg')
      expect(style['border-width']).toBe('1px')
      expect(style['border-style']).toBe('solid')
      expect(style['border-color']).toContain('--wot-popover-border-color')
      expect(style.overflow).not.toBe('hidden')
      if (mode === 'menu') {
        const menu = declarations(panel.querySelector('.wd-popover__menu')!, 'wd-popover')
        const row = declarations(panel.querySelector('.wd-popover__menu-inner')!, 'wd-popover')
        for (const side of ['left', 'right']) expect(resolveVars(menu[`padding-${side}`], menu)).toBe('12px')
        for (const side of ['top', 'bottom']) expect(resolveVars(row[`padding-${side}`], row)).toBe('12px')
      }
    }
  })

  it('十二种方位的箭头包含真实描边与填充，亮暗主题及定制颜色保持一致', async () => {
    stubNativeQuery(() => rect(120, 60))
    const placement = ref<PlacementType>('bottom')
    const visibleArrow = ref(true)
    const { container } = render(defineComponent(() => () => h(Popover, {
      modelValue: true, content: '带轮廓的气泡', placement: placement.value, visibleArrow: visibleArrow.value
    })))
    const themeSheet = postcss.parse(compileScss(resolve(__dirname, '../../../core/src/styles/theme/index.scss')))
    const themes = ['light', 'dark'].map((theme) => {
      const variables: Record<string, string> = {}
      themeSheet.walkRules((rule) => {
        if (rule.selectors.includes(':root') || rule.selectors.includes(`.wot-theme-${theme}`)) {
          rule.walkDecls((decl) => { variables[decl.prop] = decl.value })
        }
      })
      return variables
    })
    themes.push({ '--wot-popover-bg': '#234567', '--wot-popover-border-color': '#abcdef' })
    for (const [side, direction, border] of [
      ['top', 'down', 'top'], ['bottom', 'up', 'bottom'], ['left', 'right', 'left'], ['right', 'left', 'right']
    ]) {
      for (const alignment of ['', '-start', '-end']) {
        placement.value = (side + alignment) as PlacementType
        await flush()
        const panel = container.querySelector('.wd-transition .wd-popover__container')!
        const arrow = panel.querySelector(`.wd-popover__arrow-${direction}`)!
        expect(arrow).not.toBeNull()
        expect(arrow.getAttribute('user-interaction-enabled')).toBe('false')
        const fill = arrow.querySelector('.wd-popover__arrow-fill')!
        expect(fill).not.toBeNull()
        const panelStyle = declarations(panel, 'wd-popover')
        const arrowStyle = declarations(arrow, 'wd-popover')
        const fillStyle = declarations(fill, 'wd-popover')
        expect(arrowStyle['box-sizing']).toBe('content-box')
        expect(fillStyle['box-sizing']).toBe('content-box')
        for (const variables of themes) {
          const colors = { ...arrowStyle, ...fillStyle, ...variables }
          expect(resolveVars(arrowStyle[`border-${border}-color`], colors)).toBe(resolveVars(panelStyle['border-color'], variables))
          expect(resolveVars(fillStyle[`border-${border}-color`], colors)).toBe(resolveVars(panelStyle['background-color'], variables))
        }
      }
    }
    visibleArrow.value = false
    await flush()
    expect(container.querySelector('.wd-transition .wd-popover__arrow')).toBeNull()
    visibleArrow.value = true
    await flush()
    expect(container.querySelectorAll('.wd-transition .wd-popover__arrow-fill')).toHaveLength(1)
  })

  it('content 插槽只挂载一份，不在隐藏测量层重复创建可交互内容', async () => {
    stubNativeQuery(() => rect(100, 40))
    const { container } = render(defineComponent(() => () => h(Popover, { modelValue: true }, {
      content: () => h('view', { class: 'custom-popover-content' }, [h('text', null, '自定义内容')])
    })))
    await flush()
    expect(container.querySelectorAll('.custom-popover-content')).toHaveLength(1)
    expect(container.querySelector('.wd-popover__hidden .custom-popover-content')).toBeNull()
  })
})

describe('Resize 原生自然布局', () => {
  it('初次和后续度量都不把宽高写回父容器，支持变宽、变窄、变高并对同尺寸去重', async () => {
    let size = rect(260, 60)
    const { calls } = stubNativeQuery(() => size)
    const events: Array<Record<string, number>> = []
    const { container } = render(defineComponent(() => () => h(Resize, {
      onResize: (value: Record<string, number>) => events.push(value)
    }, () => h('view', { style: { height: '60px' } }, [h('text', null, '高度 60px · resize 次数')]))))
    const root = container.querySelector('.wd-resize') as HTMLElement
    const content = root.querySelector('.wd-resize__container')!
    expect(root.style.width).toBe('')
    expect(root.style.height).toBe('')
    expect(declarations(content, 'wd-resize').position).toBe('relative')
    await flush()
    expect(events).toEqual([size])
    for (const [width, height] of [[320, 60], [180, 120], [260, 60]]) {
      size = rect(width, height)
      fireEvent.layoutchange(content, { detail: { layout: { width, height } } })
      await flush()
      expect(events.at(-1)).toEqual(size)
      expect(root.style.width).toBe('')
      expect(root.style.height).toBe('')
    }
    const previousCalls = calls.length
    const previousEvents = events.length
    fireEvent.layoutchange(content, { detail: { width: size.width, height: size.height } })
    await flush()
    expect(calls).toHaveLength(previousCalls)
    expect(events).toHaveLength(previousEvents)
    for (const probe of root.querySelectorAll('scroll-view.wd-resize__wrapper')) {
      expect(probe.getAttribute('user-interaction-enabled')).toBe('false')
      expect(declarations(probe, 'wd-resize')['pointer-events']).toBe('none')
    }
  })

  it('自定义尺寸删除后显式清除旧内联值，不退回之前测得的固定宽度', async () => {
    stubNativeQuery(() => rect(200, 80))
    const customStyle = ref<Record<string, string>>({ width: '200px', height: '80px' })
    const { container } = render(defineComponent(() => () => h(Resize, { customStyle: customStyle.value }, () => h('text', null, '自适应'))))
    const root = container.querySelector('.wd-resize') as HTMLElement
    await flush()
    expect(root.style.width).toBe('200px')
    expect(root.style.height).toBe('80px')
    customStyle.value = {}
    await flush()
    expect(root.style.width).toBe('')
    expect(root.style.height).toBe('')
  })

  it('晚到的旧测量与卸载回调不会覆盖新尺寸或继续通知', async () => {
    // 手动控制原生返回顺序，不用 DOM 的零矩形模拟原生布局。
    const runtime = nativeRuntime()
    const original = runtime.createSelectorQuery
    const pending: Array<{ success: (value: unknown) => void }> = []
    runtime.createSelectorQuery = () => ({
      select: () => ({ invoke: (options: { success: (value: unknown) => void }) => ({ exec: () => pending.push(options) }) })
    })
    try {
      const events: unknown[] = []
      const { container, unmount } = render(Resize, { onResize: (value: unknown) => events.push(value) })
      await flush()
      const content = container.querySelector('.wd-resize__container')!
      expect(pending).toHaveLength(1)
      fireEvent.layoutchange(content, { detail: { width: 240, height: 80 } })
      await flush()
      expect(pending).toHaveLength(2)
      pending[1].success(rect(240, 80))
      await flush()
      pending[0].success(rect(20, 600))
      await flush()
      expect(events).toEqual([rect(240, 80)])
      fireEvent.layoutchange(content, { detail: { width: 320, height: 90 } })
      await flush()
      expect(pending).toHaveLength(3)
      unmount()
      pending[2].success(rect(320, 90))
      await flush()
      expect(events).toEqual([rect(240, 80)])
    } finally {
      runtime.createSelectorQuery = original
    }
  })
})
