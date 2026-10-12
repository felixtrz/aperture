import { describe, expect, it } from "vitest";
import {
  buildCases,
  OPERATORS as COMPILE_OPERATORS,
  MESH_MODULES,
  STRING_FAMILIES,
} from "../../scripts/webgpu-shader-compile-check.mjs";
import {
  INPUTS,
  EXPECTED,
  OPERATORS,
  TOLERANCE,
  buildComputeShader,
} from "../../scripts/webgpu-tonemap-numeric-check.mjs";
import {
  buildVerifiedGateConfig,
  validateVerifiedGateResult,
  verifiedCiGateHtml,
} from "../../tools/agent-benchmark/verified-ci-gates.mjs";

const successfulCompilation = (config) => ({
  schema: config.schema,
  kind: config.kind,
  ok: true,
  failures: [],
  compiledCases: config.cases.map((entry) => ({
    name: entry.name,
    sha256: entry.sha256,
    messages: [],
    validationError: null,
  })),
  readbacks: {},
});

describe("verified native CI gate parity", () => {
  it("keeps all current CI family cases byte-identical and adds the corrected StandardMaterial variants", () => {
    const original = buildCases(),
      config = buildVerifiedGateConfig("shader");
    expect(Object.keys(MESH_MODULES)).toHaveLength(6);
    expect(Object.keys(STRING_FAMILIES)).toHaveLength(6);
    expect(COMPILE_OPERATORS).toEqual([
      "aces",
      "neutral",
      "agx",
      "reinhard",
      "linear",
    ]);
    expect(original).toHaveLength(42);
    expect(config.originalCaseCount).toBe(42);
    expect(config.cases).toHaveLength(94);
    expect(
      config.cases.slice(0, 42).map(({ name, code }) => ({ name, code })),
    ).toEqual(original);
    expect(config.noOpChecks).toHaveLength(38);
    expect(
      config.noOpChecks.every(
        (entry) =>
          entry.byteIdentity && entry.beforeSha256 === entry.afterSha256,
      ),
    ).toBe(true);
    const additions = config.cases.slice(42);
    expect(additions.map((entry) => entry.name)).toContain(
      "standard-normal-skinned-morphed aces/srgb + motion-vector",
    );
    for (const name of [
      "standard-clearcoat-spot",
      "standard-sheen-spot",
      "standard-clearcoat-clustered",
      "standard-sheen-clustered",
      "standard-iridescence-clustered",
      "standard-clearcoat-sheen-textured",
      "standard-clearcoat-sheen-clustered-spot",
      "standard-combined-lobes-shadow",
      "standard-directional-point",
      "standard-clearcoat-directional-point",
      "standard-sheen-directional-point",
      "standard-iridescence-directional-point",
      "standard-clearcoat-sheen-directional-point",
      "standard-combined-lobes-directional-point",
    ]) {
      expect(additions.map((entry) => entry.name)).toContain(
        `${name} aces/srgb`,
      );
      expect(additions.map((entry) => entry.name)).toContain(
        `${name} aces/srgb + motion-vector`,
      );
    }
    expect(
      additions.every((entry) =>
        entry.code.includes("apertureTransformWorldNormal"),
      ),
    ).toBe(true);
    expect(
      validateVerifiedGateResult(config, successfulCompilation(config)),
    ).toEqual({
      compiledCaseCount: 94,
      familyCaseCount: 42,
      additionalStandardCases: 52,
    });
  });

  it("pins the exact existing Three.js reference inputs, expectations and compute source", () => {
    const config = buildVerifiedGateConfig("tonemap");
    expect(config.inputs).toEqual(INPUTS);
    expect(config.expected).toEqual(EXPECTED);
    expect(config.tolerance).toBe(5e-3);
    expect(config.tolerance).toBe(TOLERANCE);
    expect(config.cases.map((entry) => entry.name)).toEqual([
      "agx",
      "neutral",
      "reinhard",
    ]);
    expect(INPUTS).toHaveLength(6);
    for (const entry of config.cases)
      expect(entry.code).toBe(buildComputeShader(entry.name));
    expect(EXPECTED.agx[2]).toEqual([0.849271, 0.679243, 0.449166]);
    expect(EXPECTED.neutral[1]).toEqual([0.88, 0.01556, 0.01556]);
  });

  it("rejects omitted/failed native module cases and preserves compilation diagnostics", () => {
    const config = buildVerifiedGateConfig("shader"),
      result = successfulCompilation(config);
    result.compiledCases.pop();
    expect(() => validateVerifiedGateResult(config, result)).toThrow();
    const failed = successfulCompilation(config);
    failed.compiledCases[2].messages.push({
      type: "error",
      message: "real Dawn validation failure",
    });
    expect(() => validateVerifiedGateResult(config, failed)).toThrow();
  });

  it("validates actual f32 byte/readback parity and refuses NaNs, drift or missing operators", () => {
    const config = buildVerifiedGateConfig("tonemap");
    function result() {
      const value = successfulCompilation(config);
      for (const operator of OPERATORS) {
        const rgba = new Float32Array(
          EXPECTED[operator].flatMap((row) => [...row, 1]),
        );
        value.readbacks[operator] = {
          rgba: Array.from(rgba),
          bytes: Array.from(new Uint8Array(rgba.buffer)),
        };
      }
      return value;
    }
    expect(validateVerifiedGateResult(config, result())).toMatchObject({
      operatorCount: 3,
      inputCount: 6,
      tolerance: 5e-3,
    });
    const drift = result();
    drift.readbacks.agx.rgba[0] += 0.1;
    expect(() => validateVerifiedGateResult(config, drift)).toThrow(
      /byte streams/,
    );
    const invalid = result(),
      bad = new Float32Array(invalid.readbacks.agx.rgba);
    bad[0] = NaN;
    invalid.readbacks.agx = {
      rgba: Array.from(bad),
      bytes: Array.from(new Uint8Array(bad.buffer)),
    };
    expect(() => validateVerifiedGateResult(config, invalid)).toThrow(
      /non-finite/,
    );
    const wrong = result(),
      changed = new Float32Array(wrong.readbacks.agx.rgba);
    changed[0] += 0.1;
    wrong.readbacks.agx = {
      rgba: Array.from(changed),
      bytes: Array.from(new Uint8Array(changed.buffer)),
    };
    expect(() => validateVerifiedGateResult(config, wrong)).toThrow(/agx/);
    const missing = result();
    delete missing.readbacks.neutral;
    expect(() => validateVerifiedGateResult(config, missing)).toThrow();
  });

  it("retains executable native canvas/compute operations without importing or launching Playwright", () => {
    const html = verifiedCiGateHtml(buildVerifiedGateConfig("tonemap"));
    expect(html).toContain("module.getCompilationInfo()");
    expect(html).toContain("readback.mapAsync(GPUMapMode.READ)");
    expect(html).toContain("pass.draw(3)");
    expect(html).toContain("no skip route");
    expect(html).not.toContain("chromium.launch");
    expect(html).not.toContain("playwright");
    const source = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
    expect(() => new Function(source)).not.toThrow();
    expect(() => buildVerifiedGateConfig("invalid")).toThrow(/Gate must/);
  });
});
