import {
  createSourceAssetSerializationState,
  serializeSourceAssetRegistry,
} from "/worker-modules/packages/app/dist/asset-mirror.js";
import {
  VOLUME_SIZE,
  clearColor,
  createVolumeTextureBytes,
} from "./volume-texture-lut-scene.js";

let apertureModulePromise = null;
let scene = null;
const sourceAssetState = createSourceAssetSerializationState();

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The volume texture worker raised an error.",
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
      scene = createVolumeScene(
        aperture,
        data.canvas ?? { width: 960, height: 540 },
      );
      self.postMessage({ type: "ready", scene: sceneSummary(aperture, scene) });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }

      scene.app.step(0, 0);
      const frame = finiteInteger(data.frame, 1);
      const snapshot = scene.app.extract(frame);
      self.postMessage(
        {
          type: "snapshot",
          frame,
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

function createVolumeScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 8 },
  });
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });

  const shader = assets.shaders.add(
    aperture.createWgslShaderAsset({
      label: "Volume LUT WGSL",
      source: volumeWgsl(),
      virtualPath: "volume-lut.wgsl",
    }),
    { id: "volume-lut-shader" },
  );
  // Textures/samplers have no typed collection — register them on the shared
  // registry under stable ids so the main thread mirrors the same handles.
  const texture = aperture.createTextureHandle("volume-lut-texture");
  app.assets.register(texture);
  app.assets.markReady(
    texture,
    aperture.createTextureAsset({
      label: "VolumeLut",
      dimension: "3d",
      width: VOLUME_SIZE,
      height: VOLUME_SIZE,
      depthOrLayers: VOLUME_SIZE,
      format: "rgba8unorm",
      colorSpace: "data",
      semantic: "data",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: createVolumeTextureBytes(VOLUME_SIZE),
        bytesPerRow: VOLUME_SIZE * 4,
        rowsPerImage: VOLUME_SIZE,
      },
    }),
  );
  const sampler = aperture.createSamplerHandle("volume-lut-sampler");
  app.assets.register(sampler);
  app.assets.markReady(
    sampler,
    aperture.createSamplerAsset({
      label: "VolumeLutSampler",
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
    }),
  );
  const mesh = assets.meshes.add(createQuadMesh(), { id: "volume-lut-quad" });
  const material = assets.materials.customWgsl.add(
    aperture.createCustomWgslMaterialAsset({
      familyKey: "example/volume-lut",
      label: "Volume LUT Material",
      shader: { kind: "shader-asset", handle: shader },
      entryPoints: { vertex: "vs_main", fragment: "fs_main" },
      renderState: {
        cullMode: "none",
        depth: { test: true, write: true, compare: "less" },
      },
      bindings: [
        {
          name: "volumeTexture",
          binding: 0,
          kind: "texture",
          visibility: ["fragment"],
          texture,
          sampleType: "float",
          viewDimension: "3d",
        },
        {
          name: "volumeSampler",
          binding: 1,
          kind: "sampler",
          visibility: ["fragment"],
          sampler,
          samplerType: "filtering",
        },
      ],
    }),
    { id: "volume-lut-material" },
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 2.4] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
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

  return { app, mesh, material, shader, texture, sampler };
}

function sceneSummary(aperture, scene) {
  return {
    meshKey: aperture.assetHandleKey(scene.mesh),
    materialKey: aperture.assetHandleKey(scene.material),
    shaderKey: aperture.assetHandleKey(scene.shader),
    textureKey: aperture.assetHandleKey(scene.texture),
    samplerKey: aperture.assetHandleKey(scene.sampler),
    familyKey: "example/volume-lut",
  };
}

function createQuadMesh() {
  return {
    kind: "mesh",
    label: "VolumeLutQuad",
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
        // uv.y = 0 at the top, 1 at the bottom, so the fragment shader walks the
        // volume depth top-to-bottom.
        data: new Float32Array([
          -1.3, -1.0, 0, 0, 0, 1, 0, 1, 1.3, -1.0, 0, 0, 0, 1, 1, 1, 1.3, 1.0,
          0, 0, 0, 1, 1, 0, -1.3, 1.0, 0, 0, 0, 1, 0, 0,
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
    localAabb: { min: [-1.3, -1.0, 0], max: [1.3, 1.0, 0] },
    localSphere: { center: [0, 0, 0], radius: 1.64 },
  };
}

function volumeWgsl() {
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

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var volumeTexture: texture_3d<f32>;
@group(2) @binding(1) var volumeSampler: sampler;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  output.position = view.viewProjection * world * vec4f(input.position, 1.0);
  output.uv = input.uv;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  // Sample the 3D LUT volume: fix red/green at the center of the slice plane and
  // walk the blue (depth) axis with the quad's vertical UV so the top reads the
  // first slice color and the bottom reads the last.
  let coord = vec3f(0.5, 0.5, clamp(input.uv.y, 0.0, 1.0));
  let sampled = textureSampleLevel(volumeTexture, volumeSampler, coord, 0.0);
  return vec4f(sampled.rgb, 1.0);
}
`;
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
