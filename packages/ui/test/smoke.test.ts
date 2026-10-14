/**
 * 全组件冒烟测试 — 每个 wd-* 组件在 Vue Lynx 双线程测试环境中渲染一次。
 *
 * 目的：保证"任何一个组件都能运行"（import + mount + 渲染不抛错）。
 * 需要必填 props 的组件在 cases 中给出最小可用配置——漏传会让 Vue 打
 * "Missing required prop" 告警，该告警由本文件的断言锁死。
 */
import { describe, it, expect } from 'vitest'
import { render } from './render'
import { captureConsole } from './capture-console'
import WdButton from '../src/components/wd-button/wd-button.vue'
import WdIcon from '../src/components/wd-icon/wd-icon.vue'
import WdLoading from '../src/components/wd-loading/wd-loading.vue'
import WdCell from '../src/components/wd-cell/wd-cell.vue'
import WdCellGroup from '../src/components/wd-cell-group/wd-cell-group.vue'
import WdTag from '../src/components/wd-tag/wd-tag.vue'
import WdConfigProvider from '../src/components/wd-config-provider/wd-config-provider.vue'
import WdPopup from '../src/components/wd-popup/wd-popup.vue'
import WdPicker from '../src/components/wd-picker/wd-picker.vue'
import WdPickerView from '../src/components/wd-picker-view/wd-picker-view.vue'
import WdSelectPicker from '../src/components/wd-select-picker/wd-select-picker.vue'
import WdCascader from '../src/components/wd-cascader/wd-cascader.vue'
import WdCalendar from '../src/components/wd-calendar/wd-calendar.vue'
import WdCalendarView from '../src/components/wd-calendar-view/wd-calendar-view.vue'
import WdDatetimePicker from '../src/components/wd-datetime-picker/wd-datetime-picker.vue'
import WdDatetimePickerView from '../src/components/wd-datetime-picker-view/wd-datetime-picker-view.vue'
import WdTable from '../src/components/wd-table/wd-table.vue'
import WdTableColumn from '../src/components/wd-table-column/wd-table-column.vue'
import WdIndexBar from '../src/components/wd-index-bar/wd-index-bar.vue'
import WdIndexAnchor from '../src/components/wd-index-anchor/wd-index-anchor.vue'
import WdSortButton from '../src/components/wd-sort-button/wd-sort-button.vue'
import WdSwiper from '../src/components/wd-swiper/wd-swiper.vue'
import WdSwiperNav from '../src/components/wd-swiper-nav/wd-swiper-nav.vue'
import WdTabs from '../src/components/wd-tabs/wd-tabs.vue'
import WdTab from '../src/components/wd-tab/wd-tab.vue'
import WdDropMenu from '../src/components/wd-drop-menu/wd-drop-menu.vue'
import WdDropMenuItem from '../src/components/wd-drop-menu-item/wd-drop-menu-item.vue'
import WdSidebar from '../src/components/wd-sidebar/wd-sidebar.vue'
import WdSidebarItem from '../src/components/wd-sidebar-item/wd-sidebar-item.vue'
import WdGrid from '../src/components/wd-grid/wd-grid.vue'
import WdGridItem from '../src/components/wd-grid-item/wd-grid-item.vue'
import WdRow from '../src/components/wd-row/wd-row.vue'
import WdCol from '../src/components/wd-col/wd-col.vue'
import WdSteps from '../src/components/wd-steps/wd-steps.vue'
import WdStep from '../src/components/wd-step/wd-step.vue'
import WdCollapse from '../src/components/wd-collapse/wd-collapse.vue'
import WdCollapseItem from '../src/components/wd-collapse-item/wd-collapse-item.vue'
import WdForm from '../src/components/wd-form/wd-form.vue'
import WdFormItem from '../src/components/wd-form-item/wd-form-item.vue'
import WdInput from '../src/components/wd-input/wd-input.vue'
import WdTextarea from '../src/components/wd-textarea/wd-textarea.vue'
import WdInputNumber from '../src/components/wd-input-number/wd-input-number.vue'
import WdSearch from '../src/components/wd-search/wd-search.vue'
import WdCheckbox from '../src/components/wd-checkbox/wd-checkbox.vue'
import WdCheckboxGroup from '../src/components/wd-checkbox-group/wd-checkbox-group.vue'
import WdRadio from '../src/components/wd-radio/wd-radio.vue'
import WdRadioGroup from '../src/components/wd-radio-group/wd-radio-group.vue'
import WdSwitch from '../src/components/wd-switch/wd-switch.vue'
import WdRate from '../src/components/wd-rate/wd-rate.vue'
import WdSlider from '../src/components/wd-slider/wd-slider.vue'
import WdUpload from '../src/components/wd-upload/wd-upload.vue'
import WdSignature from '../src/components/wd-signature/wd-signature.vue'
import WdImgCropper from '../src/components/wd-img-cropper/wd-img-cropper.vue'
import WdNoticeBar from '../src/components/wd-notice-bar/wd-notice-bar.vue'
import WdToast from '../src/components/wd-toast/wd-toast.vue'
import WdNotify from '../src/components/wd-notify/wd-notify.vue'
import WdDialog from '../src/components/wd-dialog/wd-dialog.vue'
import WdActionSheet from '../src/components/wd-action-sheet/wd-action-sheet.vue'
import WdOverlay from '../src/components/wd-overlay/wd-overlay.vue'
import WdRootPortal from '../src/components/wd-root-portal/wd-root-portal.vue'
import WdTransition from '../src/components/wd-transition/wd-transition.vue'
import WdPopover from '../src/components/wd-popover/wd-popover.vue'
import WdTooltip from '../src/components/wd-tooltip/wd-tooltip.vue'
import WdFab from '../src/components/wd-fab/wd-fab.vue'
import WdFloatingPanel from '../src/components/wd-floating-panel/wd-floating-panel.vue'
import WdSlideVerify from '../src/components/wd-slide-verify/wd-slide-verify.vue'
import WdKeyboard from '../src/components/wd-keyboard/wd-keyboard.vue'
import WdPasswordInput from '../src/components/wd-password-input/wd-password-input.vue'
import WdCountDown from '../src/components/wd-count-down/wd-count-down.vue'
import WdCountTo from '../src/components/wd-count-to/wd-count-to.vue'
import WdBadge from '../src/components/wd-badge/wd-badge.vue'
import WdAvatar from '../src/components/wd-avatar/wd-avatar.vue'
import WdAvatarGroup from '../src/components/wd-avatar-group/wd-avatar-group.vue'
import WdSkeleton from '../src/components/wd-skeleton/wd-skeleton.vue'
import WdEmpty from '../src/components/wd-empty/wd-empty.vue'
import WdLoadmore from '../src/components/wd-loadmore/wd-loadmore.vue'
import WdPagination from '../src/components/wd-pagination/wd-pagination.vue'
import WdProgress from '../src/components/wd-progress/wd-progress.vue'
import WdCircle from '../src/components/wd-circle/wd-circle.vue'
import WdSegmented from '../src/components/wd-segmented/wd-segmented.vue'
import WdStatus from '../src/components/wd-text/wd-text.vue'
import WdDivider from '../src/components/wd-divider/wd-divider.vue'
import WdGap from '../src/components/wd-gap/wd-gap.vue'
import WdCard from '../src/components/wd-card/wd-card.vue'
import WdCurtain from '../src/components/wd-curtain/wd-curtain.vue'
import WdNavbar from '../src/components/wd-navbar/wd-navbar.vue'
import WdNavbarCapsule from '../src/components/wd-navbar-capsule/wd-navbar-capsule.vue'
import WdImg from '../src/components/wd-img/wd-img.vue'
import WdImagePreview from '../src/components/wd-image-preview/wd-image-preview.vue'
import WdVideoPreview from '../src/components/wd-video-preview/wd-video-preview.vue'
import WdQrCode from '../src/components/wd-qr-code/wd-qr-code.vue'
import WdBarCode from '../src/components/wd-bar-code/wd-bar-code.vue'
import WdWatermark from '../src/components/wd-watermark/wd-watermark.vue'
import WdTour from '../src/components/wd-tour/wd-tour.vue'
import WdResize from '../src/components/wd-resize/wd-resize.vue'
import WdSticky from '../src/components/wd-sticky/wd-sticky.vue'
import WdStickyBox from '../src/components/wd-sticky-box/wd-sticky-box.vue'
import WdSwipeAction from '../src/components/wd-swipe-action/wd-swipe-action.vue'
import WdBacktop from '../src/components/wd-backtop/wd-backtop.vue'
import WdTabbar from '../src/components/wd-tabbar/wd-tabbar.vue'
import WdTabbarItem from '../src/components/wd-tabbar-item/wd-tabbar-item.vue'

// [组件, 渲染所需的最小 props]
const cases: Array<[string, any, Record<string, any>?]> = [
  ['WdButton', WdButton],
  ['WdIcon', WdIcon, { name: 'close' }],
  ['WdLoading', WdLoading],
  ['WdCell', WdCell, { title: '标题' }],
  ['WdCellGroup', WdCellGroup],
  ['WdTag', WdTag, { text: '标签' }],
  ['WdConfigProvider', WdConfigProvider],
  ['WdPopup', WdPopup],
  ['WdPicker', WdPicker, { columns: [{ value: 'a', label: 'A' }] }],
  ['WdPickerView', WdPickerView, { columns: [{ value: 'a', label: 'A' }] }],
  ['WdSelectPicker', WdSelectPicker, { columns: [{ value: 'a', label: 'A' }], modelValue: '' }],
  ['WdCascader', WdCascader, { options: [{ value: 'a', label: 'A' }] }],
  ['WdCalendar', WdCalendar, { modelValue: null }],
  ['WdCalendarView', WdCalendarView, { modelValue: null }],
  ['WdDatetimePicker', WdDatetimePicker, { modelValue: 0 }],
  ['WdDatetimePickerView', WdDatetimePickerView, { modelValue: 0 }],
  ['WdTable', WdTable, { data: [] }],
  ['WdTableColumn', WdTableColumn, { prop: 'name', label: '名称' }],
  ['WdIndexBar', WdIndexBar],
  ['WdIndexAnchor', WdIndexAnchor, { index: 'A' }],
  ['WdSortButton', WdSortButton, { title: '排序' }],
  ['WdSwiper', WdSwiper],
  ['WdSwiperNav', WdSwiperNav, { current: 0, total: 2 }],
  ['WdTabs', WdTabs],
  ['WdTab', WdTab, { title: '页签' }],
  ['WdDropMenu', WdDropMenu],
  ['WdDropMenuItem', WdDropMenuItem],
  ['WdSidebar', WdSidebar],
  ['WdSidebarItem', WdSidebarItem, { value: 'a', label: 'A' }],
  ['WdGrid', WdGrid],
  ['WdGridItem', WdGridItem, { text: '格子' }],
  ['WdRow', WdRow],
  ['WdCol', WdCol],
  ['WdSteps', WdSteps],
  ['WdStep', WdStep],
  ['WdCollapse', WdCollapse],
  ['WdCollapseItem', WdCollapseItem, { title: '折叠', name: 'item1' }],
  ['WdForm', WdForm, { model: {} }],
  ['WdFormItem', WdFormItem, { label: '标签' }],
  ['WdInput', WdInput],
  ['WdTextarea', WdTextarea],
  ['WdInputNumber', WdInputNumber, { modelValue: 1 }],
  ['WdSearch', WdSearch],
  ['WdCheckbox', WdCheckbox],
  ['WdCheckboxGroup', WdCheckboxGroup],
  ['WdRadio', WdRadio, { value: 'a' }],
  ['WdRadioGroup', WdRadioGroup],
  ['WdSwitch', WdSwitch],
  ['WdRate', WdRate],
  ['WdSlider', WdSlider],
  ['WdUpload', WdUpload],
  ['WdSignature', WdSignature],
  ['WdImgCropper', WdImgCropper, { src: 'https://example.com/a.png' }],
  ['WdNoticeBar', WdNoticeBar, { text: '公告' }],
  ['WdToast', WdToast],
  ['WdNotify', WdNotify],
  ['WdDialog', WdDialog],
  ['WdActionSheet', WdActionSheet],
  ['WdOverlay', WdOverlay],
  ['WdRootPortal', WdRootPortal],
  ['WdTransition', WdTransition],
  ['WdPopover', WdPopover],
  ['WdTooltip', WdTooltip],
  ['WdFab', WdFab],
  ['WdFloatingPanel', WdFloatingPanel],
  ['WdSlideVerify', WdSlideVerify],
  ['WdKeyboard', WdKeyboard],
  ['WdPasswordInput', WdPasswordInput],
  ['WdCountDown', WdCountDown, { time: 0 }],
  ['WdCountTo', WdCountTo],
  ['WdBadge', WdBadge, { value: 1 }],
  ['WdAvatar', WdAvatar],
  ['WdAvatarGroup', WdAvatarGroup],
  ['WdSkeleton', WdSkeleton],
  ['WdEmpty', WdEmpty],
  ['WdLoadmore', WdLoadmore],
  ['WdPagination', WdPagination, { modelValue: 1 }],
  ['WdProgress', WdProgress],
  ['WdCircle', WdCircle, { modelValue: 65, color: { '0': '#3482FF', '100': '#7C5CFC' } }],
  ['WdSegmented', WdSegmented, { options: ['A', 'B'], value: 'A' }],
  ['WdText', WdStatus, { text: '文本' }],
  ['WdDivider', WdDivider],
  ['WdGap', WdGap],
  ['WdCard', WdCard],
  ['WdCurtain', WdCurtain, { src: 'https://example.com/a.png' }],
  ['WdNavbar', WdNavbar, { title: '标题' }],
  ['WdNavbarCapsule', WdNavbarCapsule],
  ['WdImg', WdImg, { src: 'https://example.com/a.png' }],
  ['WdImagePreview', WdImagePreview],
  ['WdVideoPreview', WdVideoPreview],
  ['WdQrCode', WdQrCode, { text: 'https://wot-ui.cn', enableGradient: true, gradientColors: ['#3482FF', '#7C5CFC'], backgroundImage: 'https://example.com/bg.png' }],
  ['WdBarCode', WdBarCode, { value: '123456' }],
  ['WdWatermark', WdWatermark],
  ['WdTour', WdTour],
  ['WdResize', WdResize],
  ['WdSticky', WdSticky],
  ['WdStickyBox', WdStickyBox],
  ['WdSwipeAction', WdSwipeAction],
  ['WdBacktop', WdBacktop, { scrollTop: 0 }],
  ['WdTabbar', WdTabbar],
  ['WdTabbarItem', WdTabbarItem, { title: '首页' }]
]

/**
 * 收集 vue-lynx 事件注册表中「不可调用」的处理器（sign => 类型描述）。
 * 空数组 = 注册表健康，publishEvent 派发任何已注册事件都不会抛 TypeError。
 */
function nonFunctionRegistryHandlers(): string[] {
  const reg = (globalThis as any).__VUE_LYNX_EVENT_REGISTRY__
  if (!reg?.handlers) return []
  const bad: string[] = []
  for (const [sign, handler] of reg.handlers as Map<string, unknown>) {
    if (typeof handler !== 'function') {
      bad.push(
        Array.isArray(handler)
          ? `${sign} => Array(${(handler as unknown[]).length})`
          : `${sign} => ${typeof handler}`
      )
    }
  }
  return bad
}

describe('全组件冒烟：每个组件都能渲染', () => {
  for (const [name, component, props] of cases) {
    it(`${name} 渲染不抛错`, () => {
      const capture = captureConsole()
      let container: Element | null = null
      try {
        expect(() => {
          const { container: c } = render(component, props)
          container = c
        }).not.toThrow()
        expect(container).toBeTruthy()
        // 结构性告警锁死：漏传必填 props / 传了不认识的 attr / 同一 id 挂多个节点，
        // 任意一条都说明组件用法或实现有问题，不允许以「刷屏但通过」的形式存在。
        expect(capture.frameworkWarnings()).toEqual([])
        // 事件注册表不变式：vue-lynx 的 publishEvent 只容忍 null/undefined，
        // 任何「非函数」注册值（典型：父组件与子组件根节点绑定同名 on* 事件，
        // 被 Vue mergeProps 合并成的数组）都会在事件派发时抛
        // "TypeError: _getRegistryState_handlers_get is not a function"。
        expect(nonFunctionRegistryHandlers()).toEqual([])
      } finally {
        capture.restore()
      }
    })
  }
})
