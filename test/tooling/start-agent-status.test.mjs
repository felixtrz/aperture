import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  parseStartArgs,
  startAgentStatus,
} from "../../scripts/start-agent-status.mjs";

const tempRoots = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

describe("agent status start hook", () => {
  it("initializes a run start timestamp from idle state", () => {
    const statusPath = createStatusFile({
      state: "idle",
      currentTaskId: null,
      currentRunStartedAt: null,
      lastRunStartedAt: "2026-05-20T18:04:05Z",
      lastRunFinishedAt: "2026-05-20T18:57:00Z",
      lastResult: "success",
      lastCommit: "abc1234",
      activePid: null,
      notes: "Previous run.",
    });

    const startedStatus = startAgentStatus({
      statusPath,
      taskId: "task-3017",
      notes: "Starting task-3017.",
      pid: 12345,
      now: new Date("2026-05-21T02:30:31.456Z"),
      isPidAlive: () => false,
    });

    expect(startedStatus).toMatchObject({
      state: "running",
      currentTaskId: "task-3017",
      currentRunStartedAt: "2026-05-21T02:30:31Z",
      lastRunStartedAt: "2026-05-21T02:30:31Z",
      lastRunFinishedAt: null,
      lastResult: "in_progress",
      lastCommit: "abc1234",
      activePid: 12345,
      notes: "Starting task-3017.",
    });
    expect(JSON.parse(fs.readFileSync(statusPath, "utf8"))).toEqual(
      startedStatus,
    );
  });

  it("refuses to replace a running status with a live active PID", () => {
    const statusPath = createStatusFile({
      state: "running",
      currentTaskId: "task-3017",
      currentRunStartedAt: "2026-05-21T02:30:31Z",
      lastRunStartedAt: "2026-05-21T02:30:31Z",
      lastResult: "in_progress",
      activePid: 12345,
    });

    expect(() =>
      startAgentStatus({
        statusPath,
        now: "2026-05-21T02:35:00Z",
        isPidAlive: (pid) => pid === 12345,
      }),
    ).toThrow("already records a running agent with live PID 12345");
  });

  it("treats a numeric string active PID as live", () => {
    const statusPath = createStatusFile({
      state: "running",
      currentTaskId: "task-3017",
      currentRunStartedAt: "2026-05-21T02:30:31Z",
      lastRunStartedAt: "2026-05-21T02:30:31Z",
      lastResult: "in_progress",
      activePid: "12345",
    });

    expect(() =>
      startAgentStatus({
        statusPath,
        now: "2026-05-21T02:35:00Z",
        isPidAlive: (pid) => pid === 12345,
      }),
    ).toThrow("already records a running agent with live PID 12345");
  });

  it("refuses to replace a recent running status even when no PID is live", () => {
    const statusPath = createStatusFile({
      state: "running",
      currentTaskId: "task-3017",
      currentRunStartedAt: "2026-05-21T02:30:31Z",
      lastRunStartedAt: "2026-05-21T02:30:31Z",
      lastResult: "in_progress",
      activePid: null,
    });

    expect(() =>
      startAgentStatus({
        statusPath,
        now: "2026-05-21T02:45:00Z",
        isPidAlive: () => false,
      }),
    ).toThrow(
      "already records a running agent started at 2026-05-21T02:30:31Z",
    );
  });

  it("replaces stale running status when the active PID is not live", () => {
    const statusPath = createStatusFile({
      state: "running",
      currentTaskId: "task-old",
      currentRunStartedAt: "2026-05-20T18:04:05Z",
      lastRunStartedAt: "2026-05-20T18:04:05Z",
      lastResult: "in_progress",
      activePid: 99999,
    });

    const startedStatus = startAgentStatus({
      statusPath,
      taskId: "task-new",
      now: "2026-05-21T02:35:00Z",
      isPidAlive: () => false,
    });

    expect(startedStatus).toMatchObject({
      state: "running",
      currentTaskId: "task-new",
      currentRunStartedAt: "2026-05-21T02:35:00Z",
      lastRunStartedAt: "2026-05-21T02:35:00Z",
      lastResult: "in_progress",
      activePid: null,
    });
  });

  it("parses CLI options with inline and positional values", () => {
    expect(
      parseStartArgs([
        "--",
        "--status-file=tmp/status.json",
        "--task-id",
        "task-3017",
        "--notes=Starting.",
        "--pid",
        "12345",
        "--now=2026-05-21T02:35:00Z",
        "--stale-running-minutes",
        "30",
        "--quiet",
      ]),
    ).toEqual({
      statusPath: "tmp/status.json",
      taskId: "task-3017",
      notes: "Starting.",
      pid: 12345,
      now: "2026-05-21T02:35:00Z",
      staleRunningMinutes: 30,
      quiet: true,
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
