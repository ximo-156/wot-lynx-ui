import { createApp } from 'vue-lynx'
import wotLynxUI from 'wot-lynx-ui'

import App from './App.vue'

// 主题变量（--wot-*）与库组件都要真实走一遍 exports 契约
import 'wot-lynx-ui/theme'

createApp(App).use(wotLynxUI).mount()
