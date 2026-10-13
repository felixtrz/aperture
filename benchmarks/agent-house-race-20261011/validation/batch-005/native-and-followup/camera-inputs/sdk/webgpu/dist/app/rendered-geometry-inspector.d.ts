import type { MeshAsset } from "@aperture-engine/render";
import type { MeshGpuBufferResource } from "../resources/meshes/mesh-buffer-resources.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { RenderedGeometryCaptureOptions, RenderedGeometryDraw, RenderedGeometryInspection, RenderedGeometryInspectionOptions, RenderedGeometryOmission } from "./rendered-geometry-types.js";
export interface SubmittedGeometryDraw extends RenderedGeometryDraw {
    readonly omission?: RenderedGeometryOmission;
}
export interface RenderedGeometryFrameCapture {
    submitted(input: {
        readonly draws: readonly SubmittedGeometryDraw[];
        readonly omissions?: readonly RenderedGeometryOmission[];
        readonly unsupportedRoute?: "custom-wgsl" | "user-pass" | "unsupported-route";
    }): void;
    failedTarget(message: string): void;
    close(): void;
}
/** Internal derived observer. Do not re-export this factory on the public barrel. */
export declare function createRenderedGeometryInspector(setting?: false | RenderedGeometryCaptureOptions): {
    enabled: boolean;
    /** Called only for a successful fresh upload or successful in-place update. */
    uploaded(input: {
        readonly key: string;
        readonly sourceKey: string;
        readonly sourceVersion: number;
        readonly mesh: MeshAsset;
        readonly reused: boolean;
        readonly previousKey?: string;
        readonly resource?: MeshGpuBufferResource;
    }): void;
    /** Same-version cache hits leave the previous uploaded bytes untouched. */
    releaseMesh(key: string): void;
    meshBinding(key: string): {
        readonly positionBufferKey: string;
        readonly positionBuffer: unknown;
        readonly indexBuffer: unknown | null;
    } | null;
    deviceObserver: {
        worldBufferCreated(buffer: unknown, resourceKey: string, capacity: number, initial: Float32Array<ArrayBufferLike>): void;
        indirectBufferCreated(buffer: unknown, resourceKey: string, capacity: number): void;
        bufferWritten(buffer: unknown, offset: number, data: ArrayBufferLike | ArrayBufferView<ArrayBufferLike>, dataOffset: number | undefined, size: number | undefined): void;
        bufferInvalidated(buffer: unknown): void;
        bufferDestroyed(buffer: unknown): void;
        bindGroupCreated(group: unknown, descriptor: unknown): void;
    };
    worldBinding(group: unknown): {
        resourceKey: string;
        matrices: Float32Array<ArrayBufferLike>;
    } | null;
    indirectCommand(command: RenderPassCommand): RenderPassCommand;
    beginFrame(frame: number): RenderedGeometryFrameCapture | null;
    inspect(options?: RenderedGeometryInspectionOptions): RenderedGeometryInspection;
    dispose(): void;
};
//# sourceMappingURL=rendered-geometry-inspector.d.ts.map