# 组件横向依赖报告

> 由 `scripts/analyze-deps.mjs` 自动生成，请勿手动编辑。
> 生成日期：2026-11-11 ｜ 判据见 [ADR-012](../adr/012-primitives-layer.md)；包边界见 [ADR-023](../adr/023-domain-package-split.md)

## 总量

| 指标 | 数值 | 目标 |
|---|---|---|
| 组件数 | 106（core 24 / business 82） | — |
| import 行数 | 208 | — |
| 去重依赖边 | 157 | — |
| 业务 → 基础件 | 97 | ↑ 越多越好 |
| **业务 ↔ 业务** | **28** | ≤ 60（拆包门槛 ≤ 30） |
| **跨包业务边** | **4** | 包级 DAG：允许单向，禁止成环 |
| 契约借用 | 0 | 0 |
| **跨族环** | **0** | 0 |
| 族内环（父子组件对） | 5 | 允许（原子单元） |
| 组件族 | 15 | — |
| 基础件反向依赖 | 0 | 0 |

## 边类型分布

| 类型 | 条数 | 说明 |
|---|---|---|
| compose | 142 | 引 `.vue`，组件组合（合法） |
| type-contract | 42 | `import type` 借契约（应下沉） |
| other | 23 | 值导入 `types` 内 KEY 常量（应下沉） |
| util-borrow | 1 | 借 utils（应下沉 common） |

## fan-in Top（被依赖最多）

| 组件 | 包 | fan-in | fan-out |
|---|---|---|---|
| `wd-icon` | @wot-lynx/primitives | 49 | 0 |
| `wd-button` | @wot-lynx/primitives | 11 | 2 |
| `wd-loading` | @wot-lynx/primitives | 10 | 0 |
| `wd-popup` | @wot-lynx/primitives | 9 | 4 |
| `wd-transition` | @wot-lynx/primitives | 7 | 0 |
| `wd-overlay` | @wot-lynx/primitives | 5 | 1 |
| `wd-badge` | @wot-lynx/primitives | 5 | 0 |
| `wd-input` | @wot-lynx/primitives | 4 | 1 |
| `wd-tabs` | @wot-lynx/primitives | 3 | 5 |
| `wd-tab` | @wot-lynx/primitives | 3 | 2 |
| `wd-img` | @wot-lynx/primitives | 3 | 1 |
| `wd-cell` | @wot-lynx/primitives | 3 | 1 |
| `wd-action-sheet` | @wot-lynx/primitives | 3 | 3 |
| `wd-sticky-box` | @wot-lynx/primitives | 2 | 0 |
| `wd-swiper` | @wot-lynx/ui-display | 2 | 2 |

## fan-out Top（依赖最多）

| 组件 | 包 | fan-out |
|---|---|---|
| `wd-select-picker` | @wot-lynx/ui-form | 8 |
| `wd-calendar` | @wot-lynx/ui-picker | 7 |
| `wd-address-edit` | @wot-lynx/ui-form | 6 |
| `wd-tabs` | @wot-lynx/primitives | 5 |
| `wd-cascader` | @wot-lynx/ui-form | 5 |
| `wd-dialog` | @wot-lynx/ui-feedback | 5 |
| `wd-popup` | @wot-lynx/primitives | 4 |
| `wd-toast` | @wot-lynx/primitives | 4 |
| `wd-upload` | @wot-lynx/ui-form | 4 |
| `wd-action-sheet` | @wot-lynx/primitives | 3 |
| `wd-grid-item` | @wot-lynx/ui-layout | 3 |
| `wd-avatar` | @wot-lynx/ui-display | 3 |

## 循环依赖

判据是**族间禁止、族内允许**：父子组件对（如 `wd-tabs` + `wd-tab`）是
不可分割的原子单元，父引子 `.vue`、子引父 `types` 的 KEY 是 Vue 父子契约的
固有形态，不构成缺陷。跨族环才说明两个本该独立的单元耦合了。

| # | 环 | 判定 |
|---|---|---|
| 1 | `wd-tab` → `wd-tabs` → `wd-tab` | ✅ 族内（含值导入） |
| 2 | `wd-avatar` → `wd-avatar-group` → `wd-avatar` | ✅ 族内（含值导入） |
| 3 | `wd-swiper` → `wd-swiper-nav` → `wd-swiper` | ✅ 族内（纯类型） |
| 4 | `wd-table` → `wd-table-column` → `wd-table` | ✅ 族内（含值导入） |
| 5 | `wd-tabbar` → `wd-tabbar-item` → `wd-tabbar` | ✅ 族内（纯类型） |

## 组件族（原子单元，拆包时不可拆分）

声明于 `docs/architecture/families.json`，由 `analyze-deps.mjs` 校验真实性。
族内互引（父引子 `.vue`、子引父 `types` 的 KEY）合法；跨族互引违规。

- **avatar**：`wd-avatar` + `wd-avatar-group`
  - avatar-group 通过 AVATAR_GROUP_KEY 向 avatar 注入排列上下文（层叠/偏移/最大数），两者共享同一套布局契约。
- **swiper**：`wd-swiper` + `wd-swiper-nav`
  - swiper-nav 通过 SWIPER_KEY 订阅 current/total 与切换方法，是 swiper 的指示器子组件，无独立使用场景。
- **tabs**：`wd-tab` + `wd-tabs`
  - tab 通过 TABS_KEY 读取 active/name 并注册自身，tabs 负责激活态与下划线动画，二者是同一个 tab 控件的两半。
- **tabbar**：`wd-tabbar` + `wd-tabbar-item`
  - tabbar-item 通过 TABBAR_KEY 读取 active 与注册索引，与 tabbar 共同实现路由式底栏。
- **table**：`wd-table` + `wd-table-column`
  - table-column 通过 TABLE_KEY 注册列定义，table 负责渲染与固定列计算，列的声明式 API 依赖 table 的 provide。
- **row**：`wd-col` + `wd-row`
  - col 通过 ROW_KEY 读取 gutter 与换行策略，脱离 row 后 gutter 语义失效。
- **steps**：`wd-step` + `wd-steps`
  - step 通过 STEPS_KEY 读取 active 与方向，单独存在无法确定步骤状态。
- **collapse**：`wd-collapse` + `wd-collapse-item`
  - collapse-item 通过 COLLAPSE_KEY 读取展开态并注册面板，手风琴行为由 collapse 统一裁决。
- **form**：`wd-form` + `wd-form-item`
  - form-item 通过 FORM_KEY 注册校验规则与读取 label 布局，脱离 form 后校验链路完全失效。
- **grid**：`wd-grid` + `wd-grid-item`
  - grid-item 通过 GRID_KEY 读取列数与边框策略，列宽计算必须由 grid 统一分配。
- **sidebar**：`wd-sidebar` + `wd-sidebar-item`
  - sidebar-item 通过 SIDEBAR_KEY 读取 active 与注册索引，选中态由 sidebar 统一管理。
- **drop-menu**：`wd-drop-menu` + `wd-drop-menu-item`
  - drop-menu-item 通过 DROP_MENU_KEY 读取展开项与关闭时机，与 drop-menu 共同管理互斥展开。
- **index-bar**：`wd-index-anchor` + `wd-index-bar`
  - index-anchor 通过 indexBarInjectionKey 读取当前激活索引并上报位置，滚动联动必须成对存在。
- **sticky**：`wd-sticky` + `wd-sticky-box`
  - sticky 通过 STICKY_BOX_KEY 读取容器边界与偏移，脱离 sticky-box 后吸附边界无法确定。
- **picker**：`wd-calendar` + `wd-calendar-view` + `wd-datetime-picker` + `wd-datetime-picker-view` + `wd-picker` + `wd-picker-view`
  - wrapper → view 的原子链：picker 是 picker-view 的弹层包装，datetime-picker 复用 datetime-picker-view，calendar-view 由 datetime-picker-view 派生，calendar 包装 calendar-view。三组 wrapper 共享同一套「列定义 / formatter / 取值」契约（PickerViewExpose、DatetimePickerViewFormatter、getPickerValue），拆开任何一环都会留下悬空类型。


## 违规清单（按规则）

### dep/lateral-component（7）

- wd-count-to → wd-text（compose）
- wd-image-preview → wd-swiper（compose）
- wd-loadmore → wd-divider（compose）
- wd-table → wd-sort-button（compose）
- wd-address-edit → wd-cell-group（compose）
- wd-upload → wd-video-preview（compose）
- wd-calendar → wd-tag（compose）

