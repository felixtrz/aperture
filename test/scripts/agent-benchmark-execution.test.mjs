import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  EXECUTION_VALIDATED,
  hasCompleteOfficialExecution,
  verifyOfficialExecution,
} from "../../tools/agent-benchmark/execution-evidence.mjs";
import { parseSummaryOptions } from "../../tools/agent-benchmark/summarize.mjs";
import {
  completedExecutionFixture,
  load,
  put,
} from "../helpers/official-execution-fixture.mjs";
import { sha256 } from "../../tools/agent-benchmark/recorder.mjs";
import { scoreRoundFiles } from "../../tools/agent-benchmark/score-round.mjs";

const roots = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
const h = (name) => sha256(Buffer.from(name));
async function fixture(capacity = false) {
  const root = await mkdtemp(resolve(tmpdir(), "official-execution-"));
  roots.push(root);
  const summary = {
    roundRoot: resolve(root, "round-001"),
    methodSha256: h("method"),
    dispatchFreezeSha256: h("freeze"),
    engines: {},
  };
  for (const engine of ["three", "aperture"])
    summary.engines[engine] = {
      author: {
        status: "validated-source-and-time",
        finishSha256: h(engine + "finish"),
      },
      trials: [1, 2, 3].map((trial) => ({
        engine,
        trial,
        status: "validated",
        path: resolve(summary.roundRoot, "trials", engine, "trial-0" + trial),
        hashes: {},
        appInputs: { "/index.html": { bytes: 7, sha256: h(engine + "app") } },
      })),
    };
  return completedExecutionFixture(root, summary, { capacity });
}
async function updateOperation(item) {
  await put(resolve(item.root, "operation.json"), item.value);
}
const exactParse = (raw) =>
  JSON.parse(raw, (_key, value, context) =>
    typeof value === "number" &&
    !Number.isSafeInteger(value) &&
    /^\d+$/.test(context?.source ?? "")
      ? BigInt(context.source)
      : value,
  );
async function retireCache(data, extra = {}) {
  const item = data.operations[0],
    join = item.value.lifecycle.capacityLifecycleJoin;
  const originalRaw = await readFile(item.value.lifecycle.manifest.path);
  const before = exactParse(originalRaw.toString("utf8"));
  const policy = await load(data.plan.capacityPolicy.path);
  const applyRoot = resolve(
    policy.stateDirectory,
    "slot-slot-1",
    "pressure-apply",
  );
  const retirement = {
    evidence_directory: applyRoot,
    name: "chromium",
    original_manifest_sha256: item.value.lifecycle.manifest.sha256,
    plan_sha256: h("retirement-plan"),
    retired_registration: before.files.chromium,
    retired_ns: 1,
  };
  delete before.files.chromium;
  before.cache_retirements = [retirement];
  Object.assign(before, extra);
  const beforePin = await put(resolve(applyRoot, "before.json"), originalRaw);
  const afterPin = await put(resolve(applyRoot, "after.json"), before);
  const outcome = await put(resolve(applyRoot, "outcome.json"), {
    status: "completed-target-reached",
    planSha256: retirement.plan_sha256,
    results: [
      {
        run: item.value.lifecycle.run,
        originalManifestSha256: beforePin.sha256,
        afterManifestSha256: afterPin.sha256,
        beforeManifest: "before.json",
        afterManifest: { ...afterPin, path: "after.json" },
      },
    ],
  });
  const maintenance = await put(resolve(applyRoot, "../maintenance.json"), {
    policySha256: data.plan.capacityPolicy.sha256,
    outcome,
  });
  join.currentManifestSha256 = afterPin.sha256;
  join.cacheRetirementBridge = {
    policyMaintenance: maintenance,
    outcome,
    originalManifestSha256: beforePin.sha256,
    afterManifestSha256: afterPin.sha256,
    retirement,
  };
  await updateOperation(item);
}

describe("original official execution supervision", () => {
  it("joins six genuine completions to the exact retained plan, author/app inputs and run IDs", async () => {
    const data = await fixture();
    const proof = await verifyOfficialExecution(data.verifyOptions);
    expect(proof.status).toBe(EXECUTION_VALIDATED);
    expect(proof.validationErrors).toEqual([]);
    expect(proof.operations).toHaveLength(6);
    expect(
      hasCompleteOfficialExecution({
        ...data.summary,
        executionEvidence: proof,
      }),
    ).toBe(true);
    expect(proof.operations[5].appRecords.inputs.sha256).toBe(
      data.summary.engines.aperture.trials[2].hashes.inputs,
    );
  });
  it("rejects the missing sixth operation even when its application artifacts survived and an interruption was resolved", async () => {
    const data = await fixture();
    await rm(resolve(data.operations[5].root, "operation.json"));
    await put(resolve(data.operations[5].root, "resolved-interruption.json"), {
      status: "resolved",
      applicationPassed: true,
    });
    const proof = await verifyOfficialExecution(data.verifyOptions);
    expect(proof.operations).toHaveLength(5);
    expect(proof.validationErrors[0]).toMatchObject({
      engine: "aperture",
      trial: 3,
    });
    expect(proof.status).not.toBe(EXECUTION_VALIDATED);
  });
  it.each([
    [
      "start-only audit",
      async (item) => {
        const raw = await readFile(item.value.lifecycle.audit.path, "utf8");
        item.value.lifecycle.audit = await put(
          item.value.lifecycle.audit.path,
          Buffer.from(raw.split("\n")[0] + "\n"),
        );
      },
      "completion audit",
    ],
    [
      "active manifest",
      async (item) => {
        const raw = await readFile(item.value.lifecycle.manifest.path, "utf8");
        item.value.lifecycle.manifest = await put(
          item.value.lifecycle.manifest.path,
          Buffer.from(raw.replace('"state":"completed"', '"state":"active"')),
        );
      },
      "completed lifecycle manifest",
    ],
    [
      "wrong app run",
      async (item) => {
        item.value.lifecycle.run = "run-" + "a".repeat(32);
      },
      "audit run/job",
    ],
    [
      "nonzero wrapper",
      async (item) => {
        item.value.wrapperExitCode = 137;
      },
      "did not complete",
    ],
    [
      "one-nanosecond reversed completion",
      async (item) => {
        const raw = await readFile(item.value.lifecycle.audit.path, "utf8");
        item.value.lifecycle.audit = await put(
          item.value.lifecycle.audit.path,
          Buffer.from(
            raw.replace("1791855961897657315", "1791855961897657313"),
          ),
        );
      },
      "completed lifecycle manifest",
    ],
    [
      "overlapping operations",
      async (item) => {
        item.value.startedAt = "2026-01-01T00:00:02.000Z";
      },
      "overlap",
    ],
  ])(
    "refuses %s without lifecycle promotion",
    async (_label, mutate, message) => {
      const data = await fixture(),
        item = data.operations[1];
      await mutate(item);
      await updateOperation(item);
      const proof = await verifyOfficialExecution(data.verifyOptions);
      expect(proof.status).not.toBe(EXECUTION_VALIDATED);
      expect(
        proof.validationErrors.map((row) => row.error).join(" "),
      ).toContain(message);
    },
  );
  it("rejects tampered retained driver/log bytes and symlink substitution", async () => {
    const data = await fixture();
    await put(data.start.retainedDriver.path, Buffer.from("different driver"));
    expect(
      (await verifyOfficialExecution(data.verifyOptions)).validationErrors[0]
        .error,
    ).toContain("byte hash differs");
    await put(
      data.start.retainedDriver.path,
      await readFile(data.plan.driver.path),
    );
    const item = data.operations[0];
    await rm(item.value.stdout.path);
    await symlink(item.value.stderr.path, item.value.stdout.path);
    expect(
      (await verifyOfficialExecution(data.verifyOptions)).validationErrors[0]
        .error,
    ).toContain("regular file");
  });
  it("rejects an app run mismatch even after the changed input bytes are honestly re-pinned", async () => {
    const data = await fixture(),
      item = data.operations[0];
    const inputs = await load(
      item.value.retainedAttemptRecords["inputs.json"].path,
    );
    inputs.lifecycle.run = "run-" + "b".repeat(32);
    const pin = await put(
      item.value.retainedAttemptRecords["inputs.json"].path,
      inputs,
    );
    item.value.retainedAttemptRecords["inputs.json"] = pin;
    data.summary.engines.three.trials[0].hashes.inputs = pin.sha256;
    await updateOperation(item);
    expect(
      (await verifyOfficialExecution(data.verifyOptions)).validationErrors[0]
        .error,
    ).toContain("app lifecycle and input identity");
  });
  it("rejects a capacity checkpoint with a failed original wrapper despite successful application records", async () => {
    const data = await fixture(true),
      item = data.operations[0];
    const join = item.value.lifecycle.capacityLifecycleJoin;
    const checkpoint = await load(join.checkpoint.path);
    checkpoint.wrapperExitCode = 137;
    join.checkpoint = await put(join.checkpoint.path, checkpoint);
    await updateOperation(item);
    expect(
      (await verifyOfficialExecution(data.verifyOptions)).validationErrors[0]
        .error,
    ).toContain("checkpoint identity/completion");
  });
  it("accepts original capacity checkpoints plus exact cache-only retirement, never changes to completion", async () => {
    const data = await fixture(true);
    expect((await verifyOfficialExecution(data.verifyOptions)).status).toBe(
      EXECUTION_VALIDATED,
    );
    await retireCache(data);
    const proof = await verifyOfficialExecution(data.verifyOptions);
    expect(proof.status).toBe(EXECUTION_VALIDATED);
    expect(
      proof.operations[0].capacity.cacheRetirementBridge.after.sha256,
    ).toBe(
      data.operations[0].value.lifecycle.capacityLifecycleJoin
        .currentManifestSha256,
    );
    await retireCache(data, { exitcode: 137 });
    expect(
      (await verifyOfficialExecution(data.verifyOptions)).validationErrors[0]
        .error,
    ).toContain("more than chromium");
  });
  it("requires exact paired execution flags and rejects relative paths/hash mistakes", () => {
    const base = ["--round", "/round-001", "--output", "/new.json"];
    expect(() =>
      parseSummaryOptions([
        ...base,
        "--official-execution",
        "/execution-start.json",
      ]),
    ).toThrow(/paired/);
    expect(() =>
      parseSummaryOptions([...base, "--official-execution-sha256", "bad"]),
    ).toThrow(/SHA256/);
    expect(() =>
      parseSummaryOptions([
        ...base,
        "--official-execution",
        "relative.json",
        "--official-execution-sha256",
        h("start"),
      ]),
    ).toThrow(/absolute/);
    expect(
      parseSummaryOptions([
        ...base,
        "--official-execution",
        "/execution-start.json",
        "--official-execution-sha256",
        h("start"),
      ]).officialExecutionSha256,
    ).toBe(h("start"));
  });
  it("file scoring rechecks supervision instead of trusting a passing summary field", async () => {
    const data = await fixture();
    data.summary.executionEvidence = await verifyOfficialExecution(
      data.verifyOptions,
    );
    await rm(resolve(data.operations[5].root, "operation.json"));
    const manifest = await put(resolve(data.root, "score-inputs.json"), {
      schema: "aperture.house-race-score-inputs.v1",
      roundId: "round-001",
      roundOrdinal: 1,
      pins: {
        summary: await put(resolve(data.root, "summary.json"), data.summary),
        method: await put(resolve(data.root, "method.json"), {}),
        reference: await put(
          resolve(data.root, "reference.png"),
          Buffer.from("fixture"),
        ),
        dispatchFreeze: await put(resolve(data.root, "freeze.json"), {}),
        caseMap: await put(resolve(data.root, "map.json"), {}),
        sourceAudit: await put(resolve(data.root, "audit.json"), {}),
        judges: [],
      },
    });
    const report = await scoreRoundFiles(manifest.path, manifest.sha256);
    expect(report.status).toBe("scores-withheld");
    expect(report.engines.aperture.scores).toBeNull();
    expect(report.eligibilityReasons.join(" ")).toContain(
      "Official execution byte graph",
    );
  });
});
