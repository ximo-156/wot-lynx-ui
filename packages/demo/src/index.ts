import { createApp } from 'vue-lynx'
import wotLynxUI from 'wot-lynx-ui'

import App from './App.vue'

// 引入 wot-lynx-ui 设计令牌（--wd-*）
import 'wot-lynx-ui/theme'

createApp(App).use(wotLynxUI).mount()
