import { defineConfig } from 'vitepress'
import path from 'node:path'
import { componentsSidebar } from './components-sidebar'

const here = __dirname
const uiSrc = path.resolve(here, '../../packages/ui/src')

/**
 * Lynx 原生元素集合（与 packages/ui/vitest.config.ts 的 LYNX_NATIVE_TAGS 对齐）。
 * 文档站的 H5 预览直接编译组件库源码，view / text / scroll-view 等标签必须
 * 声明为自定义元素，否则会被当作未注册组件而不渲染。
 */
const LYNX_NATIVE_TAGS = new Set([
  'view',
  'text',
  'image',
  'scroll-view',
  'list',
  'swiper',
  'swiper-item',
  'input',
  'textarea',
  'svg',
  'video',
  'canvas'
])

export default defineConfig({
  title: 'wot-lynx-ui',
  description: '基于 Vue Lynx 的 wot-ui 适配组件库 — 原生性能、样式一致、API 兼容',
  lang: 'zh-CN',
  base: '/',
  // H5 预览：组件库源码以「Lynx 原生元素即自定义元素」的方式在浏览器编译渲染
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag: string) => LYNX_NATIVE_TAGS.has(tag)
      }
    }
  },
  vite: {
    resolve: {
      alias: [
        // vue-lynx → 浏览器 DOM 渲染垫片（docs/.vitepress/theme/lynx-dom.ts）
        { find: /^vue-lynx$/, replacement: path.resolve(here, 'theme/lynx-dom.ts') },
        // wot-lynx-ui 工作区包（docs 未安装该依赖，按源码路径别名，与其 exports 对齐）
        { find: /^wot-lynx-ui$/, replacement: path.join(uiSrc, 'index.ts') },
        { find: /^wot-lynx-ui\/theme$/, replacement: path.join(uiSrc, 'styles/theme/index.css') },
        { find: /^wot-lynx-ui\/components\/(.+)$/, replacement: path.join(uiSrc, 'components/$1') },
        // L3.5 基础件根（ADR-012）。demo 从 components 迁到 primitives 后必须
        // 有这条别名，否则 Vite 解析到不存在的 src/components/wd-cell/… 而失败。
        { find: /^wot-lynx-ui\/primitives\/(.+)$/, replacement: path.join(uiSrc, 'primitives/$1') },
        { find: /^wot-lynx-ui\/styles\/(.+)$/, replacement: path.join(uiSrc, 'styles/$1') }
      ]
    }
  },
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: '指南', link: '/guide/quick-start' },
      { text: '真机测试', link: '/guide/device-testing' },
      { text: '组件', link: '/components/button' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: '指南',
          items: [
            { text: '快速开始', link: '/guide/quick-start' },
            { text: '真机测试指南', link: '/guide/device-testing' },
            { text: '主题与设计令牌', link: '/guide/theme' },
            { text: '内置图标', link: '/guide/icons' },
            { text: '设计美学研究', link: '/guide/design-research' },
            { text: '高性能实践', link: '/guide/performance' },
            { text: '与 wot-ui 的差异', link: '/guide/differences' }
          ]
        }
      ],
      '/components/': [componentsSidebar],
      '/design/': [
        {
          text: '设计规范',
          items: [
            { text: '规范总览', link: '/design/DESIGN-SPEC' },
            { text: '体检报告 2026-10-23', link: '/design/AUDIT-2026-10-23' }
          ]
        }
      ]
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/wot-lynx-ui/wot-lynx-ui' }],
    footer: {
      message: 'MIT Licensed',
      copyright: 'Copyright © 2026 wot-lynx-ui contributors'
    }
  }
})
