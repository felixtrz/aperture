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
  readonly summary: RenderWorldDrawPackageScratchSummary;
}

export interface RenderWorldDrawPackageDiagnosticSummary {
  readonly total: number;
  readonly byCode: Readonly<Record<string, number>>;
}

export interface RenderWorldDrawPackageScratchSummary {
  readonly readyDrawCount: number;
  readonly blockedDrawCount: number;
  readonly packageCount: number;
  readonly packagePoolSize: number;
  readonly packagePoolSizeBeforeWrite: number;
  readonly packageSlotsReused: number;
  readonly packageSlotsCreated: number;
  readonly missingPackedTransformCount: number;
  readonly diagnostics: RenderWorldDrawPackageDiagnosticSummary;
}

export interface RenderWorldDrawPackageScratch {
  readonly packages: RenderWorldDrawPackage[];
  readonly diagnostics: RenderDiagnostic[];
  readonly packagePool: RenderWorldDrawPackage[];
  readonly summary: RenderWorldDrawPackageScratchSummary;
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

interface MutableRenderWorldDrawPackageDiagnosticSummary {
  total: number;
  readonly byCode: Record<string, number>;
}

interface MutableRenderWorldDrawPackageScratchSummary {
  readyDrawCount: number;
  blockedDrawCount: number;
  packageCount: number;
  packagePoolSize: number;
  packagePoolSizeBeforeWrite: number;
  packageSlotsReused: number;
  packageSlotsCreated: number;
  missingPackedTransformCount: number;
  readonly diagnostics: MutableRenderWorldDrawPackageDiagnosticSummary;
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
  const summary = createEmptySummary();

  for (let i = 0; i < capacity; i += 1) {
    packagePool.push(createEmptyPackage());
  }

  return {
    packages,
    diagnostics,
    packagePool,
    summary,
    plan: { packages, diagnostics, summary },
  };
}

export function writeRenderWorldDrawPackages(
  readiness: RenderWorldDrawReadinessReport,
  transforms: PackedSnapshotTransforms,
  scratch: RenderWorldDrawPackageScratch,
): RenderWorldDrawPackagePlan {
  const packagePoolSizeBeforeWrite = scratch.packagePool.length;

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
  writeScratchSummary(readiness, scratch, packagePoolSizeBeforeWrite);

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

function createEmptySummary(): MutableRenderWorldDrawPackageScratchSummary {
  return {
    readyDrawCount: 0,
    blockedDrawCount: 0,
    packageCount: 0,
    packagePoolSize: 0,
    packagePoolSizeBeforeWrite: 0,
    packageSlotsReused: 0,
    packageSlotsCreated: 0,
    missingPackedTransformCount: 0,
    diagnostics: {
      total: 0,
      byCode: {},
    },
  };
}

function writeScratchSummary(
  readiness: RenderWorldDrawReadinessReport,
  scratch: RenderWorldDrawPackageScratch,
  packagePoolSizeBeforeWrite: number,
): void {
  const summary =
    scratch.summary as MutableRenderWorldDrawPackageScratchSummary;
  const diagnostics =
    summary.diagnostics as MutableRenderWorldDrawPackageDiagnosticSummary;

  summary.readyDrawCount = readiness.ready.length;
  summary.blockedDrawCount = readiness.blocked.length;
  summary.packageCount = scratch.packages.length;
  summary.packagePoolSize = scratch.packagePool.length;
  summary.packagePoolSizeBeforeWrite = packagePoolSizeBeforeWrite;
  summary.packageSlotsReused = Math.min(
    scratch.packages.length,
    packagePoolSizeBeforeWrite,
  );
  summary.packageSlotsCreated = Math.max(
    0,
    scratch.packagePool.length - packagePoolSizeBeforeWrite,
  );
  summary.missingPackedTransformCount = 0;
  diagnostics.total = scratch.diagnostics.length;

  for (const code in diagnostics.byCode) {
    delete diagnostics.byCode[code];
  }

  for (const diagnostic of scratch.diagnostics) {
    diagnostics.byCode[diagnostic.code] =
      (diagnostics.byCode[diagnostic.code] ?? 0) + 1;

    if (diagnostic.code === "renderDrawPackage.missingPackedTransform") {
      summary.missingPackedTransformCount += 1;
    }
  }
}
