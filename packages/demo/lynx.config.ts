import { defineConfig } from '@lynx-js/rspeedy'

import { pluginCssMinimizer } from '@rsbuild/plugin-css-minimizer'
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginVueLynx } from 'vue-lynx/plugin'
import { pluginWotLynxTags } from 'wot-lynx-ui/plugin'

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
