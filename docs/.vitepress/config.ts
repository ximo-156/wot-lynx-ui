import { defineConfig } from 'vitepress'
import path from 'node:path'
import { componentsSidebar } from './components-sidebar'

const here = __dirname
const uiSrc = path.resolve(here, '../../packages/ui/src')
const coreSrc = path.resolve(here, '../../packages/core/src')

/**
 * 组件包源码别名（ADR-023 域包拆分）。docs 不安装 workspace 依赖，
 * 按源码路径别名，与各包 exports 的 source 条件对齐。
 * 包清单见 docs/architecture/packages.json。
 */
const componentPkgAliases = ['primitives', 'ui-layout', 'ui-display', 'ui-nav', 'ui-form', 'ui-feedback', 'ui-picker']
  .map((dir) => {
    const src = path.resolve(here, `../../packages/${dir}/src`)
    return [
      { find: new RegExp(`^@wot-lynx/${dir}/(.+)$`), replacement: path.join(src, '$1') },
      { find: new RegExp(`^@wot-lynx/${dir}$`), replacement: path.join(src, 'index.ts') }
    ]
  })
  .flat()

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
  // 仓库 AI 指引使用源码/Git 相对路径，供助手读取，不作为消费者站点页面。
  // 仅排除开发指引，保留其他页面的 dead-link 门禁。
  srcExclude: ['**/AGENTS.md', 'ai/README.md'],
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
        // wot-lynx-ui 门面包（docs 未安装该依赖，按源码路径别名，与其 exports 对齐）
        { find: /^wot-lynx-ui$/, replacement: path.join(uiSrc, 'index.ts') },
        // 主题 CSS 编译在 @wot-lynx/core（ADR-023）；门面 src 只剩转发 scss
        { find: /^wot-lynx-ui\/theme$/, replacement: path.join(coreSrc, 'styles/theme/index.css') },
        { find: /^wot-lynx-ui\/components\/(.+)$/, replacement: path.join(uiSrc, 'components/$1') },
        // 中立层源码别名（common / composables / icons / locale / styles）
        { find: /^@wot-lynx\/core\/(.+)$/, replacement: path.join(coreSrc, '$1') },
        // 组件包源码别名（基础件 / 域包）
        ...componentPkgAliases
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
            { text: '高性能实践', link: '/guide/performance' },
            { text: '与 wot-ui 的差异', link: '/guide/differences' }
          ]
        }
      ],
      '/components/': [componentsSidebar]
      // 原 '/design/' 分组已移除：DESIGN-SPEC / AUDIT-2026-10-23 属本地独占的
      // AI 生成文档（见 .gitignore 第 9 组），留在侧边栏会让 docs:build 死链。
      //
      // 上面 '/guide/' 只有 6 篇**已入库**的用户指南。docs/guide/ 下还有
      // native-crash-audit / design-research / onboarding-template 三篇 AI
      // 审计与调研稿，它们本地独占、不入库，**不要**加进这份清单——加了就是
      // 死链（VitePress 构建期会直接报错）。
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/wot-lynx-ui/wot-lynx-ui' }],
    footer: {
      message: 'MIT Licensed',
      copyright: 'Copyright © 2026 wot-lynx-ui contributors'
    }
  }
})
