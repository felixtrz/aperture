import { binaryTemplateFile, textTemplateFile } from "./files.js";
import { SAMPLE_CUBE_GLB_BASE64 } from "./sample-cube.js";
import type { TemplateFile } from "../types.js";

export function glbViewerTemplateFiles(): readonly TemplateFile[] {
  return [
    textTemplateFile("aperture.config.ts", glbViewerConfigTs()),
    binaryTemplateFile("public/assets/sample-cube.glb", SAMPLE_CUBE_GLB_BASE64),
    textTemplateFile("src/systems/setup.system.ts", glbViewerSetupSystemTs()),
    textTemplateFile("src/systems/orbit.system.ts", glbViewerOrbitSystemTs()),
  ];
}

function glbViewerConfigTs(): string {
  return `import { asset, defineApertureConfig, input } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    sampleCube: asset.gltf("/assets/sample-cube.glb", {
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
    clearColor: [0.03, 0.035, 0.04, 1],
    defaultCamera: false,
    defaultLight: false,
    sampleCount: 4,
    maxPixelRatio: 2,
  },
  diagnostics: {
    level: "info",
  },
});
`;
}

function glbViewerSetupSystemTs(): string {
  return `import { createSystem } from "@aperture-engine/app/systems";

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

    this.spawn.light({
      key: "light.key",
      name: "Key Light",
      kind: "directional",
      illuminance: 4,
      transform: {
        rotationEulerDegrees: [-40, 35, 0],
      },
    });

    this.spawn.light({
      key: "light.fill",
      name: "Fill Light",
      kind: "ambient",
      intensity: 0.4,
    });

    this.spawn.gltf(this.assets.gltf("sampleCube"), {
      key: "viewer.sampleCube",
      name: "Sample Cube",
      tags: ["asset", "gltf", "inspectable"],
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
