/**
 * 预设主题按需分发（ADR-016）。
 *
 * 契约：
 * 1. **主主题不含预设**。`wot-lynx-ui/theme` 只提供 base 刻度 + light/dark；
 *    `brand-a` 会把 `--wot-primary-*` 整体改成紫色品牌色，默认发给所有消费者
 *    等于替他们做品牌决策。
 * 2. **每个预设文件可单独编译**。`presets/brand-a.scss` 编译结果必须自带
 *    `.wot-theme-brand-a` 规则，否则 `import 'wot-lynx-ui/theme/presets/brand-a'`
 *    拿到的是空 CSS —— 而且不会报错，只是「主题没生效」。
 * 3. **类名与运行时一致**。`WdConfigProvider` 拼的是
 *    `wot-theme-${theme}`，预设 CSS 的选择器必须与之同源，否则 `theme="brand-a"`
 *    永远命中不到规则。
 *
 * 测试直接编译 SCSS（而不是读 index.css），因此不依赖 `pnpm build:css`
 * 是否先跑过，在干净检出上也能通过。
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { compile } from 'sass'
import { h } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import ConfigProvider from '../src/components/wd-config-provider/wd-config-provider.vue'

const THEME_DIR = path.resolve(__dirname, '..', 'src/styles/theme')

/** 编译单个 SCSS 入口，返回压缩后的 CSS */
function compileScss(relPath: string): string {
  return compile(path.join(THEME_DIR, relPath), { style: 'compressed' }).css
}

/** 该 CSS 里出现过的主题类名 */
function themeClasses(css: string): string[] {
  return [...new Set(css.match(/\.wot-theme-[a-z-]+/g) || [])].sort()
}

const PRESETS = [
  { name: 'brand-a', className: '.wot-theme-brand-a' },
  { name: 'compact', className: '.wot-theme-compact' },
  { name: 'high-contrast', className: '.wot-theme-high-contrast' }
] as const

describe('预设主题按需分发', () => {
  it('主主题只含 light/dark，不含任何预设', () => {
    const classes = themeClasses(compileScss('index.scss'))
    expect(classes, '主主题必须提供亮/暗两套语义令牌').toEqual(['.wot-theme-dark', '.wot-theme-light'])
  })

  for (const preset of PRESETS) {
    it(`presets/${preset.name}.scss 单独编译后只含自己的类`, () => {
      const classes = themeClasses(compileScss(`presets/${preset.name}.scss`))
      expect(classes, `${preset.name} 必须自带类名规则，否则单独引入会得到空 CSS`).toEqual([preset.className])
    })
  }

  it('presets/index.scss 聚合三个预设', () => {
    const classes = themeClasses(compileScss('presets/index.scss'))
    expect(classes).toEqual([
      '.wot-theme-brand-a',
      '.wot-theme-compact',
      '.wot-theme-high-contrast'
    ])
  })

  it('ConfigProvider 的 theme 类名与预设选择器同源', async () => {
    // theme="brand-a" 应产出 wot-theme-brand-a —— 与 presets/brand-a.css 的选择器一致。
    // 若任一侧改名，这个断言会同时暴露两边对不上。
    const { container } = render({
      setup: () => () => h(ConfigProvider as any, { theme: 'brand-a' }, { default: () => 'x' })
    } as any)
    await pause(20)

    const root = container.querySelector('.wot-theme-brand-a')
    expect(root, 'ConfigProvider 必须把 theme 拼成 wot-theme-<name> 类').not.toBeNull()
    cleanup()
  })
})
