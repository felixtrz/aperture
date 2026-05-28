import { binaryTemplateFile, textTemplateFile } from "./files.js";
import { SAMPLE_CUBE_GLB_BASE64 } from "./sample-cube.js";
import type { TemplateFile } from "../types.js";

export function gameTemplateFiles(): readonly TemplateFile[] {
  return [
    textTemplateFile("aperture.config.ts", gameConfigTs()),
    binaryTemplateFile("public/assets/goal-cube.glb", SAMPLE_CUBE_GLB_BASE64),
    textTemplateFile("src/systems/setup.system.ts", gameSetupSystemTs()),
    textTemplateFile("src/systems/player.system.ts", gamePlayerSystemTs()),
    textTemplateFile(
      "src/systems/camera-follow.system.ts",
      gameCameraFollowSystemTs(),
    ),
  ];
}

function gameConfigTs(): string {
  return `import { asset, defineApertureConfig, input, signal } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    goal: asset.gltf("/assets/goal-cube.glb", {
      preload: "blocking",
      label: "Goal Cube",
    }),
  },
  signals: {
    score: signal.number(0),
    playerX: signal.number(0),
    goalReached: signal.boolean(false),
  },
  input: {
    actions: {
      move: input.axis2d([
        input.keyboard2d({
          negativeX: ["ArrowLeft", "KeyA"],
          positiveX: ["ArrowRight", "KeyD"],
        }),
        input.gamepadStick("left"),
      ]),
      jump: input.button([
        input.key("Space"),
        input.key("KeyW"),
        input.gamepadButton("south"),
      ]),
      reset: input.button([input.key("KeyR")]),
    },
  },
  render: {
    clearColor: [0.08, 0.12, 0.16, 1],
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

function gameSetupSystemTs(): string {
  return `import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "Main Camera",
      transform: {
        translation: [0, 3, 7],
        lookAt: [0, 0.6, 0],
      },
      fovYDegrees: 50,
    });

    this.spawn.light({
      key: "light.key",
      name: "Key Light",
      kind: "directional",
      illuminance: 4,
      transform: {
        rotationEulerDegrees: [-45, 25, 0],
      },
    });

    this.spawn.light({
      key: "light.fill",
      name: "Fill Light",
      kind: "ambient",
      intensity: 0.45,
    });

    this.spawn.mesh({
      key: "level.ground",
      name: "Ground",
      tags: ["level", "ground"],
      mesh: mesh.box({ size: [9, 0.3, 1.5] }),
      material: material.standard({
        baseColor: [0.18, 0.44, 0.32, 1],
        roughness: 0.65,
      }),
      transform: { translation: [0, -0.15, 0] },
    });

    this.spawn.mesh({
      key: "player",
      name: "Player",
      tags: ["player", "controllable"],
      mesh: mesh.box({ size: [0.5, 0.8, 0.5] }),
      material: material.standard({
        baseColor: [0.18, 0.58, 1, 1],
        roughness: 0.45,
      }),
      transform: { translation: [-3.5, 0.55, 0] },
    });

    this.spawn.gltf(this.assets.gltf("goal"), {
      key: "collectible.goal",
      name: "Goal Gem",
      tags: ["collectible", "goal"],
      transform: { translation: [1.8, 0.65, 0], scale: [0.35, 0.35, 0.35] },
    });

    this.spawn.mesh({
      key: "finish.flag",
      name: "Finish",
      tags: ["finish"],
      mesh: mesh.box({ size: [0.25, 1.2, 0.25] }),
      material: material.standard({
        baseColor: [1, 0.25, 0.3, 1],
        roughness: 0.5,
      }),
      transform: { translation: [3.8, 0.6, 0] },
    });
  }
}
`;
}

function gamePlayerSystemTs(): string {
  return `import {
  AppEntityKey,
  LocalTransform,
  createSystem,
} from "@aperture-engine/app/systems";

export default class PlayerSystem extends createSystem({
  priority: 20,
  queries: {
    actors: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  override update(delta: number): void {
    const player = this.findByKey("player");
    const gem = this.findByKey("collectible.goal");
    const score = this.signals.score;
    const playerX = this.signals.playerX;
    const goalReached = this.signals.goalReached;

    if (
      player === null ||
      score === undefined ||
      playerX === undefined ||
      goalReached === undefined
    ) {
      return;
    }

    const playerTranslation = player.getVectorView(LocalTransform, "translation");

    const reset = this.actions.reset;
    if (reset?.kind === "button" && reset.down()) {
      playerTranslation[0] = -3.5;
      score.value = 0;
      goalReached.value = false;
      if (gem !== null) {
        gem.getVectorView(LocalTransform, "translation")[1] = 0.65;
      }
    }

    const move = this.actions.move;
    const direction = move?.kind === "axis2d" ? move.x.value : 0;
    const playerCurrentX = playerTranslation[0] ?? -3.5;
    const playerNextX = Math.max(
      -4,
      Math.min(4.2, playerCurrentX + direction * delta * 3),
    );
    playerTranslation[0] = playerNextX;
    playerX.value = playerNextX;

    if (
      gem !== null &&
      Number(score.value) === 0 &&
      Math.abs(playerNextX - 1.8) < 0.45
    ) {
      score.value = 1;
      gem.getVectorView(LocalTransform, "translation")[1] = -10;
      this.diagnostics.info("game.collectible.collected", {
        score: score.value,
      });
    }

    if (Number(score.value) > 0 && playerNextX > 3.5) {
      goalReached.value = true;
    }
  }

  private findByKey(key: string) {
    for (const entity of this.queries.actors.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) {
        return entity;
      }
    }

    return null;
  }
}
`;
}

function gameCameraFollowSystemTs(): string {
  return `import {
  AppEntityKey,
  LocalTransform,
  createSystem,
} from "@aperture-engine/app/systems";

export default class CameraFollowSystem extends createSystem({
  priority: 80,
  queries: {
    actors: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  override update(): void {
    const player = this.findByKey("player");
    const camera = this.findByKey("camera.main");

    if (player === null || camera === null) {
      return;
    }

    const playerTranslation = player.getVectorView(LocalTransform, "translation");
    const cameraTranslation = camera.getVectorView(LocalTransform, "translation");
    cameraTranslation[0] = playerTranslation[0] ?? 0;
  }

  private findByKey(key: string) {
    for (const entity of this.queries.actors.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) {
        return entity;
      }
    }

    return null;
  }
}
`;
}
