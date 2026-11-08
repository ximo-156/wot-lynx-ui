/**
 * Lazy demo boundary: its slot is not evaluated until the browser mounts it.
 * Keep the actual native root in the caller's template so scoped styles, refs
 * and v-models keep their original owner. This is not v-show/KeepAlive.
 */
import { defineComponent } from 'vue-lynx'

export default defineComponent({
  name: 'DemoSection',
  props: {
    name: { type: String, required: true },
    title: { type: String, required: true },
    // The full-mount stress view also enables full mounting in nested catalogs.
    all: { type: Boolean, default: false }
  },
  setup(props, { slots }) {
    return () => slots.default?.({ title: props.title, all: props.all }) || []
  }
})
