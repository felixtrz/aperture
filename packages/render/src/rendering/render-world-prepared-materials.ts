import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import type { PreparedMaterialStore } from "../assets/preparation.js";
import type { RenderWorld, RenderWorldApplyReport } from "./render-world.js";
import {
  prepareSnapshotMaterials,
  type PrepareSnapshotMaterialsReport,
} from "./snapshot-prepared-materials.js";
import type { RenderDiagnostic, RenderSnapshot } from "./snapshot.js";

export interface BindPreparedMaterialResourcesToRenderWorldOptions {
  readonly renderWorld: RenderWorld;
  readonly materials: PreparedMaterialStore;
}

export interface BindPreparedMaterialResourcesToRenderWorldReport {
  readonly updated: number;
  readonly missing: number;
  readonly diagnostics: readonly RenderDiagnostic[];
}

export interface PrepareAndBindSnapshotMaterialsToRenderWorldOptions {
  readonly registry: AssetRegistry;
  readonly snapshot: RenderSnapshot;
  readonly renderWorld: RenderWorld;
  readonly materials: PreparedMaterialStore;
}

export interface PrepareAndBindSnapshotMaterialsToRenderWorldReport {
  readonly apply: RenderWorldApplyReport;
  readonly preparation: PrepareSnapshotMaterialsReport;
  readonly binding: BindPreparedMaterialResourcesToRenderWorldReport;
  readonly diagnostics: readonly RenderDiagnostic[];
}

export function prepareAndBindSnapshotMaterialsToRenderWorld(
  options: PrepareAndBindSnapshotMaterialsToRenderWorldOptions,
): PrepareAndBindSnapshotMaterialsToRenderWorldReport {
  const apply = options.renderWorld.applySnapshot(options.snapshot);
  const preparation = prepareSnapshotMaterials({
    registry: options.registry,
    snapshot: options.snapshot,
    materials: options.materials,
  });
  const binding = bindPreparedMaterialResourcesToRenderWorld({
    renderWorld: options.renderWorld,
    materials: options.materials,
  });

  return {
    apply,
    preparation,
    binding,
    diagnostics: [
      ...apply.diagnostics,
      ...preparation.diagnostics,
      ...binding.diagnostics,
    ],
  };
}

export function bindPreparedMaterialResourcesToRenderWorld(
  options: BindPreparedMaterialResourcesToRenderWorldOptions,
): BindPreparedMaterialResourcesToRenderWorldReport {
  const diagnostics: RenderDiagnostic[] = [];
  let updated = 0;
  let missing = 0;

  for (const object of options.renderWorld.listObjects()) {
    const materialKey = assetHandleKey(object.packet.material);
    const prepared = options.materials.get(object.packet.material);

    if (prepared === undefined) {
      missing += 1;

      if (object.gpu.materialResourceKey !== null) {
        const clearResult = options.renderWorld.updateResourceBindings(
          object.renderId,
          { materialResourceKey: null },
        );

        if (!clearResult.ok) {
          diagnostics.push(...clearResult.diagnostics);
        }
      }

      diagnostics.push({
        code: "renderWorld.missingPreparedMaterialResource",
        message: `Render object ${object.renderId} has no prepared material resource for '${materialKey}'.`,
        severity: "warning",
        entity: object.packet.entity,
        assetKey: materialKey,
      });
      continue;
    }

    const materialResourceKey = prepared.prepared.materialResourceKey;

    if (object.gpu.materialResourceKey === materialResourceKey) {
      continue;
    }

    const updateResult = options.renderWorld.updateResourceBindings(
      object.renderId,
      { materialResourceKey },
    );

    if (updateResult.ok) {
      updated += 1;
    } else {
      diagnostics.push(...updateResult.diagnostics);
    }
  }

  return { updated, missing, diagnostics };
}
