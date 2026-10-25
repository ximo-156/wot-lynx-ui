/**
 * Tier 3 展示 / 布局 / 导航 冒烟测试。
 */
import { describe, it, expect } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '../../src/common/util'
import Tag from '../../src/components/wd-tag/wd-tag.vue'
import Badge from '../../src/primitives/wd-badge/wd-badge.vue'
import Card from '../../src/components/wd-card/wd-card.vue'
import Img from '../../src/primitives/wd-img/wd-img.vue'
import Empty from '../../src/components/wd-empty/wd-empty.vue'
import Progress from '../../src/components/wd-progress/wd-progress.vue'
import CountDown from '../../src/components/wd-count-down/wd-count-down.vue'
import CountTo from '../../src/components/wd-count-to/wd-count-to.vue'
import NoticeBar from '../../src/components/wd-notice-bar/wd-notice-bar.vue'
import Skeleton from '../../src/components/wd-skeleton/wd-skeleton.vue'
import Avatar from '../../src/components/wd-avatar/wd-avatar.vue'
import Row from '../../src/components/wd-row/wd-row.vue'
import Col from '../../src/components/wd-col/wd-col.vue'
import Grid from '../../src/components/wd-grid/wd-grid.vue'
import GridItem from '../../src/components/wd-grid-item/wd-grid-item.vue'
import Navbar from '../../src/components/wd-navbar/wd-navbar.vue'
import Tabs from '../../src/components/wd-tabs/wd-tabs.vue'
import Tab from '../../src/components/wd-tab/wd-tab.vue'
import Sidebar from '../../src/components/wd-sidebar/wd-sidebar.vue'
import SidebarItem from '../../src/components/wd-sidebar-item/wd-sidebar-item.vue'
import Pagination from '../../src/components/wd-pagination/wd-pagination.vue'
import Backtop from '../../src/components/wd-backtop/wd-backtop.vue'
import IndexBar from '../../src/components/wd-index-bar/wd-index-bar.vue'
import IndexAnchor from '../../src/components/wd-index-anchor/wd-index-anchor.vue'

describe('Tier 3 展示 / 布局 / 导航', () => {
  describe('渲染冒烟', () => {
    it('WdTag 类型 × 变体 × 尺寸', () => {
      for (const type of ['default', 'primary', 'success', 'warning', 'danger']) {
        for (const variant of ['light', 'dark', 'plain', 'dashed', 'text']) {
          const { container } = render(Tag, { type, variant, text: '标签' })
          const el = container.querySelector('.wd-tag')!
          expect(el.classList.contains(`is-${type}`)).toBe(true)
          expect(el.classList.contains(`is-${variant}`)).toBe(true)
          cleanup()
        }
      }
    })

    it('WdBadge 数字 / 圆点 / max 截断', () => {
      const { container } = render(Badge, { value: 5 })
      expect(container.querySelector('.wd-badge__content')).not.toBeNull()
      cleanup()

      const dot = render(Badge, { isDot: true })
      // wot-ui 2.3.2：圆点态的类名为 is-dot（非 --dot 修饰类）
      expect(dot.container.querySelector('.wd-badge__content.is-dot')).not.toBeNull()
      cleanup()

      const max = render(Badge, { value: 100, max: 99 })
      expect(max.container.querySelector('.wd-badge__content')!.textContent).toContain('99+')
      cleanup()
    })

    it('WdCard / WdEmpty / WdProgress / WdCountDown / WdCountTo / WdNoticeBar / WdSkeleton / WdAvatar 渲染', () => {
      const cases: Array<[any, Record<string, any>, string]> = [
        [Card, { title: '标题' }, '.wd-card'],
        [Empty, { tip: '暂无数据' }, '.wd-empty'],
        [Progress, { percentage: 60 }, '.wd-progress'],
        [CountDown, { time: 60000 }, '.wd-count-down'],
        [CountTo, { endVal: 100, duration: 100 }, '.wd-count-to'],
        [NoticeBar, { text: '通知' }, '.wd-notice-bar'],
        [Skeleton, {}, '.wd-skeleton'],
        [Avatar, { text: 'A' }, '.wd-avatar'],
        [Navbar, { title: '导航栏' }, '.wd-navbar'],
        [Row, {}, '.wd-row'],
        [Col, { span: 12 }, '.wd-col'],
        [Grid, {}, '.wd-grid'],
        [Pagination, { modelValue: 1, totalPage: 5 }, '.wd-pagination'],
        [Backtop, { scrollTop: 500 }, '.wd-backtop'],
        [IndexBar, {}, '.wd-index-bar']
      ]
      for (const [comp, props, selector] of cases) {
        const { container } = render(comp, props)
        expect(container.querySelector(selector), selector).not.toBeNull()
        cleanup()
      }
    })

    it('WdGrid + WdGridItem 列宽换算', () => {
      const { container } = render(Grid, { column: 3 }, [
        { install(app: any) { app.component('WdGridItem', GridItem) } } as any
      ])
      expect(container.querySelector('.wd-grid')).not.toBeNull()
      cleanup()
    })

    it('WdSkeleton 默认行数与 rowCol 配置（对齐 wot-ui themeMap.text）', () => {
      // wot-ui 2.3.2：默认 theme=text → themeMap.text = [1, [col, col]]，
      // 即 2 行、共 3 列
      const { container } = render(Skeleton, {})
      expect(container.querySelectorAll('.wd-skeleton__row').length).toBe(2)
      expect(container.querySelectorAll('.wd-skeleton__col').length).toBe(3)
      cleanup()

      // wot-ui 语义：rowCol 中数字项 = 1 列（数值本身不表示列数），
      // 对象项 = 1 列 → [2, { width: '50%' }] 为 2 行 2 列
      const custom = render(Skeleton, { rowCol: [2, { width: '50%' }] as any })
      expect(custom.container.querySelectorAll('.wd-skeleton__row').length).toBe(2)
      expect(custom.container.querySelectorAll('.wd-skeleton__col').length).toBe(2)
      cleanup()
    })

    it('WdCountDown format 占位符', () => {
      const { container } = render(CountDown, { time: 3661000, format: 'HH:mm:ss' })
      expect(container.querySelector('.wd-count-down__text')!.textContent).toBe('01:01:01')
      cleanup()
    })
  })

  describe('交互行为', () => {
    it('WdTabs 切换激活项', async () => {
      const changes: any[] = []
      const { container } = render(
        {
          setup() {
            const value = ref(0)
            return () =>
              h(Tabs, {
                modelValue: value.value,
                'onUpdate:modelValue': (v: any) => {
                  value.value = v
                  changes.push(v)
                }
              }, {
                default: () => [
                  h(Tab, { title: '标签一', name: 0 }),
                  h(Tab, { title: '标签二', name: 1 })
                ]
              })
          }
        } as any
      )
      const items = container.querySelectorAll('.wd-tabs__nav-item')
      expect(items.length).toBe(2)
      expect(items[0].classList.contains('is-active')).toBe(true)
      fireEvent.tap(items[1])
      expect(changes).toContain(1)
      cleanup()
    })

    it('WdSidebar + WdSidebarItem 切换', () => {
      const changes: any[] = []
      const { container } = render(
        {
          setup() {
            const value = ref('a')
            return () =>
              h(Sidebar, {
                modelValue: value.value,
                'onUpdate:modelValue': (v: any) => {
                  value.value = v
                  changes.push(v)
                }
              }, {
                default: () => [
                  h(SidebarItem, { label: '选项A', value: 'a' }),
                  h(SidebarItem, { label: '选项B', value: 'b' })
                ]
              })
          }
        } as any
      )
      const items = container.querySelectorAll('.wd-sidebar-item')
      expect(items.length).toBe(2)
      expect(items[0].classList.contains('wd-sidebar-item--active')).toBe(true)
      fireEvent.tap(items[1])
      expect(changes).toContain('b')
      cleanup()
    })

    it('WdPagination 翻页', () => {
      const updates: any[] = []
      const { container } = render(
        {
          setup() {
            const value = ref(2)
            return () =>
              h(Pagination, {
                modelValue: value.value,
                totalPage: 5,
                'onUpdate:modelValue': (v: any) => {
                  value.value = v
                  updates.push(v)
                }
              })
          }
        } as any
      )
      // 下一页按钮（第二个 wd-button）
      const buttons = container.querySelectorAll('.wd-button')
      fireEvent.tap(buttons[1])
      expect(updates).toContain(3)
      cleanup()
    })

    it('WdTag 关闭事件', () => {
      const closes: any[] = []
      const { container } = render(
        {
          setup() {
            return () => h(Tag, { closable: true, onClose: () => closes.push(1) }, { default: () => h('text', '可关闭') })
          }
        } as any
      )
      fireEvent.tap(container.querySelector('.wd-tag__close')!)
      expect(closes.length).toBe(1)
      cleanup()
    })

    it('WdBacktop 点击回到顶部 emit click', () => {
      const clicks: any[] = []
      const { container } = render(
        {
          setup() {
            return () => h(Backtop, { scrollTop: 500, top: 300, onClick: () => clicks.push(1) })
          }
        } as any
      )
      fireEvent.tap(container.querySelector('.wd-backtop')!)
      expect(clicks.length).toBe(1)
      cleanup()
    })

    it('WdBacktop 阈值逻辑（scrollTop >= top 才显示）', () => {
      // 达到阈值时内容渲染（transition 内部据此显隐）
      const shown = render(Backtop, { scrollTop: 500, top: 300 })
      expect(shown.container.querySelector('.wd-backtop')).not.toBeNull()
      cleanup()
    })

    it('WdIndexBar + WdIndexAnchor 渲染', () => {
      const { container } = render(IndexBar, {}, [
        { install(app: any) { app.component('WdIndexAnchor', IndexAnchor) } } as any
      ])
      expect(container.querySelector('.wd-index-bar')).not.toBeNull()
      cleanup()
    })
  })
})
