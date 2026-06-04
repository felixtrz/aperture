import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  createMaterialHandle,
  createMeshHandle,
  type MaterialHandle,
} from "@aperture-engine/simulation";
import {
  createBatchCompatibilityKey,
  createMatcapMaterialAsset,
  createMaterialPipelineKeyInput,
  createPreparedMaterialStore,
  createRenderSortKey,
  createStableRenderId,
  createStandardMaterialAsset,
  createUnlitMaterialAsset,
  patchMatcapMaterial,
  patchStandardMaterial,
  patchUnlitMaterial,
  prepareSnapshotMaterials,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "@aperture-engine/render";
import { createMaterialAccess } from "@aperture-engine/app/systems";
import {
  createSourceAssetSerializationState,
  serializeSourceAssetRegistry,
} from "../../packages/app/src/asset-mirror.js";

// M7-T6: runtime material parameter mutation via versioned asset re-registration.

describe("runtime material mutation (M7-T6)", () => {
  it("patchStandardMaterial returns a new frozen asset with merged fields, leaving prev unmutated", () => {
    const prev = createStandardMaterialAsset({
      baseColorFactor: new Float32Array([0, 1, 0, 1]),
      metallicFactor: 0.25,
      roughnessFactor: 0.75,
      emissiveFactor: [0.1, 0.2, 0.3],
    });

    const next = patchStandardMaterial(prev, { baseColorFactor: [1, 0, 0, 1] });

    // baseColorFactor is red; every other field equals prev.
    expect(Array.from(next.baseColorFactor)).toEqual([1, 0, 0, 1]);
    expect(next.metallicFactor).toBe(0.25);
    expect(next.roughnessFactor).toBe(0.75);
    expect(next.emissiveFactor).toEqual([0.1, 0.2, 0.3]);
    expect(next.kind).toBe("standard");

    // prev is unmutated and the returned asset is a frozen, distinct object.
    expect(Array.from(prev.baseColorFactor)).toEqual([0, 1, 0, 1]);
    expect(next).not.toBe(prev);
    expect(Object.isFrozen(next)).toBe(true);
  });

  it("patches a single scalar field without disturbing the rest", () => {
    const prev = createStandardMaterialAsset({
      baseColorFactor: new Float32Array([0.2, 0.4, 0.6, 1]),
      metallicFactor: 0.1,
      roughnessFactor: 0.9,
    });
    const next = patchStandardMaterial(prev, { roughnessFactor: 0.2 });

    expect(next.roughnessFactor).toBe(0.2);
    expect(next.metallicFactor).toBe(0.1);
    expect(Array.from(next.baseColorFactor)).toEqual(
      Array.from(prev.baseColorFactor),
    );
  });

  it("supports unlit and matcap equivalents", () => {
    const unlit = patchUnlitMaterial(
      createUnlitMaterialAsset({
        baseColorFactor: new Float32Array([0, 0, 1, 1]),
      }),
      { baseColorFactor: [1, 1, 0, 1] },
    );
    expect(Array.from(unlit.baseColorFactor)).toEqual([1, 1, 0, 1]);
    expect(unlit.kind).toBe("unlit");
    expect(Object.isFrozen(unlit)).toBe(true);
    // An unlit asset never grows a standard-only field.
    expect("metallicFactor" in unlit).toBe(false);

    const matcap = patchMatcapMaterial(createMatcapMaterialAsset(), {
      baseColorFactor: [0.5, 0.5, 0.5, 1],
    });
    expect(Array.from(matcap.baseColorFactor)).toEqual([0.5, 0.5, 0.5, 1]);
    expect(matcap.kind).toBe("matcap");
  });

  it("materials.set bumps the registry version by 1 and the mirror re-serializes the new version", () => {
    const registry = new AssetRegistry();
    const handle = createMaterialHandle("mat.crate");
    registry.register(handle);
    registry.markReady(
      handle,
      createStandardMaterialAsset({
        baseColorFactor: new Float32Array([0, 1, 0, 1]),
      }),
    );

    const materials = createMaterialAccess(registry);
    const versionBefore = registry.get(handle)!.version;

    // Prime the mirror so it has "sent" the current version.
    const state = createSourceAssetSerializationState();
    const firstSerialize = serializeSourceAssetRegistry(registry, { state });
    expect(
      firstSerialize.entries.some((entry) => entry.handle.id === "mat.crate"),
    ).toBe(true);

    const result = materials.set(handle, { baseColorFactor: [1, 0, 0, 1] });
    expect(result).toMatchObject({ ok: true, kind: "standard" });

    const versionAfter = registry.get(handle)!.version;
    expect(versionAfter).toBe(versionBefore + 1);
    if (result.ok) {
      expect(result.version).toBe(versionAfter);
    }

    // The version-gated mirror re-serializes the entry at the bumped version,
    // carrying the patched asset (sentVersion check).
    const secondSerialize = serializeSourceAssetRegistry(registry, { state });
    const entry = secondSerialize.entries.find(
      (item) => item.handle.id === "mat.crate",
    );
    expect(entry?.version).toBe(versionAfter);
    const mirrored = entry?.asset as { baseColorFactor: ArrayLike<number> };
    expect(Array.from(mirrored.baseColorFactor)).toEqual([1, 0, 0, 1]);
  });

  it("reports a diagnostic for an unregistered material handle", () => {
    const registry = new AssetRegistry();
    const materials = createMaterialAccess(registry);
    const result = materials.set(createMaterialHandle("mat.missing"), {
      baseColorFactor: [1, 0, 0, 1],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostic.code).toBe("aperture.materials.notReady");
    }
  });

  // Done-when #4: the prepared-material entry action transitions to 'updated' for
  // that material key after the mutation (the exact mechanism the render route
  // reports — snapshot-prepared-materials.ts). Pixel-proven green->red is the
  // separate GPU E2E (material-mutation.spec.ts).
  it("re-prepares the material with action 'updated' after materials.set bumps the version", () => {
    const registry = new AssetRegistry();
    const handle = createMaterialHandle("mat.quad");
    registry.register(handle);
    registry.markReady(
      handle,
      createUnlitMaterialAsset({
        baseColorFactor: new Float32Array([0, 1, 0, 1]),
      }),
    );
    const store = createPreparedMaterialStore();
    const snap = snapshot([packet({ renderId: 1, material: handle })]);

    const first = prepareSnapshotMaterials({
      registry,
      snapshot: snap,
      materials: store,
    });
    expect(first.entries[0]).toMatchObject({
      materialKey: "material:mat.quad",
      action: "created",
    });

    const materials = createMaterialAccess(registry);
    expect(materials.set(handle, { baseColorFactor: [1, 0, 0, 1] }).ok).toBe(
      true,
    );

    const second = prepareSnapshotMaterials({
      registry,
      snapshot: snap,
      materials: store,
    });
    expect(second.entries[0]).toMatchObject({
      materialKey: "material:mat.quad",
      action: "updated",
    });
  });
});

function packet(input: {
  readonly renderId: number;
  readonly material: MaterialHandle;
}): MeshDrawPacket {
  const entity = { index: input.renderId, generation: 0 };
  const stableId = createStableRenderId(entity);
  const mesh = createMeshHandle(`mesh-${input.renderId}`);
  const materialPipeline = createMaterialPipelineKeyInput(
    createUnlitMaterialAsset(),
  );

  return {
    renderId: stableId,
    entity,
    mesh,
    material: input.material,
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: -1,
    layerMask: 1,
    sortKey: createRenderSortKey({
      stableId,
      pipelineKey: "unlit|opaque|back|less|none",
      materialKey: input.material.id,
      meshKey: mesh.id,
    }),
    batchKey: createBatchCompatibilityKey({
      materialPipeline,
      materialKey: input.material.id,
      meshLayoutKey: "mesh-layout:position-normal-uv",
      topology: "triangle-list",
    }),
  };
}

function snapshot(meshDraws: readonly MeshDrawPacket[]): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws,
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: meshDraws.length,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}
