import { SIMULATION_WORKER_PROTOCOL, } from "/aperture/worker-modules/packages/runtime/dist/index.js";
import { isApertureDevtoolsRequest, isGeneratedCommandMessage, } from "../commands.js";
import { isGeneratedInputEventMessage, } from "../input.js";
import { applyGeneratedCommand } from "./commands.js";
import { createGeneratedEntityToolBridge, } from "./devtools/entities.js";
import { runGeneratedWorkerLoop } from "./loop.js";
export function startGeneratedSimulationWorker(options) {
    if (options.port === undefined) {
        waitForWorkerPort((port) => {
            attachWorkerPort({ ...options, port });
        });
        return;
    }
    attachWorkerPort({ ...options, port: options.port });
}
function attachWorkerPort(options) {
    const port = options.port;
    const pendingInput = [];
    const pendingCommands = [];
    const pendingDevtools = [];
    let app = null;
    let entityTools = null;
    let devtools = null;
    port.addEventListener("message", (event) => {
        const message = event.data;
        if (isGeneratedInputEventMessage(message)) {
            pendingInput.push(message);
            return;
        }
        if (isGeneratedCommandMessage(message)) {
            if (app === null || entityTools === null) {
                pendingCommands.push(message);
            }
            else {
                applyGeneratedCommand(app, entityTools, message);
            }
            return;
        }
        if (isApertureDevtoolsRequest(message)) {
            if (devtools === null) {
                pendingDevtools.push(message);
            }
            else {
                devtools.handle(message);
            }
            return;
        }
        if (!isStartMessage(message)) {
            return;
        }
        const start = startOptionsFromMessage(message);
        void runGeneratedWorkerLoop({
            port,
            config: options.config,
            systems: options.systems,
            start,
            pendingInput,
            createEntityTools: createGeneratedEntityToolBridge,
            setApp(nextApp, nextEntityTools, nextDevtools) {
                app = nextApp;
                entityTools = nextEntityTools;
                devtools = nextDevtools;
                for (const pending of pendingCommands.splice(0)) {
                    applyGeneratedCommand(nextApp, nextEntityTools, pending);
                }
                for (const pending of pendingDevtools.splice(0)) {
                    nextDevtools.handle(pending);
                }
            },
        });
    });
    port.start?.();
}
function waitForWorkerPort(callback) {
    const workerScope = globalThis;
    workerScope.addEventListener("message", (event) => {
        const message = event.data;
        if (typeof message === "object" &&
            message !== null &&
            message.type ===
                SIMULATION_WORKER_PROTOCOL.connect) {
            const port = message.port ?? null;
            if (port !== null) {
                port.start?.();
                callback(port);
            }
        }
    });
}
function isStartMessage(value) {
    return (typeof value === "object" &&
        value !== null &&
        value.type ===
            SIMULATION_WORKER_PROTOCOL.start);
}
function startOptionsFromMessage(message) {
    const nested = message.options;
    if (nested === null || typeof nested !== "object" || Array.isArray(nested)) {
        return message;
    }
    return {
        ...message,
        ...nested,
    };
}
//# sourceMappingURL=start.js.map