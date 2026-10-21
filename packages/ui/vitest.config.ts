import { configDefaults, defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Main Thread Script 测试垫片（仅 vitest 生效，不进生产构建）。
 *
 * 生产构建中 Rspeedy 的 SWC worklet 转换把 `'main thread'` 指令函数改写为
 * 可序列化 worklet 上下文；vitest 没有该转换，这里以后置 transform 模拟：
 * 把含 `'main thread'` 指令的箭头函数定义包一层 __wdWl()（注册并返回
 * JSON 可序列的 worklet 上下文），使 main-thread-bind* 事件在双线程测试
 * 环境中可被真实派发（见 test/mts-worklet-shim.ts）。
 */
function mtsWorkletPlugin() {
  const SHIM = path.resolve(__dirname, 'test/mts-worklet-shim.ts')
  return {
    name: 'wot-lynx-mts-worklet-shim',
    enforce: 'post' as const,
    transform(code: string, id: string) {
      if (!id.includes('/src/components/') || !id.endsWith('.vue')) return null
      // SFC 编译器会把指令字符串规范成双引号，两种引号都认
      if (!code.includes("'main thread'") && !code.includes('"main thread"')) return null

      // 1) 收集所有 `'main thread'` 指令函数名（const NAME = ... => { 'main thread'）
      const mtNames = new Set<string>()
      const defRe = /\b(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>\s*\{\s*['\"]main thread['\"]/g
      let m: RegExpExecArray | null
      while ((m = defRe.exec(code)) !== null) mtNames.add(m[1])
      if (mtNames.size === 0) return null

      // 2) 在 script-setup 的返回对象上把这些名字包成 worklet 上下文：
      //    const __returned__ = { a, onTapMt, b }  →  { a, onTapMt: __wdWl(onTapMt), b }
      //    （模板经 $setup.onTapMt 读取，包装点唯一且无需括号配对）
      //    返回对象可能含 getter/setter（模板引用导入绑定或顶层 let 时编译器生成），
      //    必须按花括号配平提取对象体，不能用 [^}]* 正则（会静默失配 → worklet
      //    不包装 → 主线程事件 ctx 为 null → applySetWorkletEvent 崩溃）。
      const marker = 'const __returned__ = '
      const mi = code.indexOf(marker)
      if (mi === -1) return null
      const objStart = code.indexOf('{', mi + marker.length)
      if (objStart === -1) return null
      let depth = 0
      let objEnd = -1
      for (let i = objStart; i < code.length; i++) {
        const ch = code[i]
        if (ch === '{') depth++
        else if (ch === '}') {
          depth--
          if (depth === 0) {
            objEnd = i
            break
          }
        }
      }
      if (objEnd === -1) return null
      const body = code.slice(objStart + 1, objEnd)
      // 按顶层逗号切分（跳过 getter/setter 体内的逗号与花括号）
      const entries: string[] = []
      let d = 0
      let cur = ''
      for (const ch of body) {
        if (ch === '{' || ch === '(' || ch === '[') d++
        if (ch === '}' || ch === ')' || ch === ']') d--
        if (ch === ',' && d === 0) {
          entries.push(cur)
          cur = ''
        } else {
          cur += ch
        }
      }
      if (cur.trim()) entries.push(cur)
      let changed = false
      const wrapped = entries
        .map((entry) => {
          const t = entry.trim()
          if (mtNames.has(t)) {
            changed = true
            return `${t}: __wdWl(${t})`
          }
          return entry
        })
        .join(',')
      if (!changed) return null
      const out = code.slice(0, objStart + 1) + wrapped + code.slice(objEnd)

      const rel = path.relative(path.dirname(id), SHIM).split(path.sep).join('/')
      const importLine = `import { registerMainThreadFn as __wdWl } from '${rel.startsWith('.') ? rel : './' + rel}';\n`
      return { code: importLine + out, map: null }
    }
  }
}

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
  'test/util-merge.test.ts',
  'test/web-font-plugin.test.ts'
]

export default defineConfig({
  plugins: [],
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
        plugins: [vue({
          template: {
            compilerOptions: {
              isCustomElement: (tag: string) => LYNX_NATIVE_TAGS.has(tag)
            }
          }
        }), mtsWorkletPlugin()],
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
