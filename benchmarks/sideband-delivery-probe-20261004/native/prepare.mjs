/** CPU-only preparation pinning. Does not authorize native execution. */
import assert from "node:assert/strict";
import { writeFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { collectPins, here, sha256 } from "./inputs.mjs";
assert.equal(
  process.env.APERTURE_TMP_ROOT,
  "/workspace/scratch/0190a8c72f8a/aperture-tmp",
);
assert.match(process.env.APERTURE_TMP_RUN_ID ?? "", /^run-[a-f0-9]{32}$/);
assert.equal(
  await realpath(`/proc/self/fd/${process.env.APERTURE_TMP_LOCK_FD}`),
  resolve(process.env.APERTURE_TMP_ROOT, ".lifecycle.lock"),
);
const pins = await collectPins(),
  bytes = JSON.stringify(pins, null, 2) + "\n";
await writeFile(resolve(here, "source-pins.json"), bytes, { flag: "wx" });
console.log(
  JSON.stringify({
    status: pins.status,
    files: Object.keys(pins.files).length,
    runtimeSymlinks: Object.keys(pins.runtimeSymlinks).length,
    sourcePinsSha256: sha256(bytes),
    nativeStatus: "unrun",
    browsersLaunched: 0,
  }),
);
