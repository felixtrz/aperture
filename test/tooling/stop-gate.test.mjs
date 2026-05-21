import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { countReadyTasks, evaluateStopGate } from "../../scripts/stop-gate.mjs";

const tempRoots = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

describe("stop gate", () => {
  it("blocks before minute 50 when ready tasks remain", () => {
    const backlogPath = createBacklog(`
# Backlog

## Ready Tasks — Pipeline Maturity Roadmap

### task-3021 — Timestamp writes around render passes

### task-3022 — Timing readback

## Later

### task-9999 — Not ready
`);

    expect(
      evaluateStopGate({
        backlogPath,
        now: "2026-05-21T03:49:59Z",
      }),
    ).toEqual({
      status: "blocked",
      currentMinute: 49,
      stopMinute: 50,
      readyTaskCount: 2,
    });
  });

  it("allows stopping at minute 50 regardless of stale start timestamps", () => {
    const backlogPath = createBacklog(`
# Backlog

## Ready Tasks — Pipeline Maturity Roadmap

### task-3021 — Timestamp writes around render passes
`);

    expect(
      evaluateStopGate({
        backlogPath,
        now: "2026-05-21T03:50:00Z",
      }),
    ).toEqual({
      status: "ok",
      currentMinute: 50,
      stopMinute: 50,
      readyTaskCount: 1,
    });
  });

  it("allows stopping before minute 50 when no ready tasks remain", () => {
    const backlogPath = createBacklog(`
# Backlog

## Ready Tasks — Pipeline Maturity Roadmap

## Later

### task-9999 — Not ready
`);

    expect(
      evaluateStopGate({
        backlogPath,
        now: "2026-05-21T03:12:00Z",
      }),
    ).toMatchObject({
      status: "ok",
      currentMinute: 12,
      readyTaskCount: 0,
    });
  });

  it("counts only the current ready section", () => {
    const backlogPath = createBacklog(`
# Backlog

## Ready Tasks — Pipeline Maturity Roadmap

### task-3021 — Timestamp writes around render passes

## Ready Tasks — MVP Tracks

### task-0001 — Old work
`);

    expect(countReadyTasks(backlogPath)).toBe(1);
  });
});

function createBacklog(contents) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aperture-stop-gate-"));
  const backlogPath = path.join(root, "BACKLOG.md");

  tempRoots.push(root);
  fs.writeFileSync(backlogPath, contents.trimStart());

  return backlogPath;
}
