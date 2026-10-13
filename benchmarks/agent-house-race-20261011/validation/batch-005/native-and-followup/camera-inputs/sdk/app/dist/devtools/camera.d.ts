import type { ApertureApp } from "../advanced.js";
import type { ApertureDevtoolsRequest } from "../commands.js";
import type { EcsEntityRef } from "../config.js";
import type { GeneratedDevtoolsToolResult } from "./types.js";
export interface CameraToolState {
    readonly entity: EcsEntityRef;
    readonly camera: Readonly<Record<string, unknown>>;
    readonly localTransform: {
        readonly translation: readonly [number, number, number];
        readonly rotation: readonly [number, number, number, number];
        readonly scale: readonly [number, number, number];
    } | null;
}
export declare function callCameraTool(app: ApertureApp, request: ApertureDevtoolsRequest, savedCameraStates: Map<string, CameraToolState>, viewportAspect?: number): GeneratedDevtoolsToolResult;
//# sourceMappingURL=camera.d.ts.map