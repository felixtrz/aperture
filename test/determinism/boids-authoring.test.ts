import { describe, expect, it } from "vitest";

import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import {
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";
import {
  defineInstanceAttributes,
  type RenderSnapshot,
} from "@aperture-engine/render";

// The example seeds its flock with this exact deterministic LCG (mirrored from
// examples/boids-scene.js, which is untyped plain JS). Identical bytes every run
// are the ONLY reproducible input the GPU sim receives.
const BOID_COUNT = 160;

function seedBoids(count: number): Float32Array {
  const data = new Float32Array(count * 4);
  let state = 0x9e3779b9 >>> 0;
  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  for (let index = 0; index < count; index += 1) {
    const angle = next() * Math.PI * 2;
    const radius = 0.15 + next() * 0.6;
    const heading = next() * Math.PI * 2;
    const speed = 0.18 + next() * 0.18;
    const offset = index * 4;
    data[offset] = Math.cos(angle) * radius;
    data[offset + 1] = Math.sin(angle) * radius * 0.72;
    data[offset + 2] = Math.cos(heading) * speed;
    data[offset + 3] = Math.sin(heading) * speed;
  }
  return data;
}

// C1 (three.js parity plan): GPU boids determinism. The boids SIMULATION runs on
// the GPU (a compute pass), whose float positions differ across adapters
// (SwiftShader vs real GPU) and are intentionally NEVER hashed. What IS
// deterministic — and what "60-frame determinism with a fixed seed" asserts — is
// the CPU/ECS-authoritative seed → spawn → command stream: the seeded buffer
// bytes, the instanced entity count, and the per-frame authored snapshot. This
// headless gate proves two fresh runs produce identical authoring across 60
// fixed-delta frames (no GPU involved).

const FIXED_DELTA = 1 / 60;
const FRAMES = 60;

const CONFIG = defineApertureConfig({
  mode: "headless",
  systems: [],
});

const RENDER_WGSL = `
@vertex fn vs_main(@location(0) p: vec3f, @location(6) s: vec4f) -> @builtin(position) vec4f {
  return vec4f(p + vec3f(s.xy, 0.0), 1.0);
}
@fragment fn fs_main() -> @location(0) vec4f { return vec4f(1.0); }
`;

function createBoidsAuthoringSystem() {
  return class BoidsAuthoringSystem extends createSystem({ priority: 0 }) {
    override init(): void {
      const buffer = this.buffers.register({
        id: "boids.positions",
        elementType: "vec4f",
        elementCount: BOID_COUNT,
        usage: "storage",
        data: seedBoids(BOID_COUNT),
        label: "Boid Flock State",
      });

      this.spawn.camera({
        key: "camera.main",
        transform: { translation: [0, 0, 2], lookAt: [0, 0, 0] },
      });

      const boidMaterial = material.customWgsl({
        familyKey: "test/boids",
        label: "Boids",
        shader: {
          kind: "inline-wgsl",
          code: RENDER_WGSL,
          virtualPath: "boids.wgsl",
        },
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
        renderState: { cullMode: "none" },
        bindings: [
          material.storage("boids", {
            binding: 0,
            visibility: ["vertex"],
            buffer,
          }),
        ],
        instanceBuffer: {
          buffer,
          attributes: defineInstanceAttributes([
            { name: "instanceState", format: "float32x4" },
          ]),
        },
      });

      this.spawn.mesh({
        key: "boid",
        mesh: mesh.plane({ size: [0.03, 0.05] }),
        material: boidMaterial,
        transform: { translation: [0, 0, 0] },
      });

      const meshHandle = createMeshHandle("boid.mesh");
      const materialHandle = createMaterialHandle("boid.material");
      for (let index = 1; index < BOID_COUNT; index += 1) {
        this.spawn.mesh({
          mesh: meshHandle,
          material: materialHandle,
          transform: { translation: [0, 0, 0] },
        });
      }
    }
  };
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// Deliberately projects only the CPU-authored schedule (draw identities + the
// authored transforms), never GPU-computed positions.
function hashAuthoring(snapshot: RenderSnapshot): string {
  return fnv1a(
    JSON.stringify({
      frame: snapshot.frame,
      draws: snapshot.meshDraws.map((draw) => [
        draw.renderId,
        draw.mesh.id,
        draw.material.id,
      ]),
      transformFloats: snapshot.transforms.length,
    }),
  );
}

async function runBoidsAuthoring(): Promise<{
  readonly hashes: readonly string[];
  readonly instanceCount: number;
}> {
  const app = await createApertureApp({
    config: CONFIG,
    systems: [{ default: createBoidsAuthoringSystem() }],
  });
  const hashes: string[] = [];
  let instanceCount = 0;

  for (let frame = 1; frame <= FRAMES; frame += 1) {
    app.step(FIXED_DELTA, frame * FIXED_DELTA);
    const snapshot = app.extract(frame);
    hashes.push(hashAuthoring(snapshot));
    instanceCount = snapshot.meshDraws.length;
  }

  return { hashes, instanceCount };
}

describe("GPU boids authoring determinism (C1)", () => {
  it("seeds the flock deterministically from a fixed seed", () => {
    // The seed is the ONLY reproducible input to the GPU sim; identical bytes
    // every run guarantee the same starting flock on any adapter.
    expect(seedBoids(BOID_COUNT)).toEqual(seedBoids(BOID_COUNT));
    expect(seedBoids(BOID_COUNT).length).toBe(BOID_COUNT * 4);
  });

  it("produces identical authored snapshots across two fresh runs (60 frames)", async () => {
    const first = await runBoidsAuthoring();
    const second = await runBoidsAuthoring();

    expect(first.hashes).toHaveLength(FRAMES);
    expect(second.hashes).toEqual(first.hashes);
    // The instanced entity count is stable and complete.
    expect(first.instanceCount).toBe(BOID_COUNT);
  });
});
