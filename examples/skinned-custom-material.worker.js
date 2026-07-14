import {
  createSourceAssetSerializationState,
  serializeSourceAssetRegistry,
} from "/worker-modules/packages/app/dist/asset-mirror.js";

const clearColor = [0.02, 0.03, 0.05, 1];
const stripColor = [0.16, 0.62, 1.0, 1];
const edgeColor = [1.0, 0.5, 0.12, 1];
const MAX_BEND_ANGLE = 1.15;

let apertureModulePromise = null;
let scene = null;
const sourceAssetState = createSourceAssetSerializationState();

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message:
      event.message ||
      "The skinned custom material simulation worker raised an error.",
  });
  event.preventDefault();
});

self.addEventListener("unhandledrejection", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-unhandled-rejection",
    message: messageFromError(event.reason),
  });
  event.preventDefault();
});

self.onmessage = (message) => {
  void handleMessage(message.data);
};

async function handleMessage(data) {
  try {
    const aperture = await loadAperture();

    if (data?.type === "init") {
      scene = createSkinnedScene(aperture, {
        canvas: data.canvas ?? { width: 960, height: 540 },
        // When bend/dissolve are provided they are STATIC (the e2e isolates
        // skinning vs dissolve); otherwise both animate over time.
        staticBend: finiteOrNull(data.bend),
        staticDissolve: finiteOrNull(data.dissolve),
      });
      self.postMessage({
        type: "ready",
        scene: sceneSummary(aperture, scene),
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }

      const time = finiteNumber(data.time, 0);
      const bend =
        scene.staticBend !== null
          ? scene.staticBend
          : 0.5 + 0.5 * Math.sin(time * 1.2);
      const dissolve =
        scene.staticDissolve !== null
          ? scene.staticDissolve
          : 0.18 + 0.28 * (0.5 + 0.5 * Math.sin(time * 0.9));

      poseSkeleton(aperture, scene, bend);
      updateDissolveMaterial(aperture, scene, dissolve);
      scene.app.step(finiteNumber(data.delta, 0), time);

      const frame = finiteInteger(data.frame, 1);
      const snapshot = scene.app.extract(frame);

      self.postMessage(
        {
          type: "snapshot",
          frame,
          time,
          delta: finiteNumber(data.delta, 0),
          bend,
          dissolve,
          snapshot,
          sourceAssets: serializeSourceAssetRegistry(scene.app.assets, {
            state: sourceAssetState,
          }),
          scene: sceneSummary(aperture, scene),
        },
        aperture.renderSnapshotTransferList(snapshot),
      );
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      reason: "worker-frame-failed",
      message: messageFromError(error),
    });
  }
}

function loadAperture() {
  apertureModulePromise ??= Promise.all([
    import("@aperture-engine/simulation"),
    import("@aperture-engine/render"),
    import("@aperture-engine/runtime"),
  ]).then(([simulation, render, runtime]) => ({
    ...simulation,
    ...render,
    ...runtime,
  }));
  return apertureModulePromise;
}

function createSkinnedScene(aperture, options) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 8 },
  });
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const shader = assets.shaders.add(
    aperture.createWgslShaderAsset({
      label: "Skinned Dissolve WGSL",
      source: skinnedDissolveWgsl(),
      virtualPath: "skinned-dissolve.wgsl",
    }),
    { id: "skinned-dissolve-shader" },
  );
  const mesh = assets.meshes.add(createSkinnedStripMesh(), {
    id: "skinned-strip",
  });
  const material = assets.materials.customWgsl.add(
    createDissolveMaterial(aperture, shader, 0.2),
    { id: "skinned-dissolve-material" },
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3] }),
    aperture.withCamera({
      aspect: options.canvas.width / options.canvas.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  const character = app.spawn(
    aperture.withTransform(),
    aperture.withMesh(mesh),
    aperture.withMaterial(material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    // Manual joint palette (2 bones): bone 0 anchors the base, bone 1 bends the
    // top. The palette is recomputed in place each frame (poseSkeleton), which
    // extraction reads fresh into snapshot.bones — the same buffer the renderer
    // binds at @group(4) for the skinned custom pipeline.
    aperture.withSkin({ jointMatrices: bindPosePalette() }),
  );

  return {
    app,
    mesh,
    material,
    shader,
    character,
    skin: aperture.Skin,
    staticBend: options.staticBend,
    staticDissolve: options.staticDissolve,
  };
}

// Rewrite bone 1's palette matrix (a Z rotation about the strip's mid-joint) in
// place so the top of the strip swings as `bend` (0 = bind pose) grows to 1.
function poseSkeleton(aperture, scene, bend) {
  const palette = scene.character.getValue(scene.skin, "jointMatrices");

  if (!(palette instanceof Float32Array) || palette.length < 32) {
    return;
  }

  const angle = clamp01(bend) * MAX_BEND_ANGLE;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Bone 0 stays identity (the base); bone 1 is a column-major Z rotation.
  writeIdentity(palette, 0);
  palette.set([cos, sin, 0, 0, -sin, cos, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 16);
}

function updateDissolveMaterial(aperture, scene, dissolve) {
  scene.app.assets.markReady(
    scene.material,
    createDissolveMaterial(aperture, scene.shader, dissolve),
  );
}

function createDissolveMaterial(aperture, shader, dissolve) {
  return aperture.createCustomWgslMaterialAsset({
    familyKey: "example/skinned-dissolve",
    label: "Skinned Dissolve Material",
    shader: { kind: "shader-asset", handle: shader },
    entryPoints: { vertex: "vs_main", fragment: "fs_main" },
    // F3: opt into the renderer-owned group(4) skinning contract — the
    // apertureSkin(...) header is prepended and the joint palette is bound
    // automatically. Unlit: the dissolve is self-lit, no group(3) lit contract.
    skinned: true,
    renderState: {
      cullMode: "none",
      depth: { test: true, write: true, compare: "less" },
      blend: { preset: "none" },
      alphaMode: "opaque",
    },
    bindings: [
      {
        name: "params",
        binding: 0,
        kind: "uniform-buffer",
        visibility: ["fragment"],
        label: "DissolveUniforms",
        fields: {
          color: { type: "vec4", default: stripColor },
          edgeColor: { type: "vec4", default: edgeColor },
          dissolve: { type: "float32", default: 0.2 },
        },
        values: {
          color: stripColor,
          edgeColor,
          dissolve,
        },
      },
    ],
  });
}

function sceneSummary(aperture, scene) {
  return {
    meshKey: aperture.assetHandleKey(scene.mesh),
    materialKey: aperture.assetHandleKey(scene.material),
    shaderKey: aperture.assetHandleKey(scene.shader),
    familyKey: "example/skinned-dissolve",
    staticBend: scene.staticBend,
    staticDissolve: scene.staticDissolve,
  };
}

// A 2-column x 5-row strip standing in the z=0 plane (y in [-1, 1]). Weights
// blend from bone 0 (base) to bone 1 (top) by height, so bone 1's rotation
// bends the strip. Single interleaved stream matching the renderer's skinned
// vertex layout: POSITION f32x3 @0, NORMAL f32x3 @12, TEXCOORD_0 f32x2 @24,
// JOINTS_0 u16x4 @32, WEIGHTS_0 f32x4 @40 (stride 56).
function createSkinnedStripMesh() {
  const rows = [-1, -0.5, 0, 0.5, 1];
  const cols = [-0.4, 0.4];
  const stride = 56;
  const vertexCount = rows.length * cols.length;
  const buffer = new ArrayBuffer(vertexCount * stride);
  const view = new DataView(buffer);
  let vertexIndex = 0;

  for (let r = 0; r < rows.length; r += 1) {
    const y = rows[r];
    const t = clamp01((y + 1) / 2);

    for (let c = 0; c < cols.length; c += 1) {
      const x = cols[c];
      const base = vertexIndex * stride;

      // POSITION
      view.setFloat32(base + 0, x, true);
      view.setFloat32(base + 4, y, true);
      view.setFloat32(base + 8, 0, true);
      // NORMAL (+z, toward the camera)
      view.setFloat32(base + 12, 0, true);
      view.setFloat32(base + 16, 0, true);
      view.setFloat32(base + 20, 1, true);
      // TEXCOORD_0
      view.setFloat32(base + 24, c, true);
      view.setFloat32(base + 28, (y + 1) / 2, true);
      // JOINTS_0 (bone 0 = base, bone 1 = top)
      view.setUint16(base + 32, 0, true);
      view.setUint16(base + 34, 1, true);
      view.setUint16(base + 36, 0, true);
      view.setUint16(base + 38, 0, true);
      // WEIGHTS_0 (blend base -> top by height)
      view.setFloat32(base + 40, 1 - t, true);
      view.setFloat32(base + 44, t, true);
      view.setFloat32(base + 48, 0, true);
      view.setFloat32(base + 52, 0, true);

      vertexIndex += 1;
    }
  }

  const indices = [];

  for (let r = 0; r < rows.length - 1; r += 1) {
    const a = r * 2;
    const b = r * 2 + 1;
    const c = (r + 1) * 2;
    const d = (r + 1) * 2 + 1;

    indices.push(a, b, d, a, d, c);
  }

  return {
    kind: "mesh",
    label: "SkinnedStrip",
    vertexStreams: [
      {
        id: "skinned-interleaved",
        arrayStride: stride,
        vertexCount,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
          { semantic: "JOINTS_0", format: "uint16x4", offset: 32 },
          { semantic: "WEIGHTS_0", format: "float32x4", offset: 40 },
        ],
        data: new Float32Array(buffer),
      },
    ],
    indexBuffer: {
      format: "uint16",
      data: new Uint16Array(indices),
    },
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount,
        indexStart: 0,
        indexCount: indices.length,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    skinning: { joints0: "JOINTS_0", weights0: "WEIGHTS_0" },
    localAabb: { min: [-1.6, -1.6, -1.6], max: [1.6, 1.6, 1.6] },
    localSphere: { center: [0, 0, 0], radius: 2.4 },
  };
}

function bindPosePalette() {
  const palette = new Float32Array(32);

  writeIdentity(palette, 0);
  writeIdentity(palette, 16);
  return palette;
}

function writeIdentity(target, offset) {
  target.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], offset);
}

function skinnedDissolveWgsl() {
  return `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(8) joints0: vec4u,
  @location(9) weights0: vec4f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) worldNormal: vec3f,
};

struct DissolveUniforms {
  color: vec4f,
  edgeColor: vec4f,
  dissolve: f32,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> params: DissolveUniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  // apertureSkin comes from the renderer-prepended skinning contract header
  // (@group(4) joint palette). It returns the skinned object-space position +
  // normal without any app-side palette wiring.
  let skinned = apertureSkin(input.position, input.normal, input.joints0, input.weights0);
  let world = worldTransforms[input.instanceIndex] * vec4f(skinned.position, 1.0);
  var output: VertexOutput;
  output.position = view.viewProjection * world;
  output.uv = input.uv;
  output.worldNormal = skinned.normal;
  return output;
}

fn hash21(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let cell = floor(input.uv * vec2f(6.0, 16.0));
  let noise = hash21(cell);
  let threshold = params.dissolve;

  if (noise < threshold) {
    discard;
  }

  let edge = smoothstep(threshold, threshold + 0.14, noise);
  let facing = 0.55 + 0.45 * clamp(input.worldNormal.z, 0.0, 1.0);
  let base = params.color.rgb * facing;
  let glow = params.edgeColor.rgb * (1.0 - edge);
  return vec4f(base * edge + glow, 1.0);
}
`;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function finiteOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function finiteNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
