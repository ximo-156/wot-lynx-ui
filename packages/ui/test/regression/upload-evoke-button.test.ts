/** Upload evoke is a native view, not a disguised text input or a fake file picker. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import postcss from 'postcss'
import { parse } from 'vue/compiler-sfc'
import { h, nextTick, ref } from 'vue-lynx'
import UploadEvokeButton from '../../../demo/src/showcase/UploadEvokeButton.vue'
import Upload from '@wot-lynx/ui-form/wd-upload'
import { configureHost } from '@wot-lynx/core/common/host'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'

const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../demo/src/showcase/UploadEvokeButton.vue')
const source = readFileSync(filename, 'utf8')
const { descriptor } = parse(source, { filename })
const cssImport = descriptor.scriptSetup?.content.match(/^import\s+['"](.+\.css)['"]/m)?.[1]
const stylesheet = cssImport ? postcss.parse(readFileSync(path.resolve(path.dirname(filename), cssImport), 'utf8')) : postcss.root()
function declarations(element: Element): Record<string, string> {
  const values: Record<string, string> = {}
  stylesheet.walkRules(rule => {
    if (rule.parent?.type !== 'root' || !rule.selectors.some(selector => element.matches(selector))) return
    rule.walkDecls(declaration => { values[declaration.prop] = declaration.value })
  })
  return values
}
function mountUpload(initialCount = 0, initialLimit = 3, props: Record<string, any> = {}) {
  const files = ref(Array.from({ length: initialCount }, (_, uid) => ({ uid, url: `/tmp/${uid}.png`, name: `${uid}.png` })))
  const limit = ref(initialLimit)
  const errors: any[] = []
  const oversize = vi.fn()
  const mounted = render({ setup: () => () => h(Upload, {
    fileList: files.value, limit: limit.value, multiple: true, autoUpload: false,
    ...props,
    'onUpdate:fileList': (value: any) => { files.value = value },
    onChooseerror: (error: any) => errors.push(error), onOversize: oversize
  }, { default: () => h(UploadEvokeButton, { count: files.value.length, limit: limit.value }) }) } as any)
  return { ...mounted, files, limit, errors, oversize }
}
async function flush() { await nextTick(); await Promise.resolve(); await nextTick() }
function tapCard(container: Element) {
  // One physical event bubbles through the card to Upload's native tap handler.
  fireEvent.tap(container.querySelector('.demo-upload-evoke')!, { bubbles: true })
}
const photo = (path = '/tmp/photo.png', size = 12) => ({ fileType: 'image', tempFilePath: path, name: 'photo.png', size })
afterEach(() => { cleanup(); configureHost(null); vi.restoreAllMocks() })

describe('UploadEvokeButton native picker routing', () => {
  it('imports global CSS and renders no input or tap interception on any platform', () => {
    expect(descriptor.styles).toHaveLength(0)
    expect(cssImport).toBe('./UploadEvokeButton.css')
    expect(descriptor.template?.content).not.toMatch(/<input\b|@tap\.stop|@input|@change/)
    const { container } = mountUpload()
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector('.demo-upload-evoke__input-wrap')).toBeNull()
    expect(container.querySelector('.demo-upload-evoke__body')?.getAttribute('user-interaction-enabled')).toBe('false')
    expect(container.querySelector('.demo-upload-evoke__icon .wd-icon__glyph')?.textContent).toBeTruthy()
    const selectors: string[] = []
    stylesheet.walkRules(rule => { selectors.push(...rule.selectors) })
    expect(selectors).toHaveLength(4)
    expect(selectors.every(selector => selector.startsWith('.demo-upload-evoke'))).toBe(true)
    expect(selectors.join(' ')).not.toMatch(/__input|data-v-|:deep|::/)
  })

  it('retains the 88px camera card and directly styled native text', () => {
    const { container } = mountUpload(1)
    const card = container.querySelector('.demo-upload-evoke')!
    const body = card.querySelector('.demo-upload-evoke__body')!
    const number = body.querySelector('.demo-upload-evoke__num')!
    expect(number.tagName.toLowerCase()).toBe('text')
    expect(number.textContent).toBe('（1/3）')
    expect(declarations(card)).toMatchObject({ width: '88px', height: '88px', display: 'flex', 'flex-direction': 'column', 'justify-content': 'center', 'align-items': 'center', 'border-style': 'dashed' })
    expect(declarations(body)).toMatchObject({ display: 'flex', 'flex-direction': 'column', 'pointer-events': 'none' })
    expect(declarations(number)).toMatchObject({ 'font-size': 'var(--demo-upload-evoke-resolved-num-font-size)', 'line-height': 'var(--demo-upload-evoke-resolved-num-line-height)', 'text-align': 'center' })
  })

  it('production CSS stays in cssId=0 and preserves default dimensions and theme fallbacks', async () => {
    const demoRequire = createRequire(path.resolve(path.dirname(filename), '../../package.json'))
    const templatePackage = createRequire(demoRequire.resolve('vue-lynx/plugin')).resolve('@lynx-js/template-webpack-plugin/package.json')
    const serializerPath = createRequire(templatePackage).resolve('@lynx-js/css-serializer')
    const CSS = await import(pathToFileURL(serializerPath).href)
    const { genStyleInfo } = await import(pathToFileURL(path.resolve(path.dirname(templatePackage), 'lib/web/genStyleInfo.js')).href)
    expect(CSS.parse(stylesheet.toString()).errors).toEqual([])
    const { cssMap } = CSS.cssChunksToMap([stylesheet.toString()], [], true)
    expect(Object.keys(cssMap)).toEqual(['0'])
    const info = genStyleInfo(cssMap)
    expect(info['0'].rules).toHaveLength(4)
    const card = info['0'].rules.find((rule: any) => rule.sel.some((parts: any) => parts.flat().join('') === '.demo-upload-evoke'))
    expect(Object.fromEntries(card.decl)).toMatchObject({ width: '88px', height: '88px', '--demo-upload-evoke-resolved-bg': 'var(--wot-upload-evoke-bg,var(--wot-filled-bottom,#f7f8fa))' })
  })

  it('one card tap invokes chooseMedia once with the remaining count and actually adds the chosen image', async () => {
    const chooseMedia = vi.fn((options: any) => options.success({ tempFiles: [photo()] }))
    configureHost({ chooseMedia })
    const mounted = mountUpload(1)
    tapCard(mounted.container); await flush()
    expect(chooseMedia).toHaveBeenCalledOnce()
    expect(chooseMedia.mock.calls[0][0]).toMatchObject({ count: 2, mediaType: ['image'] })
    expect(mounted.errors).toEqual([])
    expect(mounted.files.value).toHaveLength(2)
    expect(mounted.files.value[1]).toMatchObject({ url: '/tmp/photo.png', thumb: '/tmp/photo.png', name: 'photo.png', size: 12, status: 'pending' })
    expect(mounted.container.querySelectorAll('.wd-upload__preview')).toHaveLength(2)
    expect(mounted.container.querySelector('input')).toBeNull()
  })

  it('preserves the host method receiver and accepts files/path receipts', async () => {
    const host = { marker: 'native module', chooseMedia: vi.fn(function (this: any, options: any) {
      expect(this).toBe(host)
      options.success({ files: [{ path: '/tmp/native.jpg', fileName: 'native.jpg', size: 42 }] })
    }) }
    configureHost(host)
    const mounted = mountUpload()
    tapCard(mounted.container); await flush()
    expect(mounted.files.value[0]).toMatchObject({ url: '/tmp/native.jpg', name: 'native.jpg', size: 42 })
  })

  it('honors beforeChoose and disabled instead of bypassing them with a native input', async () => {
    const chooseMedia = vi.fn()
    configureHost({ chooseMedia })
    let mounted = mountUpload(0, 3, { beforeChoose: () => false })
    tapCard(mounted.container); await flush()
    expect(chooseMedia).not.toHaveBeenCalled()
    mounted.unmount()
    mounted = mountUpload(0, 3, { disabled: true })
    tapCard(mounted.container); await flush()
    expect(chooseMedia).not.toHaveBeenCalled()
    expect(mounted.container.querySelector('input')).toBeNull()
  })

  it('honors beforeUpload and maxSize in the real Upload pipeline', async () => {
    configureHost({ chooseMedia: (options: any) => options.success({ tempFiles: [photo()] }) })
    const beforeUpload = vi.fn(() => false)
    let mounted = mountUpload(0, 3, { beforeUpload })
    tapCard(mounted.container); await flush()
    expect(beforeUpload).toHaveBeenCalledOnce()
    expect(mounted.files.value).toHaveLength(0)
    mounted.unmount()
    mounted = mountUpload(0, 3, { maxSize: 5 })
    tapCard(mounted.container); await flush()
    expect(mounted.oversize).toHaveBeenCalledOnce()
    expect(mounted.files.value).toHaveLength(0)
  })

  it('reports missing native capability and cancellation without creating any input or file', async () => {
    configureHost({ chooseMedia: undefined })
    let mounted = mountUpload()
    tapCard(mounted.container); await flush()
    expect(mounted.errors).toHaveLength(1)
    expect(mounted.errors[0].error.message).toContain('宿主未注册 chooseMedia')
    expect(mounted.files.value).toHaveLength(0)
    expect(mounted.container.querySelector('input')).toBeNull()
    mounted.unmount()
    configureHost({ chooseMedia: (options: any) => options.fail({ errMsg: 'chooseMedia:fail cancel' }) })
    mounted = mountUpload()
    tapCard(mounted.container); await flush()
    expect(mounted.errors[0].error.errMsg).toBe('chooseMedia:fail cancel')
    expect(mounted.files.value).toHaveLength(0)
  })

  it('limits excess returned images and restores the evoke card after removal', async () => {
    configureHost({ chooseMedia: (options: any) => options.success({ tempFiles: [photo('/a.png'), photo('/b.png'), photo('/c.png')] }) })
    const mounted = mountUpload(1)
    tapCard(mounted.container); await flush()
    expect(mounted.files.value).toHaveLength(3)
    expect(mounted.container.querySelector('.demo-upload-evoke')).toBeNull()
    mounted.files.value = mounted.files.value.slice(0, 2); await flush()
    expect(mounted.container.querySelector('.demo-upload-evoke__num')?.textContent).toBe('（2/3）')
    expect(mounted.container.querySelector('input')).toBeNull()
  })

  it('ignores an album result arriving after the component unmounts', async () => {
    let request: any
    configureHost({ chooseMedia: (options: any) => { request = options } })
    const mounted = mountUpload()
    tapCard(mounted.container)
    mounted.unmount()
    request.success({ tempFiles: [photo()] }); await flush()
    expect(mounted.files.value).toHaveLength(0)
    expect(mounted.errors).toEqual([])
  })
})
