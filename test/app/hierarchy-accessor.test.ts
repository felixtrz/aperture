import { describe, expect, it, vi } from "vitest";
import {
  LocalTransform,
  Parent,
  WorldTransform,
  createLocalTransform,
  createParent,
  createWorld,
  resolveWorldTransforms,
  setParent,
  type Entity,
} from "@aperture-engine/simulation";
import {
  createApertureHeadlessRunner,
  type ApertureHeadlessRunner,
} from "@aperture-engine/app/headless";
import {
  createSystem,
  material,
  mesh,
  registerApertureAppComponents,
  type HierarchyDespawnResult,
  type HierarchySetParentResult,
} from "@aperture-engine/app/systems";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";
import { defineApertureConfig, signal } from "@aperture-engine/app/config";
import type { EcsEntityRef } from "@aperture-engine/app/config";
import { createApertureEntityHierarchy } from "../../packages/app/src/entities/lookup/hierarchy.js";
import * as summaryModule from "../../packages/app/src/entities/lookup/summary.js";

// M7-T2: the hierarchy accessor surfaced on ApertureSystemContext (this.hierarchy)
// + createApertureEntityHierarchy preferring the M7-T1 Children index.

interface HierarchyRoute {
  parent: EcsEntityRef | null;
  childA: EcsEntityRef | null;
  childB: EcsEntityRef | null;
  setParentA?: HierarchySetParentResult;
  setParentB?: HierarchySetParentResult;
  despawn?: HierarchyDespawnResult;
}

function createHierarchyRouteSystem(
  route: HierarchyRoute,
): ApertureSystemModule {
  return {
    default: class HierarchyRouteSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.camera({
          key: "camera.main",
          transform: { translation: [0, 2, 8], lookAt: [0, 0, 0] },
        });
        this.spawn.light({
          key: "light.key",
          kind: "directional",
          illuminance: 4,
          transform: { rotationEulerDegrees: [-45, 35, 0] },
        });
        const parent = this.spawn.mesh({
          key: "hier.parent",
          name: "parent",
          mesh: mesh.box({ size: [1, 1, 1] }),
          material: material.standard(),
          transform: { translation: [2, 0, 0] },
        });
        const childA = this.spawn.mesh({
          key: "hier.childA",
          name: "childA",
          mesh: mesh.box({ size: [1, 1, 1] }),
          material: material.standard(),
          transform: { translation: [0, 1, 0] },
        });
        const childB = this.spawn.mesh({
          key: "hier.childB",
          name: "childB",
          mesh: mesh.box({ size: [1, 1, 1] }),
          material: material.standard(),
          transform: { translation: [0, 0, 1] },
        });
        route.parent = refOf(parent);
        route.childA = refOf(childA);
        route.childB = refOf(childB);
      }

      override update(): void {
        const action = this.signals.hierarchyAction?.value;
        if (
          action === "reparent" &&
          route.setParentA === undefined &&
          route.childA !== null &&
          route.childB !== null
        ) {
          route.setParentA = this.hierarchy.setParent(
            route.childA,
            route.parent,
          );
          route.setParentB = this.hierarchy.setParent(
            route.childB,
            route.parent,
          );
        } else if (
          action === "despawn" &&
          route.despawn === undefined &&
          route.parent !== null
        ) {
          route.despawn = this.hierarchy.despawnRecursive(route.parent);
        }
      }
    },
  };
}

async function createHierarchyRunner(
  route: HierarchyRoute,
): Promise<ApertureHeadlessRunner> {
  return createApertureHeadlessRunner({
    config: defineApertureConfig({
      mode: "headless",
      systems: [],
      signals: { hierarchyAction: signal.string("idle") },
      render: { defaultCamera: false, defaultLight: false },
    }),
    systems: [createHierarchyRouteSystem(route)],
  });
}

describe("hierarchy accessor on the system context (M7-T2)", () => {
  it("reparents a spawned child via this.hierarchy.setParent, preserving its world transform", async () => {
    const route: HierarchyRoute = { parent: null, childA: null, childB: null };
    const runner = await createHierarchyRunner(route);

    const frame0 = runner.step(1 / 60, 0);
    expect(frame0.snapshot.meshDraws).toHaveLength(3);
    expect(route.childA).not.toBeNull();
    const worldBefore = worldTranslation(runner, route.childA!);
    expect(worldBefore).toEqual([0, 1, 0]);

    runner.app.context.signals.hierarchyAction!.value = "reparent";
    runner.step(1 / 60, 1);

    expect(route.setParentA).toMatchObject({ ok: true });
    expect(route.setParentB).toMatchObject({ ok: true });

    // The published entity summary shows the child's parent ref updated.
    const childSummary = runner.entities.get(route.childA!);
    expect(childSummary).toMatchObject({ ok: true });
    if (childSummary.ok) {
      expect(childSummary.summary.parent).toEqual(route.parent);
    }

    // The world transform is preserved across the reparent (Bevy reparented_to).
    const worldAfter = worldTranslation(runner, route.childA!);
    expect(worldAfter[0]).toBeCloseTo(0, 5);
    expect(worldAfter[1]).toBeCloseTo(1, 5);
    expect(worldAfter[2]).toBeCloseTo(0, 5);

    // children() reports both reparented children under the parent.
    const children = runner.app.context.hierarchy.children(route.parent!);
    expect(children.ok).toBe(true);
    expect(children.children).toEqual(
      expect.arrayContaining([route.childA, route.childB]),
    );
  });

  it("drops the next snapshot's meshDraws by the descendant mesh count on despawnRecursive", async () => {
    const route: HierarchyRoute = { parent: null, childA: null, childB: null };
    const runner = await createHierarchyRunner(route);

    runner.step(1 / 60, 0);
    runner.app.context.signals.hierarchyAction!.value = "reparent";
    const beforeDespawn = runner.step(1 / 60, 1);
    const meshDrawsBefore = beforeDespawn.snapshot.meshDraws.length;
    expect(meshDrawsBefore).toBe(3);

    runner.app.context.signals.hierarchyAction!.value = "despawn";
    const afterDespawn = runner.step(1 / 60, 2);
    const meshDrawsAfter = afterDespawn.snapshot.meshDraws.length;

    // parent + childA + childB = 3 entities in the subtree, each with one mesh.
    expect(route.despawn).toMatchObject({ ok: true, despawned: 3 });
    expect(meshDrawsBefore - meshDrawsAfter).toBe(3);
    expect(meshDrawsAfter).toBe(0);
  });

  it("returns a structured diagnostic when reparenting would create a cycle", async () => {
    const route: HierarchyRoute = { parent: null, childA: null, childB: null };
    const runner = await createHierarchyRunner(route);
    runner.step(1 / 60, 0);

    // parent under childA, then childA under parent -> cycle.
    const first = runner.app.context.hierarchy.setParent(
      route.parent!,
      route.childA!,
    );
    expect(first.ok).toBe(true);
    const cycle = runner.app.context.hierarchy.setParent(
      route.childA!,
      route.parent!,
    );
    expect(cycle.ok).toBe(false);
    expect(cycle.diagnostic?.code).toBe("aperture.hierarchy.cycle");

    const stale = runner.app.context.hierarchy.setParent(
      { index: route.childB!.index, generation: route.childB!.generation + 5 },
      route.parent!,
    );
    expect(stale.ok).toBe(false);
    expect(stale.diagnostic?.code).toBe(
      "aperture.entityLookup.generationMismatch",
    );
  });
});

describe("createApertureEntityHierarchy prefers the Children index (M7-T2)", () => {
  it("produces an identical tree to the legacy full-scan path without calling collectActiveEntities", () => {
    const childrenWorld = buildTreeWorld(true);
    const parentOnlyWorld = buildTreeWorld(false);

    const collectSpy = vi.spyOn(summaryModule, "collectActiveEntities");
    try {
      const fast = createApertureEntityHierarchy(childrenWorld);
      const callsAfterFast = collectSpy.mock.calls.length;

      const legacy = createApertureEntityHierarchy(parentOnlyWorld);
      const callsAfterLegacy = collectSpy.mock.calls.length;

      // The Children fast path never falls back to the full ALL-entities scan...
      expect(callsAfterFast).toBe(0);
      // ...while the no-Children world still takes the legacy collectActiveEntities path.
      expect(callsAfterLegacy).toBeGreaterThan(0);

      // Both paths produce the same tree (same roots, names, parent links, nesting).
      expect(fast).toEqual(legacy);
      expect(fast.total).toBe(4);
      expect(fast.roots).toHaveLength(1);
      expect(fast.roots[0]?.children).toHaveLength(2);
    } finally {
      collectSpy.mockRestore();
    }
  });
});

function buildTreeWorld(useSetParent: boolean): ReturnType<typeof createWorld> {
  const world = createWorld({ entityCapacity: 16 });
  registerApertureAppComponents(world);

  const make = (translation: readonly [number, number, number]): Entity => {
    const entity = world.createEntity();
    entity.addComponent(LocalTransform, createLocalTransform({ translation }));
    entity.addComponent(Parent, createParent(null));
    entity.addComponent(WorldTransform);
    return entity;
  };

  const root = make([0, 0, 0]);
  const childA = make([1, 0, 0]);
  const childB = make([0, 1, 0]);
  const grandchild = make([0, 0, 1]);

  if (useSetParent) {
    resolveWorldTransforms(world);
    setParent(world, childA, root);
    setParent(world, grandchild, childA);
    setParent(world, childB, root);
  } else {
    childA.setValue(Parent, "entity", root);
    grandchild.setValue(Parent, "entity", childA);
    childB.setValue(Parent, "entity", root);
  }

  resolveWorldTransforms(world);
  return world;
}

function refOf(entity: Entity): EcsEntityRef {
  return { index: entity.index, generation: entity.generation };
}

function worldTranslation(
  runner: ApertureHeadlessRunner,
  ref: EcsEntityRef,
): [number, number, number] {
  const entity = runner.app.lowLevel.world.entityManager.getEntityByIndex(
    ref.index,
  );
  if (entity === null) {
    throw new Error(`No entity at index ${ref.index}`);
  }
  const col3 = entity.getVectorView(WorldTransform, "col3");
  return [col3[0] ?? 0, col3[1] ?? 0, col3[2] ?? 0];
}
