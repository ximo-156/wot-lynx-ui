/**
 * 内联样式回归测试（布局家族）— CONVENTIONS §19 字符串 :style 被静默丢弃。
 *
 * 背景：wd-row / wd-col / wd-grid / wd-grid-item / wd-sticky / wd-sticky-box
 * 的 rootStyle 曾返回**字符串**（拼 CSS 变量/宽高声明），vue-lynx 的 patchProp
 * 只处理对象语法，字符串被静默替换为 {}：真机上 gutter、span/offset、column、
 * containerHeight 全部失效（Web 预览亦部分失效——纯 CSS 变量串连 style
 * 属性都不会生成）。
 *
 * 断言边界说明：JSDOM 的样式序列化不支持 setProperty 自定义属性，
 * `--wd-*` 变量在测试环境的 style 属性中不可见（同 themeVars 的处理，
 * 见 inline-style-regression.test.ts:144 的注释）；真机经
 * enableCSSInlineVariables 支持内联 CSS 变量（demo 的 lynx.config.ts
 * 已开启），Web 预览亦支持（已浏览器实测：--wd-grid-column:5 生效、
 * grid 恢复 5 列布局）。因此本测试断言**普通属性**（字符串样式下它们
 * 同样会整体消失，足以守住回归），自定义变量经映射/浏览器层验证。
 */
import { describe, it, expect } from 'vitest'
import { render, cleanup } from './render'
import Row from '../src/components/wd-row/wd-row.vue'
import Col from '../src/components/wd-col/wd-col.vue'
import Grid from '../src/components/wd-grid/wd-grid.vue'
import GridItem from '../src/components/wd-grid-item/wd-grid-item.vue'
import Sticky from '../src/components/wd-sticky/wd-sticky.vue'
import StickyBox from '../src/components/wd-sticky-box/wd-sticky-box.vue'

function styleOf(el: Element | null): string {
  return el ? el.getAttribute('style') || '' : ''
}

describe('内联样式：布局家族字符串 :style 回归（CONVENTIONS §19）', () => {
  it('WdRow customStyle 合并且根节点样式非空（字符串样式下整体消失）', () => {
    const { container } = render(Row, { gutter: 12, customStyle: 'margin-bottom: 8px' })
    const style = styleOf(container.querySelector('.wd-row'))
    // gutter 的 --wd-row-gutter 为自定义属性（JSDOM 不可见，见文件头说明），
    // 此处断言 customStyle 合并生效——字符串 rootStyle 下它同样被丢弃
    expect(style).toContain('margin-bottom')
    expect(style).toMatch(/8px/)
    cleanup()
  })

  it('WdCol span / offset 换算为 flex-basis / margin-left', () => {
    const { container } = render(Col, { span: 12, offset: 6, customStyle: 'background: #fff' })
    const style = styleOf(container.querySelector('.wd-col'))
    expect(style).toMatch(/flex-basis:\s*50%/)
    expect(style).toMatch(/margin-left:\s*25%/)
    expect(style).toContain('background')
    cleanup()
  })

  it('WdGrid gutter / bgColor 生效（column 变量见浏览器实测）', () => {
    const { container } = render(Grid, { column: 5, gutter: 8, bgColor: '#f5f5f5' })
    const style = styleOf(container.querySelector('.wd-grid'))
    expect(style).toMatch(/gap:\s*8px/)
    expect(style).toContain('background-color')
    expect(style).toMatch(/rgb\(245,\s*245,\s*245\)/)
    cleanup()
  })

  it('WdGridItem customStyle 合并且根节点样式非空', () => {
    const { container } = render(GridItem, { text: 'x', customStyle: 'padding: 4px' })
    const style = styleOf(container.querySelector('.wd-grid-item'))
    expect(style).toContain('padding')
    expect(style).toMatch(/4px/)
    cleanup()
  })

  it('WdSticky position:sticky 与 offsetTop 生效', () => {
    const { container } = render(Sticky, { offsetTop: 12, zIndex: 10 })
    const style = styleOf(container.querySelector('.wd-sticky'))
    expect(style).toMatch(/position:\s*sticky/)
    expect(style).toMatch(/top:\s*12px/)
    expect(style).toMatch(/z-index:\s*10/)
    cleanup()
  })

  it('WdStickyBox containerHeight 生效（scroll-view 拿得到高度）', () => {
    const { container } = render(StickyBox, { containerHeight: 180 })
    const style = styleOf(container.querySelector('.wd-sticky-box'))
    expect(style).toMatch(/height:\s*180px/)
    cleanup()
  })
})
