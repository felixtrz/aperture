import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  assetHandleKey,
  createMaterialHandle,
  createMeshHandle,
  createRootTransform,
  createWorld,
  registerMetadataComponents,
  registerTransformComponents,
  WorldTransform,
  type EcsWorld,
  type Entity,
  type MeshHandle,
} from "@aperture-engine/simulation";
import {
  Camera,
  Lod,
  Material,
  Mesh,
  createBoxMeshAsset,
  createCamera,
  createLod,
  createUnlitMaterialAsset,
  extractRenderSnapshot,
  registerRenderAuthoringComponents,
  createRenderExtractionCache,
} from "@aperture-engine/render";

const HI = createMeshHandle("rock-hi");
const LO = createMeshHandle("rock-lo");
const BASE = createMeshHandle("rock-base");
const MATERIAL = createMaterialHandle("rock");

const HI_KEY = assetHandleKey(HI);
const LO_KEY = assetHandleKey(LO);
const BASE_KEY = assetHandleKey(BASE);

function createRenderWorld(): EcsWorld {
  const world = createWorld({ entityCapacity: 32 });
  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);
  return world;
}

function createReadyAssets(): AssetRegistry {
  const registry = new AssetRegistry();
  for (const handle of [HI, LO, BASE]) {
    registry.register(handle);
    registry.markReady(
      handle,
      createBoxMeshAsset({ label: assetHandleKey(handle) }),
    );
  }
  registry.register(MATERIAL);
  registry.markReady(MATERIAL, createUnlitMaterialAsset({ label: "Rock" }));
  return registry;
}

function spawnCamera(world: EcsWorld, z: number): Entity {
  const entity = world.createEntity();
  entity.addComponent(
    WorldTransform,
    createRootTransform({ translation: [0, 0, z] }).world,
  );
  entity.addComponent(Camera, createCamera({ priority: 0, layerMask: 1 }));
  return entity;
}

function moveCamera(camera: Entity, z: number): void {
  camera.getVectorView(WorldTransform, "col3").set([0, 0, z, 1]);
}

function spawnRock(
  world: EcsWorld,
  options: {
    readonly baseMesh?: MeshHandle;
    readonly levels?: readonly {
      readonly mesh: MeshHandle;
      readonly distance: number;
    }[];
    readonly hysteresis?: number;
    readonly lod?: boolean;
  } = {},
): Entity {
  const entity = world.createEntity();
  entity.addComponent(WorldTransform, createRootTransform().world);
  entity.addComponent(Mesh, {
    meshId: assetHandleKey(options.baseMesh ?? BASE),
  });
  entity.addComponent(Material, { materialId: assetHandleKey(MATERIAL) });
  if (options.lod !== false) {
    entity.addComponent(
      Lod,
      createLod({
        levels: options.levels ?? [
          { mesh: HI, distance: 0 },
          { mesh: LO, distance: 20 },
        ],
        hysteresis: options.hysteresis ?? 3,
      }),
    );
  }
  return entity;
}

function drawnMeshKeys(
  snapshot: ReturnType<typeof extractRenderSnapshot>,
): string[] {
  return snapshot.meshDraws.map((draw) => assetHandleKey(draw.mesh));
}

describe("E2 mesh-LOD extraction", () => {
  it("omits the report.lod field and draws the base mesh when no LOD entity exists (byte-identity)", () => {
    const world = createRenderWorld();
    spawnCamera(world, 8);
    spawnRock(world, { lod: false });

    const snapshot = extractRenderSnapshot(world, createReadyAssets(), {
      frame: 1,
    });

    expect(snapshot.report.lod).toBeUndefined();
    expect(drawnMeshKeys(snapshot)).toEqual([BASE_KEY]);
  });

  it("selects the near/high-detail level and overrides the drawn mesh handle", () => {
    const world = createRenderWorld();
    spawnCamera(world, 8);
    const rock = spawnRock(world);

    const snapshot = extractRenderSnapshot(world, createReadyAssets(), {
      frame: 1,
    });

    expect(drawnMeshKeys(snapshot)).toEqual([HI_KEY]);
    expect(rock.getValue(Lod, "currentLevel")).toBe(0);
    expect(snapshot.report.lod).toEqual({ entities: 1, levels: [1, 0] });
  });

  it("selects the far/low-detail level when the camera is far", () => {
    const world = createRenderWorld();
    spawnCamera(world, 40);
    const rock = spawnRock(world);

    const snapshot = extractRenderSnapshot(world, createReadyAssets(), {
      frame: 1,
    });

    expect(drawnMeshKeys(snapshot)).toEqual([LO_KEY]);
    expect(rock.getValue(Lod, "currentLevel")).toBe(1);
    expect(snapshot.report.lod).toEqual({ entities: 1, levels: [0, 1] });
  });

  it("shifts the selected-level distribution across a field of rocks as the camera moves (AC2 draw-count proof)", () => {
    const world = createRenderWorld();
    const camera = spawnCamera(world, 8);
    for (let index = 0; index < 4; index += 1) {
      spawnRock(world);
    }
    const assets = createReadyAssets();

    const near = extractRenderSnapshot(world, assets, { frame: 1 });
    moveCamera(camera, 40);
    const far = extractRenderSnapshot(world, assets, { frame: 2 });

    // Near: every rock high-detail (level 0). Far: every rock low-detail.
    expect(near.report.lod).toEqual({ entities: 4, levels: [4, 0] });
    expect(far.report.lod).toEqual({ entities: 4, levels: [0, 4] });
    const nearLevels = near.report.lod?.levels ?? [];
    const farLevels = far.report.lod?.levels ?? [];
    expect(nearLevels[0] ?? 0).toBeGreaterThan(farLevels[0] ?? 0);
    expect(farLevels[1] ?? 0).toBeGreaterThan(nearLevels[1] ?? 0);
  });

  it("does not pop within the hysteresis band even as a nudge straddles the raw threshold (AC2 no-pop proof)", () => {
    const world = createRenderWorld();
    const camera = spawnCamera(world, 8);
    const rock = spawnRock(world); // thresholds [0, 20], hysteresis 3 → band [17, 23)
    const assets = createReadyAssets();

    // Establish level 0 while near.
    extractRenderSnapshot(world, assets, { frame: 1 });
    expect(rock.getValue(Lod, "currentLevel")).toBe(0);

    // Nudge INTO the band, below the raw threshold.
    moveCamera(camera, 19);
    const bandA = extractRenderSnapshot(world, assets, { frame: 2 });
    // Nudge again, now ABOVE the raw threshold (20) but still inside the band.
    moveCamera(camera, 21);
    const bandB = extractRenderSnapshot(world, assets, { frame: 3 });

    // Distance crossed the raw boundary (19 → 21 across 20) yet the level and
    // the whole histogram are identical: the band suppressed the pop.
    expect(rock.getValue(Lod, "currentLevel")).toBe(0);
    expect(bandA.report.lod).toEqual({ entities: 1, levels: [1, 0] });
    expect(bandB.report.lod).toEqual(bandA.report.lod);
    expect(drawnMeshKeys(bandA)).toEqual([HI_KEY]);
    expect(drawnMeshKeys(bandB)).toEqual([HI_KEY]);
  });

  it("updates the per-entity currentLevel state only when the level actually changes", () => {
    const world = createRenderWorld();
    const camera = spawnCamera(world, 8);
    const rock = spawnRock(world);
    const assets = createReadyAssets();

    extractRenderSnapshot(world, assets, { frame: 1 });
    const versionAfterFirst = world.entityVersion(rock);

    // Re-extract with the camera unchanged: no level change → no write-back.
    extractRenderSnapshot(world, assets, { frame: 2 });
    expect(world.entityVersion(rock)).toBe(versionAfterFirst);
    expect(rock.getValue(Lod, "currentLevel")).toBe(0);

    // Move far: level 0 → 1 writes back and bumps the entity version.
    moveCamera(camera, 40);
    extractRenderSnapshot(world, assets, { frame: 3 });
    expect(world.entityVersion(rock)).toBeGreaterThan(versionAfterFirst);
    expect(rock.getValue(Lod, "currentLevel")).toBe(1);
  });

  it("re-resolves the drawn mesh after a level change even with the persistent extraction cache", () => {
    const world = createRenderWorld();
    const camera = spawnCamera(world, 8);
    spawnRock(world);
    const assets = createReadyAssets();
    const cache = createRenderExtractionCache();

    const near = extractRenderSnapshot(world, assets, { frame: 1, cache });
    expect(drawnMeshKeys(near)).toEqual([HI_KEY]);

    moveCamera(camera, 40);
    const far = extractRenderSnapshot(world, assets, { frame: 2, cache });
    expect(drawnMeshKeys(far)).toEqual([LO_KEY]);

    moveCamera(camera, 8);
    const nearAgain = extractRenderSnapshot(world, assets, { frame: 3, cache });
    expect(drawnMeshKeys(nearAgain)).toEqual([HI_KEY]);
  });

  it("emits a structured diagnostic and falls back to the base mesh for out-of-order thresholds", () => {
    const world = createRenderWorld();
    spawnCamera(world, 8);
    spawnRock(world, {
      levels: [
        { mesh: HI, distance: 20 },
        { mesh: LO, distance: 5 },
      ],
    });

    const snapshot = extractRenderSnapshot(world, createReadyAssets(), {
      frame: 1,
    });

    expect(
      snapshot.diagnostics.some(
        (diagnostic) => diagnostic.code === "render.lod.thresholdsNotAscending",
      ),
    ).toBe(true);
    // Invalid LOD is skipped: the entity keeps drawing its base mesh, and the
    // report omits the LOD tally (no valid selection this frame).
    expect(drawnMeshKeys(snapshot)).toEqual([BASE_KEY]);
    expect(snapshot.report.lod).toBeUndefined();
  });

  it("emits a diagnostic for empty levels", () => {
    const world = createRenderWorld();
    spawnCamera(world, 8);
    const entity = world.createEntity();
    entity.addComponent(WorldTransform, createRootTransform().world);
    entity.addComponent(Mesh, { meshId: BASE_KEY });
    entity.addComponent(Material, { materialId: assetHandleKey(MATERIAL) });
    entity.addComponent(Lod, { levels: [], hysteresis: 0, currentLevel: 0 });

    const snapshot = extractRenderSnapshot(world, createReadyAssets(), {
      frame: 1,
    });

    expect(
      snapshot.diagnostics.some(
        (diagnostic) => diagnostic.code === "render.lod.emptyLevels",
      ),
    ).toBe(true);
    expect(drawnMeshKeys(snapshot)).toEqual([BASE_KEY]);
  });

  it("emits a diagnostic for a missing level mesh handle", () => {
    const world = createRenderWorld();
    spawnCamera(world, 8);
    const entity = world.createEntity();
    entity.addComponent(WorldTransform, createRootTransform().world);
    entity.addComponent(Mesh, { meshId: BASE_KEY });
    entity.addComponent(Material, { materialId: assetHandleKey(MATERIAL) });
    entity.addComponent(Lod, {
      levels: [{ meshId: "", distance: 0 }],
      hysteresis: 0,
      currentLevel: 0,
    });

    const snapshot = extractRenderSnapshot(world, createReadyAssets(), {
      frame: 1,
    });

    expect(
      snapshot.diagnostics.some(
        (diagnostic) => diagnostic.code === "render.lod.invalidLevelMesh",
      ),
    ).toBe(true);
    expect(drawnMeshKeys(snapshot)).toEqual([BASE_KEY]);
  });

  it("emits a diagnostic for a negative hysteresis", () => {
    const world = createRenderWorld();
    spawnCamera(world, 8);
    const entity = world.createEntity();
    entity.addComponent(WorldTransform, createRootTransform().world);
    entity.addComponent(Mesh, { meshId: BASE_KEY });
    entity.addComponent(Material, { materialId: assetHandleKey(MATERIAL) });
    entity.addComponent(Lod, {
      levels: [{ meshId: HI_KEY, distance: 0 }],
      hysteresis: -1,
      currentLevel: 0,
    });

    const snapshot = extractRenderSnapshot(world, createReadyAssets(), {
      frame: 1,
    });

    expect(
      snapshot.diagnostics.some(
        (diagnostic) => diagnostic.code === "render.lod.invalidHysteresis",
      ),
    ).toBe(true);
    expect(drawnMeshKeys(snapshot)).toEqual([BASE_KEY]);
  });
});
