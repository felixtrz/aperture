export function webGpuAppScenePassColorFormat(app) {
    return app.sceneRenderFormat ?? app.initialization.format;
}
export function webGpuAppUsesHdrScenePass(app) {
    return webGpuAppScenePassColorFormat(app) !== app.initialization.format;
}
//# sourceMappingURL=render-color-format.js.map