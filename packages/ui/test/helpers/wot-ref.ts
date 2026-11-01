/**
 * wot-ref.ts — 官方 wot-ui 2.3.2 参考副本（`.wot-ref/`）可用性判定。
 *
 * 背景：`.wot-ref/` 是**可选的本地对照资产**，被 `.gitignore` 忽略（第 154 行），
 * 从不入库。因此 CI 与全新 clone 上必然缺失。此前 4 个 `wot-parity-*.test.ts`
 * 直接静态 import 该目录，缺失时整条 suite 在收集阶段抛 ENOENT —— 这不是回归，
 * 但会让流水线**永远无法变绿**，掩盖真实失败。
 *
 * 约定：任何依赖 `.wot-ref/` 的用例必须显式跳过，用
 *
 *   import { hasWotRef, WOT_REF_COMPONENTS_DIR } from '../helpers/wot-ref'
 *   describe.skipIf(!hasWotRef())('official parity', () => { ... })
 *   it.skipIf(!hasWotRef())('...', () => { ... })
 *
 * 静态 import 无法被 skipIf 保护（模块求值早于用例注册），必须改成
 * 条件顶层 `await import()`，否则 suite 收集阶段仍会抛错。
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/** `.wot-ref/src-2.3.2` */
export const WOT_REF_DIR = resolve(__dirname, '../../../.wot-ref/src-2.3.2')

/** `.wot-ref/src-2.3.2/components` */
export const WOT_REF_COMPONENTS_DIR = resolve(WOT_REF_DIR, 'components')

/** 参考副本是否可用。false 时所有 parity 对照用例应整体跳过 */
export function hasWotRef(): boolean {
  return existsSync(WOT_REF_COMPONENTS_DIR)
}
