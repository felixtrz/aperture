import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { createTextureHandle } from "@aperture-engine/simulation";
import {
  WALL_SIZE,
  WALL_TEXTURE_ID,
  runtimeTextureClearColor,
  runtimeTextureWallWgsl,
  solidRgbaBytes,
} from "./runtime-texture-scene.js";

// D3 (three.js parity plan): the WORKER half of the runtime-texture example. It
// registers the dynamic texture atlas as DOM-FREE metadata
// (`this.textures.register` — copy-dst + render-attachment usage) and authors the
// custom-WGSL video-wall quad that samples it. The worker never touches the DOM,
// never holds a canvas/video, and never uploads — the MAIN THREAD updates the
// texture's regions every frame (runtime-texture.main.js). Extraction validates
// the quad's texture handle against the registered asset, which mirrors to the
// renderer where the pixel uploads land.

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: runtimeTextureClearColor,
  },
});

class RuntimeTextureSystem extends createSystem({ priority: 0 }) {
  init() {
    // The dynamic texture atlas: copy-dst (writeTexture) + render-attachment
    // (copyExternalImageToTexture) usage, seeded with a dim solid color.
    this.textures.register({
      id: WALL_TEXTURE_ID,
      width: WALL_SIZE.width,
      height: WALL_SIZE.height,
      externalImage: true,
      data: solidRgbaBytes(
        WALL_SIZE.width,
        WALL_SIZE.height,
        [16, 16, 24, 255],
      ),
      label: "Runtime Texture Video Wall",
    });

    this.spawn.camera({
      key: "camera.main",
      name: "runtime-texture-camera",
      transform: { translation: [0, 0, 3], lookAt: [0, 0, 0] },
      fovYDegrees: 50,
    });

    // A dim built-in (unlit) backdrop behind the screen-space wall (also gives
    // the frame a built-in draw so the route is the proven mixed path).
    this.spawn.mesh({
      key: "backdrop",
      name: "runtime-texture-backdrop",
      mesh: mesh.plane({ size: [6, 4.5] }),
      material: material.unlit({ baseColor: [0.03, 0.04, 0.08, 1] }),
      transform: { translation: [0, 0, -0.5] },
    });

    // The video-wall quad: ONE custom-WGSL material sampling the atlas.
    this.spawn.mesh({
      key: "video-wall",
      name: "runtime-texture-wall",
      mesh: mesh.plane({ size: [1, 1] }),
      material: material.customWgsl({
        familyKey: "example/runtime-texture-wall",
        label: "Runtime Texture Wall",
        shader: {
          kind: "inline-wgsl",
          code: runtimeTextureWallWgsl(),
          virtualPath: "runtime-texture-wall.wgsl",
        },
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
        bindings: [
          material.texture("wallTexture", {
            binding: 0,
            visibility: ["fragment"],
            texture: createTextureHandle(WALL_TEXTURE_ID),
          }),
        ],
      }),
    });
  }
}

startGeneratedSimulationWorker({
  config,
  systems: [{ default: RuntimeTextureSystem }],
});
