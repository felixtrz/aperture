// Synthetic unit fixtures only. They are never retained as real browser evidence.
import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  CONTRACT,
  summarize,
  validateWorkerEligibility,
} from "../../tools/agent-benchmark/contract.mjs";
import { componentScores } from "../../tools/agent-benchmark/summarize.mjs";
import { syntheticExecutionProof } from "../helpers/official-execution-fixture.mjs";
import { sha256 } from "../../tools/agent-benchmark/recorder.mjs";
import {
  AUDIT_SCHEMA,
  apertureChecks,
  evaluateRound,
  readPinnedFile,
  requiredFeatures,
  sourceAuditTemplate,
  sourceChecks,
} from "../../tools/agent-benchmark/score-round.mjs";
import { inspectJudgeRecords } from "../../tools/agent-benchmark/score-quality.mjs";
import { evaluateStableLead } from "../../tools/agent-benchmark/score-stability.mjs";

const h = (value) => sha256(Buffer.from(value));
const pin = (key) => ({
  path: "/unit-fixture/" + key,
  bytes: 10,
  sha256: h(key),
});
const record = (key, value) => ({
  pin: pin(key),
  actualSha256: h(key),
  actualBytes: 10,
  hashParity: true,
  error: null,
  value,
});
const clone = (value) => structuredClone(value);
function judge(id) {
  return {
    judgeId: id,
    cases: ["case-A", "case-B"].map((caseId) => ({
      case: caseId,
      visualDimensions: {
        house: 1.5,
        car: 1.5,
        composition: 1.5,
        materialsLighting: 1.5,
        alternateViews: 1.5,
      },
      visualScore: 7.5,
      geometryDimensions: {
        proportions: 3,
        volume: 2,
        normalsTopology: 1.5,
        efficiency: 0.75,
      },
      geometryScore: 7.25,
      missingRequiredFeatures: [],
      visibleProblems: [],
      strengths: [],
      uncertainties: [],
    })),
  };
}

async function fixture() {
  const method = JSON.parse(
    await readFile(
      new URL(
        "../../benchmarks/agent-house-race-20261011/method.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  method.referenceSha256 = h("reference");
  const summary = {
    schema: "aperture.agent-house-summary.v1",
    status: "validated-components-pending-independent-judging",
    roundRoot: "/unit-fixture/round-002",
    method,
    methodSha256: h("method"),
    dispatchFreezeSha256: h("freeze"),
    validationErrors: [],
    engines: {},
    scores: null,
  };
  for (const engine of ["three", "aperture"]) {
    const before = {
        workerEvidence: [
          {
            id: 0,
            connected: true,
            started: true,
            terminated: false,
            snapshotMessages: 2,
            snapshotPayloadObserved: true,
            lastSnapshotFrame: 59,
            errors: 0,
            sharedFrame: null,
          },
        ],
        workersCreated: 1,
        workerTerminationCalls: 0,
      },
      after = clone(before);
    after.workerEvidence[0].lastSnapshotFrame = 179;
    const duration = engine === "aperture" ? 3 : 6;
    const sample = (frame) => ({
      frame,
      cpuSubmissionMs: duration / 3,
      applicationPromiseMs: duration / 3,
      queueCompletionLatencyMs: (duration * 2) / 3,
      endToEndMs: duration,
      submissions: 1,
      drawCalls: 1,
      submittedTriangles: 12,
      unknownCommandBuffers: 0,
      unknownTopologyDrawCalls: 0,
      indirectDrawCalls: 0,
    });
    const sourceFiles = [
      { path: "src/scene.js", bytes: 10, sha256: h(engine + "source") },
      { path: "index.html", bytes: 10, sha256: h(engine + "html") },
    ];
    const author = {
      status: "validated-source-and-time",
      lane: engine + "-r002",
      authorActiveSeconds: engine === "aperture" ? 300 : 400,
      authorRawSeconds: 450,
      authorPreviewWaitingSeconds: engine === "aperture" ? 150 : 50,
      finishSha256: h(engine + "finish"),
      auditSha256: h(engine + "audit"),
      auditRoot: "/unit-fixture/audit/" + engine,
      audit: { sourceFiles },
      semanticSourceAudit:
        "pending-independent-architecture-and-geometry-review",
    };
    const trials = [1, 2, 3].map((trial) => {
      const samples = Array.from({ length: 120 }, (_value, index) =>
        sample(index + 60),
      );
      return {
        status: "validated",
        engine,
        trial,
        path: summary.roundRoot + "/trials/" + engine + "/trial-0" + trial,
        hashes: Object.fromEntries(
          [
            "outcome",
            "inputs",
            "receipts",
            "measurement",
            "renderer",
            "geometry",
          ].map((key) => [key, h(engine + trial + key)]),
        ),
        samples,
        warmupSamples: Array.from({ length: 60 }, (_value, index) =>
          sample(index),
        ),
        timing: Object.fromEntries(
          [
            "cpuSubmissionMs",
            "applicationPromiseMs",
            "queueCompletionLatencyMs",
            "endToEndMs",
          ].map((key) => [key, summarize(samples.map((row) => row[key]))]),
        ),
        resources: { before, after },
        workerEligibility: validateWorkerEligibility(engine, before, after),
        captures: CONTRACT.views.map((camera) => ({
          camera,
          screenshot: {
            path: camera.id + ".png",
            bytes: 10,
            sha256: h(engine + camera.id),
          },
        })),
        appInputs: { "/app.js": { bytes: 10, sha256: h(engine + "app") } },
        harnessInputs: { "client.mjs": { bytes: 10, sha256: h("control") } },
        geometry: {
          semanticGeometrySha256: h(engine + "semantic-world-geometry"),
          nativePositionMatchedMeshes: 1,
          meshCount: 1,
          confidence: "position-only; independent source review required",
        },
      };
    });
    summary.engines[engine] = { author, trials };
  }
  summary.scores = componentScores(summary.engines, method);
  summary.executionEvidence = syntheticExecutionProof(summary);
  const manifest = { roundId: "round-002", roundOrdinal: 2 };
  const map = {
    schema: "aperture.house-race-case-map.v1",
    roundId: manifest.roundId,
    summarySha256: h("summary"),
    methodSha256: h("method"),
    referenceSha256: h("reference"),
    dispatchFreezeSha256: h("freeze"),
    cases: ["aperture", "three"].map((engine, index) => ({
      case: index === 0 ? "case-A" : "case-B",
      engine,
      captureTrial: 1,
      views: summary.engines[engine].trials[0].captures.map((capture) => ({
        id: capture.camera.id,
        pin: {
          path: "/unit-fixture/blind/" + engine + "/" + capture.screenshot.path,
          bytes: 10,
          sha256: capture.screenshot.sha256,
        },
      })),
    })),
  };
  const records = {
    summary: record("summary", summary),
    method: record("method", method),
    reference: record("reference", null),
    dispatchFreeze: record("freeze", {
      files: {
        "race/method.json": pin("method"),
        "race/reference.png": pin("reference"),
      },
    }),
    caseMap: record("map", map),
    judges: [
      record("judge-a", judge("judge-two-a")),
      record("judge-b", judge("judge-two-b")),
    ],
  };
  const audit = sourceAuditTemplate(manifest, records);
  audit.status = "reviewed";
  audit.reviewer = {
    id: "independent-source-reviewer",
    independentOfAuthors: true,
    reviewedAt: "2026-10-12T00:00:00Z",
    reasons: ["Synthetic unit fixture only"],
  };
  audit.protocol.status = "valid";
  audit.protocol.reasons = ["Synthetic fresh protocol review"];
  audit.protocol.authorIds = {
    three: "author-two-three",
    aperture: "author-two-aperture",
  };
  for (const key of Object.keys(audit.protocol))
    if (audit.protocol[key] === null) audit.protocol[key] = true;
  for (const engine of ["three", "aperture"]) {
    const entry = audit.engines[engine];
    entry.status = "reviewed";
    entry.reasons = ["Synthetic semantic source review"];
    for (const key of Object.keys(entry.checks)) entry.checks[key] = true;
    for (const key of Object.keys(entry.features))
      entry.features[key] = "present";
    entry.reviewedSourceFiles.forEach((file) => (file.reviewed = true));
    entry.reviewedDependencyFiles = [
      { ...pin(engine + "dependency"), reviewed: true },
    ];
  }
  for (const entry of audit.judgeInputs) {
    for (const key of Object.keys(entry))
      if (entry[key] === null) entry[key] = true;
    entry.reasons = ["Synthetic blinded-input receipt"];
  }
  audit.runtimeInterpretation = {
    status: "reviewed",
    summarySha256: h("summary"),
    reviewerId: "independent-source-reviewer",
    independentOfAuthors: true,
    reasons: ["Synthetic spread review; no timing significance claim"],
  };
  records.sourceAudit = record("audit", audit);
  return { manifest, records, scorerSha256: h("scorer") };
}

describe("frozen round scoring eligibility", () => {
  it("withholds every formal score for missing or interrupted supervision despite valid app metrics and judges", async () => {
    for (const mutate of [
      (summary) => delete summary.executionEvidence,
      (summary) => summary.executionEvidence.operations.pop(),
      (summary) =>
        (summary.executionEvidence.operations[0].appRecords.inputs.sha256 =
          h("different-run")),
      (summary) => (summary.executionEvidence.status = "resolved-interruption"),
    ]) {
      const input = await fixture();
      mutate(input.records.summary.value);
      const report = evaluateRound(input);
      expect(report.status).toBe("scores-withheld");
      expect(report.engines.three.scores).toBeNull();
      expect(report.engines.aperture.scores).toBeNull();
      expect(
        report.raw.summary.engines.aperture.trials[2].samples,
      ).toHaveLength(120);
      expect(report.eligibilityReasons.join(" ")).toContain(
        "official wrapper completions",
      );
    }
  });
  it("applies exact component weights only after all evidence/source/quality gates pass", async () => {
    const input = await fixture(),
      report = evaluateRound(input);
    expect(report.status).toBe("eligible-scored");
    expect(report.weights).toEqual({
      visual: 0.4,
      geometry: 0.2,
      runtime: 0.25,
      authoringTime: 0.15,
    });
    expect(report.engines.aperture.scores).toEqual({
      visual: 7.5,
      geometry: 7.25,
      runtime: 10,
      authoringTime: 10,
      combined: 8.45,
    });
    expect(report.engines.three.scores.combined).toBeCloseTo(6.825, 10);
    expect(report.stableLead.stableBenchmarkLead).toBe(false);
    expect(report.raw.summary.engines.aperture.trials).toHaveLength(3);
  });

  it("rejects duplicate judges/cases, wrong sums and out-of-range or nonfinite rubric dimensions", () => {
    const a = judge("a"),
      b = judge("b");
    expect(inspectJudgeRecords([a, b], ["case-A", "case-B"]).valid).toBe(true);
    for (const mutate of [
      (row) => (row.judgeId = "a"),
      (row) => (row.cases[1].case = "case-A"),
      (row) => (row.cases[0].visualScore = 8),
      (row) => (row.cases[0].visualDimensions.house = 2.1),
      (row) => (row.cases[0].geometryDimensions.volume = NaN),
      (row) => (row.cases[0].geometryScore = 11),
    ]) {
      const changed = clone(b);
      mutate(changed);
      expect(
        inspectJudgeRecords([a, changed], ["case-A", "case-B"]).valid,
      ).toBe(false);
    }
  });

  it("keeps all scores null for pending source/ECS proof despite uploaded-position matches", async () => {
    const input = await fixture();
    input.records.sourceAudit.value.engines.aperture.checks.simulationEcsAuthoritative =
      null;
    const report = evaluateRound(input);
    expect(report.status).toBe("scores-withheld");
    expect(report.engines.aperture.scores).toBeNull();
    expect(report.engines.three.scores).toBeNull();
    expect(report.eligibilityReasons.join(" ")).toContain(
      "simulationEcsAuthoritative",
    );
    expect(report.engines.aperture.rawQualityMeans.visual).toBe(7.5);
    const template = sourceAuditTemplate(input.manifest, input.records);
    expect(template.schema).toBe(AUDIT_SCHEMA);
    expect(template.status).toBe("pending");
    expect(
      [...sourceChecks, ...apertureChecks].every(
        (key) => template.engines.aperture.checks[key] === null,
      ),
    ).toBe(true);
    expect(
      requiredFeatures.every(
        (key) => template.engines.aperture.features[key] === "uncertain",
      ),
    ).toBe(true);
  });

  it("withholds scores for failed native floors, missing trials and protocol-invalid evidence", async () => {
    for (const mutate of [
      (input) =>
        (input.records.summary.value.engines.aperture.trials[0].samples[0].unknownCommandBuffers = 1),
      (input) => input.records.summary.value.engines.three.trials.pop(),
      (input) => (input.records.sourceAudit.value.protocol.status = "invalid"),
    ]) {
      const input = await fixture();
      mutate(input);
      const report = evaluateRound(input);
      expect(report.status).toBe("scores-withheld");
      expect(report.engines.aperture.scores).toBeNull();
      expect(report.raw.summary).toBe(input.records.summary.value);
    }
  });

  it("requires both quality floors and all required features without score substitutions", async () => {
    const low = await fixture();
    for (const judge of low.records.judges) {
      const entry = judge.value.cases[0];
      entry.visualDimensions = {
        house: 1,
        car: 1,
        composition: 1,
        materialsLighting: 1,
        alternateViews: 1,
      };
      entry.visualScore = 5;
    }
    expect(evaluateRound(low).engines.aperture.scores).toBeNull();
    const missing = await fixture();
    missing.records.judges[0].value.cases[0].missingRequiredFeatures = [
      "blue car",
    ];
    expect(evaluateRound(missing).eligibilityReasons.join(" ")).toContain(
      "missing required",
    );
  });

  it("refuses changed weights and original-judge input hash mismatch", async () => {
    const input = await fixture();
    input.records.method.value.weights.visual = 0.5;
    expect(evaluateRound(input).status).toBe("scores-withheld");
    const changed = await fixture();
    changed.records.judges[0].hashParity = false;
    expect(evaluateRound(changed).engines.three.scores).toBeNull();
  });

  it("rejects flattering alternate-trial selections and malformed dimension arrays", async () => {
    const input = await fixture();
    input.records.caseMap.value.cases.forEach(
      (entry) => (entry.captureTrial = 2),
    );
    expect(evaluateRound(input).eligibilityReasons.join(" ")).toContain(
      "trial-01",
    );
    const malformed = judge("b");
    malformed.cases[0].visualDimensions = Object.assign([], {
      house: 1.5,
      car: 1.5,
      composition: 1.5,
      materialsLighting: 1.5,
      alternateViews: 1.5,
    });
    expect(
      inspectJudgeRecords([judge("a"), malformed], ["case-A", "case-B"]).valid,
    ).toBe(false);
  });

  it("detects actual file mutation while retaining the untrusted raw parsed numbers", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "aperture-score-pin-"));
    try {
      const path = resolve(root, "judge.json"),
        original = Buffer.from('{"visualScore":7}');
      await writeFile(path, original);
      const receipt = {
        path,
        sha256: sha256(original),
        bytes: original.length,
      };
      expect((await readPinnedFile(receipt)).hashParity).toBe(true);
      await writeFile(path, '{"visualScore":9}');
      const result = await readPinnedFile(receipt);
      expect(result.hashParity).toBe(false);
      expect(result.value.visualScore).toBe(9);
      expect(result.error).toContain("untrusted");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("establishes only a scoped lead after two successive fresh eligible pairs with explicit reviews", async () => {
    const current = evaluateRound(await fixture()),
      previous = clone(current);
    previous.roundId = "round-001";
    previous.roundOrdinal = 1;
    previous.summarySha256 = h("summary-one");
    previous.runtimeInterpretation.summarySha256 = previous.summarySha256;
    previous.freshness = {
      authorIds: { three: "author-one-three", aperture: "author-one-aperture" },
      judgeIds: ["judge-one-a", "judge-one-b"],
    };
    const previousHash = h("previous-score"),
      review = {
        status: "reviewed",
        previousScoreSha256: previousHash,
        reviewerId: "independent-source-reviewer",
        independentOfAuthors: true,
        noMaterialQualityRegression: { three: true, aperture: true },
        reasons: [
          "Reviewed both quality dimensions; no numeric regression threshold invented",
        ],
      };
    const result = evaluateStableLead(current, previous, review, previousHash);
    expect(result.stableBenchmarkLead).toBe(true);
    expect(result.universalSuperiorityClaim).toBe(false);
    const skipped = clone(previous);
    skipped.roundOrdinal = 0;
    expect(
      evaluateStableLead(current, skipped, review, previousHash)
        .stableBenchmarkLead,
    ).toBe(false);
    const repeated = clone(previous);
    repeated.freshness.authorIds.aperture =
      current.freshness.authorIds.aperture;
    expect(
      evaluateStableLead(current, repeated, review, previousHash)
        .stableBenchmarkLead,
    ).toBe(false);
    const narrow = clone(previous);
    narrow.apertureCombinedMargin = 0.249;
    expect(
      evaluateStableLead(current, narrow, review, previousHash)
        .stableBenchmarkLead,
    ).toBe(false);
    expect(
      evaluateStableLead(
        current,
        previous,
        {
          ...review,
          noMaterialQualityRegression: { three: true, aperture: false },
        },
        previousHash,
      ).stableBenchmarkLead,
    ).toBe(false);
    expect(
      evaluateStableLead(
        current,
        previous,
        { ...review, status: "pending" },
        previousHash,
      ).stableBenchmarkLead,
    ).toBe(false);
    const noSpread = clone(previous);
    noSpread.runtimeInterpretation.status = "pending";
    expect(
      evaluateStableLead(current, noSpread, review, previousHash)
        .stableBenchmarkLead,
    ).toBe(false);
  });
});
