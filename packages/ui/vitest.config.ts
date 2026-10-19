import { configDefaults, defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

// Lynx 原生元素集合（与 vue-lynx 编译器的 isNativeTag: () => true 对齐）。
// 测试环境使用标准 @vitejs/plugin-vue，需显式声明这些标签为自定义元素，
// 否则 scroll-view / swiper / svg 等会被当作未注册组件而告警、不渲染。
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

/**
 * 纯函数 / 静态数据测试：不渲染组件、不 import vue-lynx，无需双线程环境。
 *
 * 拆成独立 project 的原因（ARCHITECTURE §3.9 / Phase 1.6）：`test/setup.ts` 会为
 * **每个测试文件**新建 JSDOM + LynxTestingEnv，单文件环境开销约 20s；而这类用例
 * 本身只有几毫秒。混在一起时，套件时长由「环境搭建 × 文件数」决定，与真正要
 * 验证的逻辑无关——2026-10 实测 36 个文件 214s，其中 environment 累计 745s。
 */
const PURE_TESTS = [
  'test/format-date.test.ts',
  'test/interceptor.test.ts',
  'test/locale-parity.test.ts',
  'test/no-main-thread-script.test.ts',
  'test/qr-encoder.test.ts',
  'test/side-effects.test.ts',
  'test/style-funnel.test.ts',
  'test/tag-transform-loader.test.ts',
  'test/theme-token-parity.test.ts',
  'test/util-merge.test.ts'
]

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag: string) => LYNX_NATIVE_TAGS.has(tag)
        }
      }
    })
  ],
  define: {
    __DEV__: 'true',
    __VUE_LYNX_AUTO_PIXEL_UNIT__: 'true'
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          globals: true,
          include: PURE_TESTS,
          setupFiles: []
        }
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          globals: true,
          setupFiles: [path.resolve(__dirname, 'test/setup.ts')],
          include: ['test/**/*.test.ts'],
          exclude: [...configDefaults.exclude, ...PURE_TESTS]
        }
      }
    ]
  },
  resolve: {
    alias: [
      {
        find: 'vue-lynx/entry-background',
        replacement: path.resolve(__dirname, 'node_modules/vue-lynx/runtime/dist/entry-background.js')
      },
      {
        find: 'vue-lynx/main-thread',
        replacement: path.resolve(__dirname, 'node_modules/vue-lynx/main-thread/dist/entry-main.js')
      },
      {
        find: 'vue-lynx/internal/ops',
        replacement: path.resolve(__dirname, 'node_modules/vue-lynx/internal/dist/ops.js')
      },
      {
        find: /^vue-lynx$/,
        replacement: path.resolve(__dirname, 'node_modules/vue-lynx/runtime/dist/index.js')
      }
    ]
  }
})
