import type {
  RenderWorldDrawReadinessReport,
  RenderWorldReadyDraw,
} from "./render-world.js";
import type { RenderDiagnostic } from "./snapshot.js";
import { compareRenderSortKeys } from "./snapshot.js";
import type { PackedSnapshotTransforms } from "./transform-pack.js";

export interface RenderWorldDrawPackage {
  readonly renderId: number;
  readonly packet: RenderWorldReadyDraw["packet"];
  readonly meshResourceKey: string;
  readonly materialResourceKey: string;
  readonly batchKey: RenderWorldReadyDraw["batchKey"];
  readonly sortKey: RenderWorldReadyDraw["packet"]["sortKey"];
  readonly transformPackedOffset: number;
}

export interface RenderWorldDrawPackagePlan {
  readonly packages: readonly RenderWorldDrawPackage[];
  readonly diagnostics: readonly RenderDiagnostic[];
}

export function planRenderWorldDrawPackages(
  readiness: RenderWorldDrawReadinessReport,
  transforms: PackedSnapshotTransforms,
): RenderWorldDrawPackagePlan {
  const transformOffsets = new Map(
    transforms.offsets.map((offset) => [offset.renderId, offset.packedOffset]),
  );
  const diagnostics: RenderDiagnostic[] = [...transforms.diagnostics];
  const packages: RenderWorldDrawPackage[] = [];

  for (const blocked of readiness.blocked) {
    diagnostics.push({
      code: "renderDrawPackage.blockedDraw",
      message: `Render object ${blocked.renderId} is blocked by missing resources: ${blocked.missing.join(", ")}.`,
      severity: "warning",
      entity: blocked.packet.entity,
    });
  }

  for (const draw of readiness.ready) {
    const transformPackedOffset = transformOffsets.get(draw.renderId);

    if (transformPackedOffset === undefined) {
      diagnostics.push({
        code: "renderDrawPackage.missingPackedTransform",
        message: `Render object ${draw.renderId} is ready but has no packed transform offset.`,
        severity: "warning",
        entity: draw.packet.entity,
      });
      continue;
    }

    packages.push({
      renderId: draw.renderId,
      packet: draw.packet,
      meshResourceKey: draw.meshResourceKey,
      materialResourceKey: draw.materialResourceKey,
      batchKey: draw.batchKey,
      sortKey: draw.packet.sortKey,
      transformPackedOffset,
    });
  }

  packages.sort((a, b) => compareRenderSortKeys(a.sortKey, b.sortKey));

  return { packages, diagnostics };
}
