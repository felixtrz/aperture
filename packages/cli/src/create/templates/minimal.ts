import { textTemplateFile } from "./files.js";
import type { TemplateFile } from "../types.js";

export function minimalTemplateFiles(): readonly TemplateFile[] {
  return [
    textTemplateFile("aperture.shared-config.ts", apertureSharedConfigTs()),
    textTemplateFile("aperture.config.ts", apertureConfigTs()),
    textTemplateFile("aperture.headless.config.ts", apertureHeadlessConfigTs()),
    textTemplateFile("src/systems/setup.system.ts", setupSystemTs()),
    textTemplateFile("src/systems/spin.system.ts", spinSystemTs()),
  ];
}

function apertureConfigTs(): string {
  return `import { createApertureAppConfig } from "./aperture.shared-config.ts";

export default createApertureAppConfig({
  mode: "browser",
  canvas: "#aperture",
});
`;
}

function apertureHeadlessConfigTs(): string {
  return `import { createApertureAppConfig } from "./aperture.shared-config.ts";

export default createApertureAppConfig({
  mode: "headless",
});
`;
}

function apertureSharedConfigTs(): string {
  return `import { defineApertureConfig, input, signal } from "@aperture-engine/app/config";

interface ApertureAppConfigOptions {
  readonly mode: "browser" | "headless";
  readonly canvas?: string;
}

export function createApertureAppConfig(options: ApertureAppConfigOptions) {
  return defineApertureConfig({
    mode: options.mode,
    ...(options.mode === "browser"
      ? { canvas: options.canvas ?? "#aperture" }
      : {}),
    systems: ["src/systems/**/*.system.ts"],
    signals: {
      selectedEntity: signal.ref(null),
    },
    input: {
      actions: {
        select: input.button([input.pointer("primary"), input.key("Enter")]),
      },
    },
    render: {
      defaultCamera: false,
      defaultLight: false,
      // The filmic pipeline the showcases ship with: ACES tonemapping through
      // the HDR scene buffer, plus a subtle bloom. A daylight gradient sky and
      // image-based lighting install automatically (render.defaultEnvironment)
      // unless this app authors its own sky or environment light.
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

function setupSystemTs(): string {
  return `import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "Main Camera",
      transform: {
        translation: [0, 1.4, 5],
        lookAt: [0, 0.6, 0],
      },
      fovYDegrees: 55,
    });

    // The sun. Ambient/fill light comes from the default daylight
    // environment's image-based lighting, so no separate fill light is
    // needed. Shadows ground objects — keep them on.
    this.spawn.light({
      key: "light.sun",
      name: "Sun",
      kind: "directional",
      illuminance: 2.2,
      transform: {
        rotationEulerDegrees: [-45, 35, 0],
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
      key: "level.ground",
      name: "Ground",
      tags: ["level", "ground"],
      mesh: mesh.box({ size: [12, 0.2, 12] }),
      material: material.standard({
        baseColor: [0.42, 0.44, 0.42, 1],
        roughness: 0.9,
      }),
      transform: { translation: [0, -0.1, 0] },
      castShadow: false,
      receiveShadow: true,
    });

    this.spawn.mesh({
      key: "starter.cube",
      name: "Starter Cube",
      tags: ["starter", "inspectable"],
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({
        baseColor: [0.13, 0.45, 0.95, 1],
        roughness: 0.45,
      }),
      transform: {
        translation: [0, 0.5, 0],
      },
      castShadow: true,
      receiveShadow: true,
    });
  }
}
`;
}

function spinSystemTs(): string {
  return `import {
  AppEntityKey,
  EcsType,
  LocalTransform,
  createSystem,
  quatFromAxisAngle,
} from "@aperture-engine/app/systems";

export default class SpinSystem extends createSystem({
  priority: 10,
  queries: {
    cubes: { required: [AppEntityKey, LocalTransform] },
  },
  config: {
    speed: { type: EcsType.Float32, default: 0.8 },
  },
}) {
  override update(_delta: number, time: number): void {
    for (const entity of this.queries.cubes.entities) {
      if (entity.getValue(AppEntityKey, "value") !== "starter.cube") {
        continue;
      }

      entity
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromAxisAngle([0, 1, 0], time * this.config.speed.value));
    }
  }
}
`;
}
