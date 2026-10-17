export function resolvePostDepthSampleCount(sampleCount: number): number {
  if (!Number.isFinite(sampleCount)) {
    return 1;
  }

  return Math.max(1, Math.floor(sampleCount));
}

export function postDepthPipelineKeyToken(sampleCount: number): string {
  return `depthSamples:${resolvePostDepthSampleCount(sampleCount)}`;
}

export function postDepthTextureBindingWgsl(sampleCount: number): string {
  const resolvedSampleCount = resolvePostDepthSampleCount(sampleCount);
  const textureType =
    resolvedSampleCount > 1
      ? "texture_depth_multisampled_2d"
      : "texture_depth_2d";

  return `@group(0) @binding(2) var depthTexture: ${textureType};`;
}

export function postDepthLoadFunctionWgsl(
  sampleCount: number,
  resolve: "average" | "nearest" = "average",
): string {
  const resolvedSampleCount = resolvePostDepthSampleCount(sampleCount);

  if (resolvedSampleCount <= 1) {
    return `
fn loadDepth(coord: vec2i, dims: vec2u) -> f32 {
  return textureLoad(depthTexture, clampCoord(coord, dims), 0);
}`;
  }

  const samples = Array.from(
    { length: resolvedSampleCount },
    (_, sampleIndex) =>
      `textureLoad(depthTexture, sampleCoord, ${sampleIndex}u)`,
  );
  // Depth is a surface location, not a color. AO needs an actual covered
  // surface at silhouettes, never a fictitious surface between MSAA samples.
  const resolved =
    resolve === "nearest"
      ? samples.reduce((nearest, sample) => `min(${nearest}, ${sample})`)
      : `(${samples.join(" + ")}) * ${wgslFloat(1 / resolvedSampleCount)}`;

  return `
fn loadDepth(coord: vec2i, dims: vec2u) -> f32 {
  let sampleCoord = clampCoord(coord, dims);
  return ${resolved};
}`;
}

function wgslFloat(value: number): string {
  return value.toFixed(6);
}
