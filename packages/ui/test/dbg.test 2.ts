import { describe, it } from 'vitest'
import { render } from './render'
import WdTabbar from '../src/components/wd-tabbar/wd-tabbar.vue'
import WdTabbarItem from '../src/components/wd-tabbar-item/wd-tabbar-item.vue'

describe('debug', () => {
  it('dump', () => {
    const Wrapper = {
      components: { WdTabbar, WdTabbarItem },
      setup: () => ({ value: 0 }),
      template: `<wd-tabbar v-model="value"><wd-tabbar-item :name="0" title="首页" /></wd-tabbar>`
    }
    const { container } = render(Wrapper)
    console.log('DOM:', container.innerHTML.slice(0, 700))
  })
})
