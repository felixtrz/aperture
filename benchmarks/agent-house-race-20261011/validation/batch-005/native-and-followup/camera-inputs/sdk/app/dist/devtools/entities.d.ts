import type { EcsWorld } from "@aperture-engine/simulation";
import { type ApertureGeneratedCommand } from "../commands.js";
import type { EcsEntityRef } from "../config.js";
import { type ApertureEntityFindReport, type ApertureEntityGetReport, type ApertureEntityHierarchyReport, type ApertureEntityLookupDiagnostic, type ApertureEntityLookupSnapshot, type ApertureEntitySetComponentFieldReport, type ApertureEntitySnapshotDiff } from "../entity-lookup.js";
import type { GeneratedDevtoolsToolResult } from "./types.js";
interface GeneratedEntityToolRequest {
    readonly channel: string;
    readonly payload: unknown;
}
interface GeneratedEntityToolStatus {
    readonly finds: number;
    readonly gets: number;
    readonly mutations: number;
    readonly snapshots: number;
    readonly diffs: number;
    readonly hierarchies: number;
    readonly lastRequest: GeneratedEntityToolRequest | null;
    readonly lastFind: ApertureEntityFindReport | null;
    readonly lastGet: ApertureEntityGetReport | null;
    readonly lastMutation: ApertureEntitySetComponentFieldReport | null;
    readonly lastSnapshot: ApertureEntityLookupSnapshot | null;
    readonly lastDiff: ApertureEntitySnapshotDiff | null;
    readonly lastHierarchy: ApertureEntityHierarchyReport | null;
    readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
}
export interface GeneratedEntityToolBridge {
    handle(command: ApertureGeneratedCommand): boolean;
    call(tool: string, payload: unknown): GeneratedDevtoolsToolResult;
    summary(): GeneratedEntityToolStatus;
}
/** Editing support through devtools only; this is not general ECS immutability. */
export interface GeneratedComponentMutationAffordance {
    readonly tool: "ecs_set_component_field";
    readonly supported: boolean;
    readonly writableFields: readonly string[];
    readonly readOnlyFields: readonly string[];
    readonly fieldPathSyntax: "literal-top-level-field";
}
export interface GeneratedComponentSchema {
    readonly id: string;
    readonly description?: string;
    readonly fields: Readonly<Record<string, unknown>>;
    readonly mutation: GeneratedComponentMutationAffordance;
}
export interface GeneratedComponentSchemaReport {
    readonly schemas: readonly GeneratedComponentSchema[];
    readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
}
export declare function createGeneratedEntityToolBridge(world: EcsWorld): GeneratedEntityToolBridge;
export declare function entityRefFromValue(value: unknown): EcsEntityRef | null;
export {};
//# sourceMappingURL=entities.d.ts.map