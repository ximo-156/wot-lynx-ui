/**
 * UploadEvokeButton 的外部样式与原生命中层回归。
 *
 * 显式 CSS import + 实际双线程节点匹配，避免普通 Vue SFC scoped 测试假绿。
 * CSS 声明检查不是像素布局/系统相册验收；测试宿主也不模拟 Web 的 x-input 文件回传。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import postcss from 'postcss'
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc'
import * as VueLynx from 'vue-lynx'
import { defineComponent, h, nextTick, ref, type Component, type Plugin } from 'vue-lynx'
import UploadEvokeButton from '../../../demo/src/showcase/UploadEvokeButton.vue'
import Upload from '../../src/components/wd-upload/wd-upload.vue'
import WdIcon from '../../src/primitives/wd-icon/wd-icon.vue'
import { configureUniAdapter } from '../../src/common/uni'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'

const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../demo/src/showcase/UploadEvokeButton.vue')
const source = readFileSync(filename, 'utf8')
const { descriptor } = parse(source, { filename })
const cssImport = descriptor.scriptSetup?.content.match(/^import\s+['"](.+\.css)['"]/m)?.[1]
// 未显式引入时保留空表，让旧 scoped 实现失败在可解释的样式契约而非模块加载阶段。
const stylesheet = cssImport
  ? postcss.parse(readFileSync(path.resolve(path.dirname(filename), cssImport), 'utf8'))
  : postcss.root()
const icons: Plugin = { install: (app) => { app.component('WdIcon', WdIcon) } }

function productionEvoke(): Component {
  // Vitest 的标准 Vue 模板 helper 不带 _lynxCatch；生产插件把 vue alias 到
  // vue-lynx，后者 withModifiers(stop) 才会通知 node-ops 注册 catchEvent。
  // 对真实模板沿用生产 tag loader/编译选项，并显式指定生产 runtime helper。
  const tagLoader = createRequire(import.meta.url)('../../plugin/tag-transform-loader.cjs')
  const transformed = tagLoader.call({ resourcePath: filename, cacheable() {} }, source)
  const { descriptor: productionDescriptor } = parse(transformed, { filename })
  const { bindings } = compileScript(productionDescriptor, { id: 'upload-evoke-events' })
  const compiled = compileTemplate({
    source: productionDescriptor.template!.content,
    filename,
    id: 'upload-evoke-events',
    compilerOptions: {
      runtimeModuleName: 'vue-lynx',
      isNativeTag: () => true,
      whitespace: 'condense',
      hoistStatic: false,
      bindingMetadata: bindings
    }
  })
  expect(compiled.errors).toEqual([])
  expect(compiled.code).toMatch(/onTap:.*_withModifiers/)
  expect(compiled.code).not.toContain('"prevent"')
  const executable = compiled.code
    .replace(/import \{([^}]+)\} from "vue-lynx"/, (_match, helpers: string) =>
      `const {${helpers.replace(/\bas\b/g, ':')}} = VueLynx`)
    .replace('export function render', 'return function render')
  // 编译代码只存在于本测试；复用原 setup/props/emits，替换副本 render，
  // 不改模块级原组件，也不手工标记事件或补造 input handler。
  return { ...UploadEvokeButton, render: new Function('VueLynx', executable)(VueLynx) }
}

function declarations(element: Element): Record<string, string> {
  const values: Record<string, string> = {}
  stylesheet.walkRules((rule) => {
    if (rule.parent?.type !== 'root' || !rule.selectors.some((selector) => element.matches(selector))) return
    rule.walkDecls((decl) => { values[decl.prop] = decl.value })
  })
  return values
}

function fileEvent(input: Element, name: 'change' | 'input', detail: unknown) {
  const event = new input.ownerDocument.defaultView!.Event(`bindEvent:${name}`)
  Object.assign(event, { eventType: 'bindEvent', eventName: name, detail })
  fireEvent(input, event)
}

function mountUpload(initialCount = 0, initialLimit = 3, evoke: Component = UploadEvokeButton) {
  const files = ref(Array.from({ length: initialCount }, (_, uid) => ({ uid, url: `/tmp/${uid}.png`, name: `${uid}.png` })))
  const limit = ref(initialLimit)
  const picked = vi.fn()
  const chooseerror = vi.fn()
  const Host = defineComponent({
    // 模拟真实 Showcase 的 scoped 父级；本项的外部 CSS 不能再依赖单一 scoped id。
    __scopeId: 'data-v-12345678',
    setup: () => () => h('view', null, [h(Upload, {
      fileList: files.value,
      limit: limit.value,
      autoUpload: false,
      onChooseerror: chooseerror
    }, { default: () => h(evoke, { count: files.value.length, limit: limit.value, onPicked: picked }) })])
  })
  return { ...render(Host, {}, [icons]), files, limit, picked, chooseerror }
}

afterEach(() => {
  cleanup()
  configureUniAdapter({ chooseMedia: undefined })
  vi.restoreAllMocks()
})

describe('UploadEvokeButton 样式与文件选择契约', () => {
  it('按规范第一行显式引入独立 CSS，不生成 scoped 属性选择器', () => {
    expect(descriptor.styles, 'Vue Lynx 组件禁止 SFC style 块').toHaveLength(0)
    expect(descriptor.scriptSetup?.content.trimStart()).toMatch(/^import ['"]\.\/UploadEvokeButton\.css['"]/)
    expect(cssImport).toBe('./UploadEvokeButton.css')
    const selectors: string[] = []
    stylesheet.walkRules((rule) => { selectors.push(...rule.selectors) })
    expect(selectors).toHaveLength(6)
    for (const selector of selectors) {
      expect(selector).toMatch(/^\.demo-upload-evoke(?:\b|__)/)
      expect(selector).not.toMatch(/data-v-|:deep|\[|::/)
    }
  })

  it('生产 serializer 将样式放入全局 cssId=0，并在 Web 输出保留默认字号与主题回退', async () => {
    // 从 demo 的真实依赖链取生产 serializer，不安装新依赖、不触发整包构建。
    const demoRequire = createRequire(path.resolve(path.dirname(filename), '../../package.json'))
    const templatePackage = createRequire(demoRequire.resolve('vue-lynx/plugin')).resolve('@lynx-js/template-webpack-plugin/package.json')
    const serializerPath = createRequire(templatePackage).resolve('@lynx-js/css-serializer')
    const CSS = await import(pathToFileURL(serializerPath).href)
    const { genStyleInfo } = await import(pathToFileURL(path.resolve(path.dirname(templatePackage), 'lib/web/genStyleInfo.js')).href)
    expect(CSS.parse(stylesheet.toString()).errors).toEqual([])
    const { cssMap } = CSS.cssChunksToMap([stylesheet.toString()], [], true)
    expect(Object.keys(cssMap)).toEqual(['0'])
    const webInfo = genStyleInfo(cssMap)
    expect(webInfo['0'].rules).toHaveLength(6)
    const webDeclarations = (selector: string): Record<string, string> => {
      const rule = webInfo['0'].rules.find((item: { sel: string[][][] }) =>
        item.sel.some((parts) => parts.flat().join('') === selector))
      expect(rule, `生产 Web 输出缺少 ${selector}`).toBeTruthy()
      return Object.fromEntries(rule.decl)
    }
    expect(webDeclarations('.demo-upload-evoke')).toMatchObject({
      width: '88px', height: '88px', 'border-radius': 'var(--demo-upload-evoke-resolved-radius)',
      '--demo-upload-evoke-resolved-radius': 'var(--wot-upload-radius,8px)',
      background: 'var(--demo-upload-evoke-resolved-bg)',
      '--demo-upload-evoke-resolved-bg': 'var(--wot-upload-evoke-bg,var(--wot-filled-bottom,#f7f8fa))'
    })
    expect(webDeclarations('.demo-upload-evoke .demo-upload-evoke__icon')).toMatchObject({
      'font-size': 'var(--demo-upload-evoke-resolved-icon-size)',
      '--demo-upload-evoke-resolved-icon-size': 'var(--wot-upload-evoke-icon-size,32px)',
      color: 'var(--demo-upload-evoke-resolved-icon-color)',
      '--demo-upload-evoke-resolved-icon-color': 'var(--wot-upload-evoke-icon-color,var(--wot-icon-auxiliary,#6b7085))'
    })
    expect(webDeclarations('.demo-upload-evoke__num')).toMatchObject({
      'font-size': 'var(--demo-upload-evoke-resolved-num-font-size)',
      '--demo-upload-evoke-resolved-num-font-size': 'var(--wot-upload-evoke-font-size,14px)',
      'line-height': 'var(--demo-upload-evoke-resolved-num-line-height)',
      '--demo-upload-evoke-resolved-num-line-height': 'var(--wot-upload-evoke-line-height,20px)',
      color: 'var(--demo-upload-evoke-resolved-num-color)',
      '--demo-upload-evoke-resolved-num-color': 'var(--wot-upload-evoke-color,var(--wot-text-auxiliary,#868a9c))'
    })
    expect(webDeclarations('.demo-upload-evoke__input-wrap')).toMatchObject({
      display: 'flex', position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', opacity: '0'
    })
    expect(webDeclarations('.demo-upload-evoke__input')).toMatchObject({
      position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', opacity: '0'
    })
  })

  it('88px 卡片与视觉层显式纵排居中，相机/计数有直接匹配的排版', () => {
    const { container } = mountUpload(1)
    const card = container.querySelector('.demo-upload-evoke')!
    const body = card.querySelector('.demo-upload-evoke__body')!
    const icon = body.querySelector('.demo-upload-evoke__icon')!
    const number = body.querySelector('.demo-upload-evoke__num')!
    expect(card.tagName.toLowerCase()).toBe('view')
    expect(icon.classList.contains('wd-icon')).toBe(true)
    expect(icon.querySelector('.wd-icon__glyph')?.textContent).toBeTruthy()
    expect(container.querySelector('wd-icon')).toBeNull()
    expect(number.tagName.toLowerCase()).toBe('text')
    expect(number.textContent).toBe('（1/3）')
    expect(declarations(card)).toMatchObject({
      position: 'relative', width: '88px', height: '88px', 'box-sizing': 'border-box', 'flex-shrink': '0',
      display: 'flex', 'flex-direction': 'column', 'justify-content': 'center', 'align-items': 'center',
      'border-width': '1px', 'border-style': 'dashed',
      'border-radius': 'var(--demo-upload-evoke-resolved-radius)',
      '--demo-upload-evoke-resolved-radius': 'var(--wot-upload-radius, 8px)',
      background: 'var(--demo-upload-evoke-resolved-bg)',
      '--demo-upload-evoke-resolved-bg': 'var(--wot-upload-evoke-bg, var(--wot-filled-bottom, #f7f8fa))'
    })
    expect(declarations(body)).toMatchObject({
      display: 'flex', 'flex-direction': 'column', 'justify-content': 'center', 'align-items': 'center', 'pointer-events': 'none'
    })
    expect(declarations(icon)).toMatchObject({
      'font-size': 'var(--demo-upload-evoke-resolved-icon-size)',
      '--demo-upload-evoke-resolved-icon-size': 'var(--wot-upload-evoke-icon-size, 32px)',
      color: 'var(--demo-upload-evoke-resolved-icon-color)',
      '--demo-upload-evoke-resolved-icon-color': 'var(--wot-upload-evoke-icon-color, var(--wot-icon-auxiliary, #6b7085))'
    })
    // 比 .wd-icon 的基础字号选择器更具体，不依赖样式表加载顺序。
    expect(stylesheet.nodes.some((node) => node.type === 'rule' && node.selector === '.demo-upload-evoke .demo-upload-evoke__icon')).toBe(true)
    expect(declarations(number)).toMatchObject({
      'font-size': 'var(--demo-upload-evoke-resolved-num-font-size)',
      '--demo-upload-evoke-resolved-num-font-size': 'var(--wot-upload-evoke-font-size, 14px)',
      'line-height': 'var(--demo-upload-evoke-resolved-num-line-height)',
      '--demo-upload-evoke-resolved-num-line-height': 'var(--wot-upload-evoke-line-height, 20px)',
      color: 'var(--demo-upload-evoke-resolved-num-color)',
      '--demo-upload-evoke-resolved-num-color': 'var(--wot-upload-evoke-color, var(--wot-text-auxiliary, #868a9c))',
      'text-align': 'center'
    })
  })

  it('原生 file input 全透明但保留覆盖卡片的命中区域，不用 display:none 隐掉功能', () => {
    const { container } = mountUpload()
    const card = container.querySelector('.demo-upload-evoke')!
    const input = card.querySelector('input.demo-upload-evoke__input') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.type).toBe('file')
    expect(input.accept).toBe('image/*')
    expect(input.disabled).toBe(false)
    expect(input.hidden).toBe(false)
    const layer = card.querySelector('.demo-upload-evoke__input-wrap')!
    expect(card.lastElementChild).toBe(layer)
    expect(layer.firstElementChild).toBe(input)
    const layerStyle = declarations(layer)
    expect(layerStyle).toMatchObject({ display: 'flex', position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', opacity: '0' })
    expect(layerStyle['pointer-events']).not.toBe('none')
    const style = declarations(input)
    expect(style).toMatchObject({ display: 'flex', position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', opacity: '0' })
    expect(style.display).not.toBe('none')
    expect(style.visibility).not.toBe('hidden')
    expect(style['pointer-events']).not.toBe('none')
    expect(input.style.display).not.toBe('none')
  })

  it('生产模板的 tap 注册为原生 catch，保留默认选图行为且不漏进 wd-upload 的 chooseMedia 链路', async () => {
    const chooseMedia = vi.fn((options: any) => options.fail({ errMsg: 'test: fallback chooser' }))
    configureUniAdapter({ chooseMedia })
    const { container, chooseerror } = mountUpload(0, 3, productionEvoke())
    const input = container.querySelector('.demo-upload-evoke__input')! as Element & { eventMap: Record<string, unknown> }
    const slot = container.querySelector('.wd-upload__evoke-slot')!
    const bubbled = vi.fn()
    container.addEventListener('catchEvent:tap', bubbled)
    expect(input.eventMap['catchEvent:tap']).toBeTypeOf('function')
    expect(input.eventMap['bindEvent:tap']).toBeUndefined()
    expect(fireEvent.tap(input, { eventType: 'catchEvent', bubbles: true, cancelable: true })).toBe(true)
    await nextTick()
    expect(bubbled).not.toHaveBeenCalled()
    expect(chooseMedia).not.toHaveBeenCalled()
    expect(chooseerror).not.toHaveBeenCalled()
    // 同类型冒泡事件的正对照，避免 catchEvent/bindEvent 的名称差异导致假绿。
    fireEvent.tap(slot, { eventType: 'catchEvent', bubbles: true })
    expect(bubbled).toHaveBeenCalledOnce()
    // 唤起槽本身仍有有效的降级监听，input 只是阻止误冒泡而非禁用外层功能。
    fireEvent.tap(slot, { bubbles: true })
    await nextTick()
    await Promise.resolve() // chooseFile.then(...).catch(...) 的拒绝回调再经过一轮 microtask
    expect(chooseMedia).toHaveBeenCalledOnce()
    expect(chooseerror).toHaveBeenCalledOnce()
  })

  it('change/input 仍回传选中文件，同批文件只 emit 一次', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const { container, picked } = mountUpload()
    const input = container.querySelector('.demo-upload-evoke__input')!
    const detail = { files: [{ tempFilePath: '/tmp/photo.png', size: 12, fileName: 'photo.png' }] }
    fileEvent(input, 'change', detail)
    fileEvent(input, 'input', detail)
    expect(picked).toHaveBeenCalledExactlyOnceWith([{ path: '/tmp/photo.png', size: 12, name: 'photo.png' }])
    fileEvent(input, 'input', { tempFiles: [{ path: '/tmp/next.png', size: 24 }] })
    expect(picked).toHaveBeenLastCalledWith([{ path: '/tmp/next.png', size: 24, name: 'next.png' }])
    expect(picked).toHaveBeenCalledTimes(2)
  })

  it('到 limit 时由真实 wd-upload 移除整个唤起槽/原生 input，移除文件后恢复并更新计数', async () => {
    const { container, files, limit } = mountUpload()
    expect(container.querySelector('.demo-upload-evoke__num')?.textContent).toBe('（0/3）')
    files.value = Array.from({ length: 3 }, (_, uid) => ({ uid, url: `/tmp/${uid}.png`, name: `${uid}.png` }))
    await nextTick()
    expect(container.querySelectorAll('.wd-upload__preview')).toHaveLength(3)
    expect(container.querySelector('.wd-upload__evoke-slot')).toBeNull()
    expect(container.querySelector('.demo-upload-evoke')).toBeNull()
    expect(container.querySelector('input[type="file"]')).toBeNull()
    files.value.pop()
    await nextTick()
    expect(container.querySelector('.demo-upload-evoke__num')?.textContent).toBe('（2/3）')
    expect(container.querySelector('input[type="file"]')).toBeTruthy()
    limit.value = 2
    await nextTick()
    expect(container.querySelector('input[type="file"]')).toBeNull()
    limit.value = 0
    await nextTick()
    expect(container.querySelector('input[type="file"]')).toBeTruthy()
  })
})
