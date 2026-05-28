import type { EcsEntityRef } from "./config.js";

export interface ApertureEntitySourceSummary {
  readonly assetId?: string;
  readonly gltfNodeIndex?: number;
  readonly gltfNodePath?: string;
}

export interface ApertureEntitySummary {
  readonly entity: EcsEntityRef;
  readonly key?: string;
  readonly name: string;
  readonly componentIds: readonly string[];
  readonly tags?: readonly string[];
  readonly source?: ApertureEntitySourceSummary;
  readonly parent?: EcsEntityRef;
  readonly localTransform?: ApertureLocalTransformSummary;
  readonly worldTransform?: ApertureWorldTransformSummary;
}

export interface ApertureLocalTransformSummary {
  readonly translation: readonly [number, number, number];
  readonly rotation: readonly [number, number, number, number];
  readonly scale: readonly [number, number, number];
}

export interface ApertureWorldTransformSummary {
  readonly matrix: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
}

export interface ApertureEntityHierarchyNode {
  readonly entity: EcsEntityRef;
  readonly key?: string;
  readonly name: string;
  readonly parent?: EcsEntityRef;
  readonly children: readonly ApertureEntityHierarchyNode[];
}

export interface ApertureEntityHierarchyReport {
  readonly roots: readonly ApertureEntityHierarchyNode[];
  readonly total: number;
  readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
}

export interface ApertureEntityLookupSourceFilter {
  readonly assetId?: string;
  readonly gltfNodeIndex?: number;
  readonly gltfNodePath?: string;
}

export interface ApertureEntityFindQuery {
  readonly key?: string;
  readonly namePattern?: string;
  readonly withComponents?: readonly string[];
  readonly tags?: readonly string[];
  readonly source?: ApertureEntityLookupSourceFilter;
  readonly limit?: number;
}

export interface ApertureEntityLookupDiagnostic {
  readonly code: string;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly suggestedFix: string;
}

export interface ApertureEntityFindReport {
  readonly summaries: readonly ApertureEntitySummary[];
  readonly total: number;
  readonly truncated: boolean;
  readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
}

export type ApertureEntityGetReport =
  | {
      readonly ok: true;
      readonly summary: ApertureEntitySummary;
    }
  | {
      readonly ok: false;
      readonly diagnostic: ApertureEntityLookupDiagnostic;
    };

export interface ApertureEntityLookupSnapshot {
  readonly label?: string;
  readonly summaries: readonly ApertureEntitySummary[];
  readonly total: number;
  readonly truncated: boolean;
  readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
}

export interface ApertureEntityLookupSnapshotOptions extends ApertureEntityFindQuery {
  readonly label?: string;
  readonly entities?: readonly EcsEntityRef[];
}

export interface ApertureEntitySnapshotChange {
  readonly entity: EcsEntityRef;
  readonly fields: readonly string[];
  readonly before: ApertureEntitySummary;
  readonly after: ApertureEntitySummary;
}

export interface ApertureEntitySnapshotDiffCounts {
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
  readonly unchanged: number;
}

export interface ApertureEntitySnapshotDiff {
  readonly fromLabel?: string;
  readonly toLabel?: string;
  readonly counts: ApertureEntitySnapshotDiffCounts;
  readonly added: readonly ApertureEntitySummary[];
  readonly removed: readonly ApertureEntitySummary[];
  readonly changed: readonly ApertureEntitySnapshotChange[];
  readonly unchanged: readonly ApertureEntitySummary[];
  readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
}

export interface ApertureEntitySetComponentFieldRequest {
  readonly entity: EcsEntityRef;
  readonly component: string;
  readonly field: string;
  readonly value: unknown;
}

export type ApertureEntitySetComponentFieldReport =
  | {
      readonly ok: true;
      readonly component: string;
      readonly field: string;
      readonly value: unknown;
      readonly summary: ApertureEntitySummary;
    }
  | {
      readonly ok: false;
      readonly diagnostic: ApertureEntityLookupDiagnostic;
    };

export interface ApertureEntityLookup {
  find(query?: ApertureEntityFindQuery): ApertureEntityFindReport;
  get(entity: EcsEntityRef): ApertureEntityGetReport;
  snapshot(
    options?: ApertureEntityLookupSnapshotOptions,
  ): ApertureEntityLookupSnapshot;
  diff(
    previous: ApertureEntityLookupSnapshot,
    next: ApertureEntityLookupSnapshot,
  ): ApertureEntitySnapshotDiff;
  setComponentField(
    request: ApertureEntitySetComponentFieldRequest,
  ): ApertureEntitySetComponentFieldReport;
  hierarchy(): ApertureEntityHierarchyReport;
}
