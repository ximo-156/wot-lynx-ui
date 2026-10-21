/*
 * 图标字体的 Web 注册由 wot-lynx-ui/plugin 的 pluginWotLynxWebFonts
 * 在宿主 HTML 中完成。Vue Lynx 的组件脚本运行在 Worker，没有 document，
 * 因此不要在组件或注册表中调用 FontFace / document.fonts。
 * 原生端继续通过同目录 iconfont.css 的 @font-face 使用原始 TTF。
 */
export {}
