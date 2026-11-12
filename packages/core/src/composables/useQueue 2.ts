import { type Ref, provide, ref } from 'vue-lynx'

export const queueKey = '__QUEUE_KEY__'

export interface Queue {
  queue: Ref<any[]>
  pushToQueue: (comp: any) => void
  removeFromQueue: (comp: any) => void
  closeOther: (comp: any) => void
  closeOutside: () => void
}

export function useQueue() {
  const queue = ref<any[]>([])

  function pushToQueue(comp: any) {
    queue.value.push(comp)
  }

  function removeFromQueue(comp: any) {
    // 判空与 clickoutside.removeFromQueue 同源：异常路径下实例可能为空，
    // 裸取 $.uid 会抛 TypeError 并中断卸载流程。
    const uid = comp?.$?.uid
    if (uid === undefined) return
    queue.value = queue.value.filter((item) => {
      return item?.$?.uid !== uid
    })
  }

  function closeOther(comp: any) {
    const uid = comp?.$?.uid
    if (uid === undefined) return
    queue.value.forEach((item) => {
      if (item?.$?.uid !== uid) {
        item.$.exposed?.close?.()
      }
    })
  }

  function closeOutside() {
    queue.value.forEach((item) => {
      item.$.exposed?.close?.()
    })
  }

  provide(queueKey, {
    queue,
    pushToQueue,
    removeFromQueue,
    closeOther,
    closeOutside
  })

  return {
    closeOther,
    closeOutside
  }
}
