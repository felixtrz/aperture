import { describe, expect, it } from "vitest";

import { decodeGltfFloatAccessor } from "../../packages/render/src/assets/gltf-accessor-float-reader.js";

const FLOAT = 5126;
const UNSIGNED_BYTE = 5121;
const UNSIGNED_SHORT = 5123;

describe("glTF sparse float accessor decoding (AI-34)", () => {
  it("applies sparse value overrides on top of the base values", () => {
    // Layout in one buffer:
    //   [0..16)  base: 4 SCALAR floats [0, 1, 2, 3]
    //   [16..20) sparse indices: 2 uint16 [1, 3]
    //   [20..28) sparse values:  2 floats [10.5, 30.5]
    const buffer = new ArrayBuffer(28);
    const view = new DataView(buffer);
    [0, 1, 2, 3].forEach((v, i) => view.setFloat32(i * 4, v, true));
    view.setUint16(16, 1, true);
    view.setUint16(18, 3, true);
    view.setFloat32(20, 10.5, true);
    view.setFloat32(24, 30.5, true);

    const root = {
      buffers: [{ byteLength: 28 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 16 },
        { buffer: 0, byteOffset: 16, byteLength: 4 },
        { buffer: 0, byteOffset: 20, byteLength: 8 },
      ],
      accessors: [
        {
          bufferView: 0,
          componentType: FLOAT,
          type: "SCALAR",
          count: 4,
          sparse: {
            count: 2,
            indices: {
              bufferView: 1,
              byteOffset: 0,
              componentType: UNSIGNED_SHORT,
            },
            values: { bufferView: 2, byteOffset: 0 },
          },
        },
      ],
    };

    const result = decodeGltfFloatAccessor({
      root,
      accessorIndex: 0,
      resolveBufferBytes: () => buffer,
    });
    expect(result).not.toBeNull();
    expect(Array.from(result?.values ?? [])).toEqual([0, 10.5, 2, 30.5]);
  });

  it("fills a pure-sparse accessor (no base bufferView) over the zeroed default", () => {
    // [0..2) indices: 2 uint8 [0, 2]; [2..10) values: 2 floats [5, 7]
    const buffer = new ArrayBuffer(10);
    const view = new DataView(buffer);
    view.setUint8(0, 0);
    view.setUint8(1, 2);
    view.setFloat32(2, 5, true);
    view.setFloat32(6, 7, true);

    const root = {
      buffers: [{ byteLength: 10 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 2 },
        { buffer: 0, byteOffset: 2, byteLength: 8 },
      ],
      accessors: [
        {
          componentType: FLOAT,
          type: "SCALAR",
          count: 4,
          sparse: {
            count: 2,
            indices: { bufferView: 0, componentType: UNSIGNED_BYTE },
            values: { bufferView: 1 },
          },
        },
      ],
    };

    const result = decodeGltfFloatAccessor({
      root,
      accessorIndex: 0,
      resolveBufferBytes: () => buffer,
    });
    expect(Array.from(result?.values ?? [])).toEqual([5, 0, 7, 0]);
  });

  it("still zero-fills an absent bufferView when there is no sparse block", () => {
    const root = {
      buffers: [],
      bufferViews: [],
      accessors: [{ componentType: FLOAT, type: "SCALAR", count: 3 }],
    };
    const result = decodeGltfFloatAccessor({
      root,
      accessorIndex: 0,
      resolveBufferBytes: () => null,
    });
    expect(Array.from(result?.values ?? [])).toEqual([0, 0, 0]);
  });

  it("returns null on an out-of-range sparse index", () => {
    const buffer = new ArrayBuffer(6);
    const view = new DataView(buffer);
    view.setUint16(0, 99, true); // index 99 is out of range for count 2
    view.setFloat32(2, 1, true);

    const root = {
      buffers: [{ byteLength: 6 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 2 },
        { buffer: 0, byteOffset: 2, byteLength: 4 },
      ],
      accessors: [
        {
          componentType: FLOAT,
          type: "SCALAR",
          count: 2,
          sparse: {
            count: 1,
            indices: { bufferView: 0, componentType: UNSIGNED_SHORT },
            values: { bufferView: 1 },
          },
        },
      ],
    };

    expect(
      decodeGltfFloatAccessor({
        root,
        accessorIndex: 0,
        resolveBufferBytes: () => buffer,
      }),
    ).toBeNull();
  });
});
