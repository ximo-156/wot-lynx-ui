import { defineConfig } from '@lynx-js/rspeedy'

import baseConfig from './lynx.config.ts'

/**
 * worklet-repro 单入口变体配置（隔离排查用，不进 build:demo）。
 *
 * 起因：Web 预览里点击时抛
 * `Uncaught TypeError: Cannot read properties of undefined (reading 'bind')`，
 * 定位到 Lynx web-core 事件分发里 `runWorklet?.(s.value, [d])` 那一支
 * （详见 `src/worklet-repro/App.vue` 头部注释）。
 *
 * 与 `lynx.config.device-test.ts` 同一套路：复用 lynx.config.ts 的插件与环境，
 * 只把入口收敛成一个，并且换端口（3100），可以跟主 dev server 同时开。
 *
 *   pnpm --filter wot-lynx-demo exec rspeedy dev -c lynx.config.worklet-repro.ts
 *   → http://localhost:3100/__web_preview?casename=worklet-repro.web.bundle
 */
export default defineConfig({
  ...baseConfig,
  server: {
    ...baseConfig.server,
    port: 3100
  },
  source: {
    ...baseConfig.source,
    entry: {
      'worklet-repro': './src/worklet-repro/index.ts'
    }
  }
})
