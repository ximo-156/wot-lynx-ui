/**
 * 表单体系「原生优先重写」回归（NATIVE-REWRITE 批次：wd-form / wd-form-item /
 * wd-input / wd-textarea / wd-search / wd-input-number）。
 *
 * 本批 6 个组件无拖动 / 滑动 / 缩放手势（input-number 的长按连续步进是
 * 「定时器 + 提交类逻辑」，change / update:modelValue 必须回后台 emit，
 * 不适用 MTS 跟手，CONVENTIONS §10 / NATIVE-REWRITE §2），故守护重点是：
 *
 * 1. **布局铁律**（NATIVE-REWRITE §3.1 / §3.2）：对编译产物 index.css 断言
 *    根节点与横向容器显式 display:flex + flex-direction，并扫描 Lynx 不
 *    识别的 inline-flex / inline-block / float / vertical-align 写法；
 *    left:50% 仅允许 wd-input-number 加减字形这一登记例外（横竖条必须在
 *    按钮中心重叠成十字，且 translate 同时承担 scale 发丝线压缩）；
 * 2. **Style Funnel**（CONVENTIONS §20）：input-number 的 inputWidth 由
 *    有值转无值时回落令牌宽度，不残留旧 inline 宽度；
 * 3. **交互链路**：input-number 长按连续步进 + 抬起后 tap 去重；
 *    form + form-item 的 schema 校验 → 错误提示渲染 → reset 清除。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { h, nextTick, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'
import { pause } from '../src/common/util'
import Form from '../src/components/wd-form/wd-form.vue'
import FormItem from '../src/components/wd-form-item/wd-form-item.vue'
import Input from '../src/components/wd-input/wd-input.vue'
import InputNumber from '../src/components/wd-input-number/wd-input-number.vue'

/** 从 cwd 向上找 monorepo 根（vitest 的 cwd 为 packages/ui） */
function findRepoRoot(start: string): string {
  let dir = start
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`找不到 monorepo 根（从 ${start} 向上未发现 pnpm-workspace.yaml）`)
}

const REPO_ROOT = findRepoRoot(process.cwd())
const COMPONENTS_DIR = join(REPO_ROOT, 'packages/ui/src/components')

/** 读取组件编译产物 index.css */
function readCss(dir: string): string {
  return readFileSync(join(COMPONENTS_DIR, dir, 'index.css'), 'utf8')
}

/** 取某个选择器的声明块文本（编译产物为压缩 CSS，按选择器前缀切片） */
function declBlock(css: string, selector: string): string {
  const idx = css.indexOf(selector + '{')
  if (idx === -1) return ''
  const start = idx + selector.length + 1
  const end = css.indexOf('}', start)
  return css.slice(start, end === -1 ? undefined : end)
}

/** 本批组件目录 */
const BATCH = ['wd-form', 'wd-form-item', 'wd-input', 'wd-textarea', 'wd-search', 'wd-input-number'] as const

describe('表单体系原生优先重写', () => {
  afterEach(() => cleanup())

  describe('布局铁律：根节点三件套与显式方向', () => {
    it('6 个组件根节点均显式 display:flex + flex-direction', () => {
      // 根视图内容方向：form / form-item / textarea 纵向堆叠，其余横向排列
      const expected: Record<string, 'row' | 'column'> = {
        'wd-form': 'column',
        'wd-form-item': 'column',
        'wd-input': 'row',
        'wd-textarea': 'column',
        'wd-search': 'row',
        'wd-input-number': 'row'
      }
      for (const dir of BATCH) {
        const css = readCss(dir)
        const block = declBlock(css, `.${dir.replace('wd-', 'wd-')}`)
        expect(block, `${dir} 根节点规则缺失`).not.toBe('')
        expect(block, `${dir} 根节点应显式 display:flex`).toMatch(/display:flex/)
        expect(block, `${dir} 根节点应显式 flex-direction:${expected[dir]}`).toContain(`flex-direction:${expected[dir]}`)
      }
    })

    it('横向容器（图标+文字行 / 按钮内容 / 单元格区）显式 flex + row', () => {
      const cases: Array<[string, string]> = [
        ['wd-input', '.wd-input__prefix'],
        ['wd-input', '.wd-input__suffix'],
        ['wd-search', '.wd-search__block'],
        ['wd-search', '.wd-search__field'],
        ['wd-search', '.wd-search__cover'],
        ['wd-input-number', '.wd-input-number__action']
      ]
      for (const [dir, selector] of cases) {
        const block = declBlock(readCss(dir), selector)
        expect(block, `${dir} ${selector} 规则缺失`).not.toBe('')
        expect(block, `${selector} 应显式 display:flex`).toMatch(/display:flex/)
        expect(block, `${selector} 应显式 flex-direction:row`).toContain('flex-direction:row')
      }
      // 需要居中的容器：justify-content 与 align-items 成对写全
      const cover = declBlock(readCss('wd-search'), '.wd-search__cover')
      expect(cover).toContain('justify-content:center')
      expect(cover).toContain('align-items:center')
      const action = declBlock(readCss('wd-input-number'), '.wd-input-number__action')
      expect(action).toContain('justify-content:center')
      expect(action).toContain('align-items:center')
      // 根级交叉轴居中
      for (const dir of ['wd-input', 'wd-search', 'wd-input-number'] as const) {
        expect(declBlock(readCss(dir), `.${dir}`)).toContain('align-items:center')
      }
    })

    it('编译产物不含 Lynx 不识别写法（inline-flex / inline-block / float / vertical-align）', () => {
      for (const dir of BATCH) {
        const css = readCss(dir)
        expect(css, `${dir} 不应出现 inline-flex`).not.toMatch(/display:inline-flex/)
        expect(css, `${dir} 不应出现 inline-block`).not.toMatch(/display:inline-block/)
        expect(css, `${dir} 不应出现 float`).not.toMatch(/float:/)
        expect(css, `${dir} 不应出现 vertical-align`).not.toMatch(/vertical-align:/)
      }
    })

    it('left:50% + translate 仅存在于登记的 input-number 加减字形例外', () => {
      for (const dir of BATCH) {
        const css = readCss(dir)
        if (dir === 'wd-input-number') {
          // 例外：加号横竖条必须在按钮中心重叠成十字，且 translate 同时承担
          // scaleY/scaleX 发丝线压缩（NATIVE-REWRITE §3.2「确有必要」）
          expect(css.match(/left:50%/g)?.length ?? 0).toBe(1)
        } else {
          expect(css, `${dir} 不应使用 left:50% 定位`).not.toMatch(/left:50%/)
        }
      }
    })
  })

  describe('Style Funnel：input-number 输入框宽度', () => {
    it('inputWidth 由有值转无值时回落令牌宽度，不残留旧值', async () => {
      const inputWidth = ref<number | string | undefined>(80)
      const { container } = render(
        {
          setup() {
            const value = ref(5)
            return () =>
              h(InputNumber as any, {
                modelValue: value.value,
                min: 0,
                max: 10,
                inputWidth: inputWidth.value,
                'onUpdate:modelValue': (v: any) => {
                  value.value = v
                }
              })
          }
        } as any
      )
      const input = container.querySelector('.wd-input-number__input')!
      expect(input.getAttribute('style')).toMatch(/width:\s*80px/)

      // 同一实例上把 inputWidth 置空：内联 width 必须回落到令牌值
      // （Lynx 的 SET_STYLE 是逐属性合并语义，省略键 = 残留旧值，§20）
      inputWidth.value = undefined
      await nextTick()
      await nextTick()
      const styleAfter = input.getAttribute('style') || ''
      expect(styleAfter).not.toMatch(/width:\s*80px/)
      expect(styleAfter).toMatch(/width:\s*var\(--wot-input-number-input-width/)
    })
  })

  describe('交互链路：input-number 长按连续步进', () => {
    it('长按 600ms 起连续步进，touchend 停止，抬起后补发的 tap 去重', async () => {
      const updates: any[] = []
      const { container } = render(
        {
          setup() {
            const value = ref(5)
            return () =>
              h(InputNumber as any, {
                modelValue: value.value,
                min: 0,
                max: 100,
                step: 1,
                longPress: true,
                'onUpdate:modelValue': (v: any) => {
                  value.value = v
                  updates.push(v)
                }
              })
          }
        } as any
      )
      const add = container.querySelector('.wd-input-number__add')!

      // 未达长按阈值前不步进
      fireEvent.touchstart(add, { touches: [{ clientX: 0, clientY: 0 }] })
      await pause(300)
      expect(updates.length).toBe(0)

      // 超过 600ms 阈值：首个步进 + 250ms 间隔连续步进
      await pause(400)
      expect(updates.length).toBeGreaterThanOrEqual(1)
      const stepped = updates.length
      await pause(300)
      expect(updates.length).toBeGreaterThan(stepped)

      // 抬起：定时器清理，不再继续步进
      fireEvent.touchend(add, { touches: [], changedTouches: [{ clientX: 0, clientY: 0 }] })
      const afterEnd = updates.length
      await pause(400)
      expect(updates.length).toBe(afterEnd)

      // 部分平台长按抬起后仍补发 tap：去重标志应吞掉该次 tap（不额外步进）
      fireEvent.tap(add)
      await pause(50)
      expect(updates.length).toBe(afterEnd)

      // 去重标志已消费：下一次普通 tap 正常步进
      fireEvent.tap(add)
      await pause(50)
      expect(updates.length).toBe(afterEnd + 1)
    })
  })

  describe('交互链路：form + form-item schema 校验', () => {
    it('validate 失败渲染错误提示，reset 清除', async () => {
      const formRef = ref<any>(null)
      const model = ref<Record<string, any>>({ name: '', phone: '' })
      const schema = {
        validate(current: Record<string, any>) {
          const issues: Array<{ path: string[]; message: string }> = []
          if (!current.name) issues.push({ path: ['name'], message: '请输入姓名' })
          if (!/^1\d{10}$/.test(current.phone || '')) issues.push({ path: ['phone'], message: '手机号格式不正确' })
          return issues
        },
        isRequired: (path: string) => path === 'name' || path === 'phone'
      }
      const { container } = render(
        {
          setup() {
            return () =>
              h(Form as any, { ref: formRef, model: model.value, schema, errorType: 'message' }, {
                default: () => [
                  h(FormItem as any, { prop: 'name', title: '姓名', required: true }, {
                    default: () => h(Input as any, { modelValue: model.value.name, placeholder: '请输入姓名' })
                  }),
                  h(FormItem as any, { prop: 'phone', title: '手机号', required: true }, {
                    default: () => h(Input as any, { modelValue: model.value.phone, placeholder: '请输入手机号' })
                  })
                ]
              })
          }
        } as any
      )
      await nextTick()

      // 两个表单项均挂载，星号由 required / schema.isRequired 推导
      expect(container.querySelectorAll('.wd-form-item').length).toBe(2)
      expect(container.querySelectorAll('.wd-input__inner').length).toBe(2)
      expect(container.querySelector('.wd-form-item__error-message')).toBeNull()

      // 校验失败：错误提示按 children 顺序渲染
      const result = await formRef.value.validate()
      await nextTick()
      expect(result.valid).toBe(false)
      const messages = Array.from(container.querySelectorAll('.wd-form-item__error-message')).map((el) => el.textContent)
      expect(messages).toEqual(['请输入姓名', '手机号格式不正确'])

      // reset 清除全部提示
      formRef.value.reset()
      await nextTick()
      expect(container.querySelector('.wd-form-item__error-message')).toBeNull()

      // 填合法值后校验通过
      model.value = { name: '张三', phone: '13800138000' }
      await nextTick()
      await nextTick()
      const okResult = await formRef.value.validate()
      await nextTick()
      expect(okResult.valid).toBe(true)
      expect(container.querySelector('.wd-form-item__error-message')).toBeNull()
    })
  })
})
