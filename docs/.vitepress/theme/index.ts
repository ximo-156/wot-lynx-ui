import DefaultTheme from 'vitepress/theme'
import './custom.css'
// 组件库设计令牌（--wd-*）：H5 预览依赖，全站引入
import 'wot-lynx-ui/theme'
// H5 预览外壳样式（Lynx 元素语义重建 + 演示页样式）
import './preview.css'
import H5Preview from './H5Preview.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // 组件文档页中以 <h5-preview name="button" /> 形式使用
    app.component('H5Preview', H5Preview)
    // 临时调试：捕获 VitePress 应用的未处理错误
    app.config.errorHandler = (err: unknown, _instance: unknown, info: string) => {
      const pre = document.createElement('pre')
      pre.id = 'vp-error'
      pre.textContent = `VP-ERR [${info}]: ${(err as Error)?.stack || err}`
      document.body.appendChild(pre)
    }
  }
}
