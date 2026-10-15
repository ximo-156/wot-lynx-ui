import baseConfig from './vitest.config'
import path from 'node:path'

/**
 * 临时验证配置：在既有双线程测试环境基础上，把 demo 包的 'wot-lynx-ui'
 * 导入别名到本包源码，用于挂载 demo 页面做「挂载即视」检查。
 */
export default {
  ...baseConfig,
  resolve: {
    ...baseConfig.resolve,
    alias: [
      ...(baseConfig.resolve?.alias || []),
      {
        find: /^wot-lynx-ui\/theme$/,
        replacement: path.resolve(__dirname, 'src/styles/theme/index.css')
      },
      {
        find: /^wot-lynx-ui$/,
        replacement: path.resolve(__dirname, 'src/index.ts')
      }
    ]
  },
  test: {
    ...baseConfig.test,
    include: ['test/demo-popup-verify.test.ts']
  }
}
