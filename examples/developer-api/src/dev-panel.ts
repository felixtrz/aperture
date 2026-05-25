import {
  APERTURE_ENTITY_DIFF_COMMAND_CHANNEL,
  APERTURE_ENTITY_FIND_COMMAND_CHANNEL,
  APERTURE_ENTITY_GET_COMMAND_CHANNEL,
  APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL,
  APERTURE_ENTITY_SNAPSHOT_COMMAND_CHANNEL,
  APERTURE_GENERATED_COMMAND_EVENT,
} from "@aperture-engine/app/commands";
import { readGeneratedBrowserAppStatus } from "@aperture-engine/app/browser";

type JsonRecord = Record<string, unknown>;

const SELECT_KEY = "Enter";
const ASSET_REQUEST_CHANNEL = "asset.request";
const SELECT_POINTER = [0.25, 0.5] as const;
const DEBUG_METADATA_COMPONENT = "aperture.metadata.debug";
let snapshotRequestId = 0;
let mutationRequestId = 0;

const selectButton = document.querySelector<HTMLButtonElement>(
  "[data-aperture-action='select']",
);
const snapshotButton = document.querySelector<HTMLButtonElement>(
  "[data-aperture-action='snapshot']",
);
const diffButton = document.querySelector<HTMLButtonElement>(
  "[data-aperture-action='diff']",
);
const findCrateButton = document.querySelector<HTMLButtonElement>(
  "[data-aperture-action='find-crate']",
);
const getEntityButton = document.querySelector<HTMLButtonElement>(
  "[data-aperture-action='get-entity']",
);
const setNoteButton = document.querySelector<HTMLButtonElement>(
  "[data-aperture-action='set-note']",
);
const requestDecalButton = document.querySelector<HTMLButtonElement>(
  "[data-aperture-action='request-decal']",
);
const invalidCommandButton = document.querySelector<HTMLButtonElement>(
  "[data-aperture-action='invalid-command']",
);
const noteInput = document.querySelector<HTMLInputElement>(
  "[data-aperture-note-input]",
);
const statusOutput = document.querySelector<HTMLElement>(
  "#aperture-dev-status",
);

selectButton?.addEventListener("click", () => {
  dispatchPointerMove(SELECT_POINTER);
  dispatchSelectKey("keydown");
  window.setTimeout(() => dispatchSelectKey("keyup"), 80);
});

requestDecalButton?.addEventListener("click", () => {
  dispatchCommand(ASSET_REQUEST_CHANNEL, { assetId: "decal" });
});

snapshotButton?.addEventListener("click", () => {
  snapshotRequestId += 1;
  dispatchCommand(APERTURE_ENTITY_SNAPSHOT_COMMAND_CHANNEL, {
    label: `panel.snapshot.${snapshotRequestId}`,
    limit: 50,
  });
});

diffButton?.addEventListener("click", () => {
  snapshotRequestId += 1;
  dispatchCommand(APERTURE_ENTITY_DIFF_COMMAND_CHANNEL, {
    label: `panel.diff.${snapshotRequestId}`,
    limit: 50,
  });
});

findCrateButton?.addEventListener("click", () => {
  dispatchCommand(APERTURE_ENTITY_FIND_COMMAND_CHANNEL, {
    key: "level.crate.primary",
    limit: 5,
  });
});

getEntityButton?.addEventListener("click", () => {
  dispatchCommand(APERTURE_ENTITY_GET_COMMAND_CHANNEL, {
    entity: readCurrentEntityRef(),
  });
});

setNoteButton?.addEventListener("click", () => {
  mutationRequestId += 1;
  dispatchCommand(APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL, {
    entity: readCurrentEntityRef(),
    component: DEBUG_METADATA_COMPONENT,
    field: "note",
    value: noteInput?.value || `panel.note.${mutationRequestId}`,
  });
});

invalidCommandButton?.addEventListener("click", () => {
  window.dispatchEvent(
    new CustomEvent(APERTURE_GENERATED_COMMAND_EVENT, {
      detail: {
        payload: { reason: "panel.invalid-command" },
      },
    }),
  );
});

function renderStatus(): void {
  if (statusOutput !== null) {
    statusOutput.textContent = JSON.stringify(readPanelStatus(), null, 2);
  }

  requestAnimationFrame(renderStatus);
}

function readPanelStatus(): JsonRecord {
  const status = readRecord(readGeneratedBrowserAppStatus());
  const worker = readRecord(status?.lastWorkerSummary);
  const entities = readRecord(worker?.entities);
  const entityTools = readRecord(worker?.entityTools);
  const lastFailure = readRecord(status?.lastFailure);
  const entityToolDiff = readRecord(entityTools?.lastDiff);
  const entityToolCounts = readRecord(entityToolDiff?.counts);
  const diagnostics = readRecord(status?.diagnostics);
  const lastFrame = readRecord(diagnostics?.lastFrame);

  return {
    app: {
      status: status?.status ?? "starting",
      webgpuOk: status?.webgpuOk ?? null,
      snapshots: status?.snapshots ?? 0,
      forwardedInputEvents: status?.forwardedInputEvents ?? 0,
      forwardedCommandEvents: status?.forwardedCommandEvents ?? 0,
      lastFrame: status?.lastFrame ?? null,
      frameCounts: readRecord(lastFrame?.counts),
      lastCommandEvent: readRecord(status?.lastCommandEvent),
      lastFailure: {
        status: lastFailure?.status ?? null,
        diagnostics: Array.isArray(lastFailure?.diagnostics)
          ? lastFailure.diagnostics
          : [],
      },
    },
    signals: readRecord(worker?.signals),
    input: readRecord(worker?.input),
    commands: readRecord(worker?.commands),
    entities: {
      total: entities?.total ?? 0,
      summaries: readEntitySummaries(entities?.summaries),
    },
    entityTools: {
      finds: entityTools?.finds ?? 0,
      gets: entityTools?.gets ?? 0,
      mutations: entityTools?.mutations ?? 0,
      snapshots: entityTools?.snapshots ?? 0,
      diffs: entityTools?.diffs ?? 0,
      lastRequest: readRecord(entityTools?.lastRequest),
      lastFind: readRecord(entityTools?.lastFind),
      lastGet: readRecord(entityTools?.lastGet),
      lastMutation: readRecord(entityTools?.lastMutation),
      lastSnapshot: readEntitySnapshot(entityTools?.lastSnapshot),
      lastDiff: {
        fromLabel: entityToolDiff?.fromLabel ?? null,
        toLabel: entityToolDiff?.toLabel ?? null,
        counts: {
          added: entityToolCounts?.added ?? 0,
          removed: entityToolCounts?.removed ?? 0,
          changed: entityToolCounts?.changed ?? 0,
          unchanged: entityToolCounts?.unchanged ?? 0,
        },
        diagnostics: Array.isArray(entityToolDiff?.diagnostics)
          ? entityToolDiff.diagnostics
          : [],
      },
      diagnostics: Array.isArray(entityTools?.diagnostics)
        ? entityTools.diagnostics
        : [],
    },
    diagnostics: Array.isArray(worker?.diagnostics) ? worker.diagnostics : [],
  };
}

function dispatchCommand(channel: string, payload: unknown): void {
  window.dispatchEvent(
    new CustomEvent(APERTURE_GENERATED_COMMAND_EVENT, {
      detail: { channel, payload },
    }),
  );
}

function readCurrentEntityRef(): unknown {
  const status = readRecord(readGeneratedBrowserAppStatus());
  const worker = readRecord(status?.lastWorkerSummary);
  const signals = readRecord(worker?.signals);
  const selected = readEntityRef(signals?.selectedEntity);

  if (selected !== null) {
    return selected;
  }

  const entityTools = readRecord(worker?.entityTools);
  const lastGet = readRecord(entityTools?.lastGet);
  const getSummary = readRecord(lastGet?.summary);
  const getEntity = readEntityRef(getSummary?.entity);

  if (getEntity !== null) {
    return getEntity;
  }

  const lastFind = readRecord(entityTools?.lastFind);
  const findSummaries = Array.isArray(lastFind?.summaries)
    ? lastFind.summaries
    : [];
  const firstFindSummary = readRecord(findSummaries[0]);
  const findEntity = readEntityRef(firstFindSummary?.entity);

  if (findEntity !== null) {
    return findEntity;
  }

  const entities = readRecord(worker?.entities);
  const summaries = Array.isArray(entities?.summaries)
    ? entities.summaries
    : [];

  for (const entry of summaries) {
    const summary = readRecord(entry);
    if (summary?.key !== "level.crate.primary") {
      continue;
    }

    const entity = readEntityRef(summary.entity);
    if (entity !== null) {
      return entity;
    }
  }

  return null;
}

function readEntityRef(
  value: unknown,
): { readonly index: number; readonly generation: number } | null {
  const record = readRecord(value);
  const index = record?.index;
  const generation = record?.generation;

  return typeof index === "number" &&
    Number.isFinite(index) &&
    typeof generation === "number" &&
    Number.isFinite(generation)
    ? { index, generation }
    : null;
}

function dispatchPointerMove(position: readonly [number, number]): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#aperture");
  const rect = canvas?.getBoundingClientRect();

  if (canvas === null || rect === undefined) {
    return;
  }

  canvas.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      clientX: rect.left + rect.width * position[0],
      clientY: rect.top + rect.height * position[1],
      pointerId: 1,
      pointerType: "mouse",
    }),
  );
}

function dispatchSelectKey(type: "keydown" | "keyup"): void {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      bubbles: true,
      code: SELECT_KEY,
      key: SELECT_KEY,
    }),
  );
}

function readEntitySummaries(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    const summary = readRecord(entry);

    return {
      entity: summary?.entity ?? null,
      key: summary?.key ?? null,
      name: summary?.name ?? null,
      tags: summary?.tags ?? [],
      componentIds: summary?.componentIds ?? [],
      source: summary?.source ?? null,
    };
  });
}

function readEntitySnapshot(value: unknown): JsonRecord {
  const snapshot = readRecord(value);

  return {
    label: snapshot?.label ?? null,
    total: snapshot?.total ?? 0,
    truncated: snapshot?.truncated ?? false,
    summaries: readEntitySummaries(snapshot?.summaries),
    diagnostics: Array.isArray(snapshot?.diagnostics)
      ? snapshot.diagnostics
      : [],
  };
}

function readRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null
    ? (value as JsonRecord)
    : null;
}

renderStatus();
