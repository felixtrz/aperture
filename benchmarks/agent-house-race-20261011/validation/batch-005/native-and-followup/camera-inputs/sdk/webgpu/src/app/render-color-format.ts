export interface WebGpuAppRenderColorFormatContext {
  readonly initialization: {
    readonly format: string;
  };
  readonly sceneRenderFormat?: string;
}

export function webGpuAppScenePassColorFormat(
  app: WebGpuAppRenderColorFormatContext,
): string {
  return app.sceneRenderFormat ?? app.initialization.format;
}

export function webGpuAppUsesHdrScenePass(
  app: WebGpuAppRenderColorFormatContext,
): boolean {
  return webGpuAppScenePassColorFormat(app) !== app.initialization.format;
}
