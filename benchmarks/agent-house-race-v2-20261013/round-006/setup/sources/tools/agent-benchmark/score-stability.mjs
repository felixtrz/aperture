export function describeRuntimeSpread(summary) {
  return Object.fromEntries(
    ["three", "aperture"].map((engine) => {
      const entry = summary?.engines?.[engine],
        medians =
          entry?.trials?.map((trial) => trial.timing?.endToEndMs?.median) ?? [],
        p95 =
          entry?.trials?.map((trial) => trial.timing?.endToEndMs?.p95) ?? [];
      const valid =
        medians.length === 3 &&
        p95.length === 3 &&
        [...medians, ...p95].every(
          (value) => Number.isFinite(value) && value > 0,
        );
      return [
        engine,
        {
          trialMedians: medians,
          trialP95: p95,
          medianRange: valid
            ? [Math.min(...medians), Math.max(...medians)]
            : null,
          p95Range: valid ? [Math.min(...p95), Math.max(...p95)] : null,
          interpretation:
            "Observed serial CPU SwiftShader spread; not a significance test or physical-GPU claim",
        },
      ];
    }),
  );
}

export function evaluateStableLead(current, previous, review, previousSha256) {
  const reasons = [];
  if (!previous)
    return {
      status: "pending-second-successive-eligible-pair",
      stableBenchmarkLead: false,
      reasons: ["A single pair remains exploratory"],
      universalSuperiorityClaim: false,
    };
  if (
    current.status !== "eligible-scored" ||
    previous.status !== "eligible-scored"
  )
    reasons.push("Both successive pairs must be fully eligible and scored");
  if (previous.roundOrdinal !== current.roundOrdinal - 1)
    reasons.push(
      "Rounds are not successive; an invalid or omitted pair cannot be skipped",
    );
  if (previous.summarySha256 === current.summarySha256)
    reasons.push("Two pairs require distinct fresh summary evidence");
  for (const key of [
    "methodSha256",
    "referenceSha256",
    "controlSha256",
    "scorerSha256",
  ])
    if (current[key] !== previous[key])
      reasons.push(`Frozen ${key} differs across pairs`);
  const currentAuthors = Object.values(current.freshness?.authorIds ?? {}),
    priorAuthors = Object.values(previous.freshness?.authorIds ?? {}),
    judges = [
      ...(current.freshness?.judgeIds ?? []),
      ...(previous.freshness?.judgeIds ?? []),
    ];
  if (
    currentAuthors.length !== 2 ||
    priorAuthors.length !== 2 ||
    new Set([...currentAuthors, ...priorAuthors]).size !== 4
  )
    reasons.push(
      "Successive pairs require four distinct fresh independent authors",
    );
  if (judges.length !== 4 || new Set(judges).size !== 4)
    reasons.push(
      "Successive pairs require four distinct fresh independent judges",
    );
  for (const round of [previous, current]) {
    if (
      !Number.isFinite(round.apertureCombinedMargin) ||
      round.apertureCombinedMargin < 0.25
    )
      reasons.push(
        `${round.roundId}: Aperture combined margin is below frozen 0.25`,
      );
    for (const engine of ["three", "aperture"])
      if (
        !(
          round.engines?.[engine]?.scores?.visual >= 6 &&
          round.engines?.[engine]?.scores?.geometry >= 6
        )
      )
        reasons.push(`${round.roundId}/${engine}: quality floor not met`);
    if (
      round.runtimeInterpretation?.status !== "reviewed" ||
      round.runtimeInterpretation.summarySha256 !== round.summarySha256 ||
      !round.runtimeInterpretation.reviewerId ||
      round.runtimeInterpretation.independentOfAuthors !== true ||
      !Array.isArray(round.runtimeInterpretation.reasons) ||
      !round.runtimeInterpretation.reasons.length
    )
      reasons.push(
        `${round.roundId}: exact runtime spread interpretation requires explicit independent review`,
      );
  }
  const difference = (a, b) =>
    Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
  const qualityDifferences = Object.fromEntries(
    ["three", "aperture"].map((engine) => [
      engine,
      {
        visual: difference(
          current.engines?.[engine]?.rawQualityMeans?.visual,
          previous.engines?.[engine]?.rawQualityMeans?.visual,
        ),
        geometry: difference(
          current.engines?.[engine]?.rawQualityMeans?.geometry,
          previous.engines?.[engine]?.rawQualityMeans?.geometry,
        ),
      },
    ]),
  );
  if (
    review?.status !== "reviewed" ||
    review.previousScoreSha256 !== previousSha256 ||
    review.independentOfAuthors !== true ||
    !review.reviewerId ||
    !review.reasons?.length
  )
    reasons.push(
      "Material quality regression review is pending or is not joined to the exact preceding score",
    );
  if (
    ["three", "aperture"].some(
      (engine) => review?.noMaterialQualityRegression?.[engine] !== true,
    )
  )
    reasons.push(
      "Both engines need an explicit no-material-quality-regression review; no numeric threshold is invented",
    );
  return {
    status: reasons.length
      ? "stable-lead-not-established"
      : "stable-benchmark-lead-established",
    stableBenchmarkLead: reasons.length === 0,
    reasons,
    comparedRounds: [previous.roundId, current.roundId],
    precedingScoreSha256: previousSha256,
    qualityDifferences,
    qualityRegressionReview: review ?? null,
    runtimeSpread: {
      previous: previous.runtimeSpread,
      current: current.runtimeSpread,
    },
    claim: reasons.length
      ? null
      : "Aperture led this frozen house-scene benchmark in two successive fresh eligible author pairs. This does not establish universal engine superiority.",
    universalSuperiorityClaim: false,
  };
}
