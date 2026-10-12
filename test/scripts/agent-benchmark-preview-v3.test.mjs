import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  PREVIEW_GEOMETRY_V3,
  preflightPreviewNumericGeometryV3,
  inspectPreviewGeometryV3,
  previewGeometryErrorV3,
} from "../../tools/agent-benchmark/preview-geometry-v3.mjs";
import {
  PREVIEW_SCHEMA,
  PREVIEW_LIMITS,
  runDiagnosticPreview,
} from "../../tools/agent-benchmark/preview-client-v3.mjs";
import {
  CONTRACT,
  READY_GLOBAL,
} from "../../tools/agent-benchmark/contract.mjs";
const identity = () =>
  new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const geometry = () => ({
  meshes: [
    {
      id: "triangle",
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint16Array([0, 1, 2]),
      worldMatrix: identity(),
    },
  ],
});
const state = () => ({ submissions: 0, drawCalls: 0 });
const observer = (value) => ({ snapshot: () => ({ ...value }) });

describe("diagnostic numeric export preflight", () => {
  it("retains compact owned-dtype/count status and no source numeric arrays or eligibility claims", () => {
    const input = geometry(),
      result = preflightPreviewNumericGeometryV3(input);
    expect(result).toMatchObject({
      status: "passed",
      sourceNumericBytes: 108,
      counts: {
        meshes: 1,
        sourceVertices: 3,
        sourceIndices: 3,
        matrixRows: 1,
        effectiveInstances: 1,
        transformedVertices: 3,
        instancedTriangles: 1,
      },
      dtypeBytes: { f32le: 100, u16le: 6 },
      fullVisibleCoverageChecked: false,
      nativeUploadParityChecked: false,
      fullOfficialManifestSizeChecked: false,
      officialEligibilityChecked: false,
    });
    expect(result).not.toHaveProperty("meshes");
    expect(result).not.toHaveProperty("chunks");
    input.meshes[0].positions[0] = 999;
    expect(result.counts.sourceVertices).toBe(3);
  });
  it("preserves exact Float64 Number-array/matrix-list policy and multiplicity", () => {
    const input = geometry();
    input.meshes[0].positions = Array.from(input.meshes[0].positions);
    input.meshes[0].instances = [identity(), Array.from(identity())];
    expect(preflightPreviewNumericGeometryV3(input)).toMatchObject({
      counts: {
        matrixRows: 3,
        effectiveInstances: 2,
        transformedVertices: 6,
        instancedTriangles: 2,
      },
      dtypeBytes: { f64le: 328 },
    });
  });
  it.each([
    [
      "nonfinite",
      (x) => {
        x.meshes[0].positions[0] = NaN;
      },
      /Nonfinite/,
    ],
    [
      "index range",
      (x) => {
        x.meshes[0].indices[2] = 3;
      },
      /out of range/,
    ],
    [
      "index fractional",
      (x) => {
        x.meshes[0].indices = [0, 1, 0.5];
      },
      /out of range/,
    ],
    [
      "nonaffine world",
      (x) => {
        x.meshes[0].worldMatrix[3] = 1;
      },
      /Nonaffine/,
    ],
    [
      "nonaffine instance",
      (x) => {
        const m = identity();
        m[15] = 0;
        x.meshes[0].instances = [m];
      },
      /Nonaffine/,
    ],
    [
      "matrix cardinality",
      (x) => {
        x.meshes[0].instances = [new Float32Array(15)];
      },
      /exactly16/,
    ],
    [
      "normal cardinality",
      (x) => {
        x.meshes[0].normals = [0, 0, 1];
      },
      /Normal element/,
    ],
    [
      "live SAB",
      (x) => {
        x.meshes[0].positions = new Float32Array(new SharedArrayBuffer(36));
      },
      /owned coherent/,
    ],
    [
      "unsupported dtype",
      (x) => {
        x.meshes[0].positions = new BigInt64Array(9);
      },
      /Unsupported/,
    ],
    [
      "source byte budget before copy",
      (x) => {
        x.meshes[0].positions = Array(
          Math.ceil(PREVIEW_GEOMETRY_V3.sourceBytes / 8 / 3) * 3,
        );
      },
      /byte budget/,
    ],
  ])("rejects %s using the official numeric rules", (_name, edit, pattern) => {
    const input = geometry();
    edit(input);
    expect(() => preflightPreviewNumericGeometryV3(input)).toThrow(pattern);
  });
  it("bounds aggregate descriptor metadata before retaining a result", () => {
    const input = geometry();
    input.meshes = Array.from({ length: 5000 }, (_, index) => ({
      ...input.meshes[0],
      id: String(index).padEnd(256, "\0"),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      instances: [identity()],
    }));
    expect(() => preflightPreviewNumericGeometryV3(input)).toThrow(
      /metadata byte budget/,
    );
  });
  it("requires inspectGeometry, forwards actual adapter failures and rejects inspector submissions", async () => {
    const value = state();
    await expect(inspectPreviewGeometryV3({}, observer(value))).rejects.toThrow(
      "inspectGeometry",
    );
    const original = new Error("actual-adapter-failure");
    await expect(
      inspectPreviewGeometryV3(
        {
          inspectGeometry() {
            throw original;
          },
        },
        observer(value),
      ),
    ).rejects.toBe(original);
    await expect(
      inspectPreviewGeometryV3(
        {
          inspectGeometry() {
            value.submissions++;
            value.drawCalls++;
            return geometry();
          },
        },
        observer(value),
      ),
    ).rejects.toThrow("uncontrolled native submission");
  });
  it("does not pretend that a valid silent subset proves full visibility or final manifest size", () => {
    const result = preflightPreviewNumericGeometryV3(geometry());
    expect(result.status).toBe("passed");
    expect(result.fullVisibleCoverageChecked).toBe(false);
    expect(result.fullOfficialManifestSizeChecked).toBe(false);
  });
  it("bounds real error attribution with no scene advice", () => {
    const original = Object.assign(new Error("actual-export-error"), {
      code: "actual.code",
      stack: "z".repeat(100000),
    });
    const result = previewGeometryErrorV3(original);
    expect(result).toMatchObject({
      message: "actual-export-error",
      code: "actual.code",
    });
    expect(result.stack.length).toBe(8192);
    expect(result).not.toHaveProperty("suggestedFix");
    expect(
      new TextEncoder().encode(JSON.stringify(result)).length,
    ).toBeLessThan(PREVIEW_GEOMETRY_V3.errorBytes);
  });
});

async function runClientDouble(engine, bad = false) {
  const touched = [
    "__AGENT_NATIVE_OBSERVER__",
    "__APERTURE_VERIFIED_GPU__",
    "__APERTURE_WAIT_GPU__",
    "__AGENT_BENCHMARK__",
    "__AGENT_BENCHMARK_PROGRESS__",
    READY_GLOBAL,
    "fetch",
    "HTMLCanvasElement",
    "document",
    "devicePixelRatio",
  ];
  const prior = new Map(
    touched.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  const calls = [],
    posts = [],
    value = { ...state(), lastSubmitAt: 0 };
  class UnitCanvas {
    width = 1024;
    height = 768;
    toBlob(callback, type) {
      callback(new Blob(["unit-only-not-native-pixels"], { type }));
    }
  }
  const canvas = new UnitCanvas();
  try {
    Object.assign(globalThis, {
      HTMLCanvasElement: UnitCanvas,
      document: { querySelectorAll: () => [canvas] },
      devicePixelRatio: 1,
      __APERTURE_VERIFIED_GPU__: { unitTestDouble: true },
      __APERTURE_WAIT_GPU__: async () => ({ unitTestDouble: true }),
      __AGENT_NATIVE_OBSERVER__: {
        ...observer(value),
        sealGeometryCapture() {
          calls.push("seal");
        },
        fence: async () => performance.now(),
      },
      __AGENT_BENCHMARK__: {
        engine,
        canvas,
        ready: Promise.resolve(),
        async setCamera(camera) {
          calls.push(camera.id);
        },
        async renderFrame(frame) {
          calls.push(frame.frame);
          value.submissions++;
          value.drawCalls++;
          value.lastSubmitAt = performance.now();
        },
        async inspectGeometry() {
          calls.push("inspect");
          const result = geometry();
          if (bad) result.meshes[0].worldMatrix[15] = 0;
          return result;
        },
      },
      fetch: async (url, options) => {
        if (url.endsWith("config.json"))
          return {
            json: async () => ({
              schema: PREVIEW_SCHEMA,
              engine,
              preview: 1,
              contract: CONTRACT,
              limits: PREVIEW_LIMITS,
              geometryPreflight: PREVIEW_GEOMETRY_V3,
            }),
          };
        const bytes = Buffer.from(options.body),
          name = url.split("/").at(-1);
        posts.push({ name, bytes });
        return {
          ok: true,
          json: async () => ({
            ok: true,
            path: name,
            bytes: bytes.length,
            sha256: createHash("sha256").update(bytes).digest("hex"),
          }),
        };
      },
    });
    await runDiagnosticPreview();
    return { calls, posts, status: globalThis[READY_GLOBAL] };
  } finally {
    for (const [name, descriptor] of prior)
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
  }
}

describe("v3 preview orchestration with CPU test doubles, no browser/native evidence", () => {
  it.each(["aperture", "three"])(
    "keeps %s at exactly nine requested renders and one post-short-frame inspector",
    async (engine) => {
      const result = await runClientDouble(engine);
      expect(result.status.ok).toBe(true);
      expect(result.calls.filter(Number.isInteger)).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8,
      ]);
      expect(result.calls.filter((x) => x === "inspect")).toHaveLength(1);
      expect(result.calls.indexOf("inspect")).toBeGreaterThan(
        result.calls.indexOf(5),
      );
      expect(result.calls.indexOf("inspect")).toBeLessThan(
        result.calls.indexOf(6),
      );
      expect(result.posts.filter((x) => x.name.endsWith(".bin"))).toHaveLength(
        0,
      );
      expect(result.posts.filter((x) => x.name.endsWith(".png"))).toHaveLength(
        3,
      );
      const preflight = JSON.parse(
        result.posts.find((x) => x.name === "geometry-preflight.json").bytes,
      );
      expect(preflight.status).toBe("passed");
      expect(preflight.capturedAfterFrame).toBe(5);
    },
  );
  it("retains bounded error and failed status hashes without geometry bytes", async () => {
    const result = await runClientDouble("aperture", true);
    expect(result.status).toMatchObject({
      ok: false,
      phase: "geometry-preflight",
      error: "Nonaffine world/instance matrix",
    });
    const failure = result.posts.find(
        (x) => x.name === "geometry-preflight-error.json",
      ),
      record = JSON.parse(
        result.posts.find((x) => x.name === "geometry-preflight.json").bytes,
      );
    expect(JSON.parse(failure.bytes).message).toBe(
      "Nonaffine world/instance matrix",
    );
    expect(record.error.sha256).toBe(
      createHash("sha256").update(failure.bytes).digest("hex"),
    );
    expect(result.posts.filter((x) => x.name.endsWith(".bin"))).toHaveLength(0);
  });
  it("keeps original workload/deadline constants and does not add a browser or observer route", () => {
    expect(PREVIEW_LIMITS).toEqual({
      warmupFrames: 3,
      diagnosticFrames: 3,
      operationMs: 30000,
      totalMs: 240000,
    });
    expect(CONTRACT).toMatchObject({ warmupFrames: 60, measuredFrames: 120 });
    const runner = readFileSync(
      new URL(
        "../../tools/agent-benchmark/preview-run-v3.mjs",
        import.meta.url,
      ),
      "utf8",
    );
    expect(runner).toContain("runVerifiedScene({");
    expect(runner).toContain("timeout: 270000");
    expect(runner).not.toMatch(/chromium\.launch|--no-sandbox/);
    const helper = readFileSync(
      new URL(
        "../../tools/agent-benchmark/preview-geometry-v3.mjs",
        import.meta.url,
      ),
      "utf8",
    );
    expect(helper).not.toMatch(
      /position-parity|geometry-data|protocol-v2|native-observer|captureGeometry|canonicalGeometryHash/,
    );
  });
});
