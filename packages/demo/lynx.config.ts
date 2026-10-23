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
      enableElementTemplates: false,
      // 组件库**用了** Main Thread Script：12 个组件、31 处 `'main thread'` worklet。
      //
      // 实测（2026-10-23）：这 31 个 worklet 只出现在后台包的描述符里
      //   `{ _c: {...}, _wkltId: "2c90:c730a:1" }`
      // 主线程包里**没有任何一个** `registerWorkletInternal("main-thread", "<id>", fn)`，
      // 所以运行时 `_workletMap[id]` 是 undefined，一碰手势就抛
      //   `main-thread.js exception: TypeError: cannot read property 'bind' of undefined`
      // （Web 端同源：`Cannot read properties of undefined (reading 'bind')`，
      //   栈落在 web-core 事件分发的 `runWorklet?.(s.value, [d])`）。
      //
      // 对照：`src/worklet-repro/App.vue` 里**项目源码**的两个 worklet 正常注册
      // （2/2），库里的 31 个是 0/31 —— 差异就是「项目源码 vs 经 node_modules 解析的包」。
      //
      // 下面这行是按 vue-lynx 文档给的开关，**实测未生效**（加上后仍是 0/31），
      // 保留是因为语义正确、上游修好后自动受益；在此之前消费方会踩同一个坑。
      includeWorkletPackages: ['wot-lynx-ui']
    })
  ],
  server: {
    port: 3000,
    // 保留跨源调试支持；图标字体由宿主 HTML 插件注册，不依赖 CORS 补救。
    cors: true
  },
  tools: {
    rspack: (config) => {
      // demo 走组件库**真实的 exports 契约**，不用别名抄近路：
      // 别名会把 package.json 的 exports 映射整个绕开，导致子路径声明错了
      // 也照样构建通过（2026-10-23 就踩过：`./components/*` 的 source 目标
      // 指向目录，真实消费时 ERR_UNSUPPORTED_DIR_IMPORT，而 demo 一直绿灯）。
      //
      // 需要 'source' 条件才会命中 exports 里的 `source` 分支（rspack 默认
      // conditionNames 不含它）。命中后 demo 直接编译 src，无需先 build:ui。
      //
      // 唯一保留的别名是 theme：`./theme` 的 source 目标是 index.scss，
      // 而 Rspeedy 未启用 @rsbuild/plugin-sass，解析 .scss 会直接报错，
      // 因此指向已编译的 index.css（该文件由 build:css 生成并入库）。
      const alias = (config.resolve?.alias ?? {}) as Record<string, unknown>
      config.resolve = {
        ...config.resolve,
        conditionNames: [...(config.resolve?.conditionNames ?? []), 'source'],
        alias: {
          ...alias,
          'wot-lynx-ui/theme$': uiSrc('styles/theme/index.css')
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
