// Synthetic unit dispositions only; none of these records are real renderer evidence.
import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { CONTRACT } from "../../tools/agent-benchmark/contract.mjs";
import { sha256 } from "../../tools/agent-benchmark/recorder.mjs";
import { describeRuntimeSpread } from "../../tools/agent-benchmark/score-stability.mjs";
import { componentScores } from "../../tools/agent-benchmark/summarize.mjs";
import {
  FAIRNESS_V2,
  DECLARATION_SCHEMA_V2,
  SOURCE_AUDIT_SCHEMA_V2,
  OBSERVATION_SCHEMA_V2,
  FAIRNESS_SOURCE_CHECKS_V2,
} from "../../tools/agent-benchmark/fairness-v2.mjs";
import {
  FAIR_SCORE_SCHEMA_V2,
  FAIR_SCORE_INPUT_SCHEMA_V2,
  evaluateFairScoreV2,
  evaluateMeaningfulEdgeV2,
  scoreFairRoundFilesV2,
  buildFairnessObservationV2,
} from "../../tools/agent-benchmark/fair-score-v2.mjs";

const clone = (value) => structuredClone(value);
const stable = (value) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
const hash = (value) =>
  sha256(Buffer.from(typeof value === "string" ? value : stable(value)));
function pinned(value, path) {
  const bytes = Buffer.from(JSON.stringify(value));
  return {
    pin: { path, bytes: bytes.length, sha256: sha256(bytes) },
    actualBytes: bytes.length,
    actualSha256: sha256(bytes),
    hashParity: true,
    error: null,
    value,
  };
}
function resources() {
  return {
    geometries: [
      {
        id: "actual-box",
        vertexCount: 24,
        placements: 1,
        attributes: [
          { semantic: "POSITION", components: 3, componentBytes: 4 },
          { semantic: "NORMAL", components: 3, componentBytes: 4 },
        ],
        indices: { count: 36, componentBytes: 2 },
        instanceAttributes: [],
      },
    ],
    textures: [],
    materials: [
      {
        id: "plain",
        model: "metallic-roughness",
        alphaMode: "opaque",
        extensions: [],
        emissiveIntensity: 0,
        maps: {},
      },
    ],
    lights: [
      { id: "sun", kind: "directional" },
      { id: "fill", kind: "ambient" },
    ],
  };
}
async function fixture(ordinal = 1, previousHash = null) {
  const method = JSON.parse(
    await readFile(
      new URL(
        "../../benchmarks/agent-house-race-v2-20261013/method.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const fairness = pinned(
    clone(FAIRNESS_V2),
    "/synthetic/fairness-contract.json",
  );
  method.fairnessContract = {
    path: "fairness-contract.json",
    bytes: fairness.actualBytes,
    sha256: fairness.actualSha256,
  };
  delete method.referenceSha256;
  method.referencePolicy = {
    kind: "fresh-low-poly-per-round",
    taskFamily: "low-poly-house-road-car",
    uniqueImagePerRound: true,
    sharedWithinRound: true,
    selection: "before-author-dispatch-and-results",
    style:
      "simple matte low-poly forms feasible with ordinary Three.js primitives, indexed mesh geometry, opaque standard materials and declared common lights/effects",
    generation:
      "new image_gen reference for each round; original returned PNG retained with provenance",
  };
  const methodRecord = pinned(method, "/synthetic/method.json");
  const roundId = `round-${String(ordinal).padStart(3, "0")}`;
  const summary = {
    method,
    referenceSha256: hash("reference" + ordinal),
    engines: {},
  };
  const baseReport = {
    roundId,
    roundOrdinal: ordinal,
    status: "eligible-scored",
    eligibilityReasons: [],
    summarySha256: hash("summary" + ordinal),
    methodSha256: methodRecord.actualSha256,
    referenceSha256: hash("reference" + ordinal),
    controlSha256: hash("control"),
    scorerSha256: hash("old-scorer"),
    freshness: {
      authorIds: {
        three: "author-three-" + ordinal,
        aperture: "author-aperture-" + ordinal,
      },
      judgeIds: ["judge-a-" + ordinal, "judge-b-" + ordinal],
    },
    inputs: { dispatchFreeze: { hashParity: true } },
    raw: { summary },
    engines: {},
    sourceReview: {
      reviewer: { id: "reviewer" },
      qualityRegressionReview: {
        status: "reviewed",
        previousScoreSha256: previousHash,
        reviewerId: "reviewer",
        independentOfAuthors: true,
        noMaterialQualityRegression: { three: true, aperture: true },
        reasons: ["Synthetic independent quality review"],
      },
    },
    runtimeInterpretation: {
      status: "reviewed",
      summarySha256: hash("summary" + ordinal),
      reviewerId: "reviewer",
      independentOfAuthors: true,
      reasons: ["Synthetic explicit trial-spread review"],
    },
  };
  const trialRecords = [];
  for (const engine of ["three", "aperture"]) {
    const duration = engine === "aperture" ? 80 : 100;
    const sourceFiles = [
      {
        path: "src/scene.js",
        bytes: 100,
        sha256: hash(engine + ordinal + "source"),
      },
    ];
    const appInputs = {
      "index.html": { bytes: 200, sha256: hash(engine + ordinal + "build") },
    };
    const sourceSha256 = hash(sourceFiles),
      buildSha256 = hash(appInputs);
    const author = {
      status: "validated-source-and-time",
      authorActiveSeconds: duration,
      audit: { sourceFiles },
      auditRoot: "/synthetic/author",
    };
    summary.engines[engine] = { author, trials: [] };
    const scene = {
      houseCount: 1,
      carCount: 1,
      extraBuildings: 0,
      extraVehicles: 0,
      distantLandscape: false,
      trees: 2,
      shrubs: 10,
      extraDecorativeObjects: 30,
      minX: -10,
      maxX: 10,
      minZ: -10,
      maxZ: 10,
    };
    const requiredFeatures = Object.fromEntries(
      FAIRNESS_V2.scene.requiredFeatures.map((feature) => [feature, true]),
    );
    const declaration = pinned(
      {
        schema: DECLARATION_SCHEMA_V2,
        engine,
        authorId: baseReport.freshness.authorIds[engine],
        contractSha256: fairness.actualSha256,
        settings: clone(FAIRNESS_V2.settings),
        inventory: resources(),
        scene,
        requiredFeatures,
      },
      `/synthetic/${engine}-declaration.json`,
    );
    const sourceAudit = pinned(
      {
        schema: SOURCE_AUDIT_SCHEMA_V2,
        engine,
        reviewerId: "reviewer",
        contractSha256: fairness.actualSha256,
        sourceSha256,
        buildSha256,
        declarationSha256: declaration.actualSha256,
        settings: clone(FAIRNESS_V2.settings),
        inventory: resources(),
        scene: clone(scene),
        requiredFeatures: clone(requiredFeatures),
        checks: Object.fromEntries(
          FAIRNESS_SOURCE_CHECKS_V2.map((check) => [
            check,
            {
              passed: true,
              reason: "Synthetic source review",
              evidence: [
                { path: "src/scene.js", sha256: sourceFiles[0].sha256 },
              ],
            },
          ]),
        ),
        shadowImplementation: {
          filterDescription:
            "Actual public PCF radius with disclosed backend taps",
          depthBiasConvention: "Native sign disclosed",
        },
      },
      `/synthetic/${engine}-audit.json`,
    );
    for (let trial = 1; trial <= 3; trial++) {
      const hashes = Object.fromEntries(
        [
          "outcome",
          "inputs",
          "receipts",
          "measurement",
          "renderer",
          "geometry",
        ].map((key) => [key, hash(engine + ordinal + trial + key)]),
      );
      summary.engines[engine].trials.push({
        status: "validated",
        engine,
        trial,
        hashes,
        appInputs,
        timing: { endToEndMs: { median: duration, p95: duration } },
      });
      const observation = pinned(
        {
          schema: OBSERVATION_SCHEMA_V2,
          engine,
          trial,
          trialHashes: clone(hashes),
          provenance: "independent-native-harness",
          contractSha256: fairness.actualSha256,
          sourceSha256,
          buildSha256,
          nativeWebGpu: true,
          webGlAttempts: 0,
          displayCanvasCount: 1,
          viewport: clone(FAIRNESS_V2.settings.viewport),
          capture: {
            warmupFrames: 60,
            measuredFrames: 120,
            complete: true,
            views: clone(FAIRNESS_V2.measurement.views),
          },
          geometry: {
            complete: true,
            semanticGeometrySha256: hash(engine + "geometry"),
            meshCount: 1,
            nativePositionMatchedMeshes: 1,
            unknownTriangleDrawCalls: 0,
            placedTriangles: 12,
            bounds: { min: [-10, 0, -10], max: [10, 10, 10] },
          },
        },
        `/synthetic/${engine}-observation-${trial}.json`,
      );
      trialRecords.push({
        engine,
        trial,
        declaration,
        sourceAudit,
        observation,
      });
    }
  }
  const components = componentScores(summary.engines, method);
  for (const engine of ["three", "aperture"]) {
    const scores = {
      visual: 8,
      geometry: 8,
      runtime: components[engine].runtime,
      authoringTime: components[engine].authoringTime,
    };
    scores.combined =
      scores.visual * 0.4 +
      scores.geometry * 0.2 +
      scores.runtime * 0.25 +
      scores.authoringTime * 0.15;
    baseReport.engines[engine] = {
      eligible: true,
      rawQualityMeans: { visual: 8, geometry: 8 },
      scores,
    };
  }
  baseReport.runtimeSpread = describeRuntimeSpread(summary);
  const records = {
    method: methodRecord,
    fairness,
    dispatchFreeze: pinned(
      {
        files: {
          "setup/fairness-contract.json": {
            bytes: fairness.actualBytes,
            sha256: fairness.actualSha256,
          },
        },
      },
      "/synthetic/freeze.json",
    ),
  };
  return {
    manifest: {
      schema: FAIR_SCORE_INPUT_SCHEMA_V2,
      roundId,
      roundOrdinal: ordinal,
    },
    records,
    trialRecords,
    baseReport,
    scorerSha256: hash("frozen-v2-scorer"),
  };
}
const evaluate = (input) => evaluateFairScoreV2(input);

describe("fair v2 score composition", () => {
  it("requires all six fairness gates while preserving original component arithmetic and first-pair pending state", async () => {
    const input = await fixture();
    const result = evaluate(input);
    expect(result.schema).toBe(FAIR_SCORE_SCHEMA_V2);
    expect(result.status).toBe("eligible-scored");
    expect(result.engines.aperture.scores).toEqual(
      input.baseReport.engines.aperture.scores,
    );
    expect(result.fairness.trials).toHaveLength(6);
    expect(result.meaningfulEdge.status).toBe(
      "pending-second-successive-eligible-pair",
    );
    expect(result.meaningfulEdge.meaningfulEdge).toBe(false);
    const missing = await fixture();
    missing.trialRecords.pop();
    const withheld = evaluate(missing);
    expect(withheld.status).toBe("scores-withheld");
    expect(withheld.engines.aperture.scores).toBeNull();
  });

  it("never exposes formal scores when the original execution/worker/quality gate fails", async () => {
    const input = await fixture();
    input.baseReport.status = "scores-withheld";
    input.baseReport.eligibilityReasons = [
      "Missing official execution; synthetic failure",
    ];
    const result = evaluate(input);
    expect(result.status).toBe("scores-withheld");
    expect(result.eligibilityReasons).toContain(
      "Missing official execution; synthetic failure",
    );
    expect(result.engines.three.scores).toBeNull();
    expect(result.stableLead.meaningfulEdge).toBe(false);
  });

  it("blocks swapped trial proofs, changed frozen method/contract and extra effects", async () => {
    const input = await fixture();
    input.trialRecords[0].observation = input.trialRecords[1].observation;
    expect(evaluate(input).status).toBe("scores-withheld");
    const effects = await fixture();
    effects.trialRecords[0].declaration.value.settings.effects.ssao = true;
    effects.trialRecords[0].declaration = pinned(
      effects.trialRecords[0].declaration.value,
      effects.trialRecords[0].declaration.pin.path,
    );
    expect(evaluate(effects).engines.aperture.scores).toBeNull();
    const changed = await fixture();
    changed.records.method.value.weights.runtime = 0.9;
    expect(evaluate(changed).status).toBe("scores-withheld");
    const wrongFairness = await fixture();
    wrongFairness.records.fairness.hashParity = false;
    expect(evaluate(wrongFairness).status).toBe("scores-withheld");
  });

  it("joins fair source inventory/build/author/reviewer identities to the original source audit", async () => {
    const input = await fixture();
    input.trialRecords[0].sourceAudit.value.sourceSha256 =
      hash("unrelated-source");
    input.trialRecords[0].sourceAudit.value.reviewerId = "unreviewed-person";
    input.trialRecords[0].sourceAudit = pinned(
      input.trialRecords[0].sourceAudit.value,
      input.trialRecords[0].sourceAudit.pin.path,
    );
    const result = evaluate(input);
    expect(result.status).toBe("scores-withheld");
    expect(result.eligibilityReasons.join(" ")).toContain(
      "exact original source/build inventories",
    );
    expect(result.eligibilityReasons.join(" ")).toContain(
      "author/reviewer identities differ",
    );
  });

  it("compares pinned native observations to deterministic retained-record derivation", async () => {
    const input = await fixture();
    input.trialRecords[0].derivedObservation = clone(
      input.trialRecords[0].observation.value,
    );
    input.trialRecords[0].derivedObservation.geometry.placedTriangles = 100;
    expect(evaluate(input).eligibilityReasons.join(" ")).toContain(
      "deterministic retained-record derivation",
    );
  });

  it("fails actual-file manifest pin mismatch without producing invented scores", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "fair-score-pin-"));
    try {
      const path = resolve(root, "inputs.json");
      await writeFile(
        path,
        JSON.stringify({ schema: FAIR_SCORE_INPUT_SCHEMA_V2 }),
      );
      const report = await scoreFairRoundFilesV2(path, hash("wrong bytes"));
      expect(report.status).toBe("scores-withheld");
      expect(report.engines.aperture.scores).toBeNull();
      expect(report.meaningfulEdge.meaningfulEdge).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("writes CLI reports create-only and refuses to replace an existing retained result", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "fair-score-cli-"));
    try {
      const path = resolve(root, "inputs.json");
      const output = resolve(root, "result.json");
      await writeFile(
        path,
        JSON.stringify({ schema: FAIR_SCORE_INPUT_SCHEMA_V2 }),
      );
      const args = [
        fileURLToPath(
          new URL(
            "../../tools/agent-benchmark/fair-score-v2.mjs",
            import.meta.url,
          ),
        ),
        "--inputs",
        path,
        "--inputs-sha256",
        hash("wrong bytes"),
        "--output",
        output,
      ];
      await promisify(execFile)(process.execPath, args);
      const original = await readFile(output);
      expect(JSON.parse(original).status).toBe("scores-withheld");
      await expect(promisify(execFile)(process.execPath, args)).rejects.toThrow(
        "EEXIST",
      );
      expect(await readFile(output)).toEqual(original);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("retained native observation derivation", () => {
  function nativeFixture() {
    const adapter = { description: "Synthetic SwiftShader Device" };
    const proof = {
      native: true,
      adapters: [adapter],
      devices: [{ adapter }],
      canvasWebGPU: 1,
      webglAttempts: 0,
      submissions: 183,
      draws: 183,
      errors: [],
      deviceLost: [],
    };
    const frame = (index) => ({
      frame: index,
      cpuSubmissionMs: 1,
      applicationPromiseMs: 1,
      queueCompletionLatencyMs: 1,
      endToEndMs: 2,
      submissions: 1,
      drawCalls: 1,
      submittedTriangles: 12,
      unknownCommandBuffers: 0,
      unknownTopologyDrawCalls: 0,
      indirectDrawCalls: 0,
      knownIndirectDrawCalls: 0,
      unknownIndirectDrawCalls: 0,
      unknownDirectTriangleDrawCalls: 0,
      knownIndirectTriangles: 0,
      nativeIndirectArgumentReferences: [],
      unretainedKnownIndirectDrawCalls: 0,
      unknownIndirectReasons: {},
      submittedTriangleAccounting: {
        schema: "aperture.native-triangle-accounting.v2.1",
        confidence: "exact-supported-command-arguments",
      },
    });
    const warmup = Array.from({ length: 60 }, (_unused, index) => frame(index));
    const samples = Array.from({ length: 120 }, (_unused, index) =>
      frame(index + 60),
    );
    const geometry = {
      meshEntries: 1,
      exactNativePositionStreamMatches: 1,
      instancedAuthoredTriangles: 12,
      bounds: { min: [-1, 0, -1], max: [1, 2, 1] },
    };
    const views = CONTRACT.views.map((camera, index) => ({
      camera,
      frame: frame(180 + index),
      proof,
      screenshot: {
        path: camera.id + ".png",
        bytes: 100,
        sha256: hash(camera.id),
      },
    }));
    const trial = {
      status: "validated",
      engine: "three",
      trial: 1,
      hashes: { measurement: hash("measurement") },
      warmupSamples: warmup,
      samples,
      geometry: { ...geometry, semanticGeometrySha256: hash("geometry") },
      captures: views.map((view) => ({
        camera: view.camera,
        screenshot: view.screenshot,
      })),
    };
    return {
      contractSha256: hash("contract"),
      sourceSha256: hash("source"),
      buildSha256: hash("build"),
      trial,
      measurement: {
        engine: "three",
        trial: 1,
        contract: CONTRACT,
        nativeProof: proof,
        warmup,
        samples,
        geometry,
        views,
        nativeIndirectArgumentProof: {
          schema: "aperture.native-indirect-arguments.v2.1",
          capacityExceeded: false,
          maxWitnesses: 16_384,
          witnesses: [],
        },
      },
      renderer: { proof },
    };
  }

  it("derives complete observations from exact retained native samples, geometry and camera records", () => {
    const input = nativeFixture();
    const result = buildFairnessObservationV2(input);
    expect(result.geometry.placedTriangles).toBe(12);
    expect(result.geometry.unknownTriangleDrawCalls).toBe(0);
    expect(result.trialHashes).toEqual(input.trial.hashes);
    expect(result.capture).toEqual({
      warmupFrames: 60,
      measuredFrames: 120,
      complete: true,
      views: ["canonical", "left-orbit", "rear-orbit"],
    });
    expect(result.limitations).toContain("do not establish material features");
  });

  it("rejects fallback attempts, summary divergence and truncated indirect proof", () => {
    const fallback = nativeFixture();
    fallback.measurement.nativeProof.webglAttempts = 1;
    expect(() => buildFairnessObservationV2(fallback)).toThrow(
      "WebGL fallback attempted",
    );
    const changed = nativeFixture();
    changed.trial.geometry.instancedAuthoredTriangles = 99;
    expect(() => buildFairnessObservationV2(changed)).toThrow(
      "Retained geometry",
    );
    const truncated = nativeFixture();
    truncated.measurement.nativeIndirectArgumentProof.capacityExceeded = true;
    expect(() => buildFairnessObservationV2(truncated)).toThrow(
      "incomplete or over capacity",
    );
  });
});

describe("predeclared meaningful edge", () => {
  async function pair() {
    const first = evaluate(await fixture(1));
    const previous = pinned(first, "/synthetic/previous-score.json");
    const secondInput = await fixture(2, previous.actualSha256);
    secondInput.records.previous = previous;
    const second = evaluate(secondInput);
    return {
      first,
      second,
      input: secondInput,
      previousHash: previous.actualSha256,
    };
  }
  const decide = ({ first, second, input, previousHash }) =>
    evaluateMeaningfulEdgeV2({
      current: second,
      previous: first,
      previousSha256: previousHash,
      method: input.records.method.value,
      qualityRegressionReview: second.sourceReview.qualityRegressionReview,
    });

  it("requires two successive fresh pairs with >=0.25 margin, unchanged quality and >=10% meaningful component gain", async () => {
    const value = await pair();
    const result = decide(value);
    expect(result.meaningfulEdge).toBe(true);
    expect(result.pairs.every((pair) => pair.gain.runtimeConclusive)).toBe(
      true,
    );
    expect(result.universalSuperiorityClaim).toBe(false);
  });

  it("cannot skip an invalid pair or reuse authors/judges or change frozen scoring controls", async () => {
    const skipped = await pair();
    skipped.first.roundOrdinal = 0;
    expect(decide(skipped).meaningfulEdge).toBe(false);
    const invalid = await pair();
    invalid.first.status = "scores-withheld";
    expect(decide(invalid).meaningfulEdge).toBe(false);
    const reused = await pair();
    reused.first.freshness = clone(reused.second.freshness);
    expect(decide(reused).meaningfulEdge).toBe(false);
    const changed = await pair();
    changed.first.fairnessSha256 = hash("other fairness");
    expect(decide(changed).reasons.join(" ")).toContain("fairnessSha256");
    changed.first.scorerSha256 = hash("other scorer");
    expect(decide(changed).meaningfulEdge).toBe(false);
    const repeatedReference = await pair();
    repeatedReference.first.referenceSha256 =
      repeatedReference.second.referenceSha256;
    expect(decide(repeatedReference).reasons.join(" ")).toContain(
      "distinct freshly generated low-poly reference",
    );
  });

  it("rejects within-pair quality regression and sub-10% gains even with an adequate combined margin", async () => {
    const quality = await pair();
    quality.second.engines.aperture.rawQualityMeans.visual = 7.9;
    expect(decide(quality).reasons.join(" ")).toContain(
      "equal or exceed Three",
    );
    const narrow = await pair();
    narrow.second.raw.summary.engines.aperture.trials.forEach((trial) => {
      trial.timing.endToEndMs.median = 95;
      trial.timing.endToEndMs.p95 = 95;
    });
    narrow.second.raw.summary.engines.aperture.author.authorActiveSeconds = 95;
    narrow.second.runtimeSpread = describeRuntimeSpread(
      narrow.second.raw.summary,
    );
    expect(decide(narrow).reasons.join(" ")).toContain(
      "Neither runtime beyond observed spread",
    );
  });

  it("labels a 20% runtime gain within observed spread inconclusive while retaining the independent author-time path", async () => {
    const value = await pair();
    value.second.raw.summary.engines.aperture.trials[0].timing.endToEndMs.median = 60;
    value.second.raw.summary.engines.aperture.trials[2].timing.endToEndMs.median = 100;
    value.second.runtimeSpread = describeRuntimeSpread(
      value.second.raw.summary,
    );
    let result = decide(value);
    expect(result.meaningfulEdge).toBe(true);
    expect(result.pairs[1].gain.runtimeConclusive).toBe(false);
    expect(result.pairs[1].gain.runtimeInterpretation).toContain(
      "inconclusive",
    );
    expect(result.pairs[1].gain.rangesOverlap).toBe(true);
    value.second.raw.summary.engines.aperture.author.authorActiveSeconds = 100;
    result = decide(value);
    expect(result.meaningfulEdge).toBe(false);
  });

  it("requires exact independent spread and quality-regression review receipts", async () => {
    const spread = await pair();
    spread.second.runtimeInterpretation.status = "pending";
    expect(decide(spread).meaningfulEdge).toBe(false);
    const quality = await pair();
    quality.second.sourceReview.qualityRegressionReview.previousScoreSha256 =
      hash("other previous report");
    expect(decide(quality).meaningfulEdge).toBe(false);
    const margins = await pair();
    margins.first.apertureCombinedMargin = 0.249;
    expect(decide(margins).meaningfulEdge).toBe(false);
  });
});
