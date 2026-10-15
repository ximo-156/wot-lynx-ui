import { defineConfig } from '@lynx-js/rspeedy'

import baseConfig from './lynx.config.ts'

/**
 * device-test 单入口变体配置。
 *
 * rspeedy CLI 不提供 `--entry` 参数（`rspeedy build --help` 仅有
 * --environment / --watch / -c / --env-mode / --no-env / -m / -r），
 * 因此 `dev:device-test` / `build:device-test` 脚本通过 `-c` 指定本文件，
 * 在复用 lynx.config.ts 全部插件与环境配置的前提下，把多入口收敛为
 * device-test 单入口：
 * - dev 时终端只输出 device-test 一个二维码（qrcode 插件按 entry 逐条打印）；
 * - build 时只产出 dist/device-test.lynx.bundle，缩短真机联调构建耗时。
 */
export default defineConfig({
  ...baseConfig,
  source: {
    ...baseConfig.source,
    // 仅保留真机测试清单页入口；main（组件总览）不参与编译
    entry: {
      'device-test': './src/device-test/index.ts'
    }
  }
})
