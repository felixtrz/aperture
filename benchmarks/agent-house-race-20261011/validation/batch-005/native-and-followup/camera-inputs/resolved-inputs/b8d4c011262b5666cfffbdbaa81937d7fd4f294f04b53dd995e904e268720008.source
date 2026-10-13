export const SIMULATION_WORKER_PROTOCOL = {
    connect: "aperture.simulation.connect",
    start: "aperture.simulation.start",
    ready: "aperture.simulation.ready",
    snapshot: "aperture.simulation.snapshot",
    audioSnapshot: "aperture.simulation.audioSnapshot",
    sourceAssets: "aperture.simulation.sourceAssets",
    error: "aperture.simulation.error",
};
export function createSimulationWorker(workerEntry, options = {}) {
    const worker = resolveWorker(workerEntry, options);
    const channelFactory = options.messageChannelFactory ?? createDefaultMessageChannel;
    const channel = channelFactory();
    const snapshotCallbacks = new Set();
    const errorCallbacks = new Set();
    const messageCallbacks = new Set();
    let terminated = false;
    const handleMessage = (event) => {
        const message = event.data;
        if (!isRecord(message)) {
            return;
        }
        if (message.type === SIMULATION_WORKER_PROTOCOL.snapshot) {
            if (!isSnapshotMessage(message)) {
                dispatchError({
                    reason: "simulation-worker.invalid-snapshot",
                    message: "Simulation worker sent a snapshot message without a valid RenderSnapshot.",
                    source: "protocol",
                    raw: message,
                });
                return;
            }
            const snapshotEvent = {
                snapshot: message.snapshot,
                frame: message.frame ?? message.snapshot.frame,
                message,
            };
            for (const callback of snapshotCallbacks) {
                callback(snapshotEvent);
            }
            return;
        }
        if (message.type === SIMULATION_WORKER_PROTOCOL.error) {
            const diagnostics = Array.isArray(message.diagnostics)
                ? message.diagnostics
                : undefined;
            dispatchError({
                reason: readString(message.reason, "simulation-worker.error"),
                message: readString(message.message, "The simulation worker reported an error."),
                source: "worker",
                ...(diagnostics === undefined ? {} : { diagnostics }),
                raw: message,
            });
            return;
        }
        for (const callback of messageCallbacks) {
            callback(message);
        }
    };
    const handleWorkerError = (event) => {
        dispatchError({
            reason: "simulation-worker.transport-error",
            message: event.message || "Simulation worker transport failed.",
            source: "worker",
            raw: event,
        });
    };
    function dispatchError(event) {
        for (const callback of errorCallbacks) {
            callback(event);
        }
    }
    channel.port1.addEventListener("message", handleMessage);
    channel.port1.start?.();
    worker.addEventListener?.("error", handleWorkerError);
    worker.postMessage({
        type: SIMULATION_WORKER_PROTOCOL.connect,
        port: channel.port2,
    }, [channel.port2]);
    return {
        worker,
        start(startOptions = {}) {
            if (terminated) {
                throw new Error("Cannot start a terminated SimulationWorker.");
            }
            channel.port1.postMessage({
                type: SIMULATION_WORKER_PROTOCOL.start,
                options: mergeStartOptions(options, startOptions),
            });
        },
        postMessage(message, transfer = []) {
            if (terminated) {
                throw new Error("Cannot post to a terminated SimulationWorker.");
            }
            channel.port1.postMessage(message, transfer);
        },
        onSnapshot(callback) {
            snapshotCallbacks.add(callback);
            return () => {
                snapshotCallbacks.delete(callback);
            };
        },
        onMessage(callback) {
            messageCallbacks.add(callback);
            return () => {
                messageCallbacks.delete(callback);
            };
        },
        onError(callback) {
            errorCallbacks.add(callback);
            return () => {
                errorCallbacks.delete(callback);
            };
        },
        terminate() {
            if (terminated) {
                return;
            }
            terminated = true;
            channel.port1.removeEventListener("message", handleMessage);
            channel.port1.close?.();
            channel.port2.close?.();
            worker.removeEventListener?.("error", handleWorkerError);
            worker.terminate();
            snapshotCallbacks.clear();
            errorCallbacks.clear();
            messageCallbacks.clear();
        },
    };
}
export function renderSnapshotTransferList(snapshot) {
    return renderSnapshotBufferTransferList(snapshot);
}
function renderSnapshotBufferTransferList(input) {
    const transfer = [
        input.transforms.buffer,
        input.viewMatrices.buffer,
    ];
    if (input.instanceTints !== undefined && input.instanceTints.byteLength > 0) {
        transfer.push(input.instanceTints.buffer);
    }
    if (input.bones !== undefined && input.bones.byteLength > 0) {
        transfer.push(input.bones.buffer);
    }
    if (input.morphTargetWeights !== undefined &&
        input.morphTargetWeights.byteLength > 0) {
        transfer.push(input.morphTargetWeights.buffer);
    }
    if (input.morphTargetDeltas !== undefined &&
        input.morphTargetDeltas.byteLength > 0) {
        transfer.push(input.morphTargetDeltas.buffer);
    }
    if (input.morphInstanceDescriptors !== undefined &&
        input.morphInstanceDescriptors.byteLength > 0) {
        transfer.push(input.morphInstanceDescriptors.buffer);
    }
    if (input.instanceAttributes !== undefined &&
        input.instanceAttributes.byteLength > 0) {
        transfer.push(input.instanceAttributes.buffer);
    }
    if (input.quads !== undefined) {
        if (input.quads.instanceFloats.byteLength > 0) {
            transfer.push(input.quads.instanceFloats.buffer);
        }
        if (input.quads.instanceWords.byteLength > 0) {
            transfer.push(input.quads.instanceWords.buffer);
        }
    }
    if (input.quadInstanceFloats !== undefined &&
        input.quadInstanceFloats.byteLength > 0) {
        transfer.push(input.quadInstanceFloats.buffer);
    }
    if (input.quadInstanceWords !== undefined &&
        input.quadInstanceWords.byteLength > 0) {
        transfer.push(input.quadInstanceWords.buffer);
    }
    return transfer;
}
function resolveWorker(workerEntry, options) {
    if (typeof workerEntry === "object" && "postMessage" in workerEntry) {
        return workerEntry;
    }
    const factory = options.workerFactory ?? createDefaultWorker;
    return factory(workerEntry, options.workerOptions);
}
function createDefaultWorker(entry, options) {
    if (typeof Worker === "undefined") {
        throw new Error("createSimulationWorker requires a Worker implementation.");
    }
    return new Worker(entry, options);
}
function createDefaultMessageChannel() {
    if (typeof MessageChannel === "undefined") {
        throw new Error("createSimulationWorker requires a MessageChannel implementation.");
    }
    return new MessageChannel();
}
function mergeStartOptions(createOptions, startOptions) {
    const { workerOptions: _workerOptions, workerFactory: _workerFactory, messageChannelFactory: _messageChannelFactory, ...defaults } = createOptions;
    return { ...defaults, ...startOptions };
}
function isSnapshotMessage(value) {
    return (value.type === SIMULATION_WORKER_PROTOCOL.snapshot &&
        isRenderSnapshotLike(value.snapshot));
}
function isRenderSnapshotLike(value) {
    if (!isRecord(value)) {
        return false;
    }
    return (typeof value.frame === "number" &&
        Array.isArray(value.views) &&
        Array.isArray(value.meshDraws) &&
        Array.isArray(value.lights) &&
        Array.isArray(value.environments) &&
        Array.isArray(value.shadowRequests) &&
        Array.isArray(value.bounds) &&
        value.transforms instanceof Float32Array &&
        value.viewMatrices instanceof Float32Array &&
        Array.isArray(value.diagnostics) &&
        isRecord(value.report));
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function readString(value, fallback) {
    return typeof value === "string" && value.length > 0 ? value : fallback;
}
//# sourceMappingURL=simulation-worker.js.map