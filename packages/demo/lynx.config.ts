import { defineConfig } from '@lynx-js/rspeedy'

import { fileURLToPath } from 'node:url'
import { pluginCssMinimizer } from '@rsbuild/plugin-css-minimizer'
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginVueLynx } from 'vue-lynx/plugin'
import { pluginWotLynxTags, pluginWotLynxWebFonts } from 'wot-lynx-ui/plugin'

/** 组件库源码内文件（相对 packages/ui/src 的路径）的绝对路径 */
const uiSrc = (p: string) => fileURLToPath(new URL(`../ui/src/${p}`, import.meta.url))

export default defineConfig({
  environments: {
    lynx: {},
    web: {}
  },
  plugins: [
    // 显式注册 CSS 压缩插件（Rspeedy 仅在未注册时才添加默认实例），
    // 关闭 cssnano 的 postcss-calc 转换：组件库 token 的回退链在 calc() 内
    // 会形成三层嵌套 var()（如 calc(var(--a, var(--b, var(--c, 2px)))）），
    // postcss-calc 解析不了该结构，压缩时刷出大量 "Parse error" 告警
    // （不影响产物：解析失败时原值透传）。代价仅为 calc 内的空白压缩。
    pluginCssMinimizer({
      pluginOptions: {
        minimizerOptions: {
          preset: ['default', { mergeLonghand: false, calc: false }]
        }
      }
    }),
    pluginWotLynxTags(),
    pluginWotLynxWebFonts(),
    pluginQRCode({
      schema(url) {
        return `${url}?fullscreen=true`
      }
    }),
    pluginVueLynx({
      optionsApi: false,
      enableCSSInlineVariables: true,
      enableCSSInheritance: true,
      enableElementTemplates: false
      // 组件库不使用 Main Thread Script（见 CONVENTIONS.md §9），无需 includeWorkletPackages 白名单
    })
  ],
  server: {
    port: 3000,
    // 保留跨源调试支持；图标字体由宿主 HTML 插件注册，不依赖 CORS 补救。
    cors: true
  },
  tools: {
    rspack: (config) => {
      // demo 直接消费组件库源码，而不是 dist：
      // - dist 只是源码桥接层（scripts/build-dist.mjs），未预构建时整个 demo 编译不过
      //   （Can't resolve 'wot-lynx-ui'）；
      // - 主题指向已编译的 index.css，因为 Rspeedy 未启用 @rsbuild/plugin-sass，
      //   直接解析 index.scss 会报 "To enable support for Sass, use plugin-sass"。
      const alias = (config.resolve?.alias ?? {}) as Record<string, unknown>
      config.resolve = {
        ...config.resolve,
        alias: {
          ...alias,
          'wot-lynx-ui/theme$': uiSrc('styles/theme/index.css'),
          'wot-lynx-ui$': uiSrc('index.ts')
        }
      }
    }
  },
  source: {
    // 多入口：main 为组件总览，device-test 为真机测试清单页（独立二维码）
    entry: {
      main: './src/index.ts',
      'device-test': './src/device-test/index.ts'
    },
    // 保证 pnpm workspace 链接的组件库源码被正常编译
    include: [/wot-lynx-ui/]
  }
})
