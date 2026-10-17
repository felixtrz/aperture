import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
const root = path.resolve(import.meta.dirname, "..");
const read = async (p) => JSON.parse(await fs.readFile(p, "utf8"));
// A completed review must retain its original randomized identities.
try {
  await fs.access(path.join(root, "judging/coordinator-mapping.json"));
  throw new Error(
    "Review mapping already exists; refusing to reshuffle a frozen trial.",
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const results = [];
for (const name of ["aperture", "vgpu", "three"]) {
  const author = path.join(root, "authors", name),
    evidence = path.join(root, "evidence", name);
  const result = await read(path.join(author, "result.json"));
  const captures = [];
  for (const entry of await fs.readdir(evidence, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      captures.push(await read(path.join(evidence, entry.name, "timing.json")));
    } catch {}
  }
  captures.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const first = captures.find((x) => x.status === "passed");
  const label =
    result.finalCaptureLabel ?? result.finalCapture ?? result.finalLabel;
  const final = captures.find((x) => x.label === label);
  if (!first || !final || final.status !== "passed")
    throw new Error(name + ": missing verified final capture");
  const startAt =
    result.startAt ??
    (await fs.readFile(path.join(author, "startAt.txt"), "utf8")).trim();
  const finishedAt = result.finishedAt ?? result.completedAt;
  if (
    !Number.isFinite(Date.parse(startAt)) ||
    !Number.isFinite(Date.parse(finishedAt))
  )
    throw new Error(name + ": missing timestamps");
  const elapsedMs = Date.parse(finishedAt) - Date.parse(startAt);
  const queueMs = captures.reduce((n, c) => n + (c.queueMs ?? 0), 0);
  results.push({
    framework: name,
    startAt,
    finishedAt,
    elapsedMs,
    queueMs,
    elapsedExcludingCaptureQueueMs: elapsedMs - queueMs,
    firstVerifiedMs: Date.parse(first.finishedAt) - Date.parse(startAt),
    finalCaptureMs: Date.parse(final.finishedAt) - Date.parse(startAt),
    captureAttempts: captures.length,
    failedCaptureAttempts: captures.filter((x) => x.status !== "passed").length,
    buildMs: captures.reduce((n, c) => n + (c.buildMs ?? 0), 0),
    renderAndCleanupMs: captures.reduce(
      (n, c) => n + (c.renderAndCleanupMs ?? 0),
      0,
    ),
    firstCapture: first.label,
    finalCapture: final.label,
    captures,
    result,
  });
}
await fs.writeFile(
  path.join(root, "evidence/summary.json"),
  JSON.stringify(results, null, 2) + "\n",
);
const blind = path.join(root, "judging/blind");
await fs.mkdir(blind, { recursive: true });
await fs.copyFile(
  path.join(root, "reference/garden.png"),
  path.join(blind, "reference.png"),
);
const shuffled = [...results];
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = crypto.randomInt(i + 1);
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}
const mapping = {};
for (let i = 0; i < shuffled.length; i++) {
  const r = shuffled[i],
    id = ["A", "B", "C"][i];
  mapping[id] = r.framework;
  await fs.copyFile(
    path.join(root, "evidence", r.framework, r.finalCapture, "render.png"),
    path.join(blind, `image-${id}.png`),
  );
  await fs.copyFile(
    path.join(root, "evidence", r.framework, r.firstCapture, "render.png"),
    path.join(blind, `first-${id}.png`),
  );
}
await fs.writeFile(
  path.join(root, "judging/coordinator-mapping.json"),
  JSON.stringify(mapping, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    results.map(
      ({
        framework,
        elapsedMs,
        firstVerifiedMs,
        captureAttempts,
        failedCaptureAttempts,
      }) => ({
        framework,
        elapsedMs,
        firstVerifiedMs,
        captureAttempts,
        failedCaptureAttempts,
      }),
    ),
    null,
    2,
  ),
);
