import type { RenderSnapshot } from "@aperture-engine/render";
import type { FixedStepClockOptions } from "@aperture-engine/physics";
export declare const SIMULATION_WORKER_PROTOCOL: {
    readonly connect: "aperture.simulation.connect";
    readonly start: "aperture.simulation.start";
    readonly ready: "aperture.simulation.ready";
    readonly snapshot: "aperture.simulation.snapshot";
    readonly audioSnapshot: "aperture.simulation.audioSnapshot";
    readonly sourceAssets: "aperture.simulation.sourceAssets";
    readonly error: "aperture.simulation.error";
};
export interface SimulationWorkerStartOptions {
    readonly entityCapacity?: number;
    readonly fixedStep?: false | SimulationWorkerFixedStepOptions;
    readonly physicsInterpolation?: boolean | SimulationWorkerPhysicsInterpolationOptions;
    readonly [key: string]: unknown;
}
export interface SimulationWorkerFixedStepOptions extends FixedStepClockOptions {
    readonly enabled?: boolean;
}
export interface SimulationWorkerPhysicsInterpolationOptions {
    readonly enabled?: boolean;
}
export interface SimulationWorkerReadyMessage {
    readonly type: typeof SIMULATION_WORKER_PROTOCOL.ready;
    readonly [key: string]: unknown;
}
export interface SimulationWorkerSnapshotMessage {
    readonly type: typeof SIMULATION_WORKER_PROTOCOL.snapshot;
    readonly snapshot: RenderSnapshot;
    readonly frame?: number;
    readonly [key: string]: unknown;
}
export interface SimulationWorkerAudioSnapshotMessage {
    readonly type: typeof SIMULATION_WORKER_PROTOCOL.audioSnapshot;
    readonly snapshot: RenderSnapshot;
    readonly frame?: number;
    readonly [key: string]: unknown;
}
export interface SimulationWorkerSourceAssetsMessage {
    readonly type: typeof SIMULATION_WORKER_PROTOCOL.sourceAssets;
    readonly frame?: number;
    readonly [key: string]: unknown;
}
export interface SimulationWorkerErrorMessage {
    readonly type: typeof SIMULATION_WORKER_PROTOCOL.error;
    readonly reason: string;
    readonly message: string;
    readonly [key: string]: unknown;
}
export interface SimulationWorkerSnapshotEvent {
    readonly snapshot: RenderSnapshot;
    readonly frame: number;
    readonly message: SimulationWorkerSnapshotMessage;
}
export interface SimulationWorkerErrorEvent {
    readonly reason: string;
    readonly message: string;
    readonly source: "worker" | "protocol";
    readonly diagnostics?: readonly unknown[];
    readonly raw?: unknown;
}
export type SimulationWorkerSnapshotCallback = (event: SimulationWorkerSnapshotEvent) => void;
export type SimulationWorkerErrorCallback = (event: SimulationWorkerErrorEvent) => void;
export type SimulationWorkerMessageCallback = (message: unknown) => void;
export interface SimulationWorker {
    readonly worker: SimulationWorkerTransport;
    start(options?: SimulationWorkerStartOptions): void;
    postMessage(message: unknown, transfer?: Transferable[]): void;
    onMessage(callback: SimulationWorkerMessageCallback): () => void;
    onSnapshot(callback: SimulationWorkerSnapshotCallback): () => void;
    onError(callback: SimulationWorkerErrorCallback): () => void;
    terminate(): void;
}
export interface SimulationWorkerTransport {
    postMessage(message: unknown, transfer?: Transferable[]): void;
    terminate(): void;
    addEventListener?(type: "error", listener: (event: ErrorEvent) => void): void;
    removeEventListener?(type: "error", listener: (event: ErrorEvent) => void): void;
}
export interface SimulationMessagePort {
    postMessage(message: unknown, transfer?: Transferable[]): void;
    addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
    removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
    start?(): void;
    close?(): void;
}
export interface SimulationMessageChannel {
    readonly port1: SimulationMessagePort;
    readonly port2: SimulationMessagePort;
}
export type SimulationWorkerEntry = string | URL | SimulationWorkerTransport;
export type SimulationWorkerFactory = (entry: string | URL, options?: WorkerOptions) => SimulationWorkerTransport;
export interface CreateSimulationWorkerOptions extends SimulationWorkerStartOptions {
    readonly workerOptions?: WorkerOptions;
    readonly workerFactory?: SimulationWorkerFactory;
    readonly messageChannelFactory?: () => SimulationMessageChannel;
}
export interface SimulationWorkerConnectMessage {
    readonly type: typeof SIMULATION_WORKER_PROTOCOL.connect;
    readonly port: SimulationMessagePort;
}
export declare function createSimulationWorker(workerEntry: SimulationWorkerEntry, options?: CreateSimulationWorkerOptions): SimulationWorker;
export declare function renderSnapshotTransferList(snapshot: Pick<RenderSnapshot, "transforms" | "viewMatrices" | "bones" | "morphTargetWeights" | "morphTargetDeltas" | "morphInstanceDescriptors" | "instanceTints" | "instanceAttributes" | "quads">): Transferable[];
//# sourceMappingURL=simulation-worker.d.ts.map