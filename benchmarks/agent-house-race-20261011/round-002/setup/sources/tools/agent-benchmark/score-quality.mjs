const visualCaps = Object.freeze({
  house: 2,
  car: 2,
  composition: 2,
  materialsLighting: 2,
  alternateViews: 2,
});
const geometryCaps = Object.freeze({
  proportions: 4,
  volume: 3,
  normalsTopology: 2,
  efficiency: 1,
});
const equalKeys = (a, b) =>
  JSON.stringify(Object.keys(a).sort()) ===
  JSON.stringify(Object.keys(b).sort());
const validNumber = (value, maximum) =>
  Number.isFinite(value) && value >= 0 && value <= maximum;

export function inspectJudgeRecords(judges, caseIds) {
  const errors = [],
    seenJudges = new Set(),
    records = [];
  if (!Array.isArray(judges) || judges.length !== 2)
    errors.push("Exactly two original independent judge records are required");
  for (const [index, judge] of (Array.isArray(judges)
    ? judges
    : []
  ).entries()) {
    const label = `judge[${index}]`;
    if (
      typeof judge?.judgeId !== "string" ||
      !judge.judgeId.trim() ||
      seenJudges.has(judge.judgeId)
    )
      errors.push(`${label}: missing or duplicate judgeId`);
    seenJudges.add(judge?.judgeId);
    const seenCases = new Set();
    if (!Array.isArray(judge?.cases) || judge.cases.length !== 2)
      errors.push(`${label}: exactly two cases required`);
    for (const entry of Array.isArray(judge?.cases) ? judge.cases : []) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        errors.push(`${label}: case record must be an object`);
        continue;
      }
      if (!caseIds.includes(entry.case) || seenCases.has(entry.case))
        errors.push(`${label}: unknown or duplicate case ${entry.case}`);
      seenCases.add(entry.case);
      for (const [dimensionKey, totalKey, caps] of [
        ["visualDimensions", "visualScore", visualCaps],
        ["geometryDimensions", "geometryScore", geometryCaps],
      ]) {
        const dimensions = entry[dimensionKey];
        if (
          !dimensions ||
          typeof dimensions !== "object" ||
          Array.isArray(dimensions) ||
          !equalKeys(dimensions, caps)
        ) {
          errors.push(
            `${label}/${entry.case}: ${dimensionKey} keys differ from frozen rubric`,
          );
          continue;
        }
        for (const [name, cap] of Object.entries(caps))
          if (!validNumber(dimensions[name], cap))
            errors.push(
              `${label}/${entry.case}: ${name} must be finite in 0..${cap}`,
            );
        const sum = Object.values(dimensions).reduce(
          (total, value) => total + value,
          0,
        );
        if (
          !validNumber(entry[totalKey], 10) ||
          !Number.isFinite(sum) ||
          Math.abs(sum - entry[totalKey]) > 1e-9
        )
          errors.push(
            `${label}/${entry.case}: ${totalKey} does not equal dimension sum`,
          );
      }
      if (
        !Array.isArray(entry.missingRequiredFeatures) ||
        entry.missingRequiredFeatures.some(
          (item) => typeof item !== "string" || !item.trim(),
        ) ||
        new Set(entry.missingRequiredFeatures).size !==
          entry.missingRequiredFeatures.length
      )
        errors.push(
          `${label}/${entry.case}: malformed missingRequiredFeatures`,
        );
    }
    if (caseIds.some((id) => !seenCases.has(id)))
      errors.push(`${label}: case coverage incomplete`);
    if (
      judge?.preferredVisualCase !== undefined &&
      !caseIds.includes(judge.preferredVisualCase)
    )
      errors.push(`${label}: preferredVisualCase is not a supplied case`);
    records.push(judge);
  }
  if (errors.length)
    return {
      valid: false,
      errors,
      originalRecords: records,
      qualityByCase: null,
    };
  const qualityByCase = Object.fromEntries(
    caseIds.map((id) => {
      const cases = judges.map((judge) =>
        judge.cases.find((entry) => entry.case === id),
      );
      return [
        id,
        {
          visualMean:
            cases.reduce((sum, entry) => sum + entry.visualScore, 0) / 2,
          geometryMean:
            cases.reduce((sum, entry) => sum + entry.geometryScore, 0) / 2,
          missingRequiredFeatures: [
            ...new Set(cases.flatMap((entry) => entry.missingRequiredFeatures)),
          ],
          disagreement: {
            visualAbsoluteDifference: Math.abs(
              cases[0].visualScore - cases[1].visualScore,
            ),
            geometryAbsoluteDifference: Math.abs(
              cases[0].geometryScore - cases[1].geometryScore,
            ),
            visualDimensions: Object.fromEntries(
              Object.keys(visualCaps).map((key) => [
                key,
                cases[0].visualDimensions[key] - cases[1].visualDimensions[key],
              ]),
            ),
            geometryDimensions: Object.fromEntries(
              Object.keys(geometryCaps).map((key) => [
                key,
                cases[0].geometryDimensions[key] -
                  cases[1].geometryDimensions[key],
              ]),
            ),
          },
          judgeValues: cases.map((entry, index) => ({
            judgeId: judges[index].judgeId,
            ...entry,
          })),
        },
      ];
    }),
  );
  return { valid: true, errors: [], originalRecords: records, qualityByCase };
}
