import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONFIG } from "./contract.mjs";
import { proveDisabledAudioImport } from "./import-proof.mjs";
const app = readFileSync(
  new URL("../../packages/app/dist/browser/app.js", import.meta.url),
  "utf8",
);
const main = readFileSync(new URL("./main.mjs", import.meta.url), "utf8");
test("active-graph preflight proves actual disabled dynamic audio source lines", () => {
  const proof = proveDisabledAudioImport(app, main, CONFIG);
  assert.equal(proof.dynamicImportLine, 110);
  assert.equal(proof.guardLine, 109);
});
for (const [name, source, caller, config] of [
  ["enabled config", app, main, { ...CONFIG, audio: true }],
  ["unknown config", app, main, { ...CONFIG, audio: {} }],
  ["static import", 'import audio from "./audio.js";\n' + app, main, CONFIG],
  [
    "missing guard",
    app.replace("audioOptions !== undefined && audioOptions !== false", "true"),
    main,
    CONFIG,
  ],
  [
    "changed resolver",
    app.replace("const audio = config.audio;", "const audio = true;"),
    main,
    CONFIG,
  ],
  [
    "enabled call override",
    app,
    main.replace("config: CONFIG,", "config: CONFIG, audio: true,"),
    CONFIG,
  ],
  [
    "unknown option spread",
    app,
    main.replace("config: CONFIG,", "config: CONFIG, ...externalOptions,"),
    CONFIG,
  ],
])
  test(`active-graph preflight rejects ${name}`, () =>
    assert.throws(() => proveDisabledAudioImport(source, caller, config)));
