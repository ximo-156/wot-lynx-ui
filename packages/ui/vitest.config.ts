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
      // 覆盖两个组件根：L3.5 基础件（src/primitives）与 L4 业务组件（src/components）。
      // ⚠️ 新增组件根时必须同步这里，否则该根的 worklet 不会被包装，
      //    主线程事件 ctx 为 null → applySetWorkletEvent 崩（`_workletType` on null）。
      //    分层依据见 docs/adr/012-primitives-layer.md。
      if (!/\/src\/(?:components|primitives)\//.test(id) || !id.endsWith('.vue')) return null
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
  'test/api-diff.test.ts',
  'test/codemod.test.ts',
  'test/format-date.test.ts',
  'test/interceptor.test.ts',
  'test/locale-parity.test.ts',
  'test/meta-generated.test.ts',
  'test/no-main-thread-script.test.ts',
  'test/png-codec.test.ts',
  'test/project-coverage.test.ts',
  'test/qr-encoder.test.ts',
  'test/side-effects.test.ts',
  'test/style-funnel.test.ts',
  'test/tag-transform-loader.test.ts',
  'test/theme-token-parity.test.ts',
  'test/util-merge.test.ts',
  'test/visual-diff.test.ts',
  'test/web-font-plugin.test.ts'
]

export default defineConfig({
  plugins: [],
  define: {
    __DEV__: 'true',
    __VUE_LYNX_AUTO_PIXEL_UNIT__: 'true'
  },
  test: {
    /**
     * 环境复用：一个 worker 连续跑多个测试文件，`test/setup.ts` 只执行一次。
     *
     * ⚠️ **必须写在根 `test` 上，写在 project 内部会被静默忽略。**
     *    2026-10 实测（71 个组件文件 / 8 核）：
     *      project 内 isolate:false      → 113.88s，environment 累计 274.49s
     *      根 test.isolate = false       →  30.60s，environment 累计  25.32s（本行）
     *      仅 CLI --no-isolate           →  30.60s（与上面等价，可作交叉验证）
     *    差异是「配置看着对、行为没变」：断言配置值发现不了，只有量耗时能发现。
     *    `test/project-coverage.test.ts` 会断言这一行的位置（根层），并说明原因。
     *
     * 收益来源不是「少启动进程」，而是 JSDOM + LynxTestingEnv 每文件重建一次的
     * ≈3s —— 它比单个文件里真正要验的逻辑（中位数 < 300ms）大一个数量级。
     * 关掉隔离后这份成本摊到整个 worker。
     *
     * ⚠️ 代价：模块级状态不再随文件结束而消失。前提是「测试文件之间没有可变
     *    全局状态耦合」，这不是靠一次跑绿就能证明的，必须用
     *    `--sequence.shuffle.files` 多 seed 取证（ADR-021）。新增「测试会写、
     *    生产不会撤销」的全局注册表时，记得在 setup.ts 的 beforeEach 里复位。
     */
    isolate: false,
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
