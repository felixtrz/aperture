import { describe, expect, it } from "vitest";

import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import {
  createApertureSystemContext,
  createSystem,
  createSpatialIndexPopulationState,
  material,
  mesh as meshDescriptor,
  populateSpatialIndexFromWorld,
} from "@aperture-engine/app/systems";
import {
  Mesh,
  MeshQueryAcceleration,
  Pickable,
  PickablePrecision,
  RenderLayer,
  createMeshQueryAcceleration,
  createPickable,
  createPlaneMeshAsset,
} from "@aperture-engine/render";
import {
  AssetRegistry,
  WorldTransform,
  assetHandleKey,
  createMeshHandle,
  createRootTransform,
  createWorld,
  type Entity,
  type Vec3Like,
} from "@aperture-engine/simulation";

class AutoSpatialSetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      transform: {
        translation: [0, 0, 5],
        lookAt: [0, 0, 0],
      },
      fovYDegrees: 60,
    });
    this.spawn.mesh({
      key: "target.plane",
      mesh: meshDescriptor.plane({ size: [2, 2] }),
      material: material.standard({ baseColor: [1, 0.5, 0.2, 1] }),
    });
  }
}

function createPopulationFixture() {
  const world = createWorld({ entityCapacity: 16 });
  const registry = new AssetRegistry();
  const context = createApertureSystemContext({
    world,
    assetsRegistry: registry,
  });
  const state = createSpatialIndexPopulationState();

  return { context, registry, state, world };
}

function createMeshEntity(
  fixture: ReturnType<typeof createPopulationFixture>,
  input: {
    readonly id: string;
    readonly translation?: Vec3Like;
    readonly pickable?: Parameters<typeof createPickable>[0];
    readonly layerMask?: number;
    readonly acceleration?: Parameters<typeof createMeshQueryAcceleration>[0];
  },
): Entity {
  const handle = createMeshHandle(input.id);
  const entity = fixture.world.createEntity();
  const transform = createRootTransform({
    translation: input.translation ?? [0, 0, 0],
  });

  fixture.registry.register(handle);
  fixture.registry.markReady(
    handle,
    createPlaneMeshAsset({ width: 2, height: 2, label: input.id }),
  );
  entity.addComponent(Mesh, { meshId: assetHandleKey(handle) });
  entity.addComponent(WorldTransform, transform.world);

  if (input.pickable !== undefined) {
    entity.addComponent(Pickable, createPickable(input.pickable));
  }

  if (input.layerMask !== undefined) {
    entity.addComponent(RenderLayer, { mask: input.layerMask });
  }

  if (input.acceleration !== undefined) {
    entity.addComponent(
      MeshQueryAcceleration,
      createMeshQueryAcceleration(input.acceleration),
    );
  }

  return entity;
}

function setWorldTranslation(entity: Entity, translation: Vec3Like): void {
  const transform = createRootTransform({ translation });

  entity
    .getVectorView(WorldTransform, "col0")
    .set(transform.world.col0 ?? [1, 0, 0, 0]);
  entity
    .getVectorView(WorldTransform, "col1")
    .set(transform.world.col1 ?? [0, 1, 0, 0]);
  entity
    .getVectorView(WorldTransform, "col2")
    .set(transform.world.col2 ?? [0, 0, 1, 0]);
  entity
    .getVectorView(WorldTransform, "col3")
    .set(transform.world.col3 ?? [0, 0, 0, 1]);
}

function readArrayLike(value: ArrayLike<number>, index: number): number {
  const next = value[index];

  if (next === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return next;
}

describe("spatial index population", () => {
  it("auto-populates the app context so camera rays hit spawned meshes without manual setup", async () => {
    const app = await createApertureApp({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: AutoSpatialSetupSystem }],
    });

    app.step(1 / 60, 0);
    const hit = app.context.spatial.raycastFirst(
      app.context.cameras.main.rayFromPointer([0.5, 0.5]),
      { source: "visual-mesh", includeBackfaces: true },
    );

    expect(hit).toMatchObject({
      source: "mesh-bvh",
      entity: {
        ref: {
          index: expect.any(Number),
          generation: expect.any(Number),
        },
      },
    });
  });

  it("builds mesh BVH entries from live ECS meshes and serves exact ray hits", () => {
    const fixture = createPopulationFixture();
    const left = createMeshEntity(fixture, {
      id: "left-plane",
      translation: [-2, 0, 0],
    });
    const right = createMeshEntity(fixture, {
      id: "right-plane",
      translation: [2, 0, 0],
    });

    const report = populateSpatialIndexFromWorld(
      {
        world: fixture.world,
        assetsRegistry: fixture.registry,
        spatial: fixture.context.spatial,
      },
      fixture.state,
    );

    expect(report.diagnostics).toEqual([]);
    expect(report.meshes).toHaveLength(2);
    expect(report.bounds).toHaveLength(2);
    expect(report.meshes.every((entry) => entry.bvh !== undefined)).toBe(true);
    expect(report.meshes.map((entry) => entry.entity)).toEqual([left, right]);
    expect(readArrayLike(report.meshes[0]!.meshFromWorld!, 0)).toBeCloseTo(1);
    expect(readArrayLike(report.meshes[0]!.meshFromWorld!, 12)).toBeCloseTo(2);

    const hit = fixture.context.spatial.raycastFirst(
      { origin: [-2, 0, 2], direction: [0, 0, -1] },
      {
        source: "visual-mesh",
        includeBackfaces: true,
        includeNormal: true,
        includeUv: true,
      },
    );

    expect(hit).toMatchObject({
      entity: { entity: left },
      source: "mesh-bvh",
      faceIndex: expect.any(Number),
      submeshIndex: 0,
      materialSlot: 0,
    });
    expect(hit?.normal).toEqual([0, 0, 1]);
    expect(hit?.uv).toEqual([0.5, 0.5]);
  });

  it("updates transforms without rebuilding BVHs and rebuilds when mesh versions change", () => {
    const fixture = createPopulationFixture();
    const entity = createMeshEntity(fixture, {
      id: "moving-plane",
      translation: [0, 0, 0],
    });

    const first = populateSpatialIndexFromWorld(
      {
        world: fixture.world,
        assetsRegistry: fixture.registry,
        spatial: fixture.context.spatial,
      },
      fixture.state,
    );
    const firstBvh = first.meshes[0]?.bvh;
    const second = populateSpatialIndexFromWorld(
      {
        world: fixture.world,
        assetsRegistry: fixture.registry,
        spatial: fixture.context.spatial,
      },
      fixture.state,
    );

    expect(second.meshes[0]).toBe(first.meshes[0]);
    expect(second.bounds[0]).toBe(first.bounds[0]);
    expect(second.bvhReports[0]).toMatchObject({
      reused: true,
      built: false,
    });

    setWorldTranslation(entity, [0, 1, 0]);
    const moved = populateSpatialIndexFromWorld(
      {
        world: fixture.world,
        assetsRegistry: fixture.registry,
        spatial: fixture.context.spatial,
      },
      fixture.state,
    );
    const movedHit = fixture.context.spatial.raycastFirst(
      { origin: [0, 1, 2], direction: [0, 0, -1] },
      { source: "visual-mesh", includeBackfaces: true },
    );

    expect(firstBvh).toBeDefined();
    expect(moved.meshes[0]?.bvh).toBe(firstBvh);
    expect(moved.bvhReports[0]).toMatchObject({ reused: true, built: false });
    expect(movedHit?.entity.entity).toBe(entity);
    expect(movedHit?.point[1]).toBeCloseTo(1);

    const handle = createMeshHandle("moving-plane");
    fixture.registry.markReady(
      handle,
      createPlaneMeshAsset({ width: 4, height: 4, label: "moving-plane-v2" }),
    );
    const changed = populateSpatialIndexFromWorld(
      {
        world: fixture.world,
        assetsRegistry: fixture.registry,
        spatial: fixture.context.spatial,
      },
      fixture.state,
    );

    expect(changed.meshes[0]?.bvh).toBeDefined();
    expect(changed.meshes[0]?.bvh).not.toBe(firstBvh);
    expect(changed.bvhReports[0]).toMatchObject({ reused: false, built: true });
  });

  it("honors Pickable disabled state and layer masks", () => {
    const fixture = createPopulationFixture();
    const disabled = createMeshEntity(fixture, {
      id: "disabled-plane",
      translation: [0, 0, 0],
      pickable: { enabled: false, precision: PickablePrecision.VisualMesh },
    });
    const masked = createMeshEntity(fixture, {
      id: "masked-plane",
      translation: [3, 0, 0],
      pickable: {
        enabled: true,
        layerMask: 0b0010,
        precision: PickablePrecision.VisualMesh,
      },
      layerMask: 0b0010,
    });

    const report = populateSpatialIndexFromWorld(
      {
        world: fixture.world,
        assetsRegistry: fixture.registry,
        spatial: fixture.context.spatial,
      },
      fixture.state,
    );

    expect(report.meshes.map((entry) => entry.entity)).not.toContain(disabled);
    expect(report.meshes.map((entry) => entry.entity)).toContain(masked);
    expect(
      fixture.context.spatial.raycastFirst(
        { origin: [3, 0, 2], direction: [0, 0, -1] },
        { source: "visual-mesh", layerMask: 0b0001 },
      ),
    ).toBeNull();
    expect(
      fixture.context.spatial.raycastFirst(
        { origin: [3, 0, 2], direction: [0, 0, -1] },
        { source: "visual-mesh", layerMask: 0b0010 },
      )?.entity.entity,
    ).toBe(masked);
  });
});
