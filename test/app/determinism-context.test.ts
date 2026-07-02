import { describe, expect, it } from "vitest";
import {
  createApertureHeadlessEcsDigest,
  createApertureRenderSnapshotDigest,
  createApertureSessionSnapshot,
  createApertureStableDigest,
  createApertureHeadlessRunner,
  restoreApertureHeadlessRunnerFromSessionSnapshot,
  type ApertureSessionSnapshot,
  type ApertureHeadlessRunner,
} from "@aperture-engine/app/headless";
import { defineApertureConfig, signal } from "@aperture-engine/app/config";
import {
  createApertureRandom,
  createSystem,
  defineResource,
  material,
  mesh,
  resource,
  type SimulationFixedStepContext,
} from "@aperture-engine/app/systems";
import { LocalTransform, Name } from "@aperture-engine/simulation";
import { renderSnapshotToJsonValue } from "@aperture-engine/render";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";

describe("createApertureRandom (PD.1)", () => {
  it("is deterministic for a given seed and stays in [0, 1)", () => {
    const a = createApertureRandom(7);
    const b = createApertureRandom(7);
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("fork yields independent, label-stable sub-streams", () => {
    const enemiesA = createApertureRandom(1).fork("enemies");
    const enemiesB = createApertureRandom(1).fork("enemies");
    const loot = createApertureRandom(1).fork("loot");
    expect(enemiesA.next()).toBe(enemiesB.next());
    expect(createApertureRandom(1).fork("enemies").next()).not.toBe(
      loot.next(),
    );
  });
});

// A system that consumes the sanctioned context RNG + sim-time every frame, so
// its captured output is fully determined by the seed.
function wanderingCubeSystem(draws: number[]): ApertureSystemModule {
  return {
    default: class WanderingCube extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.camera({
          key: "camera.main",
          transform: { translation: [0, 1, 6], lookAt: [0, 0, 0] },
          fovYDegrees: 60,
        });
        this.spawn.mesh({
          key: "cube",
          mesh: mesh.box({ size: [1, 1, 1] }),
          material: material.standard(),
          transform: { translation: [0, 0, 0] },
        });
      }
      override update(): void {
        draws.push(this.random.range(-1, 1) * this.time.delta);
      }
    },
  };
}

function seededPlacementSystem(): ApertureSystemModule {
  return {
    default: class SeededPlacement extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.camera({
          key: "camera.main",
          transform: { translation: [0, 1, 6], lookAt: [0, 0, 0] },
          fovYDegrees: 60,
        });
        this.spawn.mesh({
          key: "cube",
          mesh: mesh.box({ size: [1, 1, 1] }),
          material: material.standard(),
          transform: { translation: [this.random.range(-1, 1), 0, 0] },
        });
      }
    },
  };
}

function nondeterministicGlobalsSystem(calls: string[]): ApertureSystemModule {
  return {
    default: class NondeterministicGlobals extends createSystem({
      priority: 0,
    }) {
      override update(): void {
        calls.push(
          [
            Math.random(),
            Date.now(),
            new Date().getTime(),
            performance.now(),
          ].join(":"),
        );
      }
    },
  };
}

function nondeterministicEffectSystem(calls: string[]): ApertureSystemModule {
  return {
    default: class NondeterministicEffect extends createSystem({
      priority: 0,
    }) {
      override init(): void {
        this.effects.watch(
          this.signals["phase"]!,
          () => {
            calls.push(`effect:${Math.random()}`);
          },
          { phase: "update" },
        );
      }

      override update(): void {
        if (this.signals["phase"]!.value !== "boot") {
          return;
        }

        this.signals["phase"]!.value = "running";
      }
    },
  };
}

const SessionCounterResource = defineResource("test.session.counter", {
  ticks: resource.number(0),
});

function sessionSnapshotSystem(): ApertureSystemModule {
  return {
    default: class SessionSnapshotSystem extends createSystem({
      priority: 0,
      queries: {
        cubes: {
          required: [Name, LocalTransform],
          where: [
            { component: Name, key: "value", op: "eq", value: "session-cube" },
          ],
        },
      },
    }) {
      #privateTicks = 0;

      override init(): void {
        this.resources.read(SessionCounterResource);
        this.spawn.camera({
          key: "camera.main",
          transform: { translation: [0, 1, 6], lookAt: [0, 0, 0] },
          fovYDegrees: 60,
        });
        this.spawn.mesh({
          key: "session-cube",
          name: "session-cube",
          mesh: mesh.box({ size: [1, 1, 1] }),
          material: material.standard(),
          transform: { translation: [this.random.range(-1, 1), 0, 0] },
        });
      }

      override update(delta: number): void {
        this.#privateTicks += 1;
        this.resources.write(SessionCounterResource, (state) => {
          state.ticks += 1;
        });
        this.signals["phase"]!.value = `frame:${this.time.frame}`;

        for (const entity of this.queries.cubes.entities) {
          const translation = entity.getVectorView(
            LocalTransform,
            "translation",
          );
          translation.set([
            (translation[0] ?? 0) +
              (this.#privateTicks + this.random.range(0, 1)) * delta,
            translation[1] ?? 0,
            translation[2] ?? 0,
          ]);
        }
      }

      override snapshotState(): unknown {
        return { privateTicks: this.#privateTicks };
      }

      override restoreState(payload: unknown): void {
        if (
          typeof payload === "object" &&
          payload !== null &&
          typeof (payload as { readonly privateTicks?: unknown })
            .privateTicks === "number"
        ) {
          this.#privateTicks = (
            payload as { readonly privateTicks: number }
          ).privateTicks;
        }
      }

      override afterRestore(): void {
        // Hook presence is asserted by the restore report; frame updates still
        // own the visible signal value.
      }
    },
  };
}

function fixedStepCounterSystem(steps: number[]): ApertureSystemModule {
  return {
    default: class SessionFixedStepCounter extends createSystem({
      priority: 0,
    }) {
      override fixedUpdate(context: SimulationFixedStepContext): void {
        steps.push(context.fixedStep);
      }
    },
  };
}

async function runSeeded(seed: number, frames: number): Promise<number[]> {
  const draws: number[] = [];
  const runner: ApertureHeadlessRunner = await createApertureHeadlessRunner({
    config: defineApertureConfig({
      mode: "headless",
      render: { defaultCamera: false, defaultLight: false },
    }),
    systems: [wanderingCubeSystem(draws)],
    random: seed,
  });
  for (let frame = 0; frame < frames; frame += 1) {
    runner.step(1 / 60, frame / 60);
  }
  return draws;
}

describe("context.random + context.time replay (PD.1/PD.2/PD.3)", () => {
  it("advances context.time once per step", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [wanderingCubeSystem([])],
    });

    expect(runner.app.context.time.frame).toBe(0);
    runner.step(1 / 60, 1 / 60);
    runner.step(1 / 60, 2 / 60);
    expect(runner.app.context.time.frame).toBe(2);
    expect(runner.app.context.time.delta).toBeCloseTo(1 / 60, 6);
    expect(runner.app.context.time.elapsed).toBeCloseTo(2 / 60, 6);
  });

  it("replays bit-identically for the same seed and diverges for a different one", async () => {
    const a = await runSeeded(42, 30);
    const b = await runSeeded(42, 30);
    const c = await runSeeded(99, 30);

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("creates stable digests for deterministic ECS and render snapshots", async () => {
    expect(createApertureStableDigest({ b: 1, a: 2 })).toEqual(
      createApertureStableDigest({ a: 2, b: 1 }),
    );

    const run = async (seed: number) => {
      const runner = await createApertureHeadlessRunner({
        config: defineApertureConfig({
          mode: "headless",
          render: { defaultCamera: false, defaultLight: false },
        }),
        systems: [seededPlacementSystem()],
        random: seed,
      });
      const report = runner.step(1 / 60, 0);
      return {
        ecs: createApertureHeadlessEcsDigest(report.status),
        snapshot: createApertureRenderSnapshotDigest(report.snapshot),
      };
    };

    const a = await run(7);
    const b = await run(7);
    const c = await run(8);

    expect(a.ecs).toEqual(b.ecs);
    expect(a.snapshot).toEqual(b.snapshot);
    expect(a.ecs.hash).not.toBe(c.ecs.hash);
    expect(a.snapshot.hash).not.toBe(c.snapshot.hash);
  });

  it("optionally reports nondeterministic global API usage in systems", async () => {
    const config = defineApertureConfig({
      mode: "headless",
      render: { defaultCamera: false, defaultLight: false },
    });
    const calls: string[] = [];
    const off = await createApertureHeadlessRunner({
      config,
      systems: [nondeterministicGlobalsSystem(calls)],
    });

    off.step(1 / 60, 0);
    expect(nondeterministicDiagnosticApis(off)).toEqual([]);

    const warn = await createApertureHeadlessRunner({
      config,
      systems: [nondeterministicGlobalsSystem(calls)],
      determinism: { globals: "warn" },
    });

    warn.step(1 / 60, 0);
    warn.step(1 / 60, 1 / 60);
    expect(nondeterministicDiagnosticApis(warn)).toEqual([
      "Date.now",
      "Math.random",
      "new Date",
      "performance.now",
    ]);
    expect(
      warn
        .getStatus()
        .diagnostics.filter(
          (diagnostic) =>
            diagnostic.code === "aperture.determinism.nondeterministicGlobal",
        )
        .every((diagnostic) => diagnostic.severity === "warning"),
    ).toBe(true);

    const error = await createApertureHeadlessRunner({
      config,
      systems: [nondeterministicGlobalsSystem(calls)],
      determinism: { globals: "error" },
    });

    error.step(1 / 60, 0);
    expect(
      error
        .getStatus()
        .diagnostics.filter(
          (diagnostic) =>
            diagnostic.code === "aperture.determinism.nondeterministicGlobal",
        )
        .every((diagnostic) => diagnostic.severity === "error"),
    ).toBe(true);
  });

  it("reports nondeterministic global API usage in queued effect callbacks", async () => {
    const calls: string[] = [];
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        signals: {
          phase: signal.string("boot"),
        },
      }),
      systems: [nondeterministicEffectSystem(calls)],
      determinism: { globals: "warn" },
    });

    runner.step(1 / 60, 0);

    expect(calls).toHaveLength(1);
    expect(nondeterministicDiagnosticRecords(runner)).toContainEqual({
      api: "Math.random",
      phase: "effect:update",
      severity: "warning",
      system: "NondeterministicEffect",
    });
  });

  it("exports a JSON-safe session snapshot and restores continuation state", async () => {
    const config = defineApertureConfig({
      mode: "headless",
      render: { defaultCamera: false, defaultLight: false },
      signals: {
        phase: signal.string("boot"),
      },
    });
    const systems = [sessionSnapshotSystem()];
    const seed = 123;
    const uninterrupted = await createApertureHeadlessRunner({
      config,
      systems,
      random: seed,
    });

    uninterrupted.step(1 / 60, 0);
    uninterrupted.step(1 / 60, 1 / 60);

    const snapshot = JSON.parse(
      JSON.stringify(createApertureSessionSnapshot(uninterrupted)),
    ) as ApertureSessionSnapshot;
    expect(snapshot.format).toBe("aperture.session-snapshot");
    expect(snapshot.bootstrap).toMatchObject({
      apertureVersion: "0.2.0",
      appMode: "headless",
      packageVersions: {
        "@aperture-engine/app": "0.2.0",
      },
    });
    expect(snapshot.bootstrap.systemModules).toHaveLength(1);
    expect(snapshot.bootstrap.systemModules[0]).toMatchObject({
      moduleId: "SessionSnapshotSystem",
      className: "SessionSnapshotSystem",
      hasSnapshotState: true,
      hasRestoreState: true,
      hasAfterRestore: true,
    });
    expect(snapshot.simulation.componentRegistry.ids).toEqual(
      expect.arrayContaining([LocalTransform.id, Name.id]),
    );
    expect(Array.isArray(snapshot.simulation.resources)).toBe(true);
    expect(snapshot.simulation.resources).toContainEqual(
      expect.objectContaining({
        id: "test.session.counter",
        values: { ticks: 2 },
      }),
    );
    expect(snapshot.simulation.signals).toContainEqual({
      name: "phase",
      kind: "string",
      value: "frame:2",
    });
    expect(snapshot.runtime.frame).toBe(2);
    expect(snapshot.runtime.nextFrame).toBe(2);
    expect(snapshot.runtime.randomStreams[0]?.id).toBe("default");
    expect(snapshot.runtime.systems).toHaveLength(1);
    expect(systemStateValue(snapshot, "privateTicks")).toBe(2);
    expect(resourceValue(snapshot, "test.session.counter", "ticks")).toBe(2);
    expect(signalValue(snapshot, "phase")).toBe("frame:2");

    const restored = await restoreApertureHeadlessRunnerFromSessionSnapshot({
      config,
      systems,
      random: seed,
      snapshot,
    });

    expect(restored.restore.ok).toBe(true);
    expect(restored.restore.random.restored).toBe(true);
    expect(restored.restore.resources.missing).toEqual([]);
    expect(restored.restore.signals.missing).toEqual([]);
    expect(restored.restore.systems.restored).toBe(1);
    expect(restored.restore.systems.missing).toEqual([]);
    expect(restored.restore.systems.afterRestore).toBe(1);
    expect(restored.runner.getStatus().nextFrame).toBe(2);
    expect(
      resourceValue(
        restored.runner.getStatus(),
        "test.session.counter",
        "ticks",
      ),
    ).toBe(2);

    uninterrupted.step(1 / 60, 2 / 60);
    restored.runner.step(1 / 60, 2 / 60);
    const uninterruptedReport = uninterrupted.step(1 / 60, 3 / 60);
    const restoredReport = restored.runner.step(1 / 60, 3 / 60);

    expect(semanticMeshSnapshot(restoredReport.snapshot)).toEqual(
      semanticMeshSnapshot(uninterruptedReport.snapshot),
    );
    expect(
      sceneComponentPayloads(createApertureSessionSnapshot(restored.runner)),
    ).toEqual(
      sceneComponentPayloads(createApertureSessionSnapshot(uninterrupted)),
    );
    expect(
      resourceValue(
        restored.runner.getStatus(),
        "test.session.counter",
        "ticks",
      ),
    ).toBe(4);
    expect(restored.runner.getStatus().signals["phase"]).toBe("frame:4");
  });

  it("stamps restored simulation time into the first post-restore extract", async () => {
    const config = defineApertureConfig({
      mode: "headless",
      render: { defaultCamera: false, defaultLight: false },
      signals: {
        phase: signal.string("boot"),
      },
    });
    const systems = [sessionSnapshotSystem()];
    const runner = await createApertureHeadlessRunner({
      config,
      systems,
      random: 1,
    });

    runner.step(1 / 60, 0);
    runner.step(1 / 60, 1 / 60);

    const snapshot = JSON.parse(
      JSON.stringify(createApertureSessionSnapshot(runner)),
    ) as ApertureSessionSnapshot;
    expect(snapshot.runtime.time.elapsed).toBeGreaterThan(0);

    const restored = await restoreApertureHeadlessRunnerFromSessionSnapshot({
      config,
      systems,
      random: 1,
      snapshot,
    });
    expect(restored.restore.ok).toBe(true);

    // Extract WITHOUT stepping first: the snapshot must carry the restored
    // simulation time, not a zero re-initialized extraction clock.
    const report = restored.runner.extract(snapshot.runtime.frame);
    expect(report.snapshot.time).toBe(snapshot.runtime.time.elapsed);
  });

  it("restores fixed-step accumulator state before continuing", async () => {
    const config = defineApertureConfig({
      mode: "headless",
      render: { defaultCamera: false, defaultLight: false },
    });
    const fixedStep = { fixedDelta: 0.1, maxSubsteps: 4 };
    const originalSteps: number[] = [];
    const original = await createApertureHeadlessRunner({
      config,
      fixedStep,
      systems: [fixedStepCounterSystem(originalSteps)],
    });

    original.step(0.15, 0);
    expect(originalSteps).toEqual([0]);

    const snapshot = JSON.parse(
      JSON.stringify(createApertureSessionSnapshot(original)),
    ) as ApertureSessionSnapshot;
    expect(snapshot.runtime.fixedStepClock?.fixedStepIndex).toBe(1);
    expect(snapshot.runtime.fixedStepClock?.accumulator).toBeCloseTo(0.05);

    const restoredSteps: number[] = [];
    const restored = await restoreApertureHeadlessRunnerFromSessionSnapshot({
      config,
      fixedStep,
      systems: [fixedStepCounterSystem(restoredSteps)],
      snapshot,
    });

    expect(restored.restore.ok).toBe(true);
    expect(restored.restore.fixedStepClock.restored).toBe(true);

    original.step(0.05, 0.15);
    restored.runner.step(0.05, 0.15);

    expect(originalSteps).toEqual([0, 1]);
    expect(restoredSteps).toEqual([1]);
  });
});

function nondeterministicDiagnosticApis(
  runner: ApertureHeadlessRunner,
): readonly string[] {
  return nondeterministicDiagnosticRecords(runner)
    .map((diagnostic) => diagnostic.api)
    .sort();
}

function nondeterministicDiagnosticRecords(
  runner: ApertureHeadlessRunner,
): readonly {
  readonly api: string;
  readonly phase: string;
  readonly severity: string;
  readonly system: string;
}[] {
  return runner
    .getStatus()
    .diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === "aperture.determinism.nondeterministicGlobal",
    )
    .flatMap((diagnostic) => {
      const api = diagnostic.data?.["api"];
      const phase = diagnostic.data?.["phase"];
      const system = diagnostic.data?.["system"];

      return typeof api === "string" &&
        typeof phase === "string" &&
        typeof system === "string"
        ? [
            {
              api,
              phase,
              severity: diagnostic.severity,
              system,
            },
          ]
        : [];
    });
}

function systemStateValue(
  snapshot: ApertureSessionSnapshot,
  key: string,
): unknown {
  const payload = snapshot.runtime.systems[0]?.payload;
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }
  return (payload as Record<string, unknown>)[key];
}

function resourceValue(
  value:
    | ApertureSessionSnapshot
    | ReturnType<ApertureHeadlessRunner["getStatus"]>,
  id: string,
  field: string,
): unknown {
  const resources =
    "simulation" in value ? value.simulation.resources : value.resources;
  const entries = Array.isArray(resources)
    ? resources
    : (
        resources as ReturnType<
          ApertureHeadlessRunner["getStatus"]
        >["resources"]
      ).entries;
  return entries.find((entry) => entry.id === id)?.values[field];
}

function signalValue(snapshot: ApertureSessionSnapshot, name: string): unknown {
  return snapshot.simulation.signals.find((entry) => entry.name === name)
    ?.value;
}

function sceneComponentPayloads(
  snapshot: ApertureSessionSnapshot,
): readonly unknown[] {
  return snapshot.simulation.scene.entities.map((entity) =>
    entity.components.map((component) => ({
      id: component.id,
      fields: normalizeNegativeZero(component.fields),
    })),
  );
}

function normalizeNegativeZero(value: unknown): unknown {
  if (typeof value === "number") {
    return Object.is(value, -0) ? 0 : value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeNegativeZero);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      normalizeNegativeZero(item),
    ]),
  );
}

function semanticMeshSnapshot(
  snapshot: Parameters<typeof createApertureRenderSnapshotDigest>[0],
): unknown {
  const value = renderSnapshotToJsonValue(snapshot) as {
    readonly meshDraws?: unknown;
    readonly transforms?: unknown;
  };
  return stripRuntimeIds({
    meshDraws: value.meshDraws,
    transforms: value.transforms,
  });
}

function stripRuntimeIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripRuntimeIds);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      key === "entity" ||
      key === "renderId" ||
      key === "stableId" ||
      key === "viewId"
    ) {
      continue;
    }
    result[key] = stripRuntimeIds(item);
  }
  return result;
}
