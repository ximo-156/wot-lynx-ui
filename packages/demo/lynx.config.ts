import { defineConfig } from '@lynx-js/rspeedy'

import { fileURLToPath } from 'node:url'
import { networkInterfaces } from 'node:os'
import { pluginCssMinimizer } from '@rsbuild/plugin-css-minimizer'
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginVueLynx } from 'vue-lynx/plugin'
import { pluginWotLynxTags, pluginWotLynxWebFonts } from 'wot-lynx-ui/plugin'

/** 组件库源码内文件（相对 packages/ui/src 的路径）的绝对路径 */
const uiSrc = (p: string) => fileURLToPath(new URL(`../ui/src/${p}`, import.meta.url))

/**
 * 选取真实局域网 IPv4 作为 dev server 的 host（二维码 / assetPrefix /
 * HMR client 同源使用）。
 *
 * 不设 server.host 时 rspeedy 按 os.networkInterfaces() 的**枚举顺序**取
 * 第一个非内部 IPv4——装有代理 TUN 虚拟网卡的机器（网卡地址常为
 * 198.18.0.1，RFC 2544 保留段）会被选中，而真机与该地址不在同一路由域，
 * 拉取 bundle 必然超时（真机 fatal 102/10203「failed to connect to
 * 198.18.0.1」的根因，2026-10-25）。这里只认私有网段
 * （10.0.0.0/8、172.16-31、192.168.0.0/16），天然跳过 TUN 网卡；
 * 一个都没有时返回 undefined，回落 rspeedy 的默认探测。
 */
function resolveLanHost(): string | undefined {
  const candidates = Object.values(networkInterfaces())
    .flat()
    .filter((net): net is { address: string } => !!net && net.family === 'IPv4' && !net.internal)
    .map((net) => net.address)
  const isPrivate = (ip: string) => {
    if (ip.startsWith('192.168.') || ip.startsWith('10.')) return true
    const second = ip.match(/^172\.(\d+)\./)
    return !!second && Number(second[1]) >= 16 && Number(second[1]) <= 31
  }
  return candidates.find(isPrivate)
}

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
      // worklet 包白名单：worklet-loader-mt 会把「解析后落在 node_modules
      // 里的 import」从 MT 依赖图中剔除，只放行白名单内的包。workspace 源码
      // 直连（symlink 解析到真实路径）不会触发剔除，但 **npm 实装消费者**
      // （wot-lynx-ui 解析到 node_modules 内）不列白名单时组件库全部
      // worklet 都进不了 main-thread.js。这只是两道闸门之一——另一道
      // sideEffects tree-shaking 见 tools.rspack 内注释。
      // 并行会话 2026-10-23 的实证与此一致：库内 31 个 worklet 曾 0/31 注册
      // （项目源码 worklet-repro 页 2/2 正常，差异即「源码直连 vs 经 node_modules
      // 解析的包」）。注意：单加白名单实测仍不够——保住的 import 会被第二道
      // 闸门（sideEffects tree-shaking）剪掉，见 tools.rspack 内注释。
      includeWorkletPackages: ['wot-lynx-ui']
    })
  ],
  server: {
    port: 3000,
    // host 必须显式指定：rspeedy 用它同时决定 dev server 绑定地址、
    // dev.assetPrefix（二维码地址）与 HMR client host——缺省时的自动探测
    // 在多网卡（代理 TUN）机器上会选中真机不可达的虚拟地址。
    // 注意 host 绑定具体 IP 后本机请用该 IP 访问（localhost 不再监听）。
    host: resolveLanHost(),
    // 保留跨源调试支持；图标字体由宿主 HTML 插件注册，不依赖 CORS 补救。
    cors: true
  },
  tools: {
    rspack: (config, utils) => {
      const envName = String((utils as any)?.environment?.name ?? '')
      const isLynxLike = envName.startsWith('lynx') || envName.startsWith('web')
      // 主线程 chunk 保 worklet（真机 fatal 1101 的根因，2026-10-25）：
      //
      // MT 层不跑组件逻辑——worklet-loader-mt 把 App.vue 等脚本改写成只含
      // registerWorklet 的桩，组件依赖只剩 bare import（import 'wot-lynx-ui'）。
      // 而 wot-lynx-ui 的 sideEffects 白名单只有 css/scss/ttf（BG 按需体积的
      // 正确声明），rspack 便把这个「无被消费导出」的 bare import 连同整个
      // 组件子树一起剪掉 → 主线程 worklet 注册表为空 → 真机首帧 hydrate 抛
      // `_workletMap[id].bind of undefined`（error_code 1101）。
      //
      // 曾试过两条更细的路都被 rspack 1.7.12 无视：
      // 1) rule { issuerLayer: 'vue:main-thread', sideEffects: false }——
      //    rule 级 false 被当作未设置（带 test 限定同样无效）；
      // 2) includeWorkletPackages 白名单——它只解决「loader 剔除 import」
      //    这一道闸（npm 实装消费者会踩，workspace 源码直连不触发），
      //    保住的 import 随后仍会被 tree-shaking 剪掉。
      // 因此只能对 lynx/web 环境整体关闭 sideEffects 优化。代价：BG 的
      // sideEffects 级 tree-shaking 失效（dev 实测 +~600KB），但
      // usedExports + 压缩仍会剪未用代码；主线程 chunk 从 94KB 恢复到
      // 含全部 31 个 worklet 的 860KB。App 正确性 > demo 包体。
      if (isLynxLike) {
        config.optimization = config.optimization ?? {}
        ;(config.optimization as any).sideEffects = false
      }
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
