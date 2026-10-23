# ADR-021 测试环境复用 + 按耗时 LPT 分片

- **状态**：已采纳
- **日期**：2026-10-23
- **相关**：`packages/ui/vitest.config.ts`、`packages/ui/test/setup.ts`、`scripts/test-shard.mjs`、`packages/ui/test/durations.json`、`packages/ui/test/project-coverage.test.ts`、`packages/ui/src/icons/registry.ts`（`__resetIconRegistry`）、`.github/workflows/ci.yml`
- **依赖**：ADR-017（meta 是源码的函数，不涉及但同属「契约机器化」脉络）

## 背景

架构评审把「测试慢」记为 P2 问题：

> **测试慢**：85 个测试文件，`environment` 是主要开销

2026-10 实测（86 文件 / 1293 用例 / 8 核 26GB）：

```
Duration 110.46s
  transform   ~16s
  setup       ~10s
  collect   136.07s
  tests      ~74s
  environment 255.34s   ← 每文件 ≈3s
```

单文件对照最能说明问题：`theme-presets.test.ts` 跑 6 个用例用 **182ms**，但文件总
耗时 **4.15s** —— 其中 `environment` 1.31s、`collect` 986ms。**环境搭建是真实逻辑的
21 倍**。也就是说，套件时长主要由「文件数 × 每文件环境成本」决定，与被测逻辑无关。

两个方向可以改善：

1. **降低每文件的环境成本**（复用）；
2. **把文件摊到更多机器上**（分片）。

方向 2 有个容易被忽略的前提：**CI 的墙钟由最慢分片决定**，所以分片是否均衡比是否
分片更重要。

## 决策

### 1. 关闭文件隔离，复用环境 —— **必须写在根 `test` 上**

```ts
// packages/ui/vitest.config.ts
export default defineConfig({
  test: {
    isolate: false,          // ← 根层，生效
    projects: [
      { test: { name: 'unit', /* ... */ } },
      { test: { name: 'component', /* ... */ } }  // ← 写在这里不生效
    ]
  }
})
```

一个 worker 连续跑多个文件，`test/setup.ts`（JSDOM + `LynxTestingEnv` + 双线程切换
+ vue-lynx 运行时导入）只执行一次。

| 配置 | Duration | environment 累计 |
|---|---|---|
| `isolate: true`（原） | 110.46s | 255.34s |
| **根 `test.isolate: false`** | **33.35s** | **24.03s** |

先做过一个排除性实验，避免把功劳记错：用 29 个文件（> worker 数）对比
`--no-isolate`，44.26s → 23.51s，470 个用例全过。**收益不是「少启动进程」，而是
JSDOM + LynxTestingEnv 不再每文件重建一次。**

#### ⚠️ 踩到的坑：写在 project 内部会被静默忽略

首版把 `isolate: false` 写在 component project 的 `test` 里，然后量出 34s 就以为成了。
实际上那几次 34s 全部来自命令行 `--no-isolate`，**配置那一行从未生效**。对照实验：

| 配置 | Duration | environment 累计 |
|---|---|---|
| project 内 `isolate: false` | 113.88s | 274.49s |
| project 内 + `--isolate` | 100.69s | 238.85s |
| project 内 + `--no-isolate`（CLI） | **30.60s** | **25.32s** |
| 根 `test.isolate: false`（无 CLI 参数） | **33.35s** | **24.03s** |

`113.88s` 与 `100.69s` 几乎一样，说明那一行完全没被读取——不是「被覆盖」，是「没生效」，
而且**不报任何警告**。

这个坑对本文档的方法论意义大于性能意义：当时 `test/project-coverage.test.ts` 里写了
`expect(component.isolate).toBe(false)`，它一直是绿的，因为它断言的是**配置值**而不是
**行为**。配置值对、行为不对，这类失效只能靠量耗时发现。现在那条断言改为断言根层
位置，并额外断言「project 内部没有重复写一份」，避免后人以为那里才是生效位置。

### 2. 前提：测试文件之间不能有可变全局状态耦合

关掉隔离意味着模块级单例不再随文件结束而消失。这个前提**不能用「跑一次绿了」证明**
—— 一次跑绿只说明「这一次的顺序恰好没撞上」。取证方法是打乱文件顺序、换多个 seed：

```bash
npx vitest run --sequence.shuffle.files --sequence.seed=7
```

注意必须用 `--sequence.shuffle.files` 而不是 `--sequence.shuffle`：后者会连**文件内
的用例**一起打乱，`icons-registry.test.ts` 里「先断言集合恰好两个、再注册临时集合」
的写法就会红 —— 那是文件内顺序依赖（正常且无害），不是跨文件泄漏，混在一起会误判。

取证结果（修复前）：

| seed | 失败文件 | 失败用例 | 结论 |
|---|---|---|---|
| 默认 | 5 | 8 | 基线（`.wot-ref` 缺失的已知项） |
| 1 | 5 | 8 | 干净 |
| **7** | **6** | **9** | 多 1 条 |
| **42** | **6** | **8** | 多 1 个文件 |

多出来的是 `icons-registry.test.ts` 的两条 `listIconSets()` 断言。根因：`tier1-basic`
与 `wot-parity-icon-grid-pagination-additional` 都调用 `registerIconSet` 注册临时集合，
**从不注销**（`Map` 没有删除入口）。隔离时无害，复用后污染后续文件。

修复：`src/icons/registry.ts` 增加 `__resetIconRegistry()`，由 `setup.ts` 的
`beforeEach` 调用。它**不从 `src/index.ts` 导出**——不属于公开 API，调用方只有测试。
安全性依据是「所有 `registerIconSet` 都在单个 `it` 内部完成注册与断言」（逐个核对过）。

修复后 4 个 seed（1 / 7 / 42 / 99）全部回到基线 5 文件 / 8 用例。

### 3. 用 LPT 装箱分片，而不是 `--shard`

内建 `--shard=i/N` 的算法是「收集顺序上取 `i % N`」，即**按文件个数**均分。测试文件
耗时差两个数量级（20.7s 的 `event-registry-all-components` vs 0.02s 的纯函数），
按个数均分等于按个数不均分。同一份耗时数据模拟 4 片：

| 方案 | 片 1 | 片 2 | 片 3 | 片 4 | 最慢片 vs 均值 |
|---|---|---|---|---|---|
| 内建 `--shard` | 45.6s | 35.1s | 37.1s | **69.7s** | **+49%** |
| LPT 装箱 | 46.9s | 46.9s | 46.9s | 46.9s | 0% |

`scripts/test-shard.mjs` 用 LPT（耗时降序，每个文件放进当前最轻的片）。这是多机调度
的经典 4/3 近似算法，平手时取索引更小的片以保证可复现。

### 4. 正确性与性能分开保证

分片最危险的失效方式是**静默漏跑**：某天新增一个测试文件，分片清单来自过期缓存，
那个文件永远不在任何一片里，CI 依然全绿。

所以：

- **不漏跑**：分片清单由 `collectTestFiles()` **现场扫描** `packages/ui/test/` 得到，
  不读任何缓存。`assignShards()` 结束前断言「每个文件恰好出现一次」，失败直接 throw。
- **均衡**：权重来自 `test/durations.json`（`--update` 生成，入库）。缓存过期只会让
  分片不均，不会让文件漏跑；缓存里没有的文件回落到默认权重并告警。

`test/project-coverage.test.ts` 再从外部独立验证一次：对 1/2/3/4/6/8 片分别检查
「并集 == 全部文件、无重复」。

## 为什么不自己实现 glob 匹配（一次真实的失败）

`project-coverage.test.ts` 首版用 `**` → `.*`、`*` → `[^/]*` 模拟 vitest 的 glob，
用来判断「某文件被哪个 project 收下」。第一次运行就被 `configDefaults.exclude` 里的
`**/.{idea,git,cache,output,temp}/**` 拦下（不支持花括号）。

**扩展模拟器是错的方向。** 守卫脚本最危险的失效方式是它自己算错了却仍然判绿，而 glob
的语义（花括号展开、extglob、否定、`.` 开头文件、大小写）远比看起来复杂。

改成断言配置的**结构**，让覆盖性成为推论：

```
unit.include 全是精确路径（无通配符）且都真实存在
component.include === ['test/**/*.test.ts']              ← 收下整个 test/ 目录
component.exclude === configDefaults.exclude ++ PURE_TESTS ← 只排除纯函数用例
```

三条同时成立时「每个文件恰好归一个 project」是集合论上的必然，不需要模拟。
三条断言都做了负向验证（把 `isolate` 改回 `true`、收窄 `include`、少排除一条
`PURE_TESTS`），确认各自会红在对应的断言上。

## 顺带清掉的死代码

`test/mts-worklet-shim.ts` 里有三个零调用点的符号：`resetWorkletRegistry()`（被
`setup.ts` import 但从未调用）、`trackElement()`（零调用点）、`elementBySign`
（只被 `trackElement` 写、从未被读）。

值得单独说明的是 `resetWorkletRegistry` 为什么**不能**按用例调用：`registry` 由
`mtsWorkletPlugin` 在 **SFC 模块求值时**填充（把 `'main thread'` 函数包成
`__wdWl(fn)`），不是按用例注册。一旦清空，同一 worker 内后续文件的 worklet 上下文
全部失效（`ctx` 为 `null` → `applySetWorkletEvent` 崩）。关掉隔离后这个陷阱更危险，
所以在 `setup.ts` 的复位段里写了明确注释。

## 后果

**收益**

- 全量测试 110s → 33s（本机，87 文件 / 1302 用例），CI 4 分片后单 job 约 35s。
- 新增文件不可能被静默漏跑（两处独立断言）。
- 关掉隔离这个决定本身被 `project-coverage.test.ts` 锁住，不会「为排查问题临时打开、
  然后忘了改回来」——那会让全量退回 110s 且没有任何测试变红。

**代价 / 已知限制**

- **顺序无关是维护责任**：新增「测试会写、生产不撤销」的全局注册表时，必须在
  `setup.ts` 的 `beforeEach` 里复位。目前只有图标注册表一处。
- **一个已知的偶发失败（未修）**：`test/signature-mts.test.ts` 的第一条用例
  「touchmove 经主线程 worklet 直改线段池」在约 12 次全量运行中出现 2 次。
  这条用例本身已有 3 次重试，注释写明「测试环境的 worklet 事件偶发丢失（与产品
  逻辑无关）」——关闭隔离后单 worker 承载更多文件，事件调度被挤掉的概率上升。
  **刻意没有加更多重试**：无法复现就无法验证修复，而给时序测试加重试很容易把
  真实回归一起盖住。若它开始稳定复现，先查 `waitFor` 的 `attempts` 是否被耗尽，
  再看 `__wdRectStub` / `createSelectorQuery` 是否被前一个文件留在非预期状态。
- **分片均衡依赖 `durations.json` 的时效**：新增重量级测试后应跑
  `pnpm test:shard:update`，否则均衡度下降（但不会漏跑）。
- **只在 8 核 26GB 的 Windows 上测过**。CI 是 2 核 runner，分片数 4 是「比核数多」
  的过订阅配置，需在真实 CI 上观察后再调。
- **`isolate` 只能在根层设置**，且失效时不报警告。升级 vitest 后应重跑一次对照
  （`--no-isolate` 与纯配置各跑一遍，比 `environment` 累计值），确认这条没有回退。

## 推翻条件

- CI runner 核数 ≥ 分片数时，过订阅带来的调度开销可能抵消收益 —— 若实测单 job 时长
  不再随分片数下降，减少分片数。
- 若后续引入 `pool: 'threads'` 或 `--experimental-vm-modules` 使环境搭建成本降到
  百毫秒级，关闭隔离的前提（用复杂度换 3s）不再划算，应恢复 `isolate: true`。
- 若出现无法用「复位注册表」解决的跨文件耦合（例如组件模块级缓存了渲染状态），
  应恢复隔离，改为只对纯函数文件做批处理。
