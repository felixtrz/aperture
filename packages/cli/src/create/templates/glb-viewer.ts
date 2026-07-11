import { binaryTemplateFile, textTemplateFile } from "./files.js";
import { SAMPLE_CUBE_GLB_BASE64 } from "./sample-cube.js";
import type { TemplateFile } from "../types.js";

export function glbViewerTemplateFiles(): readonly TemplateFile[] {
  return [
    textTemplateFile("aperture.shared-config.ts", glbViewerSharedConfigTs()),
    textTemplateFile("aperture.config.ts", glbViewerConfigTs()),
    textTemplateFile(
      "aperture.headless.config.ts",
      glbViewerHeadlessConfigTs(),
    ),
    binaryTemplateFile("public/assets/sample-cube.glb", SAMPLE_CUBE_GLB_BASE64),
    textTemplateFile("src/systems/setup.system.ts", glbViewerSetupSystemTs()),
    textTemplateFile("src/systems/orbit.system.ts", glbViewerOrbitSystemTs()),
  ];
}

function glbViewerConfigTs(): string {
  return `import { createApertureAppConfig } from "./aperture.shared-config.ts";

export default createApertureAppConfig({
  mode: "browser",
  baseUrl: import.meta.env.BASE_URL,
  canvas: "#aperture",
});
`;
}

function glbViewerHeadlessConfigTs(): string {
  return `import { createApertureAppConfig } from "./aperture.shared-config.ts";

export default createApertureAppConfig({
  mode: "headless",
  baseUrl: "/",
});
`;
}

function glbViewerSharedConfigTs(): string {
  return `import { asset, defineApertureConfig, input } from "@aperture-engine/app/config";

interface ApertureAppConfigOptions {
  readonly mode: "browser" | "headless";
  readonly baseUrl: string;
  readonly canvas?: string;
}

export function createApertureAppConfig(options: ApertureAppConfigOptions) {
  const assetUrl = (path: string) => \`\${options.baseUrl}\${path}\`;

  return defineApertureConfig({
    mode: options.mode,
    ...(options.mode === "browser"
      ? { canvas: options.canvas ?? "#aperture" }
      : {}),
    systems: ["src/systems/**/*.system.ts"],
    assets: {
      sampleCube: asset.gltf(assetUrl("assets/sample-cube.glb"), {
        preload: "blocking",
        label: "Sample Cube",
      }),
    },
    input: {
      actions: {
        resetView: input.button([input.key("KeyR")]),
      },
    },
    render: {
      defaultCamera: false,
      defaultLight: false,
      // ACES tonemapping through the HDR scene buffer plus a subtle bloom;
      // the daylight sky + image-based lighting install automatically via
      // render.defaultEnvironment, so glTF PBR materials read correctly.
      tonemap: "aces",
      exposure: 1,
      bloom: { threshold: 0.75, intensity: 0.04, radiusPixels: 2 },
      sampleCount: 4,
      maxPixelRatio: 2,
    },
    diagnostics: {
      level: "info",
    },
  });
}
`;
}

function glbViewerSetupSystemTs(): string {
  return `import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "Main Camera",
      transform: {
        translation: [0, 1.4, 4],
        lookAt: [0, 0.4, 0],
      },
      fovYDegrees: 50,
    });

    // The sun. Ambient/fill light comes from the default daylight
    // environment's image-based lighting, which also gives glTF PBR
    // materials their reflections.
    this.spawn.light({
      key: "light.sun",
      name: "Sun",
      kind: "directional",
      illuminance: 4,
      transform: {
        rotationEulerDegrees: [-40, 35, 0],
      },
      shadow: {
        mapSize: 2048,
        cascadeCount: 1,
        shadowType: 1,
        strength: 0.75,
        filterRadius: 2,
        normalBias: 0.04,
      },
    });

    this.spawn.mesh({
      key: "viewer.ground",
      name: "Ground",
      tags: ["level", "ground"],
      mesh: mesh.box({ size: [8, 0.2, 8] }),
      material: material.standard({
        baseColor: [0.72, 0.72, 0.7, 1],
        roughness: 0.9,
      }),
      transform: { translation: [0, -0.6, 0] },
      castShadow: false,
      receiveShadow: true,
    });

    this.spawn.gltf(this.assets.gltf("sampleCube"), {
      key: "viewer.sampleCube",
      name: "Sample Cube",
      tags: ["asset", "gltf", "inspectable"],
      castShadow: true,
      receiveShadow: true,
    });
  }
}
`;
}

function glbViewerOrbitSystemTs(): string {
  return `import {
  AppEntityKey,
  LocalTransform,
  createSystem,
  quatFromAxisAngle,
} from "@aperture-engine/app/systems";

export default class OrbitSystem extends createSystem({
  priority: 20,
  queries: {
    objects: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  override update(_delta: number, time: number): void {
    for (const entity of this.queries.objects.entities) {
      if (entity.getValue(AppEntityKey, "value") !== "viewer.sampleCube") {
        continue;
      }

      entity
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromAxisAngle([0, 1, 0], time * 0.6));
    }
  }
}
`;
}
