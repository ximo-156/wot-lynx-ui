# ADR-011 声明式 MTS 为跟手交互唯一形态

- **状态**：已采纳（已落地）
- **日期**：2026-10-19（代码）／ 2026-10-22（留痕）
- **取代**：[ADR-009 零 MTS](./009-zero-mts.md)
- **相关**：`CONVENTIONS §10`、`CONVENTIONS §21`、`js/mts-imperative` lint 规则

## 背景

ADR-009 全面禁用 MTS 后，跟手交互（拖动 / 滑动 / 缩放 / 手势）全部走后台线程：每帧两次线程往返，低端机上手感明显滞后。

`7658d0c`（全组件原生优先重写）改用 Lynx 官方**声明式** MTS，实测跟手性显著改善，且未复现 ADR-009 记录的崩溃路径。

## 决策

**跟手交互必须走声明式 MTS，这是唯一允许的形态**：

```vue
<script lang="ts" setup>
import { useMainThreadRef } from 'vue-lynx'
const trackRef = useMainThreadRef()
const onTouchMove = (e: any) => {
  'main thread'
  const el = trackRef.current
  if (!el) return
  el.setStyleProperty('transform', `translateX(${e.touches[0].clientX}px)`)
}
</script>
<template>
  <view :main-thread-ref="trackRef" main-thread-bindtouchmove="onTouchMove" />
</template>
```

规则（详见 `CONVENTIONS §10`）：

1. worklet 内**只做**跟手计算 + `setStyleProperty` 直改；提交类状态（change / confirm / 落定值）回后台线程经 `emit` 上调。
2. **禁止命令式** `runOnMainThread` / `runOnBackground`：其 worklet 消费 `useMainThreadRef.current` 依赖 `INIT_MT_REF` ops 先于 worklet 应用，两通道无顺序保证 → 真机 1101 崩溃。声明式由框架建树时注册，不经该竞态路径。
3. **禁止 `lynxWorkletImpl` 可用性检测**（后台线程恒 `undefined`，只会写出双份代码）。
4. 跟手期间禁用 CSS `transition`（显式写 `none`），落位时恢复或用主线程 `requestAnimationFrame` 吸附。
5. 度量（轨道宽度等）仍遵守 `CONVENTIONS §16`：挂载后 `getRect` 一次并缓存。
6. **worklet 之间禁止互相引用**（`CONVENTIONS §21`）：编译产物会逐个注册到主线程，互相引用导致注册顺序依赖。

## 后果

**正面**

- 跟手交互零线程跨越，性能接近原生。
- 组件不再需要「后台线程 + 主线程」双份交互代码。

**负面**

- worklet 内不能使用后台线程的响应式状态，状态设计必须区分「跟手瞬时值」与「提交值」。
- 测试需要 `test/mts-worklet-shim.ts` 模拟主线程派发（已提供）。

## 推翻条件

- Lynx 提供「后台线程直改样式」的零延迟通道 → 可放弃 MTS（需引擎版本 ADR）。
- 声明式 MTS 出现与 ADR-009 同类的竞态崩溃 → 记录真机证据后重新评估。
