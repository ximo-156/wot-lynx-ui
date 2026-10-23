import { createApp } from 'vue-lynx'
import wotLynxUI from 'wot-lynx-ui'

import App from './App.vue'

// 引入 wot-lynx-ui 主题变量（--wot-*）
import 'wot-lynx-ui/theme'

// 子路径契约探针：让构建真实解析一次 exports 的 ./primitives/* 与 ./components/*。
// barrel 导入只覆盖 "."，子路径映射写错了构建照样绿灯（见文件内注释）。
import './subpath-contract'

createApp(App).use(wotLynxUI).mount()
