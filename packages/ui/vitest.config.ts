import { defineConfig } from 'vitest/config'
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
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(__dirname, 'test/setup.ts')],
    include: ['test/**/*.test.ts']
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
