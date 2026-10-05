/** Read retained native PNGs and records only; never renders. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { here, checkPins, sha256 } from "./inputs.mjs";
import { SESSIONS, statesFor } from "./contract.mjs";
import { validateState } from "./checks.mjs";
import { inspectCanvasPng } from "../../indexed-shared-mesh-fanout-20261004/harness/recorder.mjs";
export function comparePixels(images) {
  const pairs = [
    ["before-poll/baseline", "late-delivery/baseline"],
    ["before-poll/baseline", "late-delivery/early"],
    ["before-poll/changed", "late-delivery/converged"],
    ["before-poll/changed", "cold-changed/changed"],
  ];
  const exact = pairs.map(([a, b]) => {
    assert(
      images.get(a).equals(images.get(b)),
      `Decoded RGB differs: ${a}, ${b}`,
    );
    return { a, b, equal: true };
  });
  const baseline = images.get("before-poll/baseline"),
    changed = images.get("before-poll/changed");
  assert.equal(baseline.length, changed.length);
  let changedPixels = 0,
    maxChannelDifference = 0;
  for (let i = 0; i < baseline.length; i += 3) {
    let differs = false;
    for (let c = 0; c < 3; c++) {
      const delta = Math.abs(baseline[i + c] - changed[i + c]);
      differs ||= delta !== 0;
      maxChannelDifference = Math.max(maxChannelDifference, delta);
    }
    changedPixels += Number(differs);
  }
  assert(
    changedPixels >= 1024 && maxChannelDifference >= 8,
    "Baseline/change not visibly different",
  );
  return { exact, changedPixels, maxChannelDifference };
}
export async function compare(outputName) {
  assert.match(outputName, /^[a-z][a-z0-9-]*\.json$/);
  const freeze = await checkPins();
  const images = new Map(),
    evidence = [];
  for (const session of SESSIONS) {
    const folder = resolve(here, "renders", session, "attempt-001");
    const outcome = JSON.parse(
      await readFile(resolve(folder, "outcome.json"), "utf8"),
    );
    assert.equal(outcome.status, "passed");
    assert.equal(outcome.sourcePinsSha256, freeze.sha256);
    assert(outcome.sourcePinsUnchanged && outcome.serverClosed);
    for (const state of statesFor(session)) {
      const record = JSON.parse(
        await readFile(resolve(folder, state.id + ".json"), "utf8"),
      );
      const summary = validateState(record, session, state.id);
      const png = await readFile(resolve(folder, state.id + ".png"));
      const { rgb, ...inspection } = inspectCanvasPng(png, {
        includePixels: true,
      });
      images.set(session + "/" + state.id, rgb);
      evidence.push({
        session,
        id: state.id,
        ...summary,
        pngSha256: sha256(png),
        rgbSha256: sha256(rgb),
        inspection,
      });
    }
  }
  const result = {
    status: "passed",
    sourcePinsSha256: freeze.sha256,
    ...comparePixels(images),
    evidence,
    scope:
      "Six native 1024-square captures; no performance, artistic score or same-frame atomicity claim",
  };
  await writeFile(
    resolve(here, outputName),
    JSON.stringify(result, null, 2) + "\n",
    { flag: "wx" },
  );
  return result;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  console.log(JSON.stringify(await compare(process.argv[2])));
