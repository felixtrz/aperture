// Synthetic unit fixtures only. They are never retained as real browser evidence.
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  CONTRACT,
  summarize,
  validateWorkerEligibility,
} from "../../tools/agent-benchmark/contract.mjs";
import { componentScores } from "../../tools/agent-benchmark/summarize.mjs";
import { sha256 } from "../../tools/agent-benchmark/recorder.mjs";
import {
  evaluateRound,
  sourceAuditTemplate,
} from "../../tools/agent-benchmark/score-round.mjs";

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

function installProof(input, unknown = false) {
  const summary = input.records.summary.value;
  summary.artifactProtocol = "aperture.agent-house-artifacts.v2";
  for (const engine of ["aperture", "three"])
    for (const trial of summary.engines[engine].trials) {
      trial.artifactProtocol = summary.artifactProtocol;
      const indirect = engine === "aperture";
      trial.nativeIndirectArgumentProof = {
        schema: "aperture.native-indirect-arguments.v2.1",
        capacityExceeded: false,
        maxWitnesses: 16384,
        witnesses: indirect
          ? [
              {
                sequence: 0,
                method: "drawIndexedIndirect",
                topology: "triangle-list",
                bufferId: 0,
                byteOffset: 0,
                argumentBytesHex: "0300000001000000000000000000000000000000",
                count: 3,
                instances: 1,
                first: 0,
                baseVertex: 0,
                firstInstance: 0,
                triangles: 1,
                provenance:
                  "complete-owned-cpu-span-with-no-modeled-gpu-mutation",
              },
            ]
          : [],
      };
      for (const sample of [...trial.warmupSamples, ...trial.samples])
        Object.assign(sample, {
          unknownDirectTriangleDrawCalls: 0,
          indirectDrawCalls: Number(indirect),
          knownIndirectDrawCalls: Number(indirect && !unknown),
          unknownIndirectDrawCalls: Number(indirect && unknown),
          knownIndirectTriangles: Number(indirect && !unknown),
          unknownIndirectReasons:
            indirect && unknown ? { "storage-buffer-gpu-writable": 1 } : {},
          nativeIndirectArgumentReferences:
            indirect && !unknown ? [[0, 1]] : [],
          unretainedKnownIndirectDrawCalls: 0,
          submittedTriangleAccounting: {
            schema: "aperture.native-triangle-accounting.v2.1",
            confidence:
              indirect && unknown
                ? "lower-bound"
                : "exact-supported-command-arguments",
            proofStatus: "complete",
          },
        });
    }
  return input;
}
describe("scorer native indirect proof adapter", () => {
  it("accepts complete independently decoded known arguments with original weights", async () => {
    const report = evaluateRound(installProof(await fixture()));
    expect(report.status).toBe("eligible-scored");
    expect(report.weights).toEqual({
      visual: 0.4,
      geometry: 0.2,
      runtime: 0.25,
      authoringTime: 0.15,
    });
  });
  it("refuses unresolved indirect contributions despite flattering source/quality review", async () => {
    const report = evaluateRound(installProof(await fixture(), true));
    expect(report.status).not.toBe("eligible-scored");
    expect(report.engines.aperture.scores).toBeNull();
  });
  it("refuses altered raw arguments or omitted frame proof without substituting scores", async () => {
    for (const mutate of [
      (trial) =>
        (trial.nativeIndirectArgumentProof.witnesses[0].argumentBytesHex =
          "0".repeat(40)),
      (trial) => (trial.samples[0].nativeIndirectArgumentReferences = []),
    ]) {
      const input = installProof(await fixture());
      mutate(input.records.summary.value.engines.aperture.trials[0]);
      const report = evaluateRound(input);
      expect(report.status).not.toBe("eligible-scored");
      expect(report.engines.aperture.scores).toBeNull();
    }
  });
});
