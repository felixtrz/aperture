import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { input } from "@aperture-engine/app/config";
import {
  LocalTransform,
  createSystem,
  material,
  mesh,
  type InputAxis2dAction,
  type InputButtonAction,
} from "@aperture-engine/app/systems";
import { PhysicsRigidBodyType } from "@aperture-engine/physics";
import { createTestPhysicsBackend } from "@aperture-engine/physics/testing";
import type { RenderSnapshot } from "@aperture-engine/render";
import type { Entity } from "@aperture-engine/simulation";
import {
  advanceGeneratedInputFrame,
  createGeneratedInputEventMessage,
  drainGeneratedInputEventMessagesForFrame,
  type ApertureGeneratedInputEventMessage,
} from "../../packages/app/src/input/events.js";

// AF-2 (readiness roadmap R2.3): the determinism replay gate. A committed
// recording of frame-stamped inputs drives a headless app (movement system,
// spawn/despawn, and a physics body on the deterministic test backend) for
// 300 fixed-delta frames; every frame's extracted snapshot is hashed.
//
// Two fresh app instances must produce identical hash sequences (catches
// map-iteration order, pooled-scratch leakage, wall-clock reads), and the
// sequence must match the committed fixture (catches engine/platform drift).
//
// After an INTENTIONAL simulation-affecting change, refresh the fixture and
// review it like any other diff:
//   APERTURE_UPDATE_DETERMINISM_HASHES=1 npx vitest run test/determinism/replay.test.ts
//
// Hashes are computed over a float-quantized (1e-5) stable projection of the
// snapshot, so sub-ulp libm differences across V8 versions cannot flip them
// while any real divergence (different inputs, order, or physics) does.

const FIXED_DELTA = 1 / 60;
const FRAMES = 300;
const EXPECTED_HASHES_FILE = path.join(
  process.cwd(),
  "test/fixtures/determinism/expected-hashes.json",
);

const APP_CONFIG = defineApertureConfig({
  mode: "headless",
  systems: [],
  input: {
    actions: {
      move: input.axis2d([
        input.keyboard2d({
          negativeX: ["KeyA"],
          positiveX: ["KeyD"],
          negativeY: ["KeyS"],
          positiveY: ["KeyW"],
        }),
      ]),
      jump: input.button([input.key("Space")]),
    },
  },
});

function keyMessage(
  code: string,
  pressed: boolean,
  frame: number,
): ApertureGeneratedInputEventMessage {
  return createGeneratedInputEventMessage(
    { kind: "keyboard", code, pressed },
    frame,
  );
}

// The committed recording: move right (frames 10-120), spawn a crate on the
// jump edges at frames 30 and 180, move left (frames 200-260). The system
// despawns the first crate at update 240.
const RECORDING: readonly ApertureGeneratedInputEventMessage[] = [
  keyMessage("KeyD", true, 10),
  keyMessage("Space", true, 30),
  keyMessage("Space", false, 31),
  keyMessage("KeyD", false, 120),
  keyMessage("Space", true, 180),
  keyMessage("Space", false, 181),
  keyMessage("KeyA", true, 200),
  keyMessage("KeyA", false, 260),
];

function createReplaySystem() {
  return class ReplaySystem extends createSystem({ priority: 10 }) {
    #mover: Entity | null = null;
    #spawned: Entity[] = [];
    #updates = 0;

    override init(): void {
      this.spawn.camera({
        key: "camera.replay",
        transform: { translation: [0, 2, 8], lookAt: [0, 0, 0] },
      });
      this.#mover = this.spawn.mesh({
        key: "mover",
        mesh: mesh.box({ size: 0.5 }),
        material: material.standard(),
        transform: { translation: [0, 0, 0] },
      });
      // A rendered, physics-driven body: the deterministic test backend
      // integrates its velocity each fixed step and writes the pose back, so
      // physics motion is part of every frame hash.
      this.spawn.mesh({
        key: "physics.replay",
        mesh: mesh.box({ size: 0.5 }),
        material: material.standard(),
        transform: { translation: [0, 3, 0] },
        physics: {
          rigidBody: { type: PhysicsRigidBodyType.Dynamic },
          collider: { shape: { kind: "sphere", radius: 0.25 } },
          velocity: { linear: [0.4, 0, 0] },
        },
      });
    }

    override update(delta: number): void {
      this.#updates += 1;

      const move = this.actions.move as InputAxis2dAction | undefined;
      const jump = this.actions.jump as InputButtonAction | undefined;

      if (this.#mover !== null && this.#mover.active) {
        const translation = this.#mover.getVectorView(
          LocalTransform,
          "translation",
        );
        translation[0] =
          Number(translation[0] ?? 0) + (move?.x.value ?? 0) * delta * 3;
      }

      if (jump?.down() === true) {
        this.#spawned.push(
          this.spawn.mesh({
            key: `crate.${this.#spawned.length}`,
            mesh: mesh.box({ size: 0.25 }),
            material: material.standard(),
            transform: {
              translation: [this.#spawned.length, 0.5, -1],
            },
          }),
        );
      }

      if (this.#updates === 240) {
        const doomed = this.#spawned.shift();
        doomed?.destroy();
      }
    }
  };
}

function quantize(value: number): number {
  const rounded = Math.round(value * 1e5) / 1e5;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

function hashSnapshotForReplay(snapshot: RenderSnapshot): string {
  const projection = {
    frame: snapshot.frame,
    report: snapshot.report,
    draws: snapshot.meshDraws.map((draw) => [
      draw.renderId,
      draw.mesh.id,
      draw.material.id,
      draw.submesh,
      draw.materialSlot,
      draw.worldTransformOffset,
    ]),
    transforms: Array.from(snapshot.transforms, quantize),
    viewMatrices: Array.from(snapshot.viewMatrices, quantize),
    bounds: snapshot.bounds.map((bounds) => [
      ...[...bounds.worldAabb.min].map(quantize),
      ...[...bounds.worldAabb.max].map(quantize),
    ]),
    lights: snapshot.lights.length,
    views: snapshot.views.length,
  };

  return fnv1a(JSON.stringify(projection));
}

interface ReplayRun {
  readonly hashes: readonly string[];
  readonly drawCounts: Readonly<Record<number, number>>;
}

async function runReplay(): Promise<ReplayRun> {
  const app = await createApertureApp({
    config: APP_CONFIG,
    systems: [{ default: createReplaySystem() }],
    physics: { backend: () => createTestPhysicsBackend() },
  });
  const pending = [...RECORDING];
  const hashes: string[] = [];
  const drawCounts: Record<number, number> = {};

  for (let frame = 1; frame <= FRAMES; frame += 1) {
    advanceGeneratedInputFrame({
      signals: app.context.input,
      config: APP_CONFIG,
      events: drainGeneratedInputEventMessagesForFrame(pending, frame),
    });
    app.step(FIXED_DELTA, frame * FIXED_DELTA);

    const snapshot = app.extract(frame);
    hashes.push(hashSnapshotForReplay(snapshot));

    if (frame === 5 || frame === 100 || frame === 250) {
      drawCounts[frame] = snapshot.meshDraws.length;
    }
  }

  expect(pending).toHaveLength(0);
  return { hashes, drawCounts };
}

describe("determinism replay gate (AF-2)", () => {
  it("produces identical snapshot hashes across two fresh runs and matches the committed fixture", async () => {
    const first = await runReplay();
    const second = await runReplay();

    expect(second.hashes).toEqual(first.hashes);

    // The recording is genuinely expressed in the scene: the mover plus the
    // physics body draw from the start, one crate spawns at frame 30, a
    // second at frame 180, and the first crate despawns at update 240.
    expect(first.drawCounts).toEqual({ 5: 2, 100: 3, 250: 3 });

    // The scene actually changes over time — the hash is not a constant.
    expect(new Set(first.hashes).size).toBeGreaterThan(10);

    if (process.env["APERTURE_UPDATE_DETERMINISM_HASHES"] === "1") {
      writeFileSync(
        EXPECTED_HASHES_FILE,
        `${JSON.stringify(first.hashes, null, 2)}\n`,
      );
      return;
    }

    expect(
      existsSync(EXPECTED_HASHES_FILE),
      "expected-hashes fixture missing — run with APERTURE_UPDATE_DETERMINISM_HASHES=1 to generate",
    ).toBe(true);

    const expected = JSON.parse(
      readFileSync(EXPECTED_HASHES_FILE, "utf8"),
    ) as readonly string[];
    expect(first.hashes).toEqual(expected);
  });
});
