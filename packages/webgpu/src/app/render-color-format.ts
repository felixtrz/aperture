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

export interface WebGpuAppPostTonemapStageContext extends WebGpuAppRenderColorFormatContext {
  readonly postEffects?: readonly { readonly enabled?: boolean }[];
}

/**
 * Whether `renderStage: "post-tonemap"` mesh draws route to their own
 * presentation-target pass this frame.
 *
 * The stage only means something when a post stack actually tone-maps the
 * scene buffer afterwards. Without an HDR scene pass, mesh materials already
 * tonemap in-material and write display-space color to the 8-bit swapchain, so
 * a scene-stage draw ALREADY blends in display space and routing it would only
 * move it past the rest of the scene for no visual gain. Gating on the post
 * stack also keeps the pipelines honest: a post-tonemap pipeline is built for
 * the overlay boundary (swapchain format, one color target, sample count 1,
 * read-only depth), which the post route is the only route to encode.
 */
export function webGpuAppUsesPostTonemapMeshStage(
  app: WebGpuAppPostTonemapStageContext,
): boolean {
  return (
    webGpuAppUsesHdrScenePass(app) &&
    (app.postEffects ?? []).some((effect) => effect.enabled !== false)
  );
}
