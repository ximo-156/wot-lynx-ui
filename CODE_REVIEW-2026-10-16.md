# wot-lynx-ui 代码审查报告 — 性能瓶颈与潜在 Bug

审查范围：`packages/ui/src`（约 27,000 行，110+ 组件 + common/composables）
审查日期：2026-10-16
审查方式：静态通读 + 关键函数转译后实证验证（`common/util.ts` 的 4 个缺陷已用真实代码跑通复现）

---

## 一、已实证确认的缺陷（P0）

以下 4 条不是推测，是把 `packages/ui/src/common/util.ts` 用 tsc 转译成 JS 后实际执行得到的输出。

### P0-1 `deepMerge` 无法覆盖数组、无法置 null

- 位置：`packages/ui/src/common/util.ts:628`（`deepMerge`）、`:26`（`isObj`）
- 实测输出：

  | 调用 | 实际结果 | 期望 |
  | --- | --- | --- |
  | `deepMerge({buttons:[1,2,3]}, {buttons:[9]})` | `[9,2,3]` | `[9]` |
  | `deepMerge({a:{x:1}}, {a:null})` | `{a:{x:1}}` | `{a:null}` |
  | `isObj(null)` | `true` | `false` |
  | `isObj([])` | `true` | `false` |

- 根因：`isObj` 写成了 `toString === '[object Object]' || typeof value === 'object'`。后半句让 `null` 和数组都成为「对象」，于是 `deepMerge` 对它们走递归合并分支：
  - 数组：`deepClone(target)` 得到 `[1,2,3]`，再按 index 逐位覆盖 → 尾元素残留、长度不会收缩；
  - `null`：`isObj(null)` 为真 → 递归合并 `null`（空循环）→ 返回 target 原值，**永远无法把某个选项置空**。
- 影响面：所有命令式弹层的选项合并 —— `wd-dialog/index.ts:37,44`、`wd-dialog/wd-dialog.vue:178,182`、`wd-toast/index.ts:38,44,45`、`wd-notify/index.ts:33,62,63`。消费方传数组型选项（按钮列表等）会与默认值「逐位混合」；传 `null` 想关掉某个选项无效。
- 建议修复：

  ```ts
  export function isObj(value: any): value is object {
    return Object.prototype.toString.call(value) === '[object Object]'
  }
  ```

  并在 `deepMerge` 中显式区分数组（直接替换，不递归）。

### P0-2 `debounce({ leading: true })` 单次调用会触发两次

- 位置：`packages/ui/src/common/util.ts:684`
- 实测：`debounce(fn, 50, {leading:true, trailing:true})` 只调用 1 次 → `fn` 执行 **2 次**。
- 根因：`leading` 已在首次调用时立即执行，但 50ms 后的定时器仍无条件 `invoke(lastArgs)`。lodash 语义是「仅当 wait 窗口内被调用超过 1 次才补 trailing」。
- 修复：leading 执行后把 `lastArgs` 置空（或用一个 `leadingInvoked` 标志决定 trailing 是否执行）。
- 备注：`debounce` / `throttle` 在仓库内暂无调用点，属对外导出的公共 API 缺陷，但仍会污染使用方。

### P0-3 `wd-segmented` 选中首项时滑块不归位

- 位置：`packages/ui/src/components/wd-segmented/wd-segmented.vue:71-77`

  ```ts
  const left = rects.slice(0, state.activeIndex).reduce(...)
  if (left) {                       // ← left === 0 时整条 transform 被省略
    style.transform = `translateX(${left}px)`
  }
  ```

- 问题：`activeIndex` 回到 0 时 `left === 0`（falsy），`transform` 不写入。而 Lynx 的 `SetStyle` / `__SetInlineStyles` 是**逐属性合并**语义——省略一个键**不会**清除元素上已应用的内联属性。
- 语义证据（仓库内已有真机结论，非本人推测）：
  - `packages/ui/test/overlay-chain-regression.test.ts:13-18`：*"wd-transition 用「键的增减」表达 display 状态……但 Lynx SetStyle / __SetInlineStyles 是合并语义（引擎 PAPI 镜像与 Web 预览运行时均 Object.assign 逐属性合并），删键不会清除元素上已应用的内联属性 → ……挂载即带 display:none，此后永远不可见"*（2026-10-15 真机核实）。
  - `wd-swipe-action.vue:51-59`：跟手时段必须显式写 `transition: 'none'`，同理。
  - 调用链已核实：BG `pushOp(SET_STYLE, id, styleObject)` → MT `ops-apply.js:124-131` → `__SetInlineStyles(el, value)`（`vue-lynx/main-thread/dist/ops-apply.js`）。
- 结论：**`wd-segmented` 的 `if (left)` 与上述已确认缺陷是完全相同的反模式**。`wd-transition` 踩过一次，segmented 是同一坑的第二处。
- 复现路径：点击第 2 项 → 再点击第 1 项，滑块仍停在第 2 项下方。
- 修复：无条件写入 `style.transform = \`translateX(${left}px)\``。
- 建议顺手全库排查同类写法（`if (x) style.y = ...` 形式的条件写样式），这是该引擎下反复出现的缺陷类型。

### P0-4 `wd-tabs` 指示线首帧定位失效

- 位置：`packages/ui/src/components/wd-tabs/wd-tabs.vue:111-125`
- 问题：`updateLineStyle()` 只在 `watch(() => props.modelValue, ..., {immediate: true})` 中调用。`immediate` 使其在 **setup 阶段**就发起 `getRect`，此时节点尚未挂载，度量得到零尺寸；而 `onMounted` 只做了 `state.activeIndex = activeIndex.value` / `renderedSet.add` / `inited = true`，**没有再调一次 `updateLineStyle()`**，此后也不会重算。
- 后果：首屏指示线宽度为 0 或位置错位，直到用户手动切 tab 才恢复。
- 修复：`onMounted` 中补调 `updateLineStyle()`（必要时 `nextTick` 后再测一次）。

---

## 二、性能瓶颈

### PERF-1 `wd-picker-view` 拖拽热路径每帧上百次对象/字符串分配

- 位置：`wd-picker-view.vue:110-115`（`getItemClass`）、`:101-108`（`columnTransform`）、模板 `:256-265`
- 在 `immediateChange` 模式下，每个 `touchmove` 都会改写 `selectedIndex` → 整列重渲染：
  - `getItemClass()` 每行创建数组 + `join(' ')`；
  - `columnTransform()` 每列创建对象；
  - `:style="{ height: addUnit(itemHeight) }"` 每行创建对象。
- 量级：3 列 × 60 行 ≈ **每帧 180+ 次分配**，叠加跨线程 setStyle 通信，真机滚动明显掉帧。
- 建议：行高样式提为模块级常量对象；`getItemClass` 改为「基础 class 常量 + 仅 active 行追加」的拼接；列 transform 用 `computed` 数组缓存。

### PERF-2 `wd-calendar-view` 模板内联生成时间列，每次渲染新建 144 个对象

- 位置：`wd-calendar-view.vue:356-369`

  ```html
  :columns="[
    Array.from({ length: 24 }, ...),
    Array.from({ length: 60 }, ...),
    ...(hideSecond ? [] : [Array.from({ length: 60 }, ...)])
  ]"
  ```

- 该表达式写在渲染函数里，任何一次重渲染（例如每点选一个日期）都会重建 24+60+60 = **144 个对象**并生成新数组引用；`wd-picker-view` 的 `columns` 被 `deep: true` 的 watch 监听（`picker-view.vue:50-67`），会连带触发列重建与重新格式化。
- 建议：提为 `computed`（依赖 `hideSecond` 即可）。

### PERF-3 `wd-rate` touchmove 可能反复触发跨线程 getRect

- 位置：`wd-rate.vue:125-140`

  ```ts
  if (!itemRects.length) { await refreshRects() }   // 在 touchmove 内
  ```

- 当度量不可用（宿主无 `createSelectorQuery`、节点未渲染、`all` 模式返回 `[]`）时，`itemRects` 恒为空数组 → **每个 touchmove 事件都发起一次 SelectorQuery**，这正是 CONVENTIONS §16 明令禁止的写法。同时 `refreshRects`（`:103`）没有 `isAlive` 守卫，卸载后回调仍会写模块级变量。
- 建议：加「已尝试过度量」的一次性标志；`refreshRects` 内加存活判断。

### PERF-4 `useChildren.sortChildren` 每次 link 都全树遍历 + 排序

- 位置：`packages/ui/src/composables/useChildren.ts:47-67`
- `flattenVNodes(parent.subTree)` 递归遍历整棵子树，`findVNodeIndex` 在 vnodes 上线性查找（未命中返回 `-1`，会让比较器不稳定）；而 `link()` 每注册一个子组件就调用一次 → 收集 N 个子组件整体是 **O(N²) ~ O(N³)**。
- 影响：`wd-checkbox-group` / `wd-radio-group` / `wd-index-bar` 等在大列表（几十~上百项）下首屏明显变慢。
- 建议：改为「先收集、渲染后再统一排序一次」，或用 uid 递增序替代 vnode 查找。

### PERF-5 `wd-index-bar` 索引去重 O(N²) + 受控 `scroll-top` 隐患

- 位置：`wd-index-bar.vue:68-71`、`:123`
- `indexes.filter((i, idx) => indexes.indexOf(i) === idx)` 是 O(N²)；索引项数量少，影响有限。
- 更值得注意的是 `:scroll-top="scrollState.scrollTop"`：`scrollState.scrollTop` **全仓库没有任何赋值点**，恒为 0。`handleTouchMove` 修改 `state.activeIndex` 会触发重渲染并再次下发 `scroll-top: 0`，与同函数内的 `scrollIntoViewById(...)` 相互打架，有把内容拉回顶部的风险。`:123` 的 `@scroll="() => {}"` 也是空实现。
- 建议：移除 `:scroll-top` 绑定，或真实同步滚动位置。

### PERF-6 `wd-watermark` 平铺节点数无上限

- 位置：`wd-watermark.vue:42-56`
- `rows × cols = ceil(容器尺寸 / (width+gutterX)) × ceil(...)`，没有上限钳制。小尺寸水印 + 大容器（如整页水印 750×1600，单元 50px）会产生数百个节点，全页水印场景下可达数千。
- 建议：对 rows/cols 加最大行列数（或总节点数）钳制。

### PERF-7 通用

- `wd-tabs.vue:84-101` `navItems()` 在**模板里调用**，每次渲染都执行 `slots.default()` 创建一批 vnode 并做 `deepEqual` 全量比较（作者有注释说明为规避无限重渲染，属权衡，但仍是每帧成本）。
- `usePopover.ts:149-214` `control()` 每次调用都 `new Map` 构造 12 个 placement 条目 + 大量模板字符串，在弹层显隐/重定位路径上属于可避免的分配。
- `wd-form.vue:32-40` 对 `props.model` 做 `deep: true` 的 watch，大表单每次输入都会深遍历整个 model。

---

## 三、系统性缺陷模式：条件写样式 + SetStyle 合并语义

这是本次审查发现的**最值得成批修复的一类问题**，P0-3 只是其中一个实例。

### 根因

Lynx 的 `SET_STYLE` 走 BG → MT 的 `__SetInlineStyles(el, styleObject)`（调用链见 `vue-lynx/main-thread/dist/ops-apply.js:124-131`），语义是**逐属性合并（Object.assign）**：新对象里**没有出现的键不会清除元素上已应用的内联属性**。因此任何「条件为真才写某个样式键」的写法，在该条件由真转假时都会留下脏值。

仓库已经为此付出过两次代价，并在两处留下了显式注释：

- `test/overlay-chain-regression.test.ts:13-18`（2026-10-15 真机核实）：`wd-transition` 用「删键」表达 `display` 状态 → 元素永久 `display:none`，toast / 遮罩全不可见；修法是在样式里**常带** `display: flex`。
- `wd-swipe-action.vue:51-59`：跟手时段必须**显式写** `transition: 'none'`，否则上一次的落位过渡残留、拖动不跟手。

### 已确认受影响的实例

| 严重度 | 位置 | 脏值 | 触发条件 |
| --- | --- | --- | --- |
| 🔴 P0 | `wd-segmented.vue:71-77` | `transform` | 选中项切回首项（`left === 0` 时不写 transform）—— 即 P0-3 |
| 🔴 高 | `wd-picker-view.vue:101-107` + `:156` | `transition` | `onTouchStart` 置 `transitions[col] = false` → `columnTransform` 省略 `transition` → 上一次 `transform 0.2s` 过渡**残留**。表现为：**首次拖动跟手，之后每次拖动都带 0.2s 缓动、不跟手**。与 swipe-action 已修的缺陷完全同型 |
| 🟡 中 | `wd-toast.vue:63-77` | `top` / `bottom` | `wd-transition` 默认走 v-show 分支（元素常驻，`useVif = destroy && lazyRender` 为 false），因此同一实例从 `position: 'top'` 切到 `'bottom'` 时 `top: 10%` 残留 → 同时存在 top 与 bottom，位置错乱 |
| 🟡 中 | `wd-fab.vue:41-43` | `transform` | `if (offset.x \|\| offset.y)` 才写 transform；`clampToViewport` 在 `maxX/maxY` 为 0（按钮大于视口）时会把 offset 归零 → transform 被省略、旧位移残留，模型与视觉不一致 |
| 💭 低 | `wd-col.vue:26-28`、`wd-text.vue:50-60`、`wd-icon.vue:81-89`、`wd-gap.vue:19-23`、`wd-steps.vue:25-28`、`wd-slider.vue:91,121` | `margin-left` / `color` / `font-size` / `background-color` / `row-gap` / `background` 等 | 同一写法（computed 里条件写键）。这些 prop 在运行时由有值变为无值的场景较少，风险相对低，但**模式相同**，一旦出现「清空 prop」的需求就会复现 |

### 建议

1. **统一修法**：需要「关闭」某个样式时，显式写中性值（`transform: 'translateX(0px)'`、`transition: 'none'`、`display: 'flex'`），而不是省略该键——沿用仓库已有的两处正确范例。
2. **加一条 lint / 回归测试**：扫描 `computed` 中 `if (...) { style[...] = ... }` 形式的条件写样式，或在真机回归里覆盖「条件由真转假」的用例。仓库现有 `inline-style-regression` / `layout-inline-style-regression` 只断言「样式非空」，抓不到这类回归（`overlay-chain-regression.test.ts` 的注释也指出了这一点）。
3. 把 `styleToObject` / `filterStyle` 之外的样式下发收敛到统一入口，避免各处手写对象时漏掉「必须常带」的键。

---

## 四、潜在 Bug（P1）

### BUG-1 `wd-notice-bar` 纵向定时器泄漏（方向切换后仍在跑）

- 位置：`wd-notice-bar.vue:174-184` 的 watch 与 `initMarquee`（`:100-112`）
- watch 中 `isVertical` 为 false 时走 `initMarquee()`，它内部只 `stopMarquee()`，**没有 `stopVerticalScroll()`**。若先前是纵向模式（`startVerticalScroll` 已启动 2s 间隔的 `setInterval`），切到横向后该定时器继续每 2 秒改 `currentIndex`：污染 `handleClick` 上报的 index、白耗 CPU、直到组件卸载才被清理。
- 修复：`initMarquee()` 开头（或 watch 的 else 分支）补 `stopVerticalScroll()`。

### BUG-2 `wd-form-item` 校验异常 → 未处理的 Promise 拒绝

- 位置：`wd-form-item.vue:71-77` + `wd-form.vue:46-74`
- `watch(() => propValue.value, async () => { await validateByTrigger('change') }, {deep:true})`：`props.schema.validate(model)` 抛错或被拒绝时，`validate()` 的 rejection 直接冒泡到 async watcher 回调，**无人 catch** → 未处理的 Promise 拒绝。这与本仓库反复强调的 Sentry `USER_RUNTIME_ERROR` 场景完全一致。
- 修复：`validateByTrigger` 内 try/catch（或 `validate()` 内兜底）。

### BUG-3 `wd-upload` 直接改写 props 元素 + 无效守卫

- 位置：`wd-upload.vue:62-75`

  ```ts
  item[statusKey] = item[statusKey] || 'success'
  item.response = item.response || ''
  ```

- 两个问题：
  1. 直接修改**消费方传入的 prop 对象**（且是在 `deep: true` 的 watcher 内改写被监听的 props，存在自触发循环风险）；
  2. `if (isEqual(val, uploadFiles.value)) return` 这个守卫无效 —— `isEqual` 不支持对象比较（实测 `isEqual({a:1},{a:1}) === false`），对象数组恒判不等。
- 修复：先浅拷贝再写；守卫改为按 `uid` 列表比较。

### BUG-4 `wd-form-item` 必填星号判定过宽

- 位置：`wd-form-item.vue:130-132`

  ```ts
  const isRequired = computed(() => isDef(props.required) ? props.required : Boolean(props.prop))
  ```

- 只要传了 `prop` 就显示必填星号，与校验规则里的 `required` 无关；wot-ui 语义是由 rules 决定。会给所有绑定 `prop` 的字段错误地加上星号。

### BUG-5 `useFormDisabled` 无法用 `disabled=false` 覆盖表单级禁用

- 位置：`useFormDisabled.ts:39-47`

  ```ts
  if (props.disabled) return true          // 只处理 truthy
  ```

- 显式传 `disabled={false}` 时不会短路，后续 `formItem.disabled` / `form.props.disabled` 仍会把它判为禁用 → 在禁用的表单里无法单独启用某个字段。建议 `isDef(props.disabled) ? props.disabled : ...`。

### BUG-6 `clickoutside` 队列调用无判空

- 位置：`packages/ui/src/common/clickoutside.ts:13-25`
- `item.$.exposed.close()` 未做存在性判断：`exposed` 为 `null`、或某个实例未暴露 `close` 时直接抛 TypeError，**一处异常会中断整个队列的收起流程**（后续行不再收起）。建议 `item.$.exposed?.close?.()`。

### BUG-7 `wd-swipe-action` 程序化展开依赖异步度量结果

- 位置：`swipe-action.vue:78-90`（onMounted 度量）与 `:100-113`（`changeState`）
- `leftWidth` / `rightWidth` 只有在 `onMounted` 的 `getRect` 回调落地后才有值。在此之前（或度量不可用、宽度为 0 时）把 `modelValue` 设为 `'left'`/`'right'` → `swipeMove(0)`，展开**静默无效**。
- 建议：宽度为 0 时补一次度量，或用百分比兜底。

### BUG-8 `wd-swiper` 未清理的定时器 + 双向写 `current`

- 位置：`wd-swiper.vue:134-161`
- `next()` / `prev()` 中的两个 `setTimeout(..., 50)`（用于 `wrapNoAnim` 复位）未纳入 `onUnmounted` 的清理清单，仅靠 `isAlive()` 兜底；
- `watch(() => props.current)` 与 `onScroll` 都会写 `current`，快速滑动/自动播放时与 `scroll-left` 程序定位存在互相回写的风险（已有 `userScrolling` 缓解，建议收敛为单向数据流）。

### BUG-9 `wd-floating-panel` 不响应外部高度变化

- 位置：`wd-floating-panel.vue:19`
- `currentHeight = ref(props.height)` 之后没有任何 watch，外部改 `height` prop 不会生效；`onTouchMove` 的高度上限硬编码 `9999`（`:47`）。

### BUG-10 `useSelection.formatColumnsData` 就地改写入参

- 位置：`composables/useSelection.ts:27-44`
- 对传入的 option 对象补写 `option[labelKey] = option[valueKey]` / 反向补写，属**对 props 数据的隐式变更**。虽然 `wd-picker-view` 的 watcher 因引用相等不会死循环，但会污染消费方的原始数据（外部同一份 options 被复用时可见）。

---

## 五、健壮性与一致性（P2）

| # | 位置 | 问题 |
| --- | --- | --- |
| 1 | `wd-fab.vue:59-80` | `disabled` 未参与拖拽与展开判断（禁用态仍可拖、可 toggle）；`clampToViewport` 的异步回调无 `isAlive` 守卫，卸载后仍写 ref（与仓库 9902 防护约定不一致） |
| 2 | `wd-sticky.vue:25` | `props.offsetTop ? ... : boxOffset.value` —— `offsetTop: 0` 是合法值却被当作未设置，应用 `isDef` 判断 |
| 3 | `wd-notify/index.ts:76-81` | `closeNotify` 原地改写 `notifyOption.value.visible`；首次使用前 `notifyOption.value` 就是模块级 `currentOptions` 本体，存在污染全局默认值的路径。建议与 `useToast` 统一为 `deepMerge` 赋新对象 |
| 4 | `wd-count-to.vue:30-45` | `timeText` 前两行是死代码（`decimals > 0` 时被第三行覆盖）；`decimals === 0` 时大数经 `Number()` 有科学计数法风险 |
| 5 | `useRaf.ts:51-57` | `cancel()` 未把 `requestRef.value` 置空，后续会对陈旧句柄重复 `clearTimeout` |
| 6 | `wd-upload.vue:275-277` | 预览列表 `v-for :key="index"`，删除中间项会错配复用（应使用 `file.uid`） |
| 7 | `wd-input-number.vue:38-44`、`wd-slider.vue:38-44` | `validStep` computed 内含 `console.warn` 副作用：`step <= 0` 时每次 `calcByStep`（touchmove / 长按 100ms 定时器）都会打印，直接刷屏。computed 应保持纯函数 |
| 8 | `common/util.ts:794` | `closest([])` 抛 `Reduce of empty array with no initial value`（已实测）。该函数已导出但仓库内无调用点，属公共 API 隐患 |
| 9 | `common/util.ts:136` | `isEqual` 不支持对象/Map/Set（实测 `{a:1}` vs `{a:1}` → `false`）。已在 `wd-upload`（守卫失效）、`wd-tabs`（被迫自造 `deepEqual`）处造成绕行，建议补对象分支或明确文档化 |
| 10 | `common/util.ts:166,530` | `styleToObject` 与 `parseStyle` 功能重叠（前者处理引号/括号内的分号，后者裸切 `;`）。用错 `parseStyle` 会把 `background: url(data:...;base64,...)` 截断；`objToStyle` 全仓库无调用方 |
| 11 | 多处（`usePopover`、`wd-fab`、`wd-swiper`、`wd-notice-bar`、`wd-tabs`…） | `getRect(...).catch(...)` 是死代码 —— `getRect` 的契约是「永不 reject」（`util.ts:276-351`）。这些 catch 分支给人「已有错误处理」的错觉，建议删除或改为注释说明 |
| 12 | `wd-tabs.vue:109`、`wd-tabs.vue:149-151` | `showScrollbar` 恒为 `true`、`getTabItemStyle` 恒返回 `{}`、`state.scrollLeft` 无赋值点 → 激活 tab 不会自动滚入视野，属未完成实现 |
| 13 | `wd-calendar-view.vue:162-168` | `isSameWeek` 定义后未被使用（死代码） |

---

## 六、建议的修复优先级

1. **立刻**：P0-1（`isObj` / `deepMerge`）—— 影响所有命令式弹层，且修复成本极低（一行 + 数组分支）。
2. **立刻**：第三节的样式脏值类 —— `wd-segmented`（P0-3）、`wd-picker-view`（拖动不跟手）、`wd-toast`（位置残留）、`wd-fab`，四处同源，可一次改完并补一条回归测试。
3. **立刻**：P0-4（tabs 指示线首帧失效）—— 用户可见的功能缺陷。
4. **本迭代**：P0-2（debounce）、BUG-1（notice-bar 定时器泄漏）、BUG-2（表单校验未处理拒绝）、BUG-3（upload props 改写）。
5. **性能专项**：PERF-1（picker-view 热路径）、PERF-2（calendar-view 内联 columns）、PERF-4（useChildren 排序），这三处是渲染/滚动卡顿的主要来源。
6. **工程效能**：修复失效的 MTS 守卫测试（见第七节），否则 CONVENTIONS §9 的约束实际上处于「无人看守」状态。
7. **清理项**：P2 表中的死代码与重复工具函数，建议一并处理以避免误用。

---

## 七、测试套件运行结果

依赖只安装在 `packages/ui/node_modules`（根目录 `node_modules` 为空），在该目录下执行 `./node_modules/.bin/vitest run` 的完整结果：

```
 Test Files  1 failed | 26 passed (27)
      Tests  7 failed | 284 passed (291)
   Duration  582.90s (transform 69.28s, setup 112.72s, collect 1026.95s,
                     tests 197.17s, environment 2130.66s)
```

### 7 个失败全部是超时，不是断言失败

全部集中在 `test/no-main-thread-script.test.ts`，报错均为 `Test timed out in 5000ms`（`vitest` 默认超时），**没有任何一条是 `expect` 不通过**。因此：

- ✅ **没有证据表明源码违反 CONVENTIONS §9（禁止 MTS）** —— 同文件中的「覆盖率：收集器不应漏扫 src 下的源码文件」用例通过，说明扫描本身正常。
- ❌ 但这条**守卫测试实际上失效了**：它 `it.each` 展开 7 个正则，每个用例都重新 `readFileSync` 全部 ~350 个源码文件并跑一遍 `stripComments`（`:78`），即整库读盘 + 去注释 **7 次**，无任何缓存。在本机环境下每次超过 5s 上限 → 全部超时。
- 后果：CI 上这条守卫要么**红（假失败）**、要么被当作 flaky 忽略，等于 CONVENTIONS §9 的回归防线形同虚设。
- 建议修复（很小）：把「读文件 + 去注释」在 `describe` 作用域内**只做一次**（缓存 `fileContents` 数组），`it.each` 只对缓存内容跑正则；同时给该文件设置更宽松的 `timeout`。

### 其他观察

- 本次运行 `collect` 阶段耗时 1027s、`environment` 2130s，而 `tests` 仅 197s —— 环境/收集开销是测试本身的 10 倍以上，本地与 CI 反馈都偏慢，建议排查 jsdom 环境初始化与 transform 配置。
- 已通过的用例覆盖了事件注册表、内联样式、swipe-action 交互、picker、crash-guard、bugfix 回归等，但**没有覆盖**本报告 P0-1（`deepMerge` 数组/null）、P0-3（segmented 滑块归位）、P0-4（tabs 指示线首帧）、以及 `debounce` 的 leading 语义 —— 这些正是「测试全绿但仍存在缺陷」的部分，建议按第三节建议补真机回归。

---

## 八、审查方法与局限

- 覆盖：`common/*`（13 个文件）、`composables/*`（21 个文件）全量通读；组件抽样覆盖复杂度最高的 ~30 个（slider / picker-view / calendar-view / upload / img-cropper / swiper / tabs / form / swipe-action / rate / index-bar / notice-bar / fab / floating-panel / segmented / transition / watermark / count-to / input-number / sticky / popover …）。
- 实证（非推测）：
  - `common/util.ts` + `AbortablePromise.ts` 经 `typescript.transpileModule` 转译后在 Node 22 下**实际执行**，P0-1 / P0-2 / `isEqual` / `closest` 的输出为真实运行结果。
  - `SET_STYLE` 的调用链在 `vue-lynx` 运行时源码中逐级核实：BG `pushOp(SET_STYLE, id, styleObject)`（`internal/dist/ops.js:16`）→ MT `__SetInlineStyles(el, value)`（`main-thread/dist/ops-apply.js:124-131`）。**逐属性合并的语义**由仓库自身的真机结论佐证（`test/overlay-chain-regression.test.ts:13-18`、`wd-swipe-action.vue:51-59`），本人未在真机复测该引擎行为。
  - 完整测试套件已跑通（结果见第七节）。
- 局限：本报告为静态审查 + 单测佐证，**未做真机验证**。第三节标注的样式脏值问题建议在真机或 Web 预览上按「条件由真转假」的路径实测确认后再合并修复；`wd-picker-view` 的拖动跟手问题建议优先真机复现（表现最直观）。

---

## 九、修复执行结果（2026-10-16）

按第六节的优先级逐条落地。每处修复都以「临时还原 → 对应用例必须失败」验证过有效性（见文末）。

### 已修复清单

| 编号 | 位置 | 修复要点 |
| --- | --- | --- |
| P0-1 | `common/util.ts` `isObj` / `deepMerge` | `isObj` 只认 `[object Object]`（去掉 `typeof === 'object'` 兜底）；`deepMerge` 数组整体替换、可置 null |
| P0-2 | `common/util.ts` `debounce` | leading 执行后清空 `lastArgs`，单次调用不再触发两次 |
| P0-3 | `wd-segmented.vue` | 无条件写 `transform`（选中首项 `left===0` 也要归位） |
| P0-4 | `wd-tabs.vue` | `onMounted` 补调 `updateLineStyle()` |
| 样式脏值 | `wd-picker-view` / `wd-toast` / `wd-fab` / `wd-floating-panel` | transition / top+bottom / transform 两态都显式写 |
| BUG-1 | `wd-notice-bar.vue` | `initMarquee()` 补 `stopVerticalScroll()` |
| BUG-2 | `wd-form-item.vue` | `validateByTrigger` 与 async watcher 均加 try/catch |
| BUG-3 | `wd-upload.vue` | 先浅拷贝再补默认值，不再改写消费方 prop |
| BUG-4 | `wd-form-item.vue` | 必填星号只由显式 `required` 决定 |
| BUG-5 | `useFormDisabled.ts` | `isDef(props.disabled)` 短路，支持 `disabled=false` 覆盖表单级禁用 |
| BUG-6 | `common/clickoutside.ts` | `exposed?.close?.()` + `removeFromQueue` 判空 |
| BUG-7 | `wd-swipe-action.vue` | 宽度落地后补齐「早到的展开态」 |
| BUG-10 | `wd-calendar-view.vue` | 起点高亮与 `allowSameDay` 解耦；`allowSameDay` 落到点击守卫 |
| PERF-1 | `wd-picker-view.vue` | 行高/留白/指示带样式提为复用对象；列 transform 用 computed 数组；行 class 改字符串拼接 |
| PERF-2 | `wd-calendar-view.vue` | 时间列提为 computed（原为模板内联，每次重渲染新建 144 个对象） |
| PERF-3 | `wd-rate.vue` | 加「已尝试度量」一次性标志 + `isAlive` 守卫，热路径不再反复 getRect |
| PERF-4 | `useChildren.ts` | 索引 Map 替代比较器内 O(N) 线性查找 |
| PERF-6 | `wd-watermark.vue` | 平铺节点总数上限 1000 |
| P2-1 | `wd-fab.vue` | `disabled` 参与拖拽/toggle；`clampToViewport` 加 `isAlive`、删死 `.catch` |
| P2-2 | `wd-sticky`（types + 组件） | `offsetTop` 去掉默认值 + `isDef`（区分「未传」与「显式 0」） |
| P2-3 | `wd-notify/index.ts` | `closeNotify` 赋新对象，不再原地改 `visible` 污染全局默认值 |
| P2-4 | `wd-count-to.vue` | 删除死代码；`toFixed` 直出，消除大数科学计数法 |
| P2-5 | `useRaf.ts` | `cancel()` 置空句柄 |
| P2-6 | `wd-upload.vue` | 预览 `:key` 改用 `file.uid` |
| P2-7 | `wd-slider.vue` | `validStep` 恢复纯函数，告警移到 `step` watch |
| P2-8/9 | `common/util.ts` | `closest([])` 早返回；`isEqual` 支持普通对象 |
| P2-13 | `wd-calendar-view.vue` | 删除未使用的 `isSameWeek` |
| §6-6 | `test/no-main-thread-script.test.ts` | 读盘 + 去注释缓存到 describe 作用域，8 个用例 20ms 内通过 |

> P2-10（`styleToObject`/`objToStyle` 重复与死代码）与 P2-12（`wd-tabs` 未完成实现）由同期的「样式漏斗」重构一并处理。

### 新增回归测试

| 文件 | 用例数 | 锁定内容 |
| --- | --- | --- |
| `test/util-merge.test.ts` | 18 | P0-1 / P0-2 / `isEqual` / `closest` |
| `test/style-merge-regression.test.ts` | 4 | segmented / picker-view / toast / fab 的样式脏值 |
| `test/bugfix-range-and-expand.test.ts` | 4 | BUG-7（编程展开）、BUG-10（区间高亮 + allowSameDay 守卫） |
| `test/perf-guards.test.ts` | 3 | PERF-6（水印节点上限）、PERF-2（时间列）、PERF-1（picker 样式复用） |
| `test/bugfix-p2-cleanup.test.ts` | 4 | P2-2（sticky offsetTop 语义）、P2-4（count-to 格式化） |

### 验证

- `vue-tsc --noEmit`：**0 错误**。
- 全量 `vitest run`：**32 文件 / 330 项通过，0 失败**（第七节的 7 个超时失败已随 MTS 守卫测试的缓存修复消失）。
- 有效性证明：对 BUG-7、BUG-10、PERF-6、P2-2 四处，均以「临时还原修复 → 对应用例必须失败」验证（还原后分别得到 `translateX(0px)`、缺 `is-start`、2546 个节点、`top: 50px` 的失败输出）。

### 复查时对本文档原判断的两处修正

- **P2-2（sticky）**：原建议「直接用 `isDef`」不完整——`offsetTop` 原默认值为 `0`，直接改 `isDef` 会让父级 `sticky-box` 的偏移彻底失效。正确做法是去掉 prop 默认值（`undefined`）再配 `isDef`，已按此实施。
- **P2-7（validStep）**：`wd-input-number.vue` 实际并无 `validStep` computed（文档把 slider 的写法误记到 input-number）；仅 `wd-slider.vue` 需要修。
