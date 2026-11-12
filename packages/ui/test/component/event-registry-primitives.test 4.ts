/**
 * 事件注册表全覆盖回归测试 — CONVENTIONS §14（基础件，ADR-023 拆分后独立范围）。
 *
 * 基础件（@wot-lynx/primitives）是高 fan-in 叶子件，被全部业务组件依赖，
 * 同样必须满足「绑定全部原生事件后挂载 + 全元素派发不崩溃」契约。
 * 背景与做法见 event-registry-all-components.test.ts 头注释，
 * 共享逻辑在 helpers/event-registry-suite.ts。
 *
 * 与业务组件拆成两个文件的原因：一次 eager 导入全部 106 个 SFC 会超出
 * vitest worker 默认堆上限（实测 OOM）；按包分担后面罩再宽也有界。
 */
import { runEventRegistrySuite } from '../helpers/event-registry-suite'

const modules = import.meta.glob('../../../primitives/src/wd-*/wd-*.vue', { eager: false })
const entries = Object.entries(modules)

runEventRegistrySuite('基础件', entries)
