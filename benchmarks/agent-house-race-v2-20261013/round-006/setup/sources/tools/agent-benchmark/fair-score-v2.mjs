import { readFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyProof } from "../../scripts/verified-webgpu.mjs";
import { CONTRACT, summarize, validateSample } from "./contract.mjs";
import { componentScores } from "./summarize.mjs";
import { readPinnedFile, scoreRoundFiles } from "./score-round.mjs";
import { describeRuntimeSpread } from "./score-stability.mjs";
import { validateTriangleArgumentProofV2 } from "./triangle-accounting-v2.mjs";
import { sha256, writeImmutable } from "./recorder.mjs";
import {
  FAIRNESS_SCHEMA_V2,
  OBSERVATION_SCHEMA_V2,
  validateFairnessV2,
} from "./fairness-v2.mjs";

export const FAIR_SCORE_SCHEMA_V2 = "aperture.house-race-fair-score.v2";
export const FAIR_SCORE_INPUT_SCHEMA_V2 =
  "aperture.house-race-fair-score-inputs.v2";
export const METHOD_SCHEMA_V2 = "aperture.house-race-method.v2";
const engines = ["three", "aperture"];
const weights = {
  visual: 0.4,
  geometry: 0.2,
  runtime: 0.25,
  authoringTime: 0.15,
};
const criteria = {
  successiveEligiblePairs: 2,
  combinedMarginMinimum: 0.25,
  componentGainMinimumFraction: 0.1,
  componentGain: ["runtime", "activeAuthoringTime"],
  visualMeanMinimum: 6,
  geometryMeanMinimum: 6,
  noMaterialQualityRegression: true,
  reportRuntimeTrialSpread: true,
};
const runtimeCriteria = {
  minimumFraction: 0.1,
  minimumAbsoluteDifference:
    "greater than the larger within-engine max-minus-min range of the three trial medians",
  reportRangeOverlap: true,
  independentReview: true,
};
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const stable = (value) =>
  JSON.stringify(value, (_key, item) =>
    object(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
const same = (left, right) => stable(left) === stable(right);
const digest = (value) => sha256(Buffer.from(stable(value)));
const hash = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const nonempty = (value) =>
  typeof value === "string" && value.trim().length > 0;
const requireValue = (condition, message) => {
  if (!condition) throw new Error(message);
};
const verified = (record) =>
  record?.hashParity === true &&
  record.error == null &&
  hash(record?.pin?.sha256) &&
  record.actualSha256 === record.pin.sha256 &&
  Number.isSafeInteger(record.pin.bytes) &&
  record.pin.bytes >= 0 &&
  record.actualBytes === record.pin.bytes;
const pinSummary = (record) =>
  record
    ? {
        pin: record.pin,
        actualSha256: record.actualSha256,
        actualBytes: record.actualBytes,
        hashParity: record.hashParity,
        error: record.error,
      }
    : null;

function methodErrors(method, fairnessRecord) {
  const errors = [];
  if (
    method?.schema !== METHOD_SCHEMA_V2 ||
    method.mode !== "independent-authoring" ||
    method.benchmarkVersion !== "2.0.0" ||
    !same(method.weights, weights) ||
    method.trialsPerEngine !== 3
  )
    errors.push(
      "Exact supported v2 independent-authoring method, unchanged weights and three trials required",
    );
  if (
    !same(method?.meaningfulEdge, criteria) ||
    !same(method?.runtimeEdge, runtimeCriteria)
  )
    errors.push(
      "Predeclared v2 meaningful-edge and runtime-spread criteria differ",
    );
  if (
    method?.referenceSha256 !== undefined ||
    method?.referencePolicy?.kind !== "fresh-low-poly-per-round" ||
    method.referencePolicy.taskFamily !== "low-poly-house-road-car" ||
    method.referencePolicy.uniqueImagePerRound !== true ||
    method.referencePolicy.sharedWithinRound !== true ||
    method.referencePolicy.selection !== "before-author-dispatch-and-results" ||
    !nonempty(method.referencePolicy.style) ||
    !nonempty(method.referencePolicy.generation)
  )
    errors.push(
      "Fresh low-poly per-round reference policy required; a fixed method reference cannot be reused",
    );
  if (
    !verified(fairnessRecord) ||
    fairnessRecord.value?.schema !== FAIRNESS_SCHEMA_V2 ||
    method?.fairnessContract?.sha256 !== fairnessRecord.actualSha256 ||
    method?.fairnessContract?.bytes !== fairnessRecord.actualBytes ||
    basename(fairnessRecord?.pin?.path ?? "") !== method?.fairnessContract?.path
  )
    errors.push(
      "Method must bind exact independently verified fairness-contract bytes and filename",
    );
  return errors;
}

function roundMetrics(report) {
  const summary = report?.raw?.summary;
  const metrics = {};
  for (const engine of engines) {
    const medians =
      summary?.engines?.[engine]?.trials?.map(
        (trial) => trial.timing?.endToEndMs?.median,
      ) ?? [];
    const author = summary?.engines?.[engine]?.author?.authorActiveSeconds;
    if (
      medians.length !== 3 ||
      !medians.every((value) => Number.isFinite(value) && value > 0) ||
      !Number.isFinite(author) ||
      author <= 0
    )
      return null;
    metrics[engine] = {
      medianTrialMedianMs: summarize(medians).median,
      trialMedianRange: [Math.min(...medians), Math.max(...medians)],
      activeAuthorSeconds: author,
    };
  }
  return metrics;
}

function evaluatePairEdge(report, method) {
  const reasons = [];
  if (
    report?.schema !== FAIR_SCORE_SCHEMA_V2 ||
    report.status !== "eligible-scored" ||
    report.fairness?.eligible !== true ||
    report.fairness.trials?.length !== 6 ||
    report.fairness.trials.some((trial) => trial.result?.eligible !== true)
  )
    reasons.push(
      "Pair must be fully scored and all six fairness gates eligible",
    );
  const margin = report?.apertureCombinedMargin;
  if (
    !Number.isFinite(margin) ||
    margin < method.meaningfulEdge.combinedMarginMinimum
  )
    reasons.push("Aperture combined margin is below the predeclared 0.25");
  for (const component of ["visual", "geometry"]) {
    const aperture = report?.engines?.aperture?.rawQualityMeans?.[component];
    const three = report?.engines?.three?.rawQualityMeans?.[component];
    if (
      !Number.isFinite(aperture) ||
      !Number.isFinite(three) ||
      aperture < 6 ||
      three < 6 ||
      aperture < three
    )
      reasons.push(
        `Aperture ${component} must meet 6 and equal or exceed Three's corresponding mean`,
      );
  }
  const metrics = roundMetrics(report);
  let gain = null;
  if (!metrics)
    reasons.push(
      "All three raw trial medians and recorded positive active author durations required",
    );
  else {
    const a = metrics.aperture,
      b = metrics.three;
    const absoluteDifferenceMs = b.medianTrialMedianMs - a.medianTrialMedianMs;
    const observedSpreadMs = Math.max(
      a.trialMedianRange[1] - a.trialMedianRange[0],
      b.trialMedianRange[1] - b.trialMedianRange[0],
    );
    const runtimeFraction = absoluteDifferenceMs / b.medianTrialMedianMs;
    const authoringFraction =
      (b.activeAuthorSeconds - a.activeAuthorSeconds) / b.activeAuthorSeconds;
    const runtimeReview = report.runtimeInterpretation;
    const reviewed =
      runtimeReview?.status === "reviewed" &&
      runtimeReview.summarySha256 === report.summarySha256 &&
      nonempty(runtimeReview.reviewerId) &&
      runtimeReview.independentOfAuthors === true &&
      !Object.values(report.freshness?.authorIds ?? {}).includes(
        runtimeReview.reviewerId,
      ) &&
      Array.isArray(runtimeReview.reasons) &&
      runtimeReview.reasons.length > 0 &&
      runtimeReview.reasons.every(nonempty);
    if (
      !reviewed ||
      !same(report.runtimeSpread, describeRuntimeSpread(report.raw.summary))
    )
      reasons.push(
        "Exact trial spread requires an explicit independent review and unchanged raw spread report",
      );
    const runtimeConclusive =
      runtimeFraction >= method.meaningfulEdge.componentGainMinimumFraction &&
      absoluteDifferenceMs > observedSpreadMs;
    const authoringConclusive =
      authoringFraction >= method.meaningfulEdge.componentGainMinimumFraction;
    gain = {
      runtimeFraction,
      activeAuthoringFraction: authoringFraction,
      absoluteDifferenceMs,
      observedSpreadMs,
      runtimeConclusive,
      activeAuthoringConclusive: authoringConclusive,
      rangesOverlap:
        a.trialMedianRange[1] >= b.trialMedianRange[0] &&
        b.trialMedianRange[1] >= a.trialMedianRange[0],
      runtimeInterpretation: runtimeConclusive
        ? "exceeds-predeclared-observed-spread-threshold"
        : "runtime-gain-inconclusive-or-below-threshold",
      metrics,
      limitations:
        "Observed CPU SwiftShader trial spread is not a statistical significance test or physical-GPU measurement",
    };
    if (!runtimeConclusive && !authoringConclusive)
      reasons.push(
        "Neither runtime beyond observed spread nor active authoring achieves the predeclared 10% gain",
      );
  }
  return {
    roundId: report?.roundId,
    eligible: reasons.length === 0,
    reasons,
    gain,
  };
}

/** Pure decision over verified reports. A skipped or invalid predecessor cannot establish a lead. */
export function evaluateMeaningfulEdgeV2({
  current,
  previous,
  previousSha256,
  method,
  qualityRegressionReview,
} = {}) {
  if (
    !same(method?.meaningfulEdge, criteria) ||
    !same(method?.runtimeEdge, runtimeCriteria) ||
    method?.referencePolicy?.kind !== "fresh-low-poly-per-round" ||
    method.referencePolicy.uniqueImagePerRound !== true ||
    method.referencePolicy.sharedWithinRound !== true
  )
    return {
      status: "meaningful-edge-not-established",
      meaningfulEdge: false,
      stableBenchmarkLead: false,
      reasons: ["Frozen v2 meaningful-edge criteria required"],
      universalSuperiorityClaim: false,
    };
  const currentPair = evaluatePairEdge(current, method);
  if (!previous)
    return {
      status: currentPair.eligible
        ? "pending-second-successive-eligible-pair"
        : "meaningful-edge-not-established",
      meaningfulEdge: false,
      stableBenchmarkLead: false,
      reasons: [...currentPair.reasons, "A single pair remains exploratory"],
      pairs: [currentPair],
      universalSuperiorityClaim: false,
    };
  const previousPair = evaluatePairEdge(previous, method);
  const stabilityReasons = [];
  if (previous.roundOrdinal !== current.roundOrdinal - 1)
    stabilityReasons.push(
      "Rounds are not successive; an invalid or omitted pair cannot be skipped",
    );
  if (
    !hash(previous.summarySha256) ||
    previous.summarySha256 === current.summarySha256
  )
    stabilityReasons.push("Two pairs require distinct fresh summary evidence");
  const currentAuthors = Object.values(current.freshness?.authorIds ?? {});
  const previousAuthors = Object.values(previous.freshness?.authorIds ?? {});
  const authors = [...currentAuthors, ...previousAuthors];
  const judges = [
    ...(current.freshness?.judgeIds ?? []),
    ...(previous.freshness?.judgeIds ?? []),
  ];
  if (
    currentAuthors.length !== 2 ||
    previousAuthors.length !== 2 ||
    authors.some((id) => !nonempty(id)) ||
    new Set(authors).size !== 4
  )
    stabilityReasons.push(
      "Successive pairs require four distinct fresh independent authors",
    );
  if (
    judges.length !== 4 ||
    judges.some((id) => !nonempty(id)) ||
    new Set(judges).size !== 4
  )
    stabilityReasons.push(
      "Successive pairs require four distinct fresh independent judges",
    );
  if (
    qualityRegressionReview?.status !== "reviewed" ||
    qualityRegressionReview.previousScoreSha256 !== previousSha256 ||
    qualityRegressionReview.independentOfAuthors !== true ||
    !nonempty(qualityRegressionReview.reviewerId) ||
    !Array.isArray(qualityRegressionReview.reasons) ||
    qualityRegressionReview.reasons.length === 0 ||
    !qualityRegressionReview.reasons.every(nonempty)
  )
    stabilityReasons.push(
      "Material quality regression review is pending or not joined to the exact preceding score",
    );
  if (
    engines.some(
      (engine) =>
        qualityRegressionReview?.noMaterialQualityRegression?.[engine] !== true,
    )
  )
    stabilityReasons.push(
      "Both engines require explicit no-material-quality-regression review across the fresh references",
    );
  if (
    !hash(current.referenceSha256) ||
    !hash(previous.referenceSha256) ||
    current.referenceSha256 === previous.referenceSha256
  )
    stabilityReasons.push(
      "Successive v2 pairs require distinct freshly generated low-poly reference image hashes",
    );
  if (
    !same(current.referencePolicy, method.referencePolicy) ||
    !same(previous.referencePolicy, method.referencePolicy)
  )
    stabilityReasons.push(
      "Both pairs require the same frozen low-poly task-family/reference-generation policy",
    );
  const reasons = [
    ...currentPair.reasons.map((message) => `${current?.roundId}: ${message}`),
    ...previousPair.reasons.map(
      (message) => `${previous?.roundId}: ${message}`,
    ),
    ...stabilityReasons,
  ];
  for (const key of [
    "methodSha256",
    "fairnessSha256",
    "controlSha256",
    "scorerSha256",
  ])
    if (!hash(current?.[key]) || current[key] !== previous?.[key])
      reasons.push(`Same exact frozen ${key} required across pairs`);
  if (!hash(previousSha256))
    reasons.push("Exact pinned preceding fair-score report required");
  return {
    status: reasons.length
      ? "meaningful-edge-not-established"
      : "meaningful-benchmark-edge-established",
    meaningfulEdge: reasons.length === 0,
    stableBenchmarkLead: reasons.length === 0,
    reasons,
    comparedRounds: [previous.roundId, current.roundId],
    precedingScoreSha256: previousSha256,
    pairs: [previousPair, currentPair],
    sharedStabilityChecks: {
      eligible: stabilityReasons.length === 0,
      reasons: stabilityReasons,
      qualityRegressionReview: qualityRegressionReview ?? null,
    },
    references: {
      previous: previous.referenceSha256,
      current: current.referenceSha256,
      policy: method.referencePolicy,
    },
    claim: reasons.length
      ? null
      : "Aperture showed the predeclared meaningful edge on this frozen low-poly house task family across two successive fresh references and eligible author pairs.",
    universalSuperiorityClaim: false,
  };
}

/** Derive observed facts from retained trial records; no material/settings claims are inferred. */
export function buildFairnessObservationV2({
  contractSha256,
  sourceSha256,
  buildSha256,
  trial,
  measurement,
  renderer,
} = {}) {
  requireValue(
    hash(contractSha256) && hash(sourceSha256) && hash(buildSha256),
    "Exact contract/source/build hashes required",
  );
  requireValue(
    trial?.status === "validated" &&
      measurement?.engine === trial.engine &&
      measurement.trial === trial.trial &&
      same(measurement.contract, CONTRACT),
    "Validated fixed-contract measurement/trial join required",
  );
  verifyProof(measurement.nativeProof);
  verifyProof(renderer?.proof);
  requireValue(
    same(measurement.warmup, trial.warmupSamples) &&
      same(measurement.samples, trial.samples),
    "Retained raw sample arrays differ from validated summary",
  );
  for (const sample of [...measurement.warmup, ...measurement.samples])
    validateSample(sample);
  validateTriangleArgumentProofV2(measurement);
  for (const [key, value] of Object.entries(measurement.geometry ?? {}))
    requireValue(
      same(value, trial.geometry?.[key]),
      `Retained geometry ${key} differs from independently validated summary`,
    );
  requireValue(
    measurement.views?.length === 3 &&
      measurement.views.every(
        (view, index) =>
          same(view.camera, CONTRACT.views[index]) &&
          same(view.screenshot, trial.captures?.[index]?.screenshot),
      ),
    "Retained controlled camera captures differ",
  );
  for (const view of measurement.views) verifyProof(view.proof);
  const samples = [
    ...measurement.warmup,
    ...measurement.samples,
    ...measurement.views.map((view) => view.frame),
  ];
  const unknownTriangleDrawCalls = samples.reduce(
    (sum, sample) =>
      sum +
      (sample.unknownDirectTriangleDrawCalls ?? 0) +
      (sample.unknownIndirectDrawCalls ?? sample.indirectDrawCalls ?? 0) +
      (sample.unknownTopologyDrawCalls ?? 0) +
      (sample.unknownCommandBuffers ?? 0),
    0,
  );
  return {
    schema: OBSERVATION_SCHEMA_V2,
    provenance: "independent-native-harness",
    engine: trial.engine,
    trial: trial.trial,
    trialHashes: structuredClone(trial.hashes),
    contractSha256,
    sourceSha256,
    buildSha256,
    nativeWebGpu: true,
    webGlAttempts: measurement.nativeProof.webglAttempts,
    displayCanvasCount: 1,
    viewport: {
      ...CONTRACT.viewport,
      devicePixelRatio: CONTRACT.devicePixelRatio,
    },
    capture: {
      warmupFrames: measurement.warmup.length,
      measuredFrames: measurement.samples.length,
      complete: true,
      views: measurement.views.map((view) => view.camera.id),
    },
    geometry: {
      complete: true,
      semanticGeometrySha256: trial.geometry.semanticGeometrySha256,
      meshCount: trial.geometry.meshEntries,
      nativePositionMatchedMeshes:
        trial.geometry.exactNativePositionStreamMatches,
      unknownTriangleDrawCalls,
      placedTriangles: trial.geometry.instancedAuthoredTriangles,
      bounds: structuredClone(trial.geometry.bounds),
    },
    limitations:
      "Canvas/DPR facts are the frozen client's checked display contract. Position/triangle facts do not establish material features or full source inventory.",
  };
}

/** Pure composition of the original score gate and all six new fairness gates. */
export function evaluateFairScoreV2({
  manifest,
  records,
  trialRecords = [],
  baseReport,
  scorerSha256,
  evidenceErrors = [],
} = {}) {
  const reasons = [...evidenceErrors];
  for (const key of ["method", "fairness"])
    if (!verified(records?.[key]))
      reasons.push(`Exact coordinator-verified ${key} record required`);
  const method = records?.method?.value;
  reasons.push(...methodErrors(method, records?.fairness));
  if (
    manifest?.schema !== FAIR_SCORE_INPUT_SCHEMA_V2 ||
    manifest.roundId !== baseReport?.roundId ||
    manifest.roundOrdinal !== baseReport?.roundOrdinal
  )
    reasons.push(
      "New versioned manifest must join exact original round identity",
    );
  if (baseReport?.status !== "eligible-scored")
    reasons.push(
      ...(baseReport?.eligibilityReasons ?? [
        "Original full execution/source/worker/quality score gate is incomplete",
      ]),
    );
  if (
    baseReport?.methodSha256 !== records?.method?.actualSha256 ||
    !same(baseReport?.raw?.summary?.method, method)
  )
    reasons.push(
      "Original verified scoring method differs from exact v2 method",
    );
  const frozenFiles = baseReport?.inputs?.dispatchFreeze?.hashParity
    ? (records?.dispatchFreeze?.value?.files ?? {})
    : {};
  if (
    !Object.entries(frozenFiles).some(
      ([path, pin]) =>
        path.endsWith("/fairness-contract.json") &&
        pin.sha256 === records?.fairness?.actualSha256 &&
        pin.bytes === records?.fairness?.actualBytes,
    )
  )
    reasons.push(
      "Exact fairness contract pin absent from pre-author dispatch freeze",
    );
  const inventory = new Set();
  const trials = [];
  for (const item of trialRecords) {
    const id = `${item.engine}/${item.trial}`;
    if (
      !engines.includes(item.engine) ||
      ![1, 2, 3].includes(item.trial) ||
      inventory.has(id)
    )
      reasons.push("Six unique engine/trial fairness records required");
    inventory.add(id);
    const result = validateFairnessV2({
      contract: records?.fairness?.value,
      contractSha256: records?.fairness?.actualSha256,
      engine: item.engine,
      declaration: item.declaration,
      sourceAudit: item.sourceAudit,
      observation: item.observation,
    });
    const summaryTrial = baseReport?.raw?.summary?.engines?.[
      item.engine
    ]?.trials?.find((trial) => trial.trial === item.trial);
    const sourceAudit = item.sourceAudit?.value;
    const declaration = item.declaration?.value;
    const observation = item.observation?.value;
    const author = baseReport?.raw?.summary?.engines?.[item.engine]?.author;
    const sourceInventorySha256 = author?.audit?.sourceFiles
      ? digest(author.audit.sourceFiles)
      : null;
    const buildInventorySha256 = summaryTrial?.appInputs
      ? digest(summaryTrial.appInputs)
      : null;
    const joins = [];
    if (
      !summaryTrial ||
      observation?.trial !== item.trial ||
      !same(observation?.trialHashes, summaryTrial.hashes)
    )
      joins.push(
        "Native observation must join exact trial ordinal and all retained artifact hashes",
      );
    if (
      sourceAudit?.sourceSha256 !== sourceInventorySha256 ||
      sourceAudit?.buildSha256 !== buildInventorySha256
    )
      joins.push(
        "Fair source review must join exact original source/build inventories",
      );
    if (
      declaration?.authorId !==
        baseReport?.freshness?.authorIds?.[item.engine] ||
      sourceAudit?.reviewerId !== baseReport?.sourceReview?.reviewer?.id
    )
      joins.push(
        "Fair author/reviewer identities differ from original independently reviewed identities",
      );
    if (item.derivedObservation && !same(observation, item.derivedObservation))
      joins.push(
        "Pinned native observation differs from deterministic retained-record derivation",
      );
    for (const message of [...result.reasons, ...joins])
      reasons.push(`${id}: ${message}`);
    trials.push({
      engine: item.engine,
      trial: item.trial,
      result: {
        ...result,
        eligible: result.eligible && joins.length === 0,
        reasons: [...result.reasons, ...joins],
      },
      inputs: {
        declaration: pinSummary(item.declaration),
        sourceAudit: pinSummary(item.sourceAudit),
        observation: pinSummary(item.observation),
      },
    });
  }
  if (
    trialRecords.length !== 6 ||
    engines.some((engine) =>
      [1, 2, 3].some((trial) => !inventory.has(`${engine}/${trial}`)),
    )
  )
    reasons.push(
      "All three declared trials per engine required; missing or invalid pairs cannot be skipped",
    );
  const report = {
    ...baseReport,
    schema: FAIR_SCORE_SCHEMA_V2,
    recordedAt: new Date().toISOString(),
    status: reasons.length ? "scores-withheld" : "eligible-scored",
    methodSha256: records?.method?.actualSha256,
    fairnessSha256: records?.fairness?.actualSha256,
    referencePolicy: method?.referencePolicy,
    scorerSha256,
    eligibilityReasons: reasons,
    baseEvaluation: baseReport,
    fairness: {
      eligible:
        trials.length === 6 && trials.every((trial) => trial.result.eligible),
      trials,
    },
    inputsV2: {
      method: pinSummary(records?.method),
      fairness: pinSummary(records?.fairness),
      previous: pinSummary(records?.previous),
    },
    engines: structuredClone(
      baseReport?.engines ?? {
        three: { scores: null },
        aperture: { scores: null },
      },
    ),
    apertureCombinedMargin: null,
  };
  if (reasons.length)
    for (const engine of engines) {
      report.engines[engine].scores = null;
      report.engines[engine].eligible = false;
    }
  else {
    const components = componentScores(baseReport.raw.summary.engines, method);
    for (const engine of engines) {
      const quality = report.engines[engine].rawQualityMeans;
      const scores = {
        visual: quality.visual,
        geometry: quality.geometry,
        runtime: components[engine].runtime,
        authoringTime: components[engine].authoringTime,
      };
      scores.combined = Object.entries(weights).reduce(
        (sum, [key, weight]) => sum + scores[key] * weight,
        0,
      );
      requireValue(
        same(scores, baseReport.engines[engine].scores),
        "V2 arithmetic differs from unchanged original component scoring",
      );
      report.engines[engine].scores = scores;
    }
    report.apertureCombinedMargin =
      report.engines.aperture.scores.combined -
      report.engines.three.scores.combined;
  }
  report.meaningfulEdge = evaluateMeaningfulEdgeV2({
    current: report,
    previous: verified(records?.previous) ? records.previous.value : null,
    previousSha256: records?.previous?.actualSha256,
    method,
    qualityRegressionReview: baseReport?.sourceReview?.qualityRegressionReview,
  });
  report.stableLead = report.meaningfulEdge;
  return report;
}

async function verifySourceEvidence(item, baseReport, errors) {
  const author = baseReport.raw?.summary?.engines?.[item.engine]?.author;
  const review = baseReport.sourceReview?.engines?.[item.engine];
  const known = new Map(
    (isAbsolute(author?.auditRoot ?? "")
      ? (author?.audit?.sourceFiles ?? [])
      : []
    ).map((pin) => [
      pin.path,
      { ...pin, path: resolve(author.auditRoot, "source", pin.path) },
    ]),
  );
  for (const pin of review?.reviewedDependencyFiles ?? [])
    known.set(pin.path, pin);
  const checked = new Set();
  for (const check of Object.values(item.sourceAudit?.value?.checks ?? {}))
    for (const witness of Array.isArray(check?.evidence)
      ? check.evidence
      : []) {
      if (checked.has(witness.path + witness.sha256)) continue;
      checked.add(witness.path + witness.sha256);
      const pin = known.get(witness.path);
      if (!pin || pin.sha256 !== witness.sha256) {
        errors.push(
          `${item.engine}: fair audit cites source outside exact independently reviewed inventories`,
        );
        continue;
      }
      const record = await readPinnedFile(pin, false);
      if (!verified(record))
        errors.push(
          `${item.engine}: fair source-review witness bytes changed: ${witness.path}`,
        );
    }
  const declarationFile = author?.audit?.sourceFiles?.find(
    (pin) => pin.path === "benchmark-fairness.json",
  );
  if (
    !declarationFile ||
    declarationFile.sha256 !== item.declaration?.actualSha256 ||
    declarationFile.bytes !== item.declaration?.actualBytes
  )
    errors.push(
      `${item.engine}: author declaration must survive in the immutable final author source inventory`,
    );
}

/** Exact file pins, original full verifier, retained native derivation and create-only CLI. */
export async function scoreFairRoundFilesV2(manifestPath, expectedSha256) {
  const outer = await readPinnedFile({
    path: manifestPath,
    sha256: expectedSha256,
  });
  if (!outer.hashParity || outer.error)
    return {
      schema: FAIR_SCORE_SCHEMA_V2,
      status: "scores-withheld",
      eligibilityReasons: ["Exact fair scoring manifest integrity invalid"],
      engines: { three: { scores: null }, aperture: { scores: null } },
      meaningfulEdge: {
        meaningfulEdge: false,
        stableBenchmarkLead: false,
        universalSuperiorityClaim: false,
      },
      inputsManifest: pinSummary(outer),
    };
  const manifest = outer.value;
  requireValue(
    manifest.schema === FAIR_SCORE_INPUT_SCHEMA_V2,
    "Unsupported fair scoring input manifest schema",
  );
  const records = {};
  await Promise.all(
    [
      "baseInputs",
      "method",
      "fairness",
      ...(manifest.pins?.previous ? ["previous"] : []),
    ].map(async (key) => {
      records[key] = await readPinnedFile(manifest.pins?.[key]);
    }),
  );
  const errors = [];
  for (const [key, record] of Object.entries(records))
    if (!verified(record)) errors.push(`Exact ${key} hash/size pin invalid`);
  const strictMethodErrors = methodErrors(
    records.method?.value,
    records.fairness,
  );
  errors.push(...strictMethodErrors);
  requireValue(
    records.baseInputs?.value?.pins?.method?.sha256 ===
      records.method.actualSha256 &&
      records.baseInputs.value.pins.method.path === records.method.pin.path,
    "Original score manifest must use the exact same v2 method file",
  );
  const baseReport = await scoreRoundFiles(
    records.baseInputs.pin.path,
    records.baseInputs.actualSha256,
    {
      acceptedMethodSchema:
        strictMethodErrors.length === 0
          ? METHOD_SCHEMA_V2
          : "aperture.house-race-method.v1",
    },
  );
  records.dispatchFreeze = await readPinnedFile(
    records.baseInputs.value.pins.dispatchFreeze,
  );
  const trialRecords = await Promise.all(
    (Array.isArray(manifest.trials) ? manifest.trials : []).map(
      async (item) => ({
        engine: item.engine,
        trial: item.trial,
        declaration: await readPinnedFile(item.declaration),
        sourceAudit: await readPinnedFile(item.sourceAudit),
        observation: await readPinnedFile(item.observation),
      }),
    ),
  );
  for (const item of trialRecords) {
    await verifySourceEvidence(item, baseReport, errors);
    const trial = baseReport.raw?.summary?.engines?.[item.engine]?.trials?.find(
      (trial) => trial.trial === item.trial,
    );
    if (!trial) continue;
    const measurement = await readPinnedFile({
      path: resolve(trial.path, "measurement.json"),
      sha256: trial.hashes.measurement,
    });
    const renderer = await readPinnedFile({
      path: resolve(trial.path, "verified-runner.json"),
      sha256: trial.hashes.renderer,
    });
    if (
      !measurement.hashParity ||
      measurement.error ||
      !renderer.hashParity ||
      renderer.error
    ) {
      errors.push(
        `${item.engine}/${item.trial}: retained native observation inputs invalid`,
      );
      continue;
    }
    try {
      item.derivedObservation = buildFairnessObservationV2({
        contractSha256: records.fairness.actualSha256,
        sourceSha256: item.sourceAudit.value?.sourceSha256,
        buildSha256: item.sourceAudit.value?.buildSha256,
        trial,
        measurement: measurement.value,
        renderer: renderer.value,
      });
    } catch (error) {
      errors.push(
        `${item.engine}/${item.trial}: native observation cannot be verified: ${error.message}`,
      );
    }
  }
  const scorerSources = { ...(baseReport.scorerSources ?? {}) };
  for (const name of ["fair-score-v2.mjs", "fairness-v2.mjs"]) {
    const bytes = await readFile(
      resolve(dirname(fileURLToPath(import.meta.url)), name),
    );
    const key = "tools/agent-benchmark/" + name;
    scorerSources[key] = { sha256: sha256(bytes), bytes: bytes.length };
    const frozen = records.dispatchFreeze.value?.provenance?.inputs?.[key];
    if (
      !same(
        { sha256: frozen?.sha256, bytes: frozen?.bytes },
        scorerSources[key],
      )
    )
      errors.push(
        `Active v2 scorer source differs from pre-author freeze: ${name}`,
      );
  }
  const result = evaluateFairScoreV2({
    manifest,
    records,
    trialRecords,
    baseReport,
    scorerSha256: digest(scorerSources),
    evidenceErrors: errors,
  });
  result.inputsManifest = pinSummary(outer);
  result.scorerSources = scorerSources;
  return result;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const options = {};
    for (let index = 2; index < process.argv.length; index += 2) {
      const name = process.argv[index],
        value = process.argv[index + 1];
      requireValue(
        ["--inputs", "--inputs-sha256", "--output"].includes(name) &&
          nonempty(value) &&
          options[name] === undefined,
        "Unknown, duplicate or missing fair-score option",
      );
      options[name] = value;
    }
    requireValue(
      isAbsolute(options["--inputs"] ?? "") &&
        isAbsolute(options["--output"] ?? "") &&
        hash(options["--inputs-sha256"]),
      "Provide --inputs /absolute.json --inputs-sha256 EXACT_SHA --output /absolute/new.json",
    );
    const report = await scoreFairRoundFilesV2(
      options["--inputs"],
      options["--inputs-sha256"],
    );
    await writeImmutable(
      options["--output"],
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        status: report.status,
        output: options["--output"],
        meaningfulEdge: report.meaningfulEdge?.meaningfulEdge ?? false,
      }),
    );
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
