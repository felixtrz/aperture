import { assetHandleKey } from "../assets/index.js";
import type { RenderDiagnostic, RenderSnapshot } from "./snapshot.js";

export interface RenderSnapshotInspectionCounts {
  readonly views: number;
  readonly meshDraws: number;
  readonly lights: number;
  readonly environments: number;
  readonly shadowRequests: number;
  readonly bounds: number;
  readonly transformFloats: number;
  readonly viewMatrixFloats: number;
  readonly diagnostics: number;
}

export interface RenderSnapshotInspectionHandles {
  readonly meshKeys: readonly string[];
  readonly materialKeys: readonly string[];
  readonly renderTargetKeys: readonly string[];
  readonly environmentMapKeys: readonly string[];
}

export interface RenderSnapshotInspectionReport {
  readonly counts: RenderSnapshotInspectionCounts;
  readonly handles: RenderSnapshotInspectionHandles;
  readonly diagnostics: readonly RenderDiagnostic[];
}

export function inspectRenderSnapshot(
  snapshot: RenderSnapshot,
): RenderSnapshotInspectionReport {
  const diagnostics: RenderDiagnostic[] = [...snapshot.diagnostics];

  if (
    snapshot.views.length === 0 &&
    snapshot.meshDraws.length === 0 &&
    snapshot.lights.length === 0 &&
    snapshot.environments.length === 0 &&
    snapshot.shadowRequests.length === 0 &&
    snapshot.bounds.length === 0
  ) {
    diagnostics.push({
      code: "renderSnapshot.empty",
      message: "Render snapshot contains no packets.",
      severity: "info",
    });
  }

  return {
    counts: {
      views: snapshot.views.length,
      meshDraws: snapshot.meshDraws.length,
      lights: snapshot.lights.length,
      environments: snapshot.environments.length,
      shadowRequests: snapshot.shadowRequests.length,
      bounds: snapshot.bounds.length,
      transformFloats: snapshot.transforms.length,
      viewMatrixFloats: snapshot.viewMatrices.length,
      diagnostics: diagnostics.length,
    },
    handles: {
      meshKeys: uniqueSorted(
        snapshot.meshDraws.map((draw) => assetHandleKey(draw.mesh)),
      ),
      materialKeys: uniqueSorted(
        snapshot.meshDraws.map((draw) => assetHandleKey(draw.material)),
      ),
      renderTargetKeys: uniqueSorted(
        snapshot.views.flatMap((view) =>
          view.renderTarget === null ? [] : [assetHandleKey(view.renderTarget)],
        ),
      ),
      environmentMapKeys: uniqueSorted(
        snapshot.environments.flatMap((environment) =>
          environment.handle === null
            ? []
            : [assetHandleKey(environment.handle)],
        ),
      ),
    },
    diagnostics,
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
