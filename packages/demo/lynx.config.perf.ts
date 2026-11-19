import { defineConfig } from '@lynx-js/rspeedy'
import baseConfig from './lynx.config.ts'

/** 隔离性能入口；输出到独立目录，避免覆盖常规 Demo 构建。 */
export default defineConfig({
  ...baseConfig,
  output: { ...baseConfig.output, distPath: { root: 'dist/perf' } },
  source: { ...baseConfig.source, entry: { perf: './src/perf/index.ts' } }
})
