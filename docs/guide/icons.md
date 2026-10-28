# 内置图标

组件库内置 **180 个图标**（iconfont 集，`.ttf` 字体图标），由图标注册表
（`src/icons/registry.ts`）统一管理，随包发布、无网络请求。

| 集合 | 数量 | 渲染形态 | 说明 |
| --- | --- | --- | --- |
| iconfont 集 | 180 | **.ttf 字体图标**（`<text>` 字形） | `src/icons/fonts/iconfont.ttf`，构建时由 Rspeedy 资产管线产出静态地址 |

## 寻址规则

| 写法 | 含义 |
| --- | --- |
| `<wd-icon name="close" />` | 内置图标直接按名使用 |
| `<wd-icon name="iconfont:close" />` | `集合键:图标名`：精确命中指定集合（注册了多套集时用于消歧） |
| `<wd-icon name="https://.../a.png" />` | name 含 `/` 按图片渲染原生 `image` 元素 |
| `<wd-icon css-icon name="my-icon-font" />` | CSS 图标模式（配合自定义字体 / UnoCSS 等） |

全部 180 个图标在 demo（`packages/demo`）的「Icon 图标 / Loading 加载」一节中
经 `wd-pagination` 分页展示（每页 30 个），可直接对照挑选。

## 内置图标名单（180 个）

来自移动端场景的成套图标（含 `-bold` / `-filling` 变体），经 .ttf 字体渲染
（字体族 `wd-iconfont`，码点映射见 `src/icons/sets/iconfont.ts`）：

| `history` | `file-open` | `forward` | `import` | `image-text` | `keyboard-26` |
| `keyboard-9` | `link` | `layout` | `fullscreen-shrink` | `layers` | `lock` |
| `fullscreen-expand` | `map` | `meh` | `menu` | `loading` | `help` |
| `minus-circle` | `modular` | `notification` | `mic` | `more` | `pad` |
| `operation` | `play` | `print` | `mobile-phone` | `minus` | `navigation` |
| `pdf` | `prompt` | `move` | `refresh` | `run-up` | `picture` |
| `run-in` | `pin` | `save` | `search` | `share` | `scanning` |
| `security` | `sign-out` | `select` | `stop` | `success` | `smile` |
| `switch` | `setting` | `survey` | `task` | `skip` | `text` |
| `time` | `telephone-out` | `toggle-left` | `toggle-right` | `telephone` | `top` |
| `unlock` | `user` | `upload` | `work` | `training` | `warning` |
| `zoom-in` | `zoom-out` | `add-bold` | `arrow-left-bold` | `arrow-up-bold` | `close-bold` |
| `arrow-down-bold` | `minus-bold` | `arrow-right-bold` | `select-bold` | `arrow-up-filling` | `arrow-down-filling` |
| `arrow-left-filling` | `arrow-right-filling` | `caps-unlock-filling` | `comment-filling` | `check-item-filling` | `clock-filling` |
| `delete-filling` | `decline-filling` | `dynamic-filling` | `intermediate-filling` | `favorite-filling` | `layout-filling` |
| `help-filling` | `history-filling` | `filter-filling` | `file-common-filling` | `news-filling` | `edit-filling` |
| `fullscreen-expand-filling` | `smile-filling` | `rise-filling` | `picture-filling` | `notification-filling` | `user-filling` |
| `setting-filling` | `switch-filling` | `work-filling` | `task-filling` | `success-filling` | `warning-filling` |
| `folder-filling` | `map-filling` | `prompt-filling` | `meh-filling` | `cry-filling` | `top-filling` |
| `home-filling` | `sorting` | `3column` | `column-4` | `add` | `add-circle` |
| `adjust` | `arrow-up-circle` | `arrow-right-circle` | `arrow-down` | `ashbin` | `arrow-right` |
| `browse` | `bottom` | `back` | `bad` | `arrow-double-left` | `arrow-left-circle` |
| `arrow-double-right` | `caps-lock` | `camera` | `chart-bar` | `attachment` | `code` |
| `close` | `check-item` | `calendar` | `comment` | `column-vertical` | `column-horizontal` |
| `complete` | `chart-pie` | `cry` | `customer-service` | `delete` | `direction-down` |
| `copy` | `cut` | `data-view` | `direction-down-circle` | `direction-right` | `direction-up` |
| `discount` | `direction-left` | `download` | `electronics` | `drag` | `elipsis` |
| `export` | `explain` | `edit` | `eye-close` | `email` | `error` |
| `favorite` | `file-common` | `file-delete` | `file-add` | `film` | `fabulous` |
| `file` | `folder-close` | `filter` | `good` | `hide` | `home` |

### 组件内部图标的选型

组件库内部用到的图标均从上表挑选（如 navbar / pagination 的左箭头取
`arrow-left-bold`，rate 的星星取 `favorite-filling`，empty 的默认图取
`folder-close`）。少数形态内置集没有对应字形——radio / checkbox 的**未选中**
空心圆/方与 **dot** 选中态圆心点——由组件用 CSS 边框绘制（`border-color`
取 `currentColor`，跟随 `color`，见 `wd-radio` / `wd-checkbox`）。

## 字体方案的 Lynx 约束（.ttf）

内置图标以字体形式内置与渲染，产物三件套（均由生成脚本落位，`--check` 可校验）：

| 文件 | 作用 |
| --- | --- |
| `src/icons/fonts/iconfont.ttf` | 字体文件（40KB，随包发布，构建时由 Rspeedy 资产管线产出静态地址） |
| `src/icons/fonts/iconfont.css` | `@font-face { font-family: 'wd-iconfont'; src: url('./iconfont.ttf') }` |
| `src/icons/sets/iconfont.ts` | 图标名 -> unicode 码点映射（如 `pdf -> e6c1`），registry 寻址的依据 |

**为什么不是经典 `.icon-x::before { content }` 写法**：Lynx CSS 不支持
`::before/::after` 伪元素，`wd-icon` 的字体模式把码点对应的字形直接作为
`<text>` 子节点渲染，并显式设置 `font-family / font-size / color / line-height`
（Lynx 的 text 不依赖样式继承）。等效的手写用法：

```vue
<!-- 等价于 <wd-icon name="pdf" :size="24" color="#1C64FD" /> 的字体模式 -->
<text style="font-family: wd-iconfont; font-size: 24px; color: #1C64FD">&#xe6c1;</text>
```

换色 / 尺寸与 SVG 模式完全一致（`color` / `size` props 或 `custom-style`）。

## 扩展：注册自己的图标集

图标注册表（`src/icons/registry.ts`）是唯一扩展入口，`wd-icon` 无需改动：

```ts
import { registerIconSet } from 'wot-lynx-ui'

registerIconSet({
  key: 'my-icons',            // 集合键，用于 `my-icons:名称` 寻址
  type: 'svg',
  viewBox: '0 0 24 24',
  paths: {
    star: 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z',
    // 多 path 图标用数组
    badge: ['M4 4h16v16H4z', 'M8 8h8v8H8z']
  }
})
```

```vue
<wd-icon name="my-icons:star" :size="24" color="#ffb400" />
```

不带 `集合键:` 前缀的名字按注册顺序回退查找（内置集优先，保证存量名字行为
不变）；注册集与内置集重名时，用前缀精确寻址。

### 从 iconfont.cn 导出物生成新字体集

仓库内置生成脚本，把 iconfont.cn 的 symbol 模式产物转换为「码点映射 TS 模块 +
.ttf 字体文件」两件套（码点取自 iconfont.json 的 `glyphs[].unicode`）：

```bash
# 输入可以是 iconfont.js 文件或其所在目录（目录内优先读 iconfont.js）
node scripts/generate-iconfont.mjs /path/to/iconfont packages/ui/src/icons/sets/my-icons.ts --key my-icons
# → packages/ui/src/icons/sets/my-icons.ts（unicodes 映射）
# → packages/ui/src/icons/fonts/my-icons.ttf（字体拷贝）
```

接入三步：① 在 `src/icons/fonts/my-icons.css` 补一个 `@font-face`
（族名约定 `wd-my-icons`）；② 在 `src/icons/registry.ts` 注册生成的集合
（`registerIconSet(myIconsSet)`）；③ wd-icon 的 `<script>` 里 import 该 css。
`--check` 模式可用于 CI 校验 TS 模块与字体字节均未过期：

```bash
node scripts/generate-iconfont.mjs /path/to/iconfont packages/ui/src/icons/sets/iconfont.ts --key iconfont --check
```

### 查询接口

| API | 说明 |
| --- | --- |
| `resolveIcon(name)` | 解析图标名，返回 `{ type: "svg", setKey, viewBox, paths }` 或 `{ type: "font", setKey, fontFamily, unicode }`，未命中返回 `null` |
| `hasIcon(name)` | 名字是否命中任一内置集合 |
| `listIcons(setKey?)` | 列出图标名（不带参数时返回去重后的全量名单，内置集共 180 个） |
| `listIconSets()` | 列出全部集合的键与图标数 |
