import type { AssetRegistry } from "@aperture-engine/simulation";
import type {
  PreparedMaterialStore,
  PreparedMeshStore,
} from "../assets/preparation.js";
import type { RenderWorld, RenderWorldApplyReport } from "./render-world.js";
import {
  bindPreparedMaterialResourcesToRenderWorld,
  type BindPreparedMaterialResourcesToRenderWorldReport,
} from "./render-world-prepared-materials.js";
import {
  bindPreparedMeshResourcesToRenderWorld,
  type BindPreparedMeshResourcesToRenderWorldReport,
} from "./render-world-prepared-meshes.js";
import {
  prepareSnapshotMaterials,
  type PrepareSnapshotMaterialsReport,
} from "./snapshot-prepared-materials.js";
import {
  prepareSnapshotMeshes,
  type PrepareSnapshotMeshesReport,
} from "./snapshot-prepared-meshes.js";
import type { RenderDiagnostic, RenderSnapshot } from "./snapshot.js";

export interface PrepareAndBindSnapshotPreparedResourcesToRenderWorldOptions {
  readonly registry: AssetRegistry;
  readonly snapshot: RenderSnapshot;
  readonly renderWorld: RenderWorld;
  readonly meshes: PreparedMeshStore;
  readonly materials: PreparedMaterialStore;
}

export interface PrepareAndBindSnapshotPreparedResourcesToRenderWorldReport {
  readonly apply: RenderWorldApplyReport;
  readonly meshes: {
    readonly preparation: PrepareSnapshotMeshesReport;
    readonly binding: BindPreparedMeshResourcesToRenderWorldReport;
  };
  readonly materials: {
    readonly preparation: PrepareSnapshotMaterialsReport;
    readonly binding: BindPreparedMaterialResourcesToRenderWorldReport;
  };
  readonly diagnostics: readonly RenderDiagnostic[];
}

export function prepareAndBindSnapshotPreparedResourcesToRenderWorld(
  options: PrepareAndBindSnapshotPreparedResourcesToRenderWorldOptions,
): PrepareAndBindSnapshotPreparedResourcesToRenderWorldReport {
  const apply = options.renderWorld.applySnapshot(options.snapshot);
  const meshPreparation = prepareSnapshotMeshes({
    registry: options.registry,
    snapshot: options.snapshot,
    meshes: options.meshes,
  });
  const materialPreparation = prepareSnapshotMaterials({
    registry: options.registry,
    snapshot: options.snapshot,
    materials: options.materials,
  });
  const meshBinding = bindPreparedMeshResourcesToRenderWorld({
    renderWorld: options.renderWorld,
    meshes: options.meshes,
  });
  const materialBinding = bindPreparedMaterialResourcesToRenderWorld({
    renderWorld: options.renderWorld,
    materials: options.materials,
  });

  return {
    apply,
    meshes: {
      preparation: meshPreparation,
      binding: meshBinding,
    },
    materials: {
      preparation: materialPreparation,
      binding: materialBinding,
    },
    diagnostics: [
      ...apply.diagnostics,
      ...meshPreparation.diagnostics,
      ...materialPreparation.diagnostics,
      ...meshBinding.diagnostics,
      ...materialBinding.diagnostics,
    ],
  };
}
