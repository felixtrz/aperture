import type { SimulationMessagePort } from "@aperture-engine/runtime";
import type { ApertureApp } from "../../advanced.js";
import {
  createApertureDevtoolsResponse,
  type ApertureDevtoolsRequest,
} from "../../commands.js";
import { createAssetSummary } from "../assets.js";
import { isRecord, numberFromValue } from "../payload.js";
import { callCameraTool, type CameraToolState } from "./camera.js";
import type { GeneratedEntityToolBridge } from "./entities.js";
import { callInputDevtoolsTool } from "./input.js";
import type { GeneratedDevtoolsToolResult } from "./types.js";

export interface GeneratedDevtoolsBridge {
  handle(request: ApertureDevtoolsRequest): void;
}

export function createGeneratedDevtoolsBridge(options: {
  readonly app: ApertureApp;
  readonly entityTools: GeneratedEntityToolBridge;
  readonly port: SimulationMessagePort;
  readonly setPaused: (paused: boolean) => void;
  readonly step: (delta: number) => Readonly<Record<string, unknown>>;
  readonly getSimulationState: () => Readonly<Record<string, unknown>>;
}): GeneratedDevtoolsBridge {
  const savedCameraStates = new Map<string, CameraToolState>();

  return {
    handle(request) {
      try {
        const result = callGeneratedDevtoolsTool(
          options,
          request,
          savedCameraStates,
        );

        options.port.postMessage(
          createApertureDevtoolsResponse({
            requestId: request.requestId,
            ok: result.ok,
            ...(Object.prototype.hasOwnProperty.call(result, "result")
              ? { result: result.result }
              : {}),
            ...(result.diagnostics === undefined
              ? {}
              : { diagnostics: result.diagnostics }),
          }),
        );
      } catch (error: unknown) {
        options.port.postMessage(
          createApertureDevtoolsResponse({
            requestId: request.requestId,
            ok: false,
            diagnostics: [
              {
                code: "aperture.devtools.toolFailed",
                severity: "error",
                message: error instanceof Error ? error.message : String(error),
                suggestedFix:
                  "Inspect the tool payload and generated worker diagnostics.",
              },
            ],
          }),
        );
      }
    },
  };
}

function callGeneratedDevtoolsTool(
  bridge: {
    readonly app: ApertureApp;
    readonly entityTools: GeneratedEntityToolBridge;
    readonly setPaused: (paused: boolean) => void;
    readonly step: (delta: number) => Readonly<Record<string, unknown>>;
    readonly getSimulationState: () => Readonly<Record<string, unknown>>;
  },
  request: ApertureDevtoolsRequest,
  savedCameraStates: Map<string, CameraToolState>,
): GeneratedDevtoolsToolResult {
  if (request.tool === "ecs_pause") {
    bridge.setPaused(true);
    return { ok: true, result: bridge.getSimulationState() };
  }

  if (request.tool === "ecs_resume") {
    bridge.setPaused(false);
    return { ok: true, result: bridge.getSimulationState() };
  }

  if (request.tool === "ecs_step") {
    return {
      ok: true,
      result: bridge.step(devtoolsStepDelta(request.payload)),
    };
  }

  if (request.tool.startsWith("input_")) {
    const result = callInputDevtoolsTool(
      bridge.app,
      request.tool,
      request.payload,
    );

    if (result !== null) {
      return result;
    }
  }

  if (request.tool === "asset_list") {
    return {
      ok: true,
      result: {
        assets: createAssetSummary(bridge.app.context.assets.list()),
      },
    };
  }

  if (request.tool.startsWith("camera_")) {
    return callCameraTool(bridge.app, request, savedCameraStates);
  }

  return bridge.entityTools.call(request.tool, request.payload);
}

function devtoolsStepDelta(payload: unknown): number {
  const record = isRecord(payload) ? payload : {};
  const delta = numberFromValue(record["delta"]);

  return delta === undefined || delta < 0 ? 1 / 60 : delta;
}
