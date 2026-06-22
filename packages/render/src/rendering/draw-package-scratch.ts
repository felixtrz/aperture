import type { RenderWorldReadyDraw } from "./render-world.js";
import { emptyOpaqueRenderStateSortPressureReport } from "./render-state-sort.js";
import type { RenderDiagnostic } from "./snapshot.js";
import type {
  RenderWorldDrawPackage,
  RenderWorldDrawPackageScratch,
  RenderWorldDrawPackageScratchSummary,
} from "./draw-package-types.js";

export interface MutableRenderWorldDrawPackage {
  renderId: number;
  packet: RenderWorldReadyDraw["packet"];
  meshResourceKey: string;
  materialResourceKey: string;
  batchKey: RenderWorldReadyDraw["batchKey"];
  sortKey: RenderWorldReadyDraw["packet"]["sortKey"];
  transformPackedOffset: number;
}

export function createRenderWorldDrawPackageScratch(
  capacity = 0,
): RenderWorldDrawPackageScratch {
  const packagePool: RenderWorldDrawPackage[] = [];
  const packages: RenderWorldDrawPackage[] = [];
  const stableOrderScratch: RenderWorldDrawPackage[] = [];
  const diagnostics: RenderDiagnostic[] = [];
  const summary = createEmptySummary();

  for (let i = 0; i < capacity; i += 1) {
    packagePool.push(createEmptyPackage());
  }

  return {
    packages,
    diagnostics,
    packagePool,
    stableOrderScratch,
    summary,
    plan: { packages, diagnostics, summary },
  };
}

export function drawPackageAt(
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

function createEmptySummary(): RenderWorldDrawPackageScratchSummary {
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
    stateSort: emptyOpaqueRenderStateSortPressureReport(),
  };
}
