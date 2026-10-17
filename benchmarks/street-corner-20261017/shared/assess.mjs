import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = async (p) =>
  JSON.parse(await fs.readFile(path.join(root, p), "utf8"));
const mapping = await read("judging/coordinator-mapping.json");
const judgeFiles = ["fidelity.json", "art-direction.json"];
const judges = await Promise.all(judgeFiles.map((p) => read(`judging/${p}`)));
const weights = {
  composition: 0.25,
  landmarks: 0.25,
  lowPolyStyle: 0.15,
  lightingMaterials: 0.2,
  finish: 0.15,
};
const candidates = {};
for (const [anonymousId, framework] of Object.entries(mapping)) {
  const dimensions = {};
  const totals = [];
  for (const [index, judge] of judges.entries()) {
    let total = 0;
    for (const [dimension, weight] of Object.entries(weights)) {
      const score = judge.candidates[anonymousId].scores[dimension];
      assert(
        Number.isFinite(score) && score >= 0 && score <= 10,
        `${judgeFiles[index]}: invalid score`,
      );
      assert(
        Number.isInteger(score * 2),
        "Scores must use half-point increments",
      );
      dimensions[dimension] =
        (dimensions[dimension] ?? 0) + score / judges.length;
      total += score * weight;
    }
    totals.push(total);
  }
  candidates[framework] = {
    anonymousId,
    dimensions,
    judges: totals,
    mean: totals.reduce((a, b) => a + b, 0) / totals.length,
  };
}
const assessment = {
  method:
    "Weighted subjective scores, averaged across two independent blind model judges. Not an objective metric or statistically conclusive framework ranking.",
  weights,
  judgeFiles,
  mapping,
  candidates,
  rankings: judges.map((j, i) => ({
    file: judgeFiles[i],
    fidelity: j.fidelityRanking.map((id) => mapping[id]),
    appeal: j.appealRanking.map((id) => mapping[id]),
  })),
};
await fs.writeFile(
  path.join(root, "judging/assessment.json"),
  JSON.stringify(assessment, null, 2) + "\n",
);
console.log(JSON.stringify(assessment, null, 2));
