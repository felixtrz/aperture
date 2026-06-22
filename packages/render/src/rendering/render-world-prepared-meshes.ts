import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import type { PreparedMeshStore } from "../assets/preparation.js";
import type { RenderWorld, RenderWorldApplyReport } from "./render-world.js";
import {
  prepareSnapshotMeshes,
  type PrepareSnapshotMeshesReport,
} from "./snapshot-prepared-meshes.js";
import type { RenderDiagnostic, RenderSnapshot } from "./snapshot.js";

export interface BindPreparedMeshResourcesToRenderWorldOptions {
  readonly renderWorld: RenderWorld;
  readonly meshes: PreparedMeshStore;
}

export interface BindPreparedMeshResourcesToRenderWorldReport {
  readonly updated: number;
  readonly missing: number;
  readonly diagnostics: readonly RenderDiagnostic[];
}

export interface PrepareAndBindSnapshotMeshesToRenderWorldOptions {
  readonly registry: AssetRegistry;
  readonly snapshot: RenderSnapshot;
  readonly renderWorld: RenderWorld;
  readonly meshes: PreparedMeshStore;
}

export interface PrepareAndBindSnapshotMeshesToRenderWorldReport {
  readonly apply: RenderWorldApplyReport;
  readonly preparation: PrepareSnapshotMeshesReport;
  readonly binding: BindPreparedMeshResourcesToRenderWorldReport;
  readonly diagnostics: readonly RenderDiagnostic[];
}

export function prepareAndBindSnapshotMeshesToRenderWorld(
  options: PrepareAndBindSnapshotMeshesToRenderWorldOptions,
): PrepareAndBindSnapshotMeshesToRenderWorldReport {
  const apply = options.renderWorld.applySnapshot(options.snapshot);
  const preparation = prepareSnapshotMeshes({
    registry: options.registry,
    snapshot: options.snapshot,
    meshes: options.meshes,
  });
  const binding = bindPreparedMeshResourcesToRenderWorld({
    renderWorld: options.renderWorld,
    meshes: options.meshes,
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

export function bindPreparedMeshResourcesToRenderWorld(
  options: BindPreparedMeshResourcesToRenderWorldOptions,
): BindPreparedMeshResourcesToRenderWorldReport {
  const diagnostics: RenderDiagnostic[] = [];
  let updated = 0;
  let missing = 0;

  for (const object of options.renderWorld.listObjects()) {
    const meshKey = assetHandleKey(object.packet.mesh);
    const prepared = options.meshes.get(object.packet.mesh);

    if (prepared === undefined) {
      missing += 1;

      if (object.gpu.meshResourceKey !== null) {
        const clearResult = options.renderWorld.updateResourceBindings(
          object.renderId,
          { meshResourceKey: null },
        );

        if (!clearResult.ok) {
          diagnostics.push(...clearResult.diagnostics);
        }
      }

      diagnostics.push({
        code: "renderWorld.missingPreparedMeshResource",
        message: `Render object ${object.renderId} has no prepared mesh resource for '${meshKey}'.`,
        severity: "warning",
        entity: object.packet.entity,
        assetKey: meshKey,
      });
      continue;
    }

    const meshResourceKey = prepared.prepared.meshResourceKey;

    if (object.gpu.meshResourceKey === meshResourceKey) {
      continue;
    }

    const updateResult = options.renderWorld.updateResourceBindings(
      object.renderId,
      { meshResourceKey },
    );

    if (updateResult.ok) {
      updated += 1;
    } else {
      diagnostics.push(...updateResult.diagnostics);
    }
  }

  return { updated, missing, diagnostics };
}
