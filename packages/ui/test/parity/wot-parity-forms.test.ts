/** wot-ui 2.3.2 功能对齐：受控值、边界以及取消/卸载后的异步回调。 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '../../src/common/util'
import { configureUniAdapter } from '../../src/common/uni'
import Slider from '../../src/components/wd-slider/wd-slider.vue'
import Switch from '../../src/components/wd-switch/wd-switch.vue'
import Picker from '../../src/components/wd-picker/wd-picker.vue'
import DatetimePicker from '../../src/components/wd-datetime-picker/wd-datetime-picker.vue'
import DatetimePickerView from '../../src/components/wd-datetime-picker-view/wd-datetime-picker-view.vue'
import Calendar from '../../src/components/wd-calendar/wd-calendar.vue'
import SelectPicker from '../../src/components/wd-select-picker/wd-select-picker.vue'
import Upload from '../../src/components/wd-upload/wd-upload.vue'
import KeyboardKey from '../../src/components/wd-keyboard/key/index.vue'
import Segmented from '../../src/components/wd-segmented/wd-segmented.vue'
import PickerView from '../../src/components/wd-picker-view/wd-picker-view.vue'
import InputNumber from '../../src/components/wd-input-number/wd-input-number.vue'
import Form from '../../src/components/wd-form/wd-form.vue'
import FormItem from '../../src/components/wd-form-item/wd-form-item.vue'
import Radio from '../../src/components/wd-radio/wd-radio.vue'
import RadioGroup from '../../src/components/wd-radio-group/wd-radio-group.vue'
import Checkbox from '../../src/components/wd-checkbox/wd-checkbox.vue'
import CheckboxGroup from '../../src/components/wd-checkbox-group/wd-checkbox-group.vue'
import Input from '../../src/primitives/wd-input/wd-input.vue'
import Textarea from '../../src/primitives/wd-textarea/wd-textarea.vue'
import Search from '../../src/components/wd-search/wd-search.vue'
import Keyboard from '../../src/components/wd-keyboard/wd-keyboard.vue'
import PasswordInput from '../../src/components/wd-password-input/wd-password-input.vue'
import Cascader from '../../src/components/wd-cascader/wd-cascader.vue'

const restores: Array<() => void> = []
afterEach(() => {
  cleanup()
  restores.splice(0).forEach((restore) => restore())
  vi.restoreAllMocks()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function mount(component: any, initial: Record<string, any>) {
  const props = ref(initial)
  let instance: any
  const result = render({
    setup() {
      return () => h(component, { ...props.value, ref: (value: any) => { instance = value } })
    }
  } as any)
  return { ...result, props, instance: () => instance }
}

function installRects(width = 200) {
  const rect = { id: '', left: 0, top: 0, right: width, bottom: 44, width, height: 44 }
  ;(globalThis as any).__wdRectStub = () => rect
  const lynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const original = lynx.createSelectorQuery
  lynx.createSelectorQuery = () => {
    const selected = {
      invoke: (options: any) => { options.success?.(rect); return { exec() {} } },
      boundingClientRect: (callback: any) => { callback(rect); return { exec() {} } }
    }
    const query: any = { select: () => selected, selectAll: () => selected, exec() {} }
    query.in = () => query
    return query
  }
  restores.push(() => {
    delete (globalThis as any).__wdRectStub
    lynx.createSelectorQuery = original
  })
}

const pickerColumns = [[{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }]]

function chooseImage(path = '/selected.jpg') {
  configureUniAdapter({
    chooseMedia: (options: any) => options.success({
      tempFiles: [{ tempFilePath: path, fileType: 'image', size: 10 }]
    })
  })
  restores.push(() => configureUniAdapter({ chooseMedia: undefined }))
}

describe('wot parity — slider 与尺寸状态', () => {
  it('range 右滑块保留左端，dragmove/dragend/change 都使用范围数组', async () => {
    installRects()
    const update = vi.fn()
    const change = vi.fn()
    const dragmove = vi.fn()
    const dragend = vi.fn()
    const { container } = mount(Slider, {
      modelValue: [20, 80], range: true,
      'onUpdate:modelValue': update, onChange: change, onDragmove: dragmove, onDragend: dragend
    })
    await pause(30)
    const dots = container.querySelectorAll('.wd-slider__dot')
    const bar = container.querySelector('.wd-slider__bar')!
    fireEvent.touchstart(dots[1], { touches: [{ clientX: 160, clientY: 0 }] })
    fireEvent.touchmove(bar, { touches: [{ clientX: 180, clientY: 0 }] })
    fireEvent.touchend(dots[1], { changedTouches: [{ clientX: 180, clientY: 0 }], touches: [] })
    await nextTick()
    expect(dragmove).toHaveBeenLastCalledWith({ value: [20, 90] })
    expect(update).toHaveBeenLastCalledWith([20, 90])
    expect(change).toHaveBeenLastCalledWith([20, 90])
    expect(dragend).toHaveBeenLastCalledWith({ value: [20, 90] })
  })

  it('range 越过另一端后按官方排序规范化，保留未拖动端', async () => {
    installRects()
    const update = vi.fn()
    const { container } = mount(Slider, { modelValue: [20, 80], range: true, 'onUpdate:modelValue': update })
    await pause(30)
    const dots = container.querySelectorAll('.wd-slider__dot')
    fireEvent.touchstart(dots[1], { touches: [{ clientX: 160, clientY: 0 }] })
    fireEvent.touchend(dots[1], { changedTouches: [{ clientX: 10, clientY: 0 }] })
    await nextTick()
    expect(update).toHaveBeenLastCalledWith([5, 20])
    fireEvent.touchstart(dots[0], { touches: [{ clientX: 10, clientY: 0 }] })
    fireEvent.touchend(dots[0], { changedTouches: [{ clientX: 0, clientY: 0 }] })
    await nextTick()
    expect(update).toHaveBeenLastCalledWith([0, 20])
  })

  it('非整除 step 的最大值不会在舍入后越界', async () => {
    installRects()
    const update = vi.fn()
    const { container } = mount(Slider, { modelValue: 0, min: 0, max: 10, step: 6, 'onUpdate:modelValue': update })
    await pause(30)
    const dot = container.querySelector('.wd-slider__dot')!
    fireEvent.touchstart(dot, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchend(dot, { changedTouches: [{ clientX: 200, clientY: 0 }] })
    await nextTick()
    expect(update).toHaveBeenLastCalledWith(10)
  })

  it('零几何下的触摸不把合法值重置成最小值', async () => {
    installRects(0)
    const update = vi.fn()
    const { container } = mount(Slider, { modelValue: 50, 'onUpdate:modelValue': update })
    await pause(30)
    update.mockClear()
    const dot = container.querySelector('.wd-slider__dot')!
    fireEvent.touchstart(dot, { touches: [{ clientX: 50, clientY: 0 }] })
    fireEvent.touchend(dot, { changedTouches: [{ clientX: 100, clientY: 0 }] })
    expect(update).not.toHaveBeenCalled()
  })

  it('switch size 取消时清除旧的派生尺寸变量', async () => {
    const mounted = mount(Switch, { modelValue: false, size: 40 })
    // jsdom 的 CSSStyleDeclaration 不序列化自定义变量，断言真正下发的 VNode 样式键。
    expect(mounted.instance().$.subTree.props.style['--wot-switch-size']).toBe('40px')
    mounted.props.value = { modelValue: false }
    await nextTick()
    expect(mounted.instance().$.subTree.props.style['--wot-switch-size']).toBe('')
  })
})

describe('wot parity — picker 取消、配置与受控更新', () => {
  it('picker 滑动中点确认后取消，晚到 pickend 不再提交', async () => {
    const confirm = vi.fn()
    const { container } = mount(Picker, { modelValue: ['a'], columns: pickerColumns, visible: true, onConfirm: confirm })
    await pause(40)
    const content = container.querySelector('.wd-picker-view__column-content')!
    fireEvent.touchstart(content, { touches: [{ clientY: 40 }] })
    fireEvent.tap(container.querySelector('.wd-picker__action--confirm')!)
    fireEvent.tap(container.querySelector('.wd-picker__action--cancel')!)
    fireEvent.touchend(content, { changedTouches: [{ clientY: 40 }] })
    await pause(70)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('picker beforeConfirm 的旧 Promise 不可关闭重新打开的弹窗', async () => {
    const pending = deferred<boolean>()
    const confirm = vi.fn()
    const mounted = mount(Picker, {
      modelValue: ['a'], columns: pickerColumns, visible: true, beforeConfirm: () => pending.promise, onConfirm: confirm
    })
    await pause(40)
    fireEvent.tap(mounted.container.querySelector('.wd-picker__action--confirm')!)
    mounted.instance().close()
    mounted.instance().open()
    pending.resolve(true)
    await pause(30)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('datetime-view 自定义 valueKey/labelKey 保留非空列与选中值', async () => {
    const mounted = mount(DatetimePickerView, {
      type: 'time', modelValue: '03:15', minHour: 2, maxHour: 4, minMinute: 14, maxMinute: 16,
      valueKey: 'id', labelKey: 'title'
    })
    await nextTick()
    expect(mounted.container.querySelectorAll('.wd-picker-view__column').length).toBe(2)
    expect(mounted.container.textContent).toContain('03')
    expect(mounted.instance().getSelectedOptions().map((item: any) => item.value)).toEqual([3, 15])
    expect(mounted.instance().getSelectedOptions()[0]).toMatchObject({ id: 3, title: '03' })
  })

  it('datetime-view useSecond 与 minHour 动态变化重新修正模型及列', async () => {
    const update = vi.fn()
    const mounted = mount(DatetimePickerView, { type: 'time', modelValue: '03:15', 'onUpdate:modelValue': update })
    await nextTick()
    mounted.props.value = { ...mounted.props.value, useSecond: true, minHour: 5 }
    await nextTick()
    expect(update).toHaveBeenLastCalledWith('05:15:00')
    expect(mounted.container.querySelectorAll('.wd-picker-view__column').length).toBe(3)
    expect(mounted.instance().getSelectedOptions().map((item: any) => item.value)).toEqual([5, 15, 0])
  })

  it('datetime-view 不完整时间输入不生成 NaN', async () => {
    const update = vi.fn()
    mount(DatetimePickerView, { type: 'time', modelValue: 'bad', 'onUpdate:modelValue': update })
    await nextTick()
    expect(update).toHaveBeenLastCalledWith('00:00')
  })

  it('datetime-picker 区间切换为单值后不残留区间 tab', async () => {
    const mounted = mount(DatetimePicker, { type: 'time', modelValue: ['03:00', '04:00'], visible: true })
    await pause(40)
    expect(mounted.container.querySelector('.wd-datetime-picker__range')).not.toBeNull()
    mounted.props.value = { type: 'time', modelValue: '03:00', visible: true }
    await nextTick()
    expect(mounted.container.querySelector('.wd-datetime-picker__range')).toBeNull()
  })

  it('calendar 初始 visible=true 渲染面板，且 epoch=0 可确认', async () => {
    const confirm = vi.fn()
    const mounted = mount(Calendar, {
      visible: true, modelValue: 0, minDate: -86400000, maxDate: 86400000, onConfirm: confirm
    })
    await pause(40)
    expect(mounted.container.querySelector('.wd-calendar-view')).not.toBeNull()
    fireEvent.tap(mounted.container.querySelector('.wd-calendar__confirm .wd-button')!)
    expect(confirm).toHaveBeenCalledWith({ value: 0, type: 'date' })
  })

  it('calendar 取消后 late beforeConfirm 不发 confirm', async () => {
    const pending = deferred<boolean>()
    const confirm = vi.fn()
    const date = new Date(2026, 9, 20).getTime()
    const mounted = mount(Calendar, {
      visible: true, modelValue: date, minDate: date, maxDate: date + 86400000,
      beforeConfirm: () => pending.promise, onConfirm: confirm
    })
    await pause(40)
    fireEvent.tap(mounted.container.querySelector('.wd-calendar__confirm .wd-button')!)
    mounted.instance().close()
    pending.resolve(true)
    await pause(30)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('select-picker 外部 0 → "0" 的类型变化同步真正选中项', async () => {
    const columns = [{ value: 0, label: 'number' }, { value: '0', label: 'string' }]
    const mounted = mount(SelectPicker, { modelValue: 0, columns, type: 'radio', visible: true })
    await pause(30)
    mounted.props.value = { ...mounted.props.value, modelValue: '0' }
    await nextTick()
    const items = mounted.container.querySelectorAll('.wd-radio')
    expect(items[1].classList.contains('is-checked')).toBe(true)
    expect(items[0].classList.contains('is-checked')).toBe(false)
  })

  it('select-picker 可过滤数字 label，不调用数字的 substring', async () => {
    const mounted = mount(SelectPicker, { modelValue: 1, columns: [{ value: 1, label: 12345 }], type: 'radio', filterable: true, visible: true })
    await pause(30)
    fireEvent.input(mounted.container.querySelector('input')!, { detail: { value: '23' } })
    await nextTick()
    expect(mounted.container.querySelector('.wd-select-picker__text-active')?.textContent).toBe('23')
  })
})

describe('wot parity — upload 与 keyboard 异步/边界', () => {
  it('手动上传选择后立即更新 v-model:file-list 与 change', async () => {
    chooseImage()
    const update = vi.fn()
    const change = vi.fn()
    const mounted = mount(Upload, { autoUpload: false, 'onUpdate:fileList': update, onChange: change })
    fireEvent.tap(mounted.container.querySelector('.wd-upload__evoke')!)
    await pause(30)
    expect(update).toHaveBeenCalled()
    expect(update.mock.calls.at(-1)![0][0]).toMatchObject({ url: '/selected.jpg', status: 'pending' })
    expect(change).toHaveBeenCalledWith({ fileList: expect.arrayContaining([expect.objectContaining({ url: '/selected.jpg' })]) })
  })

  it('受控回写保留 uid，异步上传 success 能更新正确文件', async () => {
    chooseImage()
    const success = vi.fn()
    let options: any
    let file: any
    const state = ref<any[]>([])
    const result = render({
      setup() {
        return () => h(Upload, {
          fileList: state.value,
          uploadMethod: (item: any, _data: any, callbacks: any) => { file = item; options = callbacks },
          'onUpdate:fileList': (value: any[]) => { state.value = value }, onSuccess: success
        })
      }
    } as any)
    fireEvent.tap(result.container.querySelector('.wd-upload__evoke')!)
    await pause(30)
    expect(options).toBeDefined()
    const uid = state.value[0].uid
    options.onSuccess({ data: 'ok', statusCode: 200 }, file, {})
    await nextTick()
    expect(success).toHaveBeenCalled()
    expect(state.value[0]).toMatchObject({ uid, status: 'success', response: 'ok' })
  })

  it('未决 buildFormData 的重复 submit 只启动一次', async () => {
    const data = deferred<Record<string, any>>()
    const uploadMethod = vi.fn()
    const mounted = mount(Upload, {
      autoUpload: false, fileList: [{ uid: 10, url: '/a.jpg', status: 'pending' }],
      buildFormData: () => data.promise, uploadMethod
    })
    mounted.instance().submit()
    mounted.instance().submit()
    data.resolve({ token: 'x' })
    await pause(20)
    expect(uploadMethod).toHaveBeenCalledTimes(1)
  })

  it('删除后 late buildFormData 不再启动上传', async () => {
    const data = deferred<Record<string, any>>()
    const uploadMethod = vi.fn()
    const mounted = mount(Upload, {
      autoUpload: false, fileList: [{ uid: 10, url: '/a.jpg', status: 'pending' }],
      buildFormData: () => data.promise, uploadMethod
    })
    mounted.instance().submit()
    fireEvent.tap(mounted.container.querySelector('.wd-upload__close')!)
    data.resolve({ token: 'x' })
    await pause(20)
    expect(uploadMethod).not.toHaveBeenCalled()
  })

  it('重复 beforeRemove 的 late 回调不可删除另一文件', async () => {
    const pending = deferred<boolean>()
    const mounted = mount(Upload, {
      fileList: [{ uid: 10, url: '/a.jpg' }, { uid: 11, url: '/b.jpg' }],
      beforeRemove: () => pending.promise
    })
    const close = mounted.container.querySelector('.wd-upload__close')!
    fireEvent.tap(close)
    fireEvent.tap(close)
    pending.resolve(true)
    await pause(20)
    expect(mounted.container.querySelectorAll('.wd-upload__preview').length).toBe(1)
    expect(mounted.container.querySelector('image')?.getAttribute('src')).toBe('/b.jpg')
  })

  it('abort(task) 透传指定任务而非丢弃参数', () => {
    const mounted = mount(Upload, {})
    const abort = vi.fn()
    mounted.instance().abort({ abort })
    expect(abort).toHaveBeenCalledTimes(1)
  })

  it('keyboard touchcancel 不遗留 active 并避免后续 touchend 输入', () => {
    const press = vi.fn()
    const mounted = mount(KeyboardKey, { text: '1', onPress: press })
    const key = mounted.container.querySelector('.wd-key-wrapper')!
    fireEvent.touchstart(key, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchcancel(key)
    fireEvent.touchend(key)
    expect(press).not.toHaveBeenCalled()
  })
})


describe('wot parity — 剩余表单/配置契约', () => {
  it('segmented 异步选项重排同步activeIndex，清空后不派发 undefined', async () => {
    const update = vi.fn()
    const mounted = mount(Segmented, { value: 'B', options: ['A', 'B'], 'onUpdate:value': update })
    await nextTick()
    expect(mounted.container.querySelectorAll('.wd-segmented__item')[1].classList.contains('is-active')).toBe(true)
    mounted.props.value = { ...mounted.props.value, options: ['B', 'A'] }
    await nextTick()
    expect(mounted.container.querySelectorAll('.wd-segmented__item')[0].classList.contains('is-active')).toBe(true)
    mounted.props.value = { ...mounted.props.value, options: [] }
    await nextTick()
    expect(update).not.toHaveBeenCalledWith(undefined)
    expect(mounted.container.querySelector('.wd-segmented__slider')!.getAttribute('style')).toContain('width: 0px')
  })

  it('picker-view itemHeight 动态变化同时改变选中偏移', async () => {
    const mounted = mount(PickerView, { modelValue: ['b'], columns: [['a', 'b']], itemHeight: 44 })
    mounted.props.value = { ...mounted.props.value, itemHeight: 60 }
    await nextTick()
    expect(mounted.container.querySelector('.wd-picker-view__column-content')!.getAttribute('style')).toContain('translateY(-60px)')
  })

  it('datetime-view correctValue/getOriginColumns 是可调用的官方公开方法', async () => {
    const mounted = mount(DatetimePickerView, { type: 'time', modelValue: '03:00', minHour: 2, maxHour: 4 })
    await nextTick()
    expect(mounted.instance().correctValue('99:99')).toBe('04:59')
    expect(mounted.instance().getOriginColumns()[0]).toEqual({ type: 'hour', values: [2, 3, 4] })
  })

  it('switch beforeChange 在禁用之后不提交旧值', async () => {
    const pending = deferred<boolean>()
    const update = vi.fn()
    const mounted = mount(Switch, { modelValue: false, beforeChange: () => pending.promise, 'onUpdate:modelValue': update })
    fireEvent.tap(mounted.container.querySelector('.wd-switch')!)
    mounted.props.value = { ...mounted.props.value, disabled: true }
    await nextTick()
    pending.resolve(true)
    await nextTick()
    expect(update).not.toHaveBeenCalled()
  })

  it('input-number beforeChange 在卸载后不提交', async () => {
    const pending = deferred<boolean>()
    const update = vi.fn()
    const mounted = mount(InputNumber, { modelValue: 1, beforeChange: () => pending.promise, 'onUpdate:modelValue': update })
    fireEvent.tap(mounted.container.querySelector('.wd-input-number__add')!)
    mounted.unmount()
    pending.resolve(true)
    await nextTick()
    expect(update).not.toHaveBeenCalled()
  })

  it('form reset 使未决schema校验只返回结果，不回写旧错误', async () => {
    const pending = deferred<any[]>()
    let form: any
    const result = render({
      setup() {
        return () => h(Form, { ref: (value: any) => { form = value }, model: { name: '' }, schema: { validate: () => pending.promise } }, {
          default: () => h(FormItem, { prop: 'name', title: 'Name' })
        })
      }
    } as any)
    await nextTick()
    const validation = form.validate()
    form.reset()
    pending.resolve([{ path: ['name'], message: 'stale error' }])
    expect((await validation).valid).toBe(false)
    await nextTick()
    expect(result.container.querySelector('.wd-form-item__error-message')).toBeNull()
  })

  it('radio allowUncheck 清空为null，readonly不修改受控值', async () => {
    const state = ref<any>('a')
    const update = vi.fn((value) => { state.value = value })
    const result = render({
      setup() {
        return () => h(RadioGroup, { modelValue: state.value, allowUncheck: true, 'onUpdate:modelValue': update }, {
          default: () => [h(Radio, { value: 'a' }), h(Radio, { value: 'b', readonly: true })]
        })
      }
    } as any)
    fireEvent.tap(result.container.querySelectorAll('.wd-radio')[0])
    await nextTick()
    expect(update).toHaveBeenCalledWith(null)
    fireEvent.tap(result.container.querySelectorAll('.wd-radio')[1])
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('checkbox-group min/max 与readonly阻止越界交互', () => {
    const update = vi.fn()
    const result = render({
      setup() {
        return () => h(CheckboxGroup, { modelValue: ['a'], min: 1, max: 1, 'onUpdate:modelValue': update }, {
          default: () => [h(Checkbox, { name: 'a' }), h(Checkbox, { name: 'b' }), h(Checkbox, { name: 'c', readonly: true })]
        })
      }
    } as any)
    result.container.querySelectorAll('.wd-checkbox').forEach((item) => fireEvent.tap(item))
    expect(update).not.toHaveBeenCalled()
  })

  it('input/textarea 原生input事件与受控回写使用明确value/detail契约', async () => {
    for (const component of [Input, Textarea]) {
      const update = vi.fn()
      const input = vi.fn()
      const mounted = mount(component, { modelValue: 'a', 'onUpdate:modelValue': update, onInput: input })
      update.mockClear()
      const native = mounted.container.querySelector('input, textarea')!
      fireEvent.input(native, { detail: { value: 'hello', cursor: 0 } })
      expect(update).toHaveBeenLastCalledWith('hello')
      expect(input).toHaveBeenLastCalledWith({ value: 'hello', cursor: 0 })
      mounted.props.value = { ...mounted.props.value, modelValue: 'external' }
      await nextTick()
      expect(mounted.container.querySelector('input, textarea')!.getAttribute('value')).toBe('external')
      mounted.unmount()
    }
  })

  it('search change保留官方{value}参数', () => {
    const change = vi.fn()
    const mounted = mount(Search, { modelValue: '', placeholderLeft: true, onChange: change })
    fireEvent.input(mounted.container.querySelector('input')!, { detail: { value: 'query' } })
    expect(change).toHaveBeenLastCalledWith({ value: 'query' })
  })

  it('password-input 空值安全，键盘input maxlength 与delete 是受控契约', async () => {
    const empty = mount(PasswordInput, { modelValue: null, length: 4, focused: true, mask: false })
    expect(empty.container.querySelectorAll('.wd-password-input__item').length).toBe(4)
    expect(empty.container.querySelector('.wd-password-input__cursor')).not.toBeNull()
    empty.unmount()
    const update = vi.fn()
    const mounted = mount(Keyboard, { visible: true, modelValue: '12', maxlength: 2, 'onUpdate:modelValue': update })
    await nextTick()
    const normal = mounted.container.querySelector('.wd-key-wrapper')!
    fireEvent.touchstart(normal, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchend(normal)
    expect(update).not.toHaveBeenCalled()
    const remove = mounted.container.querySelector('.wd-key--delete')!.parentElement!
    fireEvent.touchstart(remove, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchend(remove)
    expect(update).toHaveBeenLastCalledWith('1')
  })

  it('cascader root lazyLoad 取消后不可覆盖重新打开的新请求', async () => {
    const requests: Array<(items: any[]) => void> = []
    const mounted = mount(Cascader, { visible: true, modelValue: '', lazyLoad: (_parent: any, _index: any, done: any) => requests.push(done) })
    await nextTick()
    mounted.instance().close()
    mounted.instance().open()
    expect(requests).toHaveLength(2)
    requests[0]([{ value: 'old', text: 'old' }])
    requests[1]([{ value: 'new', text: 'new' }])
    await nextTick()
    expect(mounted.container.textContent).not.toContain('old')
    expect(mounted.container.textContent).toContain('new')
  })
})
