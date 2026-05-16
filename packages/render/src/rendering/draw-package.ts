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

export interface RenderWorldDrawPackageScratch {
  readonly packages: RenderWorldDrawPackage[];
  readonly diagnostics: RenderDiagnostic[];
  readonly packagePool: RenderWorldDrawPackage[];
  readonly plan: RenderWorldDrawPackagePlan;
}

interface MutableRenderWorldDrawPackage {
  renderId: number;
  packet: RenderWorldReadyDraw["packet"];
  meshResourceKey: string;
  materialResourceKey: string;
  batchKey: RenderWorldReadyDraw["batchKey"];
  sortKey: RenderWorldReadyDraw["packet"]["sortKey"];
  transformPackedOffset: number;
}

export function planRenderWorldDrawPackages(
  readiness: RenderWorldDrawReadinessReport,
  transforms: PackedSnapshotTransforms,
): RenderWorldDrawPackagePlan {
  const scratch = createRenderWorldDrawPackageScratch();

  writeRenderWorldDrawPackages(readiness, transforms, scratch);

  return scratch.plan;
}

export function createRenderWorldDrawPackageScratch(
  capacity = 0,
): RenderWorldDrawPackageScratch {
  const packagePool: RenderWorldDrawPackage[] = [];
  const packages: RenderWorldDrawPackage[] = [];
  const diagnostics: RenderDiagnostic[] = [];

  for (let i = 0; i < capacity; i += 1) {
    packagePool.push(createEmptyPackage());
  }

  return {
    packages,
    diagnostics,
    packagePool,
    plan: { packages, diagnostics },
  };
}

export function writeRenderWorldDrawPackages(
  readiness: RenderWorldDrawReadinessReport,
  transforms: PackedSnapshotTransforms,
  scratch: RenderWorldDrawPackageScratch,
): RenderWorldDrawPackagePlan {
  scratch.packages.length = 0;
  scratch.diagnostics.length = 0;

  for (const diagnostic of transforms.diagnostics) {
    scratch.diagnostics.push(diagnostic);
  }

  for (const blocked of readiness.blocked) {
    scratch.diagnostics.push({
      code: "renderDrawPackage.blockedDraw",
      message: `Render object ${blocked.renderId} is blocked by missing resources: ${blocked.missing.join(", ")}.`,
      severity: "warning",
      entity: blocked.packet.entity,
    });
  }

  for (const draw of readiness.ready) {
    const transformPackedOffset = findPackedTransformOffset(
      transforms,
      draw.renderId,
    );

    if (transformPackedOffset === undefined) {
      scratch.diagnostics.push({
        code: "renderDrawPackage.missingPackedTransform",
        message: `Render object ${draw.renderId} is ready but has no packed transform offset.`,
        severity: "warning",
        entity: draw.packet.entity,
      });
      continue;
    }

    const drawPackage = packageAt(scratch, scratch.packages.length);

    drawPackage.renderId = draw.renderId;
    drawPackage.packet = draw.packet;
    drawPackage.meshResourceKey = draw.meshResourceKey;
    drawPackage.materialResourceKey = draw.materialResourceKey;
    drawPackage.batchKey = draw.batchKey;
    drawPackage.sortKey = draw.packet.sortKey;
    drawPackage.transformPackedOffset = transformPackedOffset;
    scratch.packages.push(drawPackage);
  }

  scratch.packages.sort((a, b) => compareRenderSortKeys(a.sortKey, b.sortKey));

  return scratch.plan;
}

function findPackedTransformOffset(
  transforms: PackedSnapshotTransforms,
  renderId: number,
): number | undefined {
  for (const offset of transforms.offsets) {
    if (offset.renderId === renderId) {
      return offset.packedOffset;
    }
  }

  return undefined;
}

function packageAt(
  scratch: RenderWorldDrawPackageScratch,
  index: number,
): MutableRenderWorldDrawPackage {
  const existing = scratch.packagePool[index] as
    | MutableRenderWorldDrawPackage
    | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const drawPackage = createEmptyPackage();

  scratch.packagePool.push(drawPackage);
  return drawPackage;
}

function createEmptyPackage(): MutableRenderWorldDrawPackage {
  return {
    renderId: 0,
    packet: null as unknown as RenderWorldReadyDraw["packet"],
    meshResourceKey: "",
    materialResourceKey: "",
    batchKey: null as unknown as RenderWorldReadyDraw["batchKey"],
    sortKey: null as unknown as RenderWorldReadyDraw["packet"]["sortKey"],
    transformPackedOffset: 0,
  };
}
