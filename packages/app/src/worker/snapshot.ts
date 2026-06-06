import {
  SIMULATION_WORKER_PROTOCOL,
  type SimulationMessagePort,
} from "@aperture-engine/runtime";
import {
  serializeSourceAssetRegistry,
  type SourceAssetSerializationState,
} from "../asset-mirror.js";
import type { ApertureConfig } from "../config.js";
import { createApertureEntityLookupSnapshot } from "../entity-lookup.js";
import {
  advanceGeneratedInputFrame,
  createInputSummary,
  type ApertureGeneratedInputEventMessage,
} from "../input.js";
import { createSignalSummary } from "../systems.js";
import type { ApertureApp } from "../advanced.js";
import { createAssetSummary } from "./assets.js";
import type { GeneratedEntityToolBridge } from "./devtools/entities.js";

export interface GeneratedWorkerSnapshotPublishReport {
  readonly nextFrame: number;
  readonly step: ReturnType<ApertureApp["step"]>;
}

export function publishGeneratedWorkerSnapshot(options: {
  readonly app: ApertureApp;
  readonly config: ApertureConfig;
  readonly port: SimulationMessagePort;
  readonly pendingInput: ApertureGeneratedInputEventMessage[];
  readonly sourceAssetState: SourceAssetSerializationState;
  readonly entityTools: GeneratedEntityToolBridge;
  readonly delta: number;
  readonly time: number;
  readonly frame: number;
}): GeneratedWorkerSnapshotPublishReport {
  advanceGeneratedInputFrame({
    signals: options.app.context.input,
    config: options.config,
    events: options.pendingInput.splice(0).map((message) => message.event),
  });
  const step = options.app.step(options.delta, options.time);
  const snapshot = options.app.extract(options.frame);

  options.port.postMessage({
    type: SIMULATION_WORKER_PROTOCOL.snapshot,
    snapshot,
    sourceAssets: serializeSourceAssetRegistry(options.app.lowLevel.assets, {
      state: options.sourceAssetState,
    }),
    workerSummary: {
      signals: createSignalSummary(options.app.context.signals),
      input: createInputSummary(options.app.context.input),
      assets: createAssetSummary(options.app.context.assets.list()),
      commands: options.app.context.commands.summary(),
      diagnostics: options.app.context.diagnostics.list(),
      physics: options.app.context.physics.summary(),
      entities: createApertureEntityLookupSnapshot(options.app.lowLevel.world, {
        label: "generated-worker",
      }),
      entityTools: options.entityTools.summary(),
    },
    frame: options.frame,
  });

  return {
    nextFrame: options.frame + 1,
    step,
  };
}
