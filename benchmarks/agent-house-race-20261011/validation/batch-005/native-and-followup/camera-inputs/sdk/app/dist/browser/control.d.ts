import { type RenderSnapshotInspectionReport } from "@aperture-engine/render";
import { type WebGpuAppRenderReport, type WebGpuAppRenderReportJsonValue } from "@aperture-engine/webgpu";
import type { EcsEntityRef } from "../config.js";
import type { ApertureEntityFindQuery, ApertureEntityFindReport, ApertureEntityGetReport } from "../entity-lookup.js";
import type { CameraToolState } from "../devtools/camera.js";
import type { CameraProjectionOptions } from "../devtools/camera-projection.js";
import type { createAssetSummary } from "../devtools/assets.js";
import { type GeneratedBrowserRequestClient, type GeneratedBrowserRequestOptions } from "./request.js";
export interface GeneratedBrowserEntitySelector {
    readonly key?: string;
    readonly entity?: EcsEntityRef;
}
export interface GeneratedBrowserCameraSummary extends CameraToolState {
    readonly key: string | null;
    readonly name: string;
}
export interface GeneratedBrowserCameraProjectionOptions extends GeneratedBrowserEntitySelector, CameraProjectionOptions {
}
/** Typed core tools share the existing semantic worker bridge. Other tools use requestRaw. */
export interface GeneratedBrowserToolContracts {
    readonly ecs_query: {
        readonly payload: ApertureEntityFindQuery | undefined;
        readonly result: ApertureEntityFindReport;
    };
    readonly ecs_get_entity: {
        readonly payload: GeneratedBrowserEntitySelector;
        readonly result: ApertureEntityGetReport;
    };
    readonly ecs_pause: {
        readonly payload: undefined;
        readonly result: Readonly<Record<string, unknown>>;
    };
    readonly asset_list: {
        readonly payload: undefined;
        readonly result: {
            readonly assets: ReturnType<typeof createAssetSummary>;
        };
    };
    readonly camera_list: {
        readonly payload: undefined;
        readonly result: readonly GeneratedBrowserCameraSummary[];
    };
    readonly camera_get: {
        readonly payload: GeneratedBrowserEntitySelector;
        readonly result: GeneratedBrowserCameraSummary;
    };
    readonly camera_set_projection: {
        readonly payload: GeneratedBrowserCameraProjectionOptions;
        readonly result: GeneratedBrowserCameraSummary;
    };
    readonly camera_look_at: {
        readonly payload: GeneratedBrowserEntitySelector & {
            readonly translation?: readonly [number, number, number];
            readonly lookAt: readonly [number, number, number];
        };
        readonly result: GeneratedBrowserCameraSummary;
    };
    readonly camera_set_transform: {
        readonly payload: GeneratedBrowserEntitySelector & {
            readonly translation?: readonly [number, number, number];
            readonly rotation?: readonly [number, number, number, number];
            readonly scale?: readonly [number, number, number];
        };
        readonly result: GeneratedBrowserCameraSummary;
    };
}
export interface GeneratedBrowserFrameOptions extends GeneratedBrowserRequestOptions {
    readonly deltaSeconds?: number;
    readonly timeSeconds?: number;
}
export interface GeneratedBrowserRenderedFrame {
    readonly snapshotFrame: number;
    /** Detached existing report data; excludes renderer resources and shared snapshot buffers. */
    readonly report: WebGpuAppRenderReportJsonValue;
}
export interface GeneratedBrowserFrameInspection extends RenderSnapshotInspectionReport {
    readonly frame: number;
}
export declare function createGeneratedBrowserFrameControl(input: {
    readonly requests: GeneratedBrowserRequestClient;
    readonly manual: boolean;
    readonly getSourceAssetVersions?: () => readonly (readonly [
        string,
        number
    ])[];
}): {
    renderFrame(options?: GeneratedBrowserFrameOptions): Promise<GeneratedBrowserRenderedFrame>;
    requested(requestId: string): void;
    acceptSnapshot(frame: number, message: unknown): boolean;
    presented(report: WebGpuAppRenderReport): void;
    failed(error: Error): void;
    inspectRenderedFrame(): GeneratedBrowserFrameInspection | null;
    dispose(): void;
};
//# sourceMappingURL=control.d.ts.map