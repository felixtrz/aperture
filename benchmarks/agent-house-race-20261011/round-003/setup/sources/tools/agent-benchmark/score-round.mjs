import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTRACT,
  summarize,
  validateSample,
  validateWorkerEligibility,
} from "./contract.mjs";
import { validateTriangleArgumentProofV2 } from "./triangle-accounting-v2.mjs";
import { ARTIFACT_PROTOCOL_V2 } from "./protocol-v2.mjs";
import { componentScores } from "./summarize.mjs";
import { sha256, writeImmutable } from "./recorder.mjs";
import { inspectJudgeRecords } from "./score-quality.mjs";
import {
  describeRuntimeSpread,
  evaluateStableLead,
} from "./score-stability.mjs";

export const SCORE_SCHEMA = "aperture.house-race-score.v1";
export const INPUT_SCHEMA = "aperture.house-race-score-inputs.v1";
export const AUDIT_SCHEMA = "aperture.house-race-source-feature-audit.v1";
const engines = ["three", "aperture"];
const weights = {
  visual: 0.4,
  geometry: 0.2,
  runtime: 0.25,
  authoringTime: 0.15,
};
export const requiredFeatures = [
  "house",
  "roof",
  "chimney",
  "windows",
  "porch",
  "path",
  "boundary",
  "garden",
  "mailbox",
  "curvedRoad",
  "curbs",
  "markings",
  "blueCar",
  "fourWheels",
];
export const sourceChecks = [
  "independentSemanticSourceReview",
  "authoredGeometryMatchesRenderedScene",
  "positionsIndicesNormalsAndWorldTransformsReviewed",
  "supportedSubmittedGeometry",
  "coherentThreeViews",
  "noImageBillboard",
  "noRuntimeOrHarnessTampering",
  "reviewedSdkMatchesBuiltDependencies",
];
export const apertureChecks = [
  "normalSimulationWorkerInUse",
  "simulationEcsAuthoritative",
  "ecsExtractionRunsInWorker",
  "rendererConsumesNormalWorkerSnapshots",
  "noDummyWorker",
];
const stable = (value) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
const hashObject = (value) =>
  value === undefined ? null : sha256(Buffer.from(stable(value)));
const nonempty = (value) =>
  typeof value === "string" && value.trim().length > 0;
const reviewedReasons = (value) =>
  Array.isArray(value) && value.length > 0 && value.every(nonempty);
const reason = (list, message) => list.push(message);
const trialFiles = {
  outcome: "outcome.json",
  inputs: "inputs.json",
  receipts: "receipts.json",
  measurement: "measurement.json",
  renderer: "verified-runner.json",
  geometry: "geometry.json",
};

export function trialEvidenceFiles(trial) {
  const protocol =
    trial.artifactProtocol ?? "aperture.agent-house-artifacts.v1";
  if (
    protocol !== "aperture.agent-house-artifacts.v1" &&
    protocol !== ARTIFACT_PROTOCOL_V2.schema
  )
    throw new Error("Unknown trial artifact protocol");
  return {
    ...trialFiles,
    geometry:
      protocol === ARTIFACT_PROTOCOL_V2.schema
        ? ARTIFACT_PROTOCOL_V2.geometryManifest
        : trialFiles.geometry,
  };
}

export async function readPinnedFile(pin, asJson = true) {
  const record = { pin, hashParity: false, value: null, error: null };
  try {
    if (
      !pin ||
      !isAbsolute(pin.path) ||
      !/^[a-f0-9]{64}$/.test(pin.sha256) ||
      !(
        pin.bytes === undefined ||
        (Number.isSafeInteger(pin.bytes) && pin.bytes >= 0)
      )
    )
      throw new Error("Absolute path and exact SHA-256/size pin required");
    const stat = await lstat(pin.path);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size > 128 * 1024 * 1024 ||
      (await realpath(pin.path)) !== resolve(pin.path)
    )
      throw new Error(
        "Pinned evidence must be a bounded canonical regular file without symlinks",
      );
    const bytes = await readFile(pin.path);
    record.actualSha256 = sha256(bytes);
    record.actualBytes = bytes.length;
    record.hashParity =
      record.actualSha256 === pin.sha256 &&
      (pin.bytes === undefined || pin.bytes === bytes.length);
    if (asJson) record.value = JSON.parse(bytes.toString("utf8"));
    if (!record.hashParity)
      record.error =
        "Pinned input hash or size differs; parsed values are untrusted and cannot be scored";
  } catch (error) {
    record.error = error.message;
  }
  return record;
}

function checkSummary(summary, method, reasons) {
  if (
    summary?.schema !== "aperture.agent-house-summary.v1" ||
    summary.status !== "validated-components-pending-independent-judging" ||
    summary.validationErrors?.length !== 0
  )
    reason(
      reasons,
      "Validated complete summarize.mjs output is required; failed/incomplete trials cannot receive score substitutions",
    );
  if (stable(summary?.method) !== stable(method))
    reason(reasons, "Summary method differs from pinned method");
  for (const engine of engines) {
    const entry = summary?.engines?.[engine];
    if (
      entry?.trials?.length !== 3 ||
      entry.author?.status !== "validated-source-and-time"
    ) {
      reason(
        reasons,
        `${engine}: three successful trials and validated authentic author evidence required`,
      );
      continue;
    }
    if (
      !Number.isFinite(entry.author.authorActiveSeconds) ||
      entry.author.authorActiveSeconds <= 0
    )
      reason(reasons, `${engine}: positive active author duration required`);
    for (const [index, trial] of entry.trials.entries()) {
      try {
        if (
          (trial.artifactProtocol ?? "aperture.agent-house-artifacts.v1") !==
          (summary.artifactProtocol ?? "aperture.agent-house-artifacts.v1")
        )
          throw new Error("Mixed trial/summary artifact protocols");
        if (
          trial.status !== "validated" ||
          trial.engine !== engine ||
          trial.trial !== index + 1 ||
          trial.path !==
            resolve(
              summary.roundRoot,
              "trials",
              engine,
              `trial-${String(index + 1).padStart(2, "0")}`,
            ) ||
          trial.samples?.length !== CONTRACT.measuredFrames ||
          trial.warmupSamples?.length !== CONTRACT.warmupFrames
        )
          throw new Error(
            "Successful exact fresh-round full-frame trial inventory required",
          );
        if (
          !/^[a-f0-9]{64}$/.test(trial.geometry?.semanticGeometrySha256 ?? "")
        )
          throw new Error(
            "Additive semantic geometry/transform digest is required",
          );
        if (trial.artifactProtocol === ARTIFACT_PROTOCOL_V2.schema)
          validateTriangleArgumentProofV2({
            warmup: trial.warmupSamples,
            samples: trial.samples,
            views: [],
            nativeIndirectArgumentProof: trial.nativeIndirectArgumentProof,
          });
        for (const [frame, sample] of [
          ...trial.warmupSamples,
          ...trial.samples,
        ].entries()) {
          validateSample(sample);
          if (
            sample.frame !== frame ||
            !Number.isInteger(sample.submittedTriangles) ||
            sample.submittedTriangles <= 0
          )
            throw new Error(
              "Missing ordered frame or attributable submitted triangle geometry",
            );
          if (
            (sample.indirectDrawCalls > 0 &&
              !(
                trial.artifactProtocol === ARTIFACT_PROTOCOL_V2.schema &&
                sample.unknownIndirectDrawCalls === 0 &&
                sample.knownIndirectDrawCalls === sample.indirectDrawCalls
              )) ||
            sample.unknownDirectTriangleDrawCalls > 0 ||
            sample.unknownTopologyDrawCalls > 0
          )
            throw new Error(
              "Submitted geometry accounting is unsupported for observed indirect/unknown-topology draws",
            );
        }
        for (const key of [
          "cpuSubmissionMs",
          "applicationPromiseMs",
          "queueCompletionLatencyMs",
          "endToEndMs",
        ])
          if (
            stable(trial.timing[key]) !==
            stable(summarize(trial.samples.map((sample) => sample[key])))
          )
            throw new Error(
              "Timing statistics differ from all retained samples",
            );
        if (
          stable(trial.workerEligibility) !==
          stable(
            validateWorkerEligibility(
              engine,
              trial.resources.before,
              trial.resources.after,
            ),
          )
        )
          throw new Error("Observed worker eligibility differs");
        if (
          trial.captures?.length !== 3 ||
          trial.captures.some(
            (capture, index) =>
              stable(capture.camera) !== stable(CONTRACT.views[index]),
          )
        )
          throw new Error("Fixed coherent capture inventory differs");
        if (
          stable(trial.appInputs) !== stable(entry.trials[0].appInputs) ||
          stable(trial.harnessInputs) !==
            stable(entry.trials[0].harnessInputs) ||
          stable(trial.geometry) !== stable(entry.trials[0].geometry)
        )
          throw new Error("Inputs/geometry changed across serial trials");
      } catch (error) {
        reason(reasons, `${engine}/trial-${index + 1}: ${error.message}`);
      }
    }
  }
  let candidates = null;
  try {
    candidates = componentScores(summary.engines, method);
    for (const engine of engines)
      for (const key of ["runtime", "authoringTime"])
        if (
          !Number.isFinite(summary.scores?.[engine]?.[key]) ||
          Math.abs(summary.scores[engine][key] - candidates[engine][key]) > 1e-9
        )
          throw new Error(
            "Summarizer runtime/time score differs from frozen formula",
          );
  } catch (error) {
    reason(reasons, error.message);
  }
  return candidates;
}

function checkSourceAudit(audit, summary, identities, reasons) {
  if (
    audit?.schema !== AUDIT_SCHEMA ||
    audit.status !== "reviewed" ||
    audit.reviewer?.independentOfAuthors !== true ||
    !nonempty(audit.reviewer?.id) ||
    !Number.isFinite(Date.parse(audit.reviewer?.reviewedAt)) ||
    !reviewedReasons(audit.reviewer?.reasons)
  )
    reason(
      reasons,
      "Independent semantic source/feature audit is pending or rejected",
    );
  const protocol = audit?.protocol;
  if (
    protocol?.status !== "valid" ||
    !Array.isArray(protocol.incidents) ||
    protocol.incidents.length !== 0 ||
    !reviewedReasons(protocol?.reasons)
  )
    reason(
      reasons,
      "Protocol eligibility is pending/invalid; incident-affected rounds remain exploratory",
    );
  for (const key of [
    "freshIndependentAuthors",
    "noInheritedAuthorContext",
    "noPeerContact",
    "sameFrozenReferenceContractRubric",
    "samePreviewAndBudgetPolicy",
    "noMidRoundControlChanges",
    "noAuthorEditsDuringTrials",
  ])
    if (protocol?.[key] !== true)
      reason(reasons, `Protocol review incomplete: ${key}`);
  const authorIds = Object.values(protocol?.authorIds ?? {});
  if (
    authorIds.length !== 2 ||
    new Set(authorIds).size !== 2 ||
    engines.some((engine) => !nonempty(protocol?.authorIds?.[engine]))
  )
    reason(reasons, "Two distinct fresh author identities required");
  if (authorIds.includes(audit?.reviewer?.id))
    reason(reasons, "The semantic reviewer cannot be either author");
  const perEngine = {};
  for (const engine of engines) {
    const errors = [],
      entry = audit?.engines?.[engine],
      author = summary?.engines?.[engine]?.author,
      trials = summary?.engines?.[engine]?.trials ?? [];
    if (entry?.status !== "reviewed" || !reviewedReasons(entry.reasons))
      reason(errors, "Engine source/feature review is pending or rejected");
    if (
      entry?.finishSha256 !== author?.finishSha256 ||
      entry?.authorAuditSha256 !== author?.auditSha256 ||
      entry?.sourceInventorySha256 !== hashObject(author?.audit?.sourceFiles)
    )
      reason(
        errors,
        "Reviewed source inventory/finish/audit does not join validated author evidence",
      );
    for (const key of [
      ...sourceChecks,
      ...(engine === "aperture" ? apertureChecks : []),
    ])
      if (entry?.checks?.[key] !== true)
        reason(errors, `Semantic source check incomplete: ${key}`);
    for (const feature of requiredFeatures)
      if (entry?.features?.[feature] !== "present")
        reason(errors, `Required feature missing or uncertain: ${feature}`);
    if (
      stable(entry?.trialJoins) !==
      stable(
        trials.map((trial) => ({ trial: trial.trial, hashes: trial.hashes })),
      )
    )
      reason(
        errors,
        "Source review is not joined to every exact trial/geometry/measurement manifest",
      );
    if (stable(entry?.appInputs) !== stable(trials[0]?.appInputs))
      reason(errors, "Source review built bytes differ from actual served app");
    const needed = (
      Array.isArray(author?.audit?.sourceFiles) ? author.audit.sourceFiles : []
    ).filter(
      (file) =>
        file.path.startsWith("src/") ||
        ["index.html", "package.json", "pnpm-lock.yaml"].includes(file.path) ||
        /^vite\.config\./.test(file.path),
    );
    for (const source of needed)
      if (
        !(
          Array.isArray(entry?.reviewedSourceFiles)
            ? entry.reviewedSourceFiles
            : []
        ).some(
          (file) =>
            file.path === source.path &&
            file.sha256 === source.sha256 &&
            file.bytes === source.bytes &&
            file.reviewed === true,
        )
      )
        reason(
          errors,
          `Semantic review missing exact authored source file: ${source.path}`,
        );
    if (
      !Array.isArray(entry?.reviewedDependencyFiles) ||
      entry.reviewedDependencyFiles.length === 0 ||
      entry.reviewedDependencyFiles.some((file) => file.reviewed !== true)
    )
      reason(
        errors,
        "Pinned independent SDK/dependency source review required; uploaded positions cannot establish ECS/renderer parity",
      );
    perEngine[engine] = {
      eligible: errors.length === 0,
      reasons: errors,
      review: entry ?? null,
    };
    reasons.push(...errors.map((error) => `${engine}: ${error}`));
  }
  for (const key of [
    "roundId",
    "summarySha256",
    "methodSha256",
    "referenceSha256",
    "dispatchFreezeSha256",
    "controlSha256",
  ])
    if (audit?.[key] !== identities[key])
      reason(reasons, `Source review ${key} pin differs`);
  return perEngine;
}

export function evaluateRound({
  manifest,
  records,
  evidenceErrors = [],
  scorerSha256,
}) {
  const reasons = [...evidenceErrors],
    summary = records.summary?.value,
    method = records.method?.value,
    map = records.caseMap?.value,
    audit = records.sourceAudit?.value;
  const identities = {
    roundId: manifest.roundId,
    summarySha256: records.summary?.actualSha256,
    methodSha256: records.method?.actualSha256,
    referenceSha256: records.reference?.actualSha256,
    dispatchFreezeSha256: records.dispatchFreeze?.actualSha256,
    controlSha256: hashObject(
      summary?.engines?.three?.trials?.[0]?.harnessInputs,
    ),
  };
  const report = {
    schema: SCORE_SCHEMA,
    recordedAt: new Date().toISOString(),
    roundId: manifest.roundId,
    roundOrdinal: manifest.roundOrdinal,
    ...identities,
    scorerSha256,
    status: "scores-withheld",
    eligibilityReasons: reasons,
    weights: method?.weights ?? null,
    engines: {},
    apertureCombinedMargin: null,
    freshness: {
      authorIds: audit?.protocol?.authorIds ?? {},
      judgeIds: (records.judges ?? []).map((record) => record.value?.judgeId),
    },
    runtimeSpread: describeRuntimeSpread(summary),
    runtimeInterpretation: audit?.runtimeInterpretation ?? null,
    sourceReview: audit ?? null,
    raw: {
      summary: summary ?? null,
      judges: (records.judges ?? []).map((record) => record.value),
      caseMap: map ?? null,
    },
    inputs: Object.fromEntries(
      Object.entries(records)
        .filter(([key]) => key !== "judges")
        .map(([key, record]) => [
          key,
          {
            pin: record.pin,
            actualSha256: record.actualSha256,
            actualBytes: record.actualBytes,
            hashParity: record.hashParity,
            error: record.error,
          },
        ]),
    ),
    judgeInputs: (records.judges ?? []).map((record) => ({
      pin: record.pin,
      actualSha256: record.actualSha256,
      hashParity: record.hashParity,
      error: record.error,
    })),
    limitations: [
      "This score joins exact independently validated evidence; it is not a new browser attestation.",
      "Native position-upload correlation alone does not prove authored ECS/extraction/index/normal/world-transform semantics. Independent pinned source review is required.",
      "Serial CPU SwiftShader durations and spread are not physical GPU measurements or a statistical significance test.",
    ],
  };
  for (const record of [
    ...Object.values(records).filter((record) => !Array.isArray(record)),
    ...(records.judges ?? []),
  ])
    if (!record?.hashParity || record.error)
      reason(
        reasons,
        `Input integrity invalid: ${record?.pin?.path ?? "missing pin"}: ${record?.error ?? "hash parity missing"}`,
      );
  if (
    !Number.isInteger(manifest.roundOrdinal) ||
    manifest.roundOrdinal < 1 ||
    manifest.roundId !==
      `round-${String(manifest.roundOrdinal).padStart(3, "0")}` ||
    !summary?.roundRoot?.endsWith("/" + manifest.roundId)
  )
    reason(
      reasons,
      "Explicit fresh round identity/ordinal differs from summary",
    );
  if (
    method?.schema !== "aperture.house-race-method.v1" ||
    stable(method.weights) !== stable(weights) ||
    method.trialsPerEngine !== 3
  )
    reason(
      reasons,
      "Frozen method schema/weights/trial count unsupported; weights must remain 0.4/0.2/0.25/0.15",
    );
  if (
    summary?.methodSha256 !== identities.methodSha256 ||
    summary?.dispatchFreezeSha256 !== identities.dispatchFreezeSha256 ||
    method?.referenceSha256 !== identities.referenceSha256
  )
    reason(reasons, "Method/reference/dispatch hash joins differ");
  const frozenFiles = records.dispatchFreeze?.value?.files ?? {};
  if (
    !Object.entries(frozenFiles).some(
      ([path, pin]) =>
        path.endsWith("/method.json") && pin.sha256 === identities.methodSha256,
    ) ||
    !Object.entries(frozenFiles).some(
      ([path, pin]) =>
        path.endsWith("/reference.png") &&
        pin.sha256 === identities.referenceSha256,
    )
  )
    reason(reasons, "Method/reference pins are absent from dispatch freeze");
  const candidates = checkSummary(summary, method, reasons);
  const cases = (Array.isArray(map?.cases) ? map.cases : []).filter(
      (entry) => entry && typeof entry === "object",
    ),
    caseIds = cases.map((entry) => entry.case);
  if (
    map?.schema !== "aperture.house-race-case-map.v1" ||
    cases.length !== 2 ||
    new Set(caseIds).size !== 2 ||
    new Set(cases.map((entry) => entry.engine)).size !== 2 ||
    engines.some((engine) => !cases.some((entry) => entry.engine === engine)) ||
    caseIds.some(
      (id) => !/^case-[A-Za-z0-9_-]+$/.test(id) || /aperture|three/i.test(id),
    )
  )
    reason(
      reasons,
      "Exactly two opaque case IDs mapped once to both engines are required",
    );
  for (const key of [
    "roundId",
    "summarySha256",
    "methodSha256",
    "referenceSha256",
    "dispatchFreezeSha256",
  ])
    if (map?.[key] !== identities[key])
      reason(reasons, `Opaque mapping ${key} pin differs`);
  if (cases.some((entry) => entry.captureTrial !== 1))
    reason(
      reasons,
      "Both blinded cases must use preselected trial-01 captures; flattering trial selection is refused",
    );
  const quality = inspectJudgeRecords(
    (records.judges ?? []).map((record) => record.value),
    caseIds,
  );
  reasons.push(...quality.errors);
  const sourceEligibility = checkSourceAudit(
    audit,
    summary,
    identities,
    reasons,
  );
  for (const record of records.judges ?? []) {
    const judge = record.value,
      receipt = audit?.judgeInputs?.find(
        (input) => input.judgeId === judge?.judgeId,
      );
    if (
      receipt?.recordSha256 !== record.actualSha256 ||
      receipt?.referenceSha256 !== identities.referenceSha256 ||
      !reviewedReasons(receipt?.reasons)
    )
      reason(
        reasons,
        `Judge ${judge?.judgeId}: original record/reference input receipt missing`,
      );
    if (
      Object.values(audit?.protocol?.authorIds ?? {}).includes(judge?.judgeId)
    )
      reason(reasons, `Judge ${judge?.judgeId} cannot be either author`);
    for (const key of [
      "freshIndependentJudge",
      "noInheritedContext",
      "engineIdentityHidden",
      "timingsHidden",
      "transcriptsHidden",
      "caseMapHidden",
      "frozenRubricUsed",
    ])
      if (receipt?.[key] !== true)
        reason(
          reasons,
          `Judge ${judge?.judgeId}: blinded input review incomplete: ${key}`,
        );
    const viewed = cases.flatMap((entry) =>
      Array.isArray(entry.views)
        ? entry.views.map((view) => ({
            case: entry.case,
            id: view?.id,
            sha256: view?.pin?.sha256,
          }))
        : [],
    );
    if (stable(receipt?.viewedImages) !== stable(viewed))
      reason(
        reasons,
        `Judge ${judge?.judgeId}: did not receive the exact same fresh three views per case`,
      );
  }
  for (const engine of engines) {
    const entry = cases.find((entry) => entry.engine === engine),
      raw = quality.qualityByCase?.[entry?.case],
      errors = [...(sourceEligibility[engine]?.reasons ?? [])];
    if (!raw)
      reason(errors, "Independent quality values are unavailable or malformed");
    else {
      if (raw.visualMean < 6 || raw.geometryMean < 6)
        reason(
          errors,
          "Both visual and geometry means must meet frozen >=6 quality floor",
        );
      if (raw.missingRequiredFeatures.length)
        reason(errors, "A judge reports missing required scene features");
    }
    reasons.push(
      ...errors
        .filter(
          (error) =>
            !(sourceEligibility[engine]?.reasons ?? []).includes(error),
        )
        .map((error) => `${engine}: ${error}`),
    );
    report.engines[engine] = {
      case: entry?.case ?? null,
      eligible: errors.length === 0,
      reasons: errors,
      rawQualityMeans: raw
        ? { visual: raw.visualMean, geometry: raw.geometryMean }
        : null,
      qualityDisagreement: raw?.disagreement ?? null,
      originalJudgeValues: raw?.judgeValues ?? null,
      scores: null,
    };
  }
  if (reasons.length === 0 && candidates && quality.valid) {
    report.status = "eligible-scored";
    for (const engine of engines) {
      const entry = report.engines[engine],
        raw = entry.rawQualityMeans;
      entry.scores = {
        visual: raw.visual,
        geometry: raw.geometry,
        runtime: candidates[engine].runtime,
        authoringTime: candidates[engine].authoringTime,
      };
      entry.scores.combined = Object.entries(weights).reduce(
        (sum, [key, weight]) => sum + entry.scores[key] * weight,
        0,
      );
    }
    report.apertureCombinedMargin =
      report.engines.aperture.scores.combined -
      report.engines.three.scores.combined;
  }
  for (const engine of engines) {
    report.engines[engine].sourceAndQualityEligible =
      report.engines[engine].eligible;
    if (report.status !== "eligible-scored")
      report.engines[engine].eligible = false;
  }
  report.stableLead = evaluateStableLead(
    report,
    records.previous?.value,
    audit?.qualityRegressionReview,
    records.previous?.actualSha256,
  );
  return report;
}

export function sourceAuditTemplate(manifest, records) {
  const summary = records.summary.value;
  return {
    schema: AUDIT_SCHEMA,
    status: "pending",
    roundId: manifest.roundId,
    summarySha256: records.summary.actualSha256,
    methodSha256: records.method.actualSha256,
    referenceSha256: records.reference.actualSha256,
    dispatchFreezeSha256: records.dispatchFreeze.actualSha256,
    controlSha256: hashObject(summary.engines.three.trials[0].harnessInputs),
    reviewer: {
      id: "",
      independentOfAuthors: false,
      reviewedAt: null,
      reasons: [],
    },
    protocol: {
      status: "pending",
      incidents: [],
      reasons: [],
      authorIds: { three: "", aperture: "" },
      freshIndependentAuthors: null,
      noInheritedAuthorContext: null,
      noPeerContact: null,
      sameFrozenReferenceContractRubric: null,
      samePreviewAndBudgetPolicy: null,
      noMidRoundControlChanges: null,
      noAuthorEditsDuringTrials: null,
    },
    engines: Object.fromEntries(
      engines.map((engine) => {
        const author = summary.engines[engine].author,
          trials = summary.engines[engine].trials;
        return [
          engine,
          {
            status: "pending",
            reasons: [],
            finishSha256: author.finishSha256,
            authorAuditSha256: author.auditSha256,
            sourceInventorySha256: hashObject(author.audit.sourceFiles),
            appInputs: trials[0].appInputs,
            trialJoins: trials.map((trial) => ({
              trial: trial.trial,
              hashes: trial.hashes,
            })),
            checks: Object.fromEntries(
              [
                ...sourceChecks,
                ...(engine === "aperture" ? apertureChecks : []),
              ].map((key) => [key, null]),
            ),
            features: Object.fromEntries(
              requiredFeatures.map((key) => [key, "uncertain"]),
            ),
            reviewedSourceFiles: author.audit.sourceFiles
              .filter(
                (file) =>
                  file.path.startsWith("src/") ||
                  ["index.html", "package.json", "pnpm-lock.yaml"].includes(
                    file.path,
                  ) ||
                  /^vite\.config\./.test(file.path),
              )
              .map((file) => ({ ...file, reviewed: false })),
            reviewedDependencyFiles: [],
          },
        ];
      }),
    ),
    judgeInputs: (records.judges ?? []).map((record) => ({
      judgeId: record.value.judgeId,
      recordSha256: record.actualSha256,
      referenceSha256: records.reference.actualSha256,
      viewedImages: records.caseMap.value.cases.flatMap((entry) =>
        entry.views.map((view) => ({
          case: entry.case,
          id: view.id,
          sha256: view.pin.sha256,
        })),
      ),
      freshIndependentJudge: null,
      noInheritedContext: null,
      engineIdentityHidden: null,
      timingsHidden: null,
      transcriptsHidden: null,
      caseMapHidden: null,
      frozenRubricUsed: null,
      reasons: [],
    })),
    runtimeInterpretation: {
      status: "pending",
      summarySha256: records.summary.actualSha256,
      reviewerId: "",
      reasons: [],
    },
    qualityRegressionReview: {
      status: "pending",
      previousScoreSha256: records.previous?.actualSha256 ?? null,
      reviewerId: "",
      independentOfAuthors: false,
      noMaterialQualityRegression: { three: null, aperture: null },
      reasons: [],
    },
  };
}

async function verifyJoins(records, errors) {
  const summary = records.summary?.value,
    map = records.caseMap?.value,
    audit = records.sourceAudit?.value;
  for (const engine of engines)
    for (const trial of summary?.engines?.[engine]?.trials ?? [])
      if (trial.status === "validated") {
        if (typeof trial.path !== "string" || !isAbsolute(trial.path)) {
          reason(
            errors,
            `${engine}/trial-${trial.trial}: absolute retained trial path required`,
          );
          continue;
        }
        let evidenceFiles;
        try {
          evidenceFiles = trialEvidenceFiles(trial);
        } catch (error) {
          reason(errors, error.message);
          continue;
        }
        for (const [key, file] of Object.entries(evidenceFiles)) {
          const checked = await readPinnedFile(
            { path: resolve(trial.path, file), sha256: trial.hashes?.[key] },
            false,
          );
          if (!checked.hashParity || checked.error)
            reason(
              errors,
              `${engine}/trial-${trial.trial} ${key}: ${checked.error ?? "hash join invalid"}`,
            );
        }
      }
  for (const entry of map?.cases ?? []) {
    const trial = summary?.engines?.[entry.engine]?.trials?.find(
      (trial) => trial.trial === entry.captureTrial,
    );
    if (!trial || entry.views?.length !== 3) {
      reason(
        errors,
        `${entry.case}: selected validated three-view capture missing`,
      );
      continue;
    }
    for (const [index, view] of entry.views.entries()) {
      const expected = trial.captures[index],
        checked = await readPinnedFile(view?.pin, false);
      if (
        view.id !== CONTRACT.views[index]?.id ||
        stable(expected?.camera) !== stable(CONTRACT.views[index]) ||
        checked.actualSha256 !== expected?.screenshot?.sha256 ||
        view.pin?.bytes !== expected?.screenshot?.bytes ||
        !checked.hashParity ||
        checked.error
      )
        reason(
          errors,
          `${entry.case}/${view.id}: fresh camera image does not join exact trial capture`,
        );
    }
  }
  for (const engine of engines) {
    const author = summary?.engines?.[engine]?.author,
      review = audit?.engines?.[engine];
    for (const file of review?.reviewedSourceFiles ?? []) {
      if (
        typeof file.path !== "string" ||
        isAbsolute(file.path) ||
        file.path
          .split("/")
          .some((part) => !part || part === "." || part === "..") ||
        typeof author?.auditRoot !== "string"
      ) {
        reason(errors, `${engine}: invalid reviewed source relative path`);
        continue;
      }
      const actual = await readPinnedFile(
        { ...file, path: resolve(author.auditRoot, "source", file.path) },
        false,
      );
      if (!actual.hashParity || actual.error)
        reason(
          errors,
          `${engine}: reviewed source bytes changed: ${file.path}`,
        );
    }
    for (const file of review?.reviewedDependencyFiles ?? []) {
      const actual = await readPinnedFile(file, false);
      if (!actual.hashParity || actual.error)
        reason(
          errors,
          `${engine}: dependency source bytes changed: ${file.path}`,
        );
    }
  }
  if (summary?.roundRoot) {
    try {
      const incidentPath = resolve(summary.roundRoot, "protocol-incident.json"),
        stat = await lstat(incidentPath);
      if (stat.isFile())
        reason(
          errors,
          "Retained protocol-incident.json makes this round exploratory/ineligible; incidents cannot be discarded for scoring",
        );
    } catch (error) {
      if (error.code !== "ENOENT")
        reason(
          errors,
          `Protocol incident inventory inaccessible: ${error.message}`,
        );
    }
  }
}

export async function scoreRoundFiles(
  manifestPath,
  expectedInputsSha256,
  { template = false } = {},
) {
  const outer = await readPinnedFile({
    path: manifestPath,
    sha256: expectedInputsSha256,
  });
  if (!outer.hashParity || outer.error)
    return {
      schema: SCORE_SCHEMA,
      status: "scores-withheld",
      eligibilityReasons: [
        `Scoring input manifest integrity invalid: ${outer.error}`,
      ],
      inputsManifest: outer,
      engines: { three: { scores: null }, aperture: { scores: null } },
      stableLead: {
        stableBenchmarkLead: false,
        universalSuperiorityClaim: false,
      },
    };
  const manifest = outer.value,
    errors = [];
  if (manifest.schema !== INPUT_SCHEMA)
    throw new Error("Unsupported scoring input manifest schema");
  const records = {};
  for (const key of [
    "summary",
    "method",
    "reference",
    "dispatchFreeze",
    "caseMap",
    ...(template ? [] : ["sourceAudit"]),
    ...(manifest.pins?.previous ? ["previous"] : []),
  ])
    records[key] = await readPinnedFile(
      manifest.pins?.[key],
      key !== "reference",
    );
  records.judges = await Promise.all(
    (Array.isArray(manifest.pins?.judges) ? manifest.pins.judges : []).map(
      (pin) => readPinnedFile(pin),
    ),
  );
  if (template) {
    if (
      [
        ...Object.values(records).filter((value) => !Array.isArray(value)),
        ...records.judges,
      ].some((value) => !value.hashParity || value.error)
    )
      throw new Error(
        "Verified pinned inputs are required before preparing a source audit template",
      );
    return sourceAuditTemplate(manifest, records);
  }
  const scorerPins = {};
  for (const name of [
    "score-round.mjs",
    "score-quality.mjs",
    "score-stability.mjs",
    "summarize.mjs",
    "contract.mjs",
    "recorder.mjs",
    "triangle-accounting-v2.mjs",
    "protocol-v2.mjs",
    "geometry-codec-v2.mjs",
    "geometry-data-v2.mjs",
    "geometry-evidence-v2.mjs",
    "position-parity-v2.mjs",
  ]) {
    const bytes = await readFile(
        resolve(dirname(fileURLToPath(import.meta.url)), name),
      ),
      key = "tools/agent-benchmark/" + name;
    scorerPins[key] = { sha256: sha256(bytes), bytes: bytes.length };
    const frozen = records.dispatchFreeze?.value?.provenance?.inputs?.[key];
    if (
      frozen?.sha256 !== scorerPins[key].sha256 ||
      frozen?.bytes !== bytes.length
    )
      reason(
        errors,
        `Active scoring source differs from dispatch freeze: ${name}`,
      );
  }
  await verifyJoins(records, errors);
  const result = evaluateRound({
    manifest,
    records,
    evidenceErrors: errors,
    scorerSha256: hashObject(scorerPins),
  });
  result.inputsManifest = {
    pin: outer.pin,
    actualSha256: outer.actualSha256,
    actualBytes: outer.actualBytes,
    hashParity: true,
  };
  result.scorerSources = scorerPins;
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
      if (
        !["--inputs", "--inputs-sha256", "--output", "--mode"].includes(name) ||
        !value ||
        options[name] !== undefined
      )
        throw new Error("Unknown, duplicate or missing score option");
      options[name] = value;
    }
    if (
      !isAbsolute(options["--inputs"] ?? "") ||
      !isAbsolute(options["--output"] ?? "") ||
      !/^[a-f0-9]{64}$/.test(options["--inputs-sha256"] ?? "") ||
      ![undefined, "score", "template"].includes(options["--mode"])
    )
      throw new Error(
        "Provide --inputs /absolute.json --inputs-sha256 EXACT_SHA --output /absolute/new.json [--mode template]",
      );
    const result = await scoreRoundFiles(
      options["--inputs"],
      options["--inputs-sha256"],
      { template: options["--mode"] === "template" },
    );
    await writeImmutable(
      options["--output"],
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        status: result.status,
        output: options["--output"],
        stableBenchmarkLead: result.stableLead?.stableBenchmarkLead ?? false,
      }),
    );
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
