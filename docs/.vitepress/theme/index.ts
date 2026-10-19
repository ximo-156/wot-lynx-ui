import DefaultTheme from 'vitepress/theme'
import './custom.css'
// 组件库设计令牌（--wot-*）：H5 预览依赖，全站引入
import 'wot-lynx-ui/theme'
// H5 预览外壳样式（Lynx 元素语义重建 + 演示页样式 + 右侧栏加宽规则）
import './preview.css'
import DocsLayout from './DocsLayout.vue'

export default {
  extends: DefaultTheme,
  // 自定义布局：组件文档页右侧栏注入 H5 预览（见 DocsLayout.vue）
  Layout: DocsLayout,
  enhanceApp() {
    // 预览由 DocsLayout 经布局槽位注入，无需全局注册
  }
}
