import {
  createSourceAssetSerializationState,
  serializeSourceAssetRegistry,
} from "/worker-modules/packages/app/dist/asset-mirror.js";

const clearColor = [0.01, 0.018, 0.028, 1];
const waterColor = [0.02, 0.46, 0.9, 1];

let apertureModulePromise = null;
let scene = null;
const sourceAssetState = createSourceAssetSerializationState();

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message:
      event.message || "The custom material simulation worker raised an error.",
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
      scene = createWaterScene(aperture, {
        canvas: data.canvas ?? { width: 960, height: 540 },
        brokenWgsl: data.brokenWgsl === true,
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

      updateWaterMaterial(aperture, scene, finiteNumber(data.time, 0));
      scene.app.step(finiteNumber(data.delta, 0), finiteNumber(data.time, 0));

      const frame = finiteInteger(data.frame, 1);
      const snapshot = scene.app.extract(frame);

      self.postMessage(
        {
          type: "snapshot",
          frame,
          time: finiteNumber(data.time, 0),
          delta: finiteNumber(data.delta, 0),
          shaderTime: finiteNumber(data.time, 0),
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

function createWaterScene(aperture, options) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 8 },
  });
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const shader = assets.shaders.add(
    aperture.createWgslShaderAsset({
      label: "Water WGSL",
      source: options.brokenWgsl ? brokenWaterWgsl() : waterWgsl(),
      virtualPath: "water.wgsl",
    }),
    { id: "custom-water-shader" },
  );
  const mesh = assets.meshes.add(createWaterPlaneMesh(), {
    id: "custom-water-plane",
  });
  const material = assets.materials.customWgsl.add(
    createWaterMaterial(aperture, shader, 0),
    { id: "custom-water-material" },
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 2.45] }),
    aperture.withCamera({
      aspect: options.canvas.width / options.canvas.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(mesh),
    aperture.withMaterial(material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return { app, mesh, material, shader, brokenWgsl: options.brokenWgsl };
}

function updateWaterMaterial(aperture, scene, time) {
  scene.app.assets.markReady(
    scene.material,
    createWaterMaterial(aperture, scene.shader, time),
  );
}

function createWaterMaterial(aperture, shader, time) {
  return aperture.createCustomWgslMaterialAsset({
    familyKey: "example/water",
    label: "Water Material",
    shader: { kind: "shader-asset", handle: shader },
    entryPoints: { vertex: "vs_main", fragment: "fs_main" },
    renderState: {
      cullMode: "none",
      depth: { test: true, write: false, compare: "less" },
      blend: { preset: "alpha" },
      alphaMode: "blend",
    },
    bindings: [
      {
        name: "water",
        binding: 0,
        kind: "uniform-buffer",
        visibility: ["fragment"],
        label: "WaterUniforms",
        fields: {
          color: { type: "vec4", default: waterColor },
          time: { type: "float32", default: 0 },
        },
        values: {
          color: waterColor,
          time,
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
    familyKey: "example/water",
    brokenWgsl: scene.brokenWgsl,
  };
}

function createWaterPlaneMesh() {
  return {
    kind: "mesh",
    label: "CustomWaterPlane",
    vertexStreams: [
      {
        id: "primitive-interleaved",
        arrayStride: 32,
        vertexCount: 4,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data: new Float32Array([
          -1.35, -0.75, 0, 0, 0, 1, 0, 1, 1.35, -0.75, 0, 0, 0, 1, 1, 1, 1.35,
          0.75, 0, 0, 0, 1, 1, 0, -1.35, 0.75, 0, 0, 0, 1, 0, 0,
        ]),
      },
    ],
    indexBuffer: {
      format: "uint16",
      data: new Uint16Array([0, 1, 2, 0, 2, 3]),
    },
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 4,
        indexStart: 0,
        indexCount: 6,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: { min: [-1.35, -0.75, 0], max: [1.35, 0.75, 0] },
    localSphere: { center: [0, 0, 0], radius: 1.55 },
  };
}

function waterWgsl() {
  return `
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
  @location(0) uv: vec2f,
};

struct WaterUniforms {
  color: vec4f,
  time: f32,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> water: WaterUniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let wave = sin((input.position.x * 5.0) + water.time * 3.0) * 0.08;
  let world = worldTransforms[input.instanceIndex];
  output.position =
    view.viewProjection * world * vec4f(input.position.x, input.position.y + wave, input.position.z, 1.0);
  output.uv = input.uv;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let shimmer = 0.5 + 0.5 * sin(water.time * 5.0 + input.uv.x * 8.0);
  let foam = smoothstep(0.72, 1.0, shimmer);
  let base = water.color.rgb + vec3f(0.0, 0.18, 0.28) * shimmer;
  return vec4f(mix(base, vec3f(0.72, 0.92, 1.0), foam * 0.35), water.color.a);
}
`;
}

function brokenWaterWgsl() {
  return `
@vertex
fn vs_main() -> @builtin(position) vec4f {
  return vec4f(0.0, 0.0, 0.0, 1.0);
}
`;
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
