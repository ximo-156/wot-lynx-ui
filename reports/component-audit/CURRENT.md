# 当前逐组件审查状态

HEAD: a7e60f2ad9a94c1042f6e3e512ef1dbfe7df407a

组件 106；fixed 5；reviewed 58；suspect 1；pending 42；incomplete 0.

已确认修复:
- wd-pull-refresh: AUDIT-STYLE-PULL-REFRESH. Confirmed customStyle color remained after prop removal; root now uses an instance-local createStyleResolver.
- wd-swiper: AUDIT-STYLE-SWIPER-ROOT, AUDIT-STYLE-SWIPER-TEXT. Confirmed root customStyle and per-slide customTextStyle keys remained after removal; added separate root and per-index text resolvers and drops resolver entries for removed indexes.
- wd-table: AUDIT-STYLE-TABLE. Confirmed customStyle removal retained old color; root now uses an instance-local resolver.
- wd-upload: AUDIT-UPLOAD-MEASURE-UNMOUNT. Confirmed hidden-image measurement Promise remained pending on unmount; unmount now rejects and clears the waiter, while the existing alive check prevents late list mutation.
- wd-dialog: AUDIT-DIALOG-ASYNC-ACTION. DialogAction.click explicitly accepts Promise<void>; handleAction now awaits it, aborts confirmation on rejection, and ignores stale completion after dialog replacement.

未确认候选:
- wd-drop-menu-item: Full source read. Index key may cause node-state reuse if options are reordered; no stable-key contract/repro is established, retained as low-confidence suspect.

逐组件范围和证据见 [audit-current.json](<audit-current.json>)。
