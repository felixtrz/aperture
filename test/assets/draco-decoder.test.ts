import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  createDracoMeshDecoder,
  parseGlbContainer,
} from "../../packages/render/src/index.js";

const DRACO_FIXTURE_DIR = new URL("./fixtures/draco/", import.meta.url);

async function readFixture(name: string): Promise<Uint8Array> {
  return readFile(new URL(name, DRACO_FIXTURE_DIR));
}

describe("createDracoMeshDecoder", () => {
  it("decodes a Draco triangular mesh into GPU-uploadable arrays", async () => {
    const decoder = await createDracoMeshDecoder({
      jsSource: await readFile(
        new URL("draco_wasm_wrapper.js", DRACO_FIXTURE_DIR),
        "utf8",
      ),
      wasmBinary: await readFixture("draco_decoder.wasm"),
    });

    const mesh = decoder.decode(await readFixture("bunny.drc"));

    expect(mesh.vertexCount).toBe(34834);
    expect(mesh.faceCount).toBe(69451);
    expect(mesh.indices).toBeInstanceOf(Uint16Array);
    expect(mesh.indices).toHaveLength(mesh.faceCount * 3);

    const position = mesh.attributes.find(
      (attribute) => attribute.semantic === "POSITION",
    );
    expect(position).toBeDefined();
    expect(position?.dataType).toBe("float32");
    expect(position?.itemSize).toBe(3);
    expect(position?.array).toBeInstanceOf(Float32Array);
    expect(position?.array).toHaveLength(mesh.vertexCount * 3);
    expect(Array.from(position?.array.slice(0, 3) ?? [])).toEqual([
      -0.03346006199717522, 0.03374761715531349, 0.008863698691129684,
    ]);
  });

  it("surfaces missing decoder assets before decode", async () => {
    await expect(
      createDracoMeshDecoder({ wasmBinary: new ArrayBuffer(0) }),
    ).rejects.toThrow("Draco decoder requires jsSource or jsUrl");
  });

  it("decodes glTF Draco bufferView payloads by unique attribute id", async () => {
    const decoder = await createDracoMeshDecoder({
      jsSource: await readFile(
        new URL("draco_wasm_wrapper.js", DRACO_FIXTURE_DIR),
        "utf8",
      ),
      wasmBinary: await readFixture("draco_decoder.wasm"),
    });
    const parsed = parseGlbContainer(await readFixture("heart_draco.glb"));
    expect(parsed.ok).toBe(true);

    const root = parsed.container?.json;
    const bufferViews = Array.isArray(root?.bufferViews)
      ? root.bufferViews
      : [];
    const bufferView = bufferViews[0] as
      | { byteOffset?: number; byteLength?: number }
      | undefined;
    const bin = parsed.container?.binaryChunk;
    expect(bin).toBeInstanceOf(Uint8Array);
    expect(bufferView?.byteLength).toBe(3144);

    const byteOffset = bufferView?.byteOffset ?? 0;
    const byteLength = bufferView?.byteLength ?? 0;
    const mesh = decoder.decode(
      bin!.subarray(byteOffset, byteOffset + byteLength),
      {
        attributes: [
          { semantic: "POSITION", uniqueId: 0, output: "float32" },
          { semantic: "NORMAL", uniqueId: 1, output: "float32" },
        ],
      },
    );

    expect(mesh.vertexCount).toBe(540);
    expect(mesh.faceCount).toBe(180);
    expect(mesh.indices).toBeInstanceOf(Uint16Array);
    expect(mesh.indices).toHaveLength(540);
    expect(mesh.attributes.map((attribute) => attribute.semantic)).toEqual([
      "POSITION",
      "NORMAL",
    ]);
  });
});
