import { type RenderSnapshot } from "@aperture-engine/render";
import { type ApertureSceneDocument, type LoadSceneResult, type SceneDocumentDiagnostic } from "@aperture-engine/simulation";
import type { SimulationFixedStepClockState } from "@aperture-engine/runtime";
import { type ApertureApp, type CreateApertureAppOptions } from "./advanced.js";
import { type ApertureConfig } from "./config.js";
import { type ApertureEntityLookup, type ApertureEntityLookupSnapshot } from "./entity-lookup.js";
import { type SignalSummary } from "./systems.js";
import { type ApertureResourceSummaryEntry } from "./systems/resources.js";
import { type SourceAssetMirrorReport } from "./asset-mirror.js";
import { type ApertureGeneratedDiagnosticsStatus } from "./diagnostics.js";
import { type ApertureInputSummary } from "./input.js";
import { type ApertureGeneratedInputEvent } from "./input/events.js";
import { type ApertureFrameTimeState } from "./systems/frame-time.js";
import { type ApertureRandomState } from "./systems/random.js";
export declare const APERTURE_SESSION_SNAPSHOT_FORMAT: "aperture.session-snapshot";
export declare const APERTURE_SESSION_SNAPSHOT_VERSION: 1;
export declare const APERTURE_SESSION_SNAPSHOT_APP_VERSION: "0.3.0";
export interface CreateApertureHeadlessRunnerOptions extends Omit<CreateApertureAppOptions, "config"> {
    readonly config: ApertureConfig;
}
export interface ApertureHeadlessSnapshotCounts {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly bounds: number;
    readonly diagnostics: number;
}
export interface ApertureHeadlessStatus {
    readonly mode: "headless";
    readonly nextFrame: number;
    readonly preload: ApertureApp["preload"];
    readonly assets: ReturnType<ApertureApp["lowLevel"]["assets"]["createManifestReport"]>;
    readonly input: ApertureInputSummary;
    readonly signals: SignalSummary;
    readonly resources: ReturnType<ApertureApp["context"]["resources"]["summary"]>;
    readonly startOptions: ReturnType<ApertureApp["context"]["startOptions"]["summary"]>;
    readonly fixedStepClock: SimulationFixedStepClockState | null;
    readonly diagnostics: ReturnType<ApertureApp["context"]["diagnostics"]["list"]>;
    readonly entities: ApertureEntityLookupSnapshot;
    readonly lastSnapshot: {
        readonly frame: number;
        readonly counts: ApertureHeadlessSnapshotCounts;
    } | null;
}
export interface ApertureHeadlessStepReport {
    readonly snapshot: RenderSnapshot;
    readonly status: ApertureHeadlessStatus;
}
export interface ApertureHeadlessFailureStatus extends ApertureGeneratedDiagnosticsStatus {
    readonly mode: "headless";
}
export interface ApertureStableDigest {
    readonly algorithm: "fnv1a32-stable-json-v1";
    readonly hash: string;
    readonly byteLength: number;
}
/**
 * Manually stepped ECS and extraction owner, without an automatic render loop.
 * Await `disposeApertureApp(runner.app)` from `@aperture-engine/app/advanced`
 * in a finally block. Its returned errors report incomplete cleanup; stop using
 * this runner after disposal and restart the process if cleanup fails.
 */
export interface ApertureHeadlessRunner {
    readonly app: ApertureApp;
    /** ECS lookup lives on the runner: find({ key }) then get(summary.entity). */
    readonly entities: ApertureEntityLookup;
    readonly sessionBootstrap: ApertureSessionSnapshotBootstrap;
    enqueueInput(event: ApertureGeneratedInputEvent, frame?: number): void;
    enqueueInputBatch(events: readonly ApertureGeneratedInputEvent[], frame?: number): void;
    getStatus(): ApertureHeadlessStatus;
    step(delta?: number, time?: number): ApertureHeadlessStepReport;
    /**
     * Advance the simulation without running render extraction (finding F18).
     * Returns only the status; the last extracted snapshot is preserved so
     * callers can extract() on demand after reaching the target state.
     */
    stepWithoutExtract(delta?: number, time?: number): {
        readonly status: ApertureHeadlessStatus;
    };
    extract(frame?: number): ApertureHeadlessStepReport;
    restoreSessionSnapshot(snapshot: ApertureSessionSnapshot): ApertureSessionRestoreReport;
}
export interface ApertureSessionSnapshot {
    readonly format: typeof APERTURE_SESSION_SNAPSHOT_FORMAT;
    readonly version: typeof APERTURE_SESSION_SNAPSHOT_VERSION;
    readonly bootstrap: ApertureSessionSnapshotBootstrap;
    readonly simulation: {
        readonly scene: ApertureSceneDocument;
        readonly componentRegistry: ApertureSessionComponentRegistryManifest;
        readonly resources: readonly ApertureSerializedResourceEntry[];
        readonly signals: readonly ApertureSerializedSignalEntry[];
        readonly sourceAssets: unknown;
        readonly diagnostics: ApertureHeadlessStatus["diagnostics"];
    };
    readonly runtime: {
        readonly frame: number;
        readonly nextFrame: number;
        readonly time: ApertureFrameTimeState;
        readonly fixedStepClock: SimulationFixedStepClockState | null;
        readonly randomStreams: readonly ApertureSerializedRandomStreamState[];
        readonly random: ApertureRandomState | null;
        readonly systems: readonly ApertureSessionSystemStateEntry[];
    };
    readonly physics: {
        readonly mode: "rebuild-from-ecs-authoring";
        readonly diagnostics: readonly SceneDocumentDiagnostic[];
    };
    readonly inspection?: ApertureSessionSnapshotInspection;
}
export interface ApertureSessionSnapshotBootstrap {
    readonly apertureVersion: string;
    readonly appConfigId: string;
    readonly appMode: "headless";
    readonly packageVersions: Readonly<Record<string, string>>;
    readonly systemModules: readonly ApertureSessionSystemModuleManifestEntry[];
    readonly worldOptions: unknown;
    readonly fixedStepOptions?: unknown;
    readonly physics?: unknown;
    readonly startOptions?: unknown;
    readonly assetLoader: ApertureSessionAssetLoaderManifest;
    readonly limitations: readonly string[];
}
export interface ApertureSessionSystemModuleManifestEntry {
    readonly index: number;
    readonly moduleId: string;
    readonly exportName: "default";
    readonly className: string | null;
    readonly priority: number | null;
    readonly hasSnapshotState: boolean;
    readonly hasRestoreState: boolean;
    readonly hasAfterRestore: boolean;
    readonly configData?: unknown;
}
export interface ApertureSessionAssetLoaderManifest {
    readonly kind: "default" | "provided";
}
export interface ApertureSessionComponentRegistryManifest {
    readonly ids: readonly string[];
}
export type ApertureSerializedResourceEntry = ApertureResourceSummaryEntry;
export interface ApertureSerializedSignalEntry {
    readonly name: string;
    readonly kind: string;
    readonly value: unknown;
}
export interface ApertureSerializedRandomStreamState {
    readonly id: "default";
    readonly state: ApertureRandomState;
}
export interface ApertureSessionSnapshotInspection {
    /**
     * Optional renderer-only sidecar, intentionally typed as unknown so the app
     * package does not depend on the CLI-owned RenderBundle schema.
     */
    readonly renderBundle?: unknown;
}
export interface ApertureSessionSystemStateEntry {
    readonly system: string;
    readonly index: number;
    readonly version: 1;
    readonly payload: unknown;
}
export interface ApertureSessionRestoreReport {
    readonly ok: boolean;
    readonly scene: LoadSceneResult;
    readonly sourceAssets: SourceAssetMirrorReport;
    readonly resources: {
        readonly restored: number;
        readonly missing: readonly string[];
    };
    readonly signals: {
        readonly restored: number;
        readonly missing: readonly string[];
    };
    readonly random: {
        readonly restored: boolean;
    };
    readonly fixedStepClock: {
        readonly restored: boolean;
    };
    readonly systems: {
        readonly restored: number;
        readonly missing: readonly string[];
        readonly afterRestore: number;
    };
}
export interface RestoreApertureHeadlessRunnerFromSessionOptions extends CreateApertureHeadlessRunnerOptions {
    readonly snapshot: ApertureSessionSnapshot;
}
export interface CreateApertureSessionSnapshotOptions {
    readonly inspection?: ApertureSessionSnapshotInspection;
}
/**
 * Create a headless runner from already imported modules, for example
 * `systems: [{ default: SceneSystem }]`. Scheduling belongs to the class's
 * `createSystem({ priority })` descriptor. Use `disposeApertureApp(runner.app)`
 * from `@aperture-engine/app/advanced` for complete system and feature cleanup.
 */
export declare function createApertureHeadlessRunner(options: CreateApertureHeadlessRunnerOptions): Promise<ApertureHeadlessRunner>;
export declare function restoreApertureHeadlessRunnerFromSessionSnapshot(options: RestoreApertureHeadlessRunnerFromSessionOptions): Promise<{
    readonly runner: ApertureHeadlessRunner;
    readonly restore: ApertureSessionRestoreReport;
}>;
export declare function createApertureSessionSnapshot(runner: ApertureHeadlessRunner, options?: CreateApertureSessionSnapshotOptions): ApertureSessionSnapshot;
export declare function createApertureHeadlessFailureStatus(error: unknown): ApertureHeadlessFailureStatus;
export declare function createApertureStableDigest(value: unknown): ApertureStableDigest;
export declare function createApertureHeadlessEcsDigest(status: Pick<ApertureHeadlessStatus, "entities">): ApertureStableDigest;
export declare function createApertureHeadlessStatusDigest(status: ApertureHeadlessStatus): ApertureStableDigest;
export declare function createApertureRenderSnapshotDigest(snapshot: RenderSnapshot): ApertureStableDigest;
export declare function assertSupportedSessionSnapshot(snapshot: ApertureSessionSnapshot): void;
//# sourceMappingURL=headless.d.ts.map