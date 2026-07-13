// Shared scene for the gbuffer example (B3): three boxes drawn by ONE custom
// WGSL material that declares three color targets (MRT) — albedo rides the
// camera's facade render target at @location(0), world-space normal and a
// quantized object-ID band ride two more facade targets at @location(1..2).
// A user render pass (gbuffer.main.js) resolves the three targets into
// scene color as three vertical bands for pixel assertions.

export const clearColor = [0.02, 0.03, 0.05, 1];

export const gbufferCanvasSize = {
  width: 384,
  height: 384,
};

export const gbufferTargetSize = 192;
export const gbufferFrameCount = 4;

export const gbufferAlbedoColor = [0.9, 0.45, 0.1, 1];

// Normalized canvas sample points (screenshot pixel assertions in the e2e
// spec): the resolve pass splits the canvas into three vertical bands
// (albedo | normal | id); each band remaps its local x back onto the full
// G-buffer texture.
export const gbufferSamplePoints = [
  // albedo band center -> the middle box's orange albedo
  { id: "albedo-center", x: 1 / 6, y: 0.5 },
  // normal band center -> the middle box's front face (+Z), encoded 0.5/0.5/1
  { id: "normal-center", x: 0.5, y: 0.5 },
  // id band: left box (red), middle box (green), right box (blue)
  { id: "id-left", x: 2 / 3 + 0.25 / 3, y: 0.5 },
  { id: "id-center", x: 2 / 3 + 0.5 / 3, y: 0.5 },
  { id: "id-right", x: 2 / 3 + 0.75 / 3, y: 0.5 },
];

// Custom MRT material: standard custom-WGSL app bind contract (group 0 view
// uniforms, group 1 world transforms, group 2 material bindings) with a
// three-output fragment stage matching the colorTargets declaration.
const gbufferWgsl = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldNormal: vec3f,
  @location(1) worldPosition: vec3f,
};

struct GBufferParams {
  idBandEdge: vec4f,
};

struct GBufferOutput {
  @location(0) albedo: vec4f,
  @location(1) normal: vec4f,
  @location(2) id: vec4f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> params: GBufferParams;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let world = worldTransforms[input.instanceIndex];
  let worldPosition = world * vec4f(input.position, 1.0);
  var output: VertexOutput;

  output.position = view.viewProjection * worldPosition;
  output.worldNormal = normalize((world * vec4f(input.normal, 0.0)).xyz);
  output.worldPosition = worldPosition.xyz;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> GBufferOutput {
  var output: GBufferOutput;

  output.albedo = vec4f(0.9, 0.45, 0.1, 1.0);
  output.normal = vec4f(input.worldNormal * 0.5 + vec3f(0.5), 1.0);

  // Quantized object-ID band from the world x position: left box red,
  // middle box green, right box blue (params.idBandEdge.x = band edge).
  let edge = params.idBandEdge.x;
  var id = vec3f(0.0, 1.0, 0.0);
  if (input.worldPosition.x < -edge) {
    id = vec3f(1.0, 0.0, 0.0);
  } else if (input.worldPosition.x > edge) {
    id = vec3f(0.0, 0.0, 1.0);
  }
  output.id = vec4f(id, 1.0);
  return output;
}
`;

export function registerGBufferScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });

  // Facade render targets (B1 assets): the camera pairs with the albedo
  // target; normal + id ride the material's colorTargets declaration.
  const albedoTarget = aperture.createRenderTargetHandle("gbuffer.albedo");
  const normalTarget = aperture.createRenderTargetHandle("gbuffer.normal");
  const idTarget = aperture.createRenderTargetHandle("gbuffer.id");

  registry.register(albedoTarget);
  registry.markReady(
    albedoTarget,
    aperture.createRenderTargetAsset({
      label: "GBuffer Albedo",
      width: gbufferTargetSize,
      height: gbufferTargetSize,
    }),
  );

  for (const [handle, label] of [
    [normalTarget, "GBuffer Normal"],
    [idTarget, "GBuffer ID"],
  ]) {
    registry.register(handle);
    registry.markReady(
      handle,
      aperture.createRenderTargetAsset({
        label,
        width: gbufferTargetSize,
        height: gbufferTargetSize,
        format: "rgba8unorm",
      }),
    );
  }

  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "GBufferBox",
      width: 1.4,
      height: 1.4,
      depth: 1.4,
    }),
    { id: "gbuffer-box" },
  );

  const material = assets.materials.customWgsl.add(
    aperture.createCustomWgslMaterialAsset({
      familyKey: "example/gbuffer",
      label: "GBuffer MRT Material",
      shader: {
        kind: "inline-wgsl",
        code: gbufferWgsl,
        virtualPath: "gbuffer.wgsl",
      },
      entryPoints: { vertex: "vs_main", fragment: "fs_main" },
      colorTargets: [
        { format: "swapchain" },
        { format: "rgba8unorm", renderTarget: normalTarget },
        { format: "rgba8unorm", renderTarget: idTarget },
      ],
      bindings: [
        {
          name: "params",
          binding: 0,
          kind: "uniform-buffer",
          visibility: ["fragment"],
          fields: { idBandEdge: { type: "vec4" } },
          values: { idBandEdge: [0.7, 0, 0, 0] },
        },
      ],
    }),
    { id: "gbuffer-material" },
  );

  return {
    mesh,
    material,
    albedoTarget,
    normalTarget,
    idTarget,
    meshKey: aperture.assetHandleKey(mesh),
    materialKey: aperture.assetHandleKey(material),
  };
}
