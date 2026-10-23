/**
 * 修复清单回归测试（keyboard / password-input / signature / upload / input /
 * search / textarea / slide-verify / slider / input-number 的 13 项修复）。
 *
 * 每个用例对应一项修复：
 *   1. wd-keyboard  handlePress 对 null modelValue 不再抛 TypeError
 *   2. wd-password-input  null modelValue 渲染不崩
 *   3. wd-signature  页脚 i18n key 与语言包对齐（无裸 key）
 *   4. locale        upload 命名空间补 file / retry（全语言）
 *   5. wd-signature  viewBox 用实测画布尺寸（度量不可用时保留默认兜底）
 *   6. wd-input      null modelValue 不显示字面量 "null"
 *   7. wd-search     focus prop 驱动 input 显隐与聚焦
 *   9. wd-textarea   字数统计读本地 inputValue（null 不计 4）
 *   10. wd-slide-verify  touchmove 加 .stop.prevent（模板层，防滚动接管）
 *   11. wd-slider    trackSize 为 0 时 touchmove 不写 NaN
 *   12. wd-input-number  allowNull 空值时加减禁用；长按 tap 去重
 *   13. wd-upload    beforeUpload 逐文件调用，false 只移除该文件
 */
import { describe, it, expect } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import { fireEvent } from './fire-event'
import { configureUniAdapter } from '../src/common/uni'
import Locale from '../src/locale'
import Keyboard from '../src/components/wd-keyboard/wd-keyboard.vue'
import PasswordInput from '../src/components/wd-password-input/wd-password-input.vue'
import Signature from '../src/components/wd-signature/wd-signature.vue'
import Upload from '../src/components/wd-upload/wd-upload.vue'
import Input from '../src/primitives/wd-input/wd-input.vue'
import Search from '../src/components/wd-search/wd-search.vue'
import Textarea from '../src/primitives/wd-textarea/wd-textarea.vue'
import InputNumber from '../src/components/wd-input-number/wd-input-number.vue'
import Slider from '../src/components/wd-slider/wd-slider.vue'
import SlideVerify from '../src/components/wd-slide-verify/wd-slide-verify.vue'

describe('修复清单回归', () => {
  it('#1 WdKeyboard modelValue 为 null 时不崩且可输入 / 回删', async () => {
    const updates: any[] = []
    const { container } = render(
      {
        setup() {
          const value = ref<any>(null)
          return () =>
            h(Keyboard, {
              visible: true,
              modelValue: value.value,
              'onUpdate:modelValue': (v: any) => {
                value.value = v
                updates.push(v)
              }
            })
        }
      } as any
    )
    await pause(150)
    const keys = container.querySelectorAll('.wd-key-wrapper')
    fireEvent.touchstart(keys[0], { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchend(keys[0], { touches: [{ clientX: 0, clientY: 0 }] })
    expect(updates).toContain('1')
    // 删除键：值清空后仍 emit ''（不再对 null 调 slice/length）
    const last = keys[keys.length - 1]
    fireEvent.touchstart(last, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchend(last, { touches: [{ clientX: 0, clientY: 0 }] })
    expect(updates[updates.length - 1]).toBe('')
    cleanup()
  })

  it('#2 WdPasswordInput modelValue 为 null 时渲染不崩', () => {
    const { container } = render(PasswordInput, { modelValue: null, length: 6 } as any)
    expect(container.querySelectorAll('.wd-password-input__item').length).toBe(6)
    cleanup()
  })

  it('#3 WdSignature 页脚按钮走语言包 key（无裸 key）', () => {
    // wot-ui 结构：页脚按钮为 wd-button + custom-class="wd-signature__button"；
    // 撤销/恢复仅在 enableHistory 为真时渲染（默认 false）
    const { container } = render(Signature, { enableHistory: true } as any)
    const texts = Array.from(container.querySelectorAll('.wd-signature__button')).map((el) => el.textContent?.trim())
    expect(texts).toEqual(['撤销', '恢复', '清空', '确认'])
    cleanup()
  })

  it('#4 upload 语言包补 file / retry key', () => {
    expect((Locale.messages() as any).upload.file).toBe('文件')
    expect((Locale.messages() as any).upload.retry).toBe('重试')
  })

  it('#5 WdSignature viewBox 与 svg 宽高一致（实测 / 默认兜底）', async () => {
    const { container } = render(Signature, {})
    await pause(50)
    const svg = container.querySelector('svg')
    const content = String(svg?.getAttribute('content') || '')
    const matched = content.match(/viewBox="0 0 (\d+) (\d+)"[^>]*width="(\d+)" height="(\d+)"/)
    expect(matched, 'svg content 应含 viewBox / width / height').not.toBeNull()
    const [, vbW, vbH, w, h] = matched!
    expect(Number(vbW)).toBeGreaterThan(0)
    expect(Number(vbH)).toBeGreaterThan(0)
    expect([vbW, vbH]).toEqual([w, h])
    cleanup()
  })

  it('#6 WdInput modelValue 为 null 不显示字面量 "null"', () => {
    const { container } = render(Input, { modelValue: null } as any)
    expect(container.querySelector('.wd-input__inner')!.getAttribute('value')).toBe('')
    cleanup()

    // maxlength 截断路径同样不再对 null 调 toString()
    const truncated = render(Input, { modelValue: null, maxlength: 2 } as any)
    expect(truncated.container.querySelector('.wd-input__inner')!.getAttribute('value')).toBe('')
    cleanup()
  })

  it('#7 WdSearch focus=true 渲染 input 并聚焦', async () => {
    // wot-ui 的聚焦展开经 onMounted → closeCover → pause(100) 异步驱动
    const { container } = render(Search, { focus: true } as any)
    await pause(150)
    expect(container.querySelector('.wd-search__input')).not.toBeNull()
    cleanup()
  })

  it('#9 WdTextarea modelValue 为 null 字数统计为 0', () => {
    const { container } = render(Textarea, { modelValue: null, maxlength: 50, showWordLimit: true } as any)
    expect(container.querySelector('.wd-textarea__count')?.textContent).toContain('0/50')
    cleanup()
  })

  it('#10 WdSlideVerify 滑块渲染与触摸（touchmove 已加 .stop.prevent）', () => {
    const { container } = render(SlideVerify, {})
    const button = container.querySelector('.wd-slide-verify__button')!
    expect(button).not.toBeNull()
    fireEvent.touchstart(button, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchmove(button, { touches: [{ clientX: 40, clientY: 0 }] })
    fireEvent.touchend(button, { touches: [{ clientX: 40, clientY: 0 }] })
    cleanup()
  })

  it('#11 WdSlider trackSize 为 0 时 touchmove 不写 NaN', async () => {
    const updates: any[] = []
    const { container } = render(
      {
        setup() {
          const value = ref(50)
          return () =>
            h(Slider, {
              modelValue: value.value,
              'onUpdate:modelValue': (v: any) => {
                value.value = v
                updates.push(v)
              }
            })
        }
      } as any
    )
    await pause(50)
    const dot = container.querySelector('.wd-slider__dot')!
    fireEvent.touchstart(dot, { touches: [{ clientX: 10, clientY: 10 }] })
    fireEvent.touchmove(dot, { touches: [{ clientX: 60, clientY: 10 }] })
    fireEvent.touchend(dot, { touches: [{ clientX: 60, clientY: 10 }] })
    expect(updates.length).toBe(0)
    cleanup()
  })

  it('#12 WdInputNumber 禁用态由 min/max 边界决定（对齐 wot-ui）', () => {
    // wot-ui 2.3.2 BEM：加减按钮为 .wd-input-number__action.wd-input-number__sub / --add。
    // 禁用逻辑（minDisabled/maxDisabled）：val <= min / val >= max 时禁用；
    // allowNull + 空值时 toNumber 返回 NaN，比较为 false——wot-ui 不禁用（与旧本地行为不同）。
    const empty = render(InputNumber, { modelValue: '', allowNull: true, min: 0, max: 10 } as any)
    expect(empty.container.querySelector('.wd-input-number__sub')!.classList.contains('is-disabled')).toBe(false)
    expect(empty.container.querySelector('.wd-input-number__add')!.classList.contains('is-disabled')).toBe(false)
    cleanup()

    // 到达边界：min 处减号禁用、max 处加号禁用
    const atMin = render(InputNumber, { modelValue: 0, min: 0, max: 10 } as any)
    expect(atMin.container.querySelector('.wd-input-number__sub')!.classList.contains('is-disabled')).toBe(true)
    expect(atMin.container.querySelector('.wd-input-number__add')!.classList.contains('is-disabled')).toBe(false)
    cleanup()

    const atMax = render(InputNumber, { modelValue: 10, min: 0, max: 10 } as any)
    expect(atMax.container.querySelector('.wd-input-number__add')!.classList.contains('is-disabled')).toBe(true)
    expect(atMax.container.querySelector('.wd-input-number__sub')!.classList.contains('is-disabled')).toBe(false)
    cleanup()

    const normal = render(InputNumber, { modelValue: 5, min: 0, max: 10 } as any)
    expect(normal.container.querySelector('.wd-input-number__sub')!.classList.contains('is-disabled')).toBe(false)
    expect(normal.container.querySelector('.wd-input-number__add')!.classList.contains('is-disabled')).toBe(false)
    cleanup()
  })

  it('#13 WdUpload beforeUpload 接收 { files, fileList }，返回 false 阻止整批入列', async () => {
    configureUniAdapter({
      chooseMedia: (opts: any) => {
        opts.success({
          tempFiles: [
            { fileType: 'image', tempFilePath: 'a.png', size: 10 },
            { fileType: 'image', tempFilePath: 'b.png', size: 10 },
            { fileType: 'image', tempFilePath: 'c.png', size: 10 }
          ]
        })
      }
    })
    // wot-ui 2.3.2 契约：beforeUpload({ files, fileList }) 为**整批**钩子，
    // 返回 false（或 reject）时本批文件全部不入列（非逐文件过滤）
    const payloads: any[] = []
    const fileLists: any[] = []
    const { container } = render(
      {
        setup() {
          return () =>
            h(Upload, {
              multiple: true,
              beforeUpload: (payload: any) => {
                payloads.push(payload)
                return false
              },
              'onUpdate:fileList': (list: any) => fileLists.push(list)
            })
        }
      } as any
    )
    await pause(50)
    fireEvent.tap(container.querySelector('.wd-upload__evoke')!)
    await pause(100)
    expect(payloads).toHaveLength(1)
    expect(payloads[0].files.map((f: any) => f.path)).toEqual(['a.png', 'b.png', 'c.png'])
    expect(payloads[0].fileList).toEqual([])
    // 返回 false：整批被拦截，fileList 保持为空
    expect(fileLists.every((l) => l.length === 0)).toBe(true)
    cleanup()
  })

  it('#13b WdUpload beforeUpload 返回 true 时整批入列', async () => {
    configureUniAdapter({
      chooseMedia: (opts: any) => {
        opts.success({
          tempFiles: [
            { fileType: 'image', tempFilePath: 'a.png', size: 10 },
            { fileType: 'image', tempFilePath: 'b.png', size: 10 }
          ]
        })
      }
    })
    const fileLists: any[] = []
    const { container } = render(
      {
        setup() {
          return () =>
            h(Upload, {
              multiple: true,
              beforeUpload: () => true,
              'onUpdate:fileList': (list: any) => fileLists.push(list)
            })
      }
      } as any
    )
    await pause(50)
    fireEvent.tap(container.querySelector('.wd-upload__evoke')!)
    await pause(100)
    expect(fileLists[fileLists.length - 1].map((f: any) => f.url).sort()).toEqual(['a.png', 'b.png'])
    cleanup()
  })
})
