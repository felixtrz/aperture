import { describe, expect, it } from "vitest";
import {
  createApertureHeadlessRunner,
  type ApertureHeadlessRunner,
} from "@aperture-engine/app/headless";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { defineApertureConfig } from "@aperture-engine/app/config";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";
import {
  assertQuadSnapshotBuffers,
  createQuadSnapshotBuffers,
  decodeTypedArrayTree,
  encodeTypedArrayTree,
  renderSnapshotFromJsonValue,
  renderSnapshotToJsonValue,
  type RenderSnapshot,
} from "@aperture-engine/render";

// P2.1: the snapshot JSON codec must round-trip every typed array losslessly
// (including NaN/Infinity, which plain JSON corrupts to null) so the Node
// headless loop can write a snapshot to disk and the browser render path can
// rehydrate it byte-for-byte.

function roundTripTree(value: unknown): unknown {
  return decodeTypedArrayTree(
    JSON.parse(JSON.stringify(encodeTypedArrayTree(value))),
  );
}

function expectTypedArrayEqual(
  actual: unknown,
  expected: ArrayBufferView,
): void {
  expect(actual).toBeInstanceOf(expected.constructor as new () => unknown);
  expect(Array.from(actual as Iterable<number>)).toEqual(
    Array.from(expected as unknown as Iterable<number>),
  );
}

describe("snapshot JSON codec — generic typed-array tree", () => {
  it("round-trips every supported typed array constructor", () => {
    const value = {
      f32: new Float32Array([1.5, -2.25, 0]),
      f64: new Float64Array([Math.PI, -0]),
      i8: new Int8Array([-128, 127]),
      i16: new Int16Array([-32768, 32767]),
      i32: new Int32Array([-2147483648, 2147483647]),
      u8: new Uint8Array([0, 255]),
      u8c: new Uint8ClampedArray([0, 255]),
      u16: new Uint16Array([0, 65535]),
      u32: new Uint32Array([0, 4294967295]),
    };

    const result = roundTripTree(value) as Record<string, ArrayBufferView>;

    expectTypedArrayEqual(result["f32"], value.f32);
    expectTypedArrayEqual(result["f64"], value.f64);
    expectTypedArrayEqual(result["i8"], value.i8);
    expectTypedArrayEqual(result["i16"], value.i16);
    expectTypedArrayEqual(result["i32"], value.i32);
    expectTypedArrayEqual(result["u8"], value.u8);
    expectTypedArrayEqual(result["u8c"], value.u8c);
    expectTypedArrayEqual(result["u16"], value.u16);
    expectTypedArrayEqual(result["u32"], value.u32);
  });

  it("preserves NaN and +/-Infinity exactly (plain JSON would lose them)", () => {
    const source = new Float32Array([NaN, Infinity, -Infinity, 42.5]);
    const result = roundTripTree({ source }) as { source: Float32Array };

    expect(Number.isNaN(result.source[0])).toBe(true);
    expect(result.source[1]).toBe(Infinity);
    expect(result.source[2]).toBe(-Infinity);
    expect(result.source[3]).toBe(42.5);
  });

  it("walks typed arrays nested at any depth and leaves plain handles intact", () => {
    const value = {
      bounds: [{ worldAabb: new Float32Array([0, 1, 2, 3, 4, 5]) }],
      draws: [
        {
          mesh: { kind: "mesh", id: "box-1" },
          material: { kind: "material", id: "m" },
        },
      ],
    };

    const result = roundTripTree(value) as typeof value;

    expectTypedArrayEqual(
      result.bounds[0]?.worldAabb,
      value.bounds[0]!.worldAabb,
    );
    expect(result.draws[0]?.mesh).toEqual({ kind: "mesh", id: "box-1" });
  });

  it("preserves empty typed arrays", () => {
    const result = roundTripTree({ empty: new Float32Array(0) }) as {
      empty: Float32Array;
    };
    expect(result.empty).toBeInstanceOf(Float32Array);
    expect(result.empty.length).toBe(0);
  });

  it("rejects an unknown typed-array tag", () => {
    expect(() =>
      decodeTypedArrayTree({
        $typedArray: "BigInt64Array",
        base64: "AAAA",
        length: 1,
      }),
    ).toThrow(/Unsupported typed array/);
  });

  it("rejects malformed typed-array nodes instead of preserving them as plain objects", () => {
    expect(() =>
      decodeTypedArrayTree({ $typedArray: "Float32Array", base64: "AAAA" }),
    ).toThrow(/Malformed typed-array JSON node/);
    expect(() =>
      decodeTypedArrayTree({
        $typedArray: "Float32Array",
        base64: "AAAA",
        length: -1,
      }),
    ).toThrow(/Malformed typed-array JSON node/);
  });

  it("rejects invalid base64 and byte lengths that do not match the declared array length", () => {
    expect(() =>
      decodeTypedArrayTree({
        $typedArray: "Uint8Array",
        base64: "AA!!",
        length: 2,
      }),
    ).toThrow(/Invalid base64 payload/);
    expect(() =>
      decodeTypedArrayTree({
        $typedArray: "Float32Array",
        base64: "AAAA",
        length: 2,
      }),
    ).toThrow(/requires 8 byte/);
  });
});

describe("snapshot JSON codec — RenderSnapshot helpers", () => {
  it("canonicalizes quads through createQuadSnapshotBuffers", () => {
    const quads = createQuadSnapshotBuffers({
      instanceFloats: new Float32Array(24),
      instanceWords: new Uint32Array(8),
    });
    const snapshot = {
      frame: 0,
      views: [],
      meshDraws: [],
      lights: [],
      environments: [],
      shadowRequests: [],
      bounds: [],
      transforms: new Float32Array(16),
      viewMatrices: new Float32Array(16),
      quads,
      diagnostics: [],
      report: { ok: true },
    } as unknown as RenderSnapshot;

    const rebuilt = renderSnapshotFromJsonValue(
      JSON.parse(JSON.stringify(renderSnapshotToJsonValue(snapshot))),
    );

    expect(rebuilt.quads).toBeDefined();
    expect(() => assertQuadSnapshotBuffers(rebuilt.quads!)).not.toThrow();
    expect(rebuilt.quads?.instanceFloatStride).toBe(quads.instanceFloatStride);
  });

  it("throws when the decoded value is not an object", () => {
    expect(() => renderSnapshotFromJsonValue(42)).toThrow(/not an object/);
  });
});

describe("snapshot JSON codec — real extracted snapshot", () => {
  async function createCubeRunner(): Promise<ApertureHeadlessRunner> {
    const system: ApertureSystemModule = {
      default: class CubeScene extends createSystem({ priority: 0 }) {
        override init(): void {
          this.spawn.camera({
            key: "camera.main",
            transform: { translation: [0, 1, 6], lookAt: [0, 0, 0] },
            fovYDegrees: 60,
          });
          this.spawn.mesh({
            key: "cube",
            mesh: mesh.box({ size: [1, 1, 1] }),
            material: material.standard(),
            transform: { translation: [0, 0, 0] },
          });
        }
      },
    };

    return createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [system],
    });
  }

  it("round-trips a real snapshot with the meshDraw and transforms preserved", async () => {
    const runner = await createCubeRunner();
    const { snapshot } = runner.step(1 / 60, 0);

    const json = JSON.parse(
      JSON.stringify(renderSnapshotToJsonValue(snapshot)),
    );
    const rebuilt = renderSnapshotFromJsonValue(json);

    expect(rebuilt.frame).toBe(snapshot.frame);
    expect(rebuilt.meshDraws.length).toBe(snapshot.meshDraws.length);
    expect(rebuilt.meshDraws.length).toBeGreaterThan(0);
    expect(rebuilt.transforms).toBeInstanceOf(Float32Array);
    expect(Array.from(rebuilt.transforms)).toEqual(
      Array.from(snapshot.transforms),
    );
    expect(Array.from(rebuilt.viewMatrices)).toEqual(
      Array.from(snapshot.viewMatrices),
    );
    expect(rebuilt.views.length).toBe(snapshot.views.length);
  });
});
