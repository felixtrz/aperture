import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  finalizeAgentStatus,
  parseFinalizeArgs,
} from "../../scripts/finalize-agent-status.mjs";

const tempRoots = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

describe("agent status finalizer", () => {
  it("clears active run fields and preserves the run start timestamp", () => {
    const statusPath = createStatusFile({
      state: "running",
      currentTaskId: "task-1234",
      currentRunStartedAt: "2026-05-20T18:04:05Z",
      lastRunStartedAt: "2026-05-20T17:00:00Z",
      lastResult: "in_progress",
      lastCommit: null,
      activePid: 12345,
      notes: "Working on task-1234.",
      lastRunFinishedAt: null,
    });

    const finalizedStatus = finalizeAgentStatus({
      statusPath,
      result: "success",
      notes: "Completed task-1234.",
      commit: "abc1234",
      now: new Date("2026-05-20T19:10:11.234Z"),
    });

    expect(finalizedStatus).toMatchObject({
      state: "idle",
      currentTaskId: null,
      currentRunStartedAt: null,
      lastRunStartedAt: "2026-05-20T18:04:05Z",
      lastRunFinishedAt: "2026-05-20T19:10:11Z",
      lastResult: "success",
      lastCommit: "abc1234",
      activePid: null,
      notes: "Completed task-1234.",
    });
    expect(JSON.parse(fs.readFileSync(statusPath, "utf8"))).toEqual(
      finalizedStatus,
    );
  });

  it("allows blocked finalization when no current run is active", () => {
    const statusPath = createStatusFile({
      state: "idle",
      currentTaskId: null,
      currentRunStartedAt: null,
      lastRunStartedAt: "2026-05-20T18:04:05Z",
      lastRunFinishedAt: "2026-05-20T18:57:00Z",
      lastResult: "success",
      activePid: null,
      notes: "Already finalized.",
    });

    const finalizedStatus = finalizeAgentStatus({
      statusPath,
      result: "blocked",
      now: "2026-05-20T19:12:13Z",
    });

    expect(finalizedStatus.lastRunStartedAt).toBe("2026-05-20T18:04:05Z");
    expect(finalizedStatus.lastResult).toBe("blocked");
    expect(finalizedStatus.notes).toBe("Already finalized.");
  });

  it("rejects success finalization when the start hook was missed", () => {
    const statusPath = createStatusFile({
      state: "idle",
      currentTaskId: null,
      currentRunStartedAt: null,
      lastRunStartedAt: "2026-05-20T18:04:05Z",
      lastRunFinishedAt: "2026-05-20T18:57:00Z",
      lastResult: "success",
      activePid: null,
      notes: "Previous run.",
    });

    expect(() =>
      finalizeAgentStatus({
        statusPath,
        result: "success",
        notes: "This should not pass.",
        now: "2026-05-21T02:35:00Z",
      }),
    ).toThrow(
      'Cannot finalize result "success" without a valid currentRunStartedAt',
    );
  });

  it("rejects non-final result values", () => {
    const statusPath = createStatusFile({
      state: "running",
      currentRunStartedAt: "2026-05-20T18:04:05Z",
    });

    expect(() =>
      finalizeAgentStatus({ statusPath, result: "in_progress" }),
    ).toThrow('Invalid final result "in_progress"');
  });

  it("parses CLI options with inline and positional values", () => {
    expect(
      parseFinalizeArgs([
        "--",
        "--result=success",
        "--notes=Completed task=a.",
        "--status-file=tmp/status.json",
        "--commit",
        "abc1234",
      ]),
    ).toEqual({
      result: "success",
      notes: "Completed task=a.",
      statusPath: "tmp/status.json",
      commit: "abc1234",
    });
  });
});

function createStatusFile(status) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aperture-status-"));
  const statusPath = path.join(root, "STATUS.json");

  tempRoots.push(root);
  fs.writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);

  return statusPath;
}
