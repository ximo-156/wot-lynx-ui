---
layout: home

hero:
  name: wot-lynx-ui
  text: Vue Lynx 的 wot-ui 适配组件库
  tagline: 原生性能 · 样式一致 · API 兼容
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: 查看组件
      link: /components/button

features:
  - icon: 🎨
    title: 样式一致
    details: 全新 --wd-* 三层设计令牌体系（色阶 → 语义 → 组件），亮暗双主题；BEM 类名与 wot-ui 一致，API 完全兼容。
  - icon: ⚡
    title: 原生性能
    details: 基于 Lynx 双线程架构，Vue 运行在后台线程、渲染在主线程；细线边框使用 1ppx 物理像素，按压缩态由渲染器原生处理。
  - icon: 🧩
    title: API 兼容
    details: wd-* 组件命名、props、slots、events 与 wot-ui 对齐；图标由 iconfont 转换为 302 个原生 SVG，免字体加载。
  - icon: 📦
    title: 开箱即用
    details: 发布预编译 CSS，消费者无需安装 Sass 工具链；组件源码分发，Rspeedy 直接编译，天然 Tree-shaking。
  - icon: 🌗
    title: 主题系统
    details: CSS 变量驱动的亮色/暗色主题，WdConfigProvider 全局配置，支持自定义主题变量。
  - icon: 🧪
    title: 可测试
    details: 基于 @lynx-js/testing-environment 的 Vue Lynx 双线程测试环境，组件测试与真实渲染行为一致。
---
