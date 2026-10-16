let queue: any[] = []

export function pushToQueue(comp: any) {
  queue.push(comp)
}

export function removeFromQueue(comp: any) {
  // 判空：onBeforeUnmount 传入的组件实例在异常路径下可能为空，
  // 裸取 comp.$.uid 会抛 TypeError 并中断卸载流程。
  const uid = comp?.$?.uid
  if (uid === undefined) return
  queue = queue.filter((item) => item?.$?.uid !== uid)
}

export function closeOther(comp: any) {
  queue.forEach((item) => {
    // 判空：exposed 为 null 或实例未暴露 close 时跳过，
    // 避免一处异常中断整个队列的收起流程（后续行不再收起）
    if (item.$.uid !== comp.$.uid) {
      item.$.exposed?.close?.()
    }
  })
}

export function closeOutside() {
  queue.forEach((item) => {
    item.$.exposed?.close?.()
  })
}
