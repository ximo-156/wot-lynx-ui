import { describe, it } from 'vitest'
import { inject, provide, ref } from 'vue-lynx'
import { render } from './render'
import WdDialog from '../src/components/wd-dialog/wd-dialog.vue'
import { useDialog, getDialogDefaultOptionKey } from '../src/components/wd-dialog'

describe('debug', () => {
  it('imperative watch trace', async () => {
    const holder: any = {}
    const Wrapper = {
      components: { WdDialog },
      setup() {
        holder.dialog = useDialog()
        holder.injected = inject(getDialogDefaultOptionKey(''), ref(null))
      },
      template: `<WdDialog />`
    }
    const { container } = render(Wrapper)
    await new Promise((r) => setTimeout(r, 50))
    console.log('before alert, injected value:', JSON.stringify(holder.injected?.value)?.slice(0, 120))
    holder.dialog.alert({ title: '标题', msg: '内容' })
    console.log('after alert, injected value:', JSON.stringify(holder.injected?.value)?.slice(0, 200))
    await new Promise((r) => setTimeout(r, 300))
    console.log(container.outerHTML.slice(0, 800))
  })
})
