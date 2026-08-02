import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { createNodeApertureAssetLoader } from "@aperture-engine/cli";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";

// A procedural cube system that does NOT depend on any external asset, so the
// snapshot is faithful regardless of asset placeholdering.
const cubeSystem: ApertureSystemModule = {
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

describe("createNodeApertureAssetLoader (PD.4/PD.5)", () => {
  it("a procedural-only app records no placeholders and draws the cube", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader(),
    });

    const { snapshot } = runner.step(1 / 60, 0);
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(manifest.placeholders.count).toBe(0);
    expect(snapshot.meshDraws.length).toBe(1);
  });

  it("an external-asset app boots without invalidUrl and marks placeholders", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          robot: asset.gltf("/assets/cube.glb", { preload: "blocking" }),
          floorColor: asset.texture("/assets/checker.png", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader(),
    });

    expect(runner.app.context.assets.gltf("robot").ready.value).toBe(true);
    expect(runner.app.context.assets.texture("floorColor").ready.value).toBe(
      true,
    );

    const manifest = runner.app.lowLevel.assets.createManifestReport();
    expect(manifest.placeholders.count).toBeGreaterThanOrEqual(2);
    expect([...manifest.placeholders.ids].sort()).toEqual(
      expect.arrayContaining(["floorColor", "robot"]),
    );

    // The procedural cube still renders even though external assets are stubbed.
    expect(runner.step(1 / 60, 0).snapshot.meshDraws.length).toBe(1);
  });

  it("strict mode loads local PNG texture assets with real provenance", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          floorColor: asset.texture("/assets/aperture-base-color-checker.png", {
            preload: "blocking",
            mimeType: "image/png",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples/developer-api"),
      }),
    });

    const handle = runner.app.context.assets.texture("floorColor").renderHandle;
    const entry = runner.app.lowLevel.assets.get(handle);
    const texture = entry?.asset as
      | {
          readonly width?: number;
          readonly sourceData?: { readonly bytes?: Uint8Array };
        }
      | null
      | undefined;

    expect(entry?.status).toBe("ready");
    expect(entry?.provenance).toBe("loaded");
    expect(texture?.width).toBeGreaterThan(0);
    expect(texture?.sourceData?.bytes?.byteLength).toBeGreaterThan(0);
    expect(
      runner.app.lowLevel.assets.createManifestReport().placeholders.count,
    ).toBe(0);
  });

  it("strict mode rejects HTTP assets unless explicitly allowed", async () => {
    await expect(
      createApertureHeadlessRunner({
        config: defineApertureConfig({
          mode: "headless",
          render: { defaultCamera: false, defaultLight: false },
          assets: {
            floorColor: asset.texture("https://assets.test/checker.png", {
              preload: "blocking",
              mimeType: "image/png",
            }),
          },
        }),
        systems: [cubeSystem],
        assetLoader: createNodeApertureAssetLoader({
          mode: "strict",
        }),
      }),
    ).rejects.toThrow(/unless allowHttp is enabled/);
  });

  it("strict mode loads HTTP assets only when allowHttp is enabled", async () => {
    const pngBytes = await readFile(
      path.resolve(
        "examples/developer-api/public/assets/aperture-base-color-checker.png",
      ),
    );
    const previousFetch = globalThis.fetch;
    const calls: string[] = [];

    globalThis.fetch = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(pngBytes, {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "image/png" },
      });
    }) as typeof fetch;

    try {
      const runner = await createApertureHeadlessRunner({
        config: defineApertureConfig({
          mode: "headless",
          render: { defaultCamera: false, defaultLight: false },
          assets: {
            floorColor: asset.texture("https://assets.test/checker.png", {
              preload: "blocking",
              mimeType: "image/png",
            }),
          },
        }),
        systems: [cubeSystem],
        assetLoader: createNodeApertureAssetLoader({
          mode: "strict",
          allowHttp: true,
        }),
      });

      const handle =
        runner.app.context.assets.texture("floorColor").renderHandle;
      const entry = runner.app.lowLevel.assets.get(handle);
      const texture = entry?.asset as
        | {
            readonly sourceData?: { readonly bytes?: Uint8Array };
          }
        | null
        | undefined;

      expect(calls).toEqual(["https://assets.test/checker.png"]);
      expect(entry?.status).toBe("ready");
      expect(entry?.provenance).toBe("loaded");
      expect(texture?.sourceData?.bytes?.byteLength).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it("strict mode loads local JPEG texture assets with real provenance", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          floorColor: asset.texture(
            "assets/aperture-jpeg-base-color-checker.jpg",
            {
              preload: "blocking",
              mimeType: "image/jpeg",
            },
          ),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples"),
      }),
    });

    const handle = runner.app.context.assets.texture("floorColor").renderHandle;
    const entry = runner.app.lowLevel.assets.get(handle);
    const texture = entry?.asset as
      | {
          readonly width?: number;
          readonly sourceData?: { readonly bytes?: Uint8Array };
        }
      | null
      | undefined;

    expect(entry?.status).toBe("ready");
    expect(entry?.provenance).toBe("loaded");
    expect(texture?.width).toBeGreaterThan(0);
    expect(texture?.sourceData?.bytes?.byteLength).toBeGreaterThan(0);
    expect(
      runner.app.lowLevel.assets.createManifestReport().placeholders.count,
    ).toBe(0);
  });

  it("strict mode loads HDR environment assets with embedded equirect payloads", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          studio: asset.hdr(syntheticHdrDataUrl(), { preload: "blocking" }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
      }),
    });

    const handle = runner.app.context.assets.hdr("studio").renderHandle;
    const entry = runner.app.lowLevel.assets.get(handle);
    const environment = entry?.asset as
      | {
          readonly kind?: string;
          readonly equirectSource?: {
            readonly width?: number;
            readonly height?: number;
            readonly data?: Uint8Array;
          };
          readonly source?: { readonly kind?: string };
        }
      | null
      | undefined;

    expect(entry?.status).toBe("ready");
    expect(entry?.provenance).toBe("loaded");
    expect(environment?.kind).toBe("environment-map");
    expect(environment?.source?.kind).toBe("hdr-rgbe");
    expect(environment?.equirectSource?.width).toBe(4);
    expect(environment?.equirectSource?.height).toBe(2);
    expect(environment?.equirectSource?.data).toBeInstanceOf(Uint8Array);
    expect(environment?.equirectSource?.data?.byteLength).toBe(4 * 2 * 4);
    expect(
      runner.app.lowLevel.assets.createManifestReport().placeholders.count,
    ).toBe(0);
  });

  it("strict mode loads local WGSL shader assets with real provenance", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          water: asset.shader("/shaders/generated-water.wgsl", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples/developer-api"),
      }),
    });

    const handle = runner.app.context.assets.shader("water").renderHandle;
    const entry = runner.app.lowLevel.assets.get(handle);
    const shader = entry?.asset as
      | { readonly source?: string }
      | null
      | undefined;

    expect(entry?.status).toBe("ready");
    expect(entry?.provenance).toBe("loaded");
    expect(shader?.source).toContain("@");
    expect(
      runner.app.lowLevel.assets.createManifestReport().placeholders.count,
    ).toBe(0);
  });

  it("strict mode loads local GLB source assets without placeholders", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          robot: asset.gltf("/assets/cube.glb", { preload: "blocking" }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples/developer-api"),
      }),
    });

    const gltf = runner.app.context.assets.gltf("robot");
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(gltf.ready.value).toBe(true);
    expect(gltf.scene.value?.meshRegistration.written.length).toBeGreaterThan(
      0,
    );
    expect(manifest.byKind.mesh).toBeGreaterThan(0);
    expect(manifest.placeholders.count).toBe(0);
  });

  it("strict mode loads external glTF buffers relative to the glTF file", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          external: asset.gltf("assets/external-cube.gltf", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples"),
      }),
    });

    const gltf = runner.app.context.assets.gltf("external");
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(gltf.ready.value).toBe(true);
    expect(gltf.scene.value?.sourceKind).toBe("gltf");
    expect(gltf.scene.value?.meshRegistration.written.length).toBeGreaterThan(
      0,
    );
    expect(manifest.byKind.mesh).toBeGreaterThan(0);
    expect(manifest.placeholders.count).toBe(0);
  });

  it("strict mode loads GLB source assets with JPEG textures", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          textured: asset.gltf("assets/uri-jpeg-texture.glb", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples"),
      }),
    });

    const gltf = runner.app.context.assets.gltf("textured");
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(gltf.ready.value).toBe(true);
    expect(gltf.scene.value?.meshRegistration.written.length).toBeGreaterThan(
      0,
    );
    expect(manifest.byKind.texture).toBeGreaterThan(0);
    expect(manifest.placeholders.count).toBe(0);
  });

  it("strict mode loads Draco-compressed GLB source assets with local decoders", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          draco: asset.gltf("draco-heart.glb", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples/assets"),
        decoderAssetsDir: path.resolve("examples/assets"),
      }),
    });

    const gltf = runner.app.context.assets.gltf("draco");
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(gltf.ready.value).toBe(true);
    expect(gltf.scene.value?.meshRegistration.written.length).toBeGreaterThan(
      0,
    );
    expect(manifest.byKind.mesh).toBeGreaterThan(0);
    expect(manifest.placeholders.count).toBe(0);
  });

  it("strict mode loads meshopt-compressed GLB source assets with local decoders", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          meshopt: asset.gltf("meshopt-cube.glb", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples/assets"),
        decoderAssetsDir: path.resolve("examples/assets"),
      }),
    });

    const gltf = runner.app.context.assets.gltf("meshopt");
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(gltf.ready.value).toBe(true);
    expect(gltf.scene.value?.meshRegistration.written.length).toBeGreaterThan(
      0,
    );
    expect(manifest.byKind.mesh).toBeGreaterThan(0);
    expect(manifest.placeholders.count).toBe(0);
  });

  it("strict mode rejects Basis/KTX2 GLB textures without local decoders", async () => {
    await expect(
      createApertureHeadlessRunner({
        config: defineApertureConfig({
          mode: "headless",
          render: { defaultCamera: false, defaultLight: false },
          assets: {
            basis: asset.gltf("basis-ktx2-texture.glb", {
              preload: "blocking",
            }),
          },
        }),
        systems: [cubeSystem],
        assetLoader: createNodeApertureAssetLoader({
          mode: "strict",
          root: path.resolve("examples/assets"),
        }),
      }),
    ).rejects.toThrow(/BasisU-compressed KTX2 textures require/);
  });

  it("hybrid mode records placeholders for unsupported decoder paths", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          basis: asset.gltf("basis-ktx2-texture.glb", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "hybrid",
        root: path.resolve("examples/assets"),
      }),
    });

    const gltf = runner.app.context.assets.gltf("basis");
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(gltf.ready.value).toBe(true);
    expect(manifest.placeholders.ids).toContain("basis");
  });

  it("strict mode loads Basis/KTX2 GLB textures with local decoders", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          basis: asset.gltf("basis-ktx2-texture.glb", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples/assets"),
        decoderAssetsDir: path.resolve("examples/assets"),
      }),
    });

    const gltf = runner.app.context.assets.gltf("basis");
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(gltf.ready.value).toBe(true);
    expect(gltf.scene.value?.meshRegistration.written.length).toBeGreaterThan(
      0,
    );
    expect(manifest.byKind.texture).toBeGreaterThan(0);
    expect(manifest.placeholders.count).toBe(0);
  });
});

describe("createNodeApertureAssetLoader indexed PNG textures", () => {
  it("strict mode decodes an 8-bit indexed PNG with tRNS to exact RGBA bytes", async () => {
    const dataUrl = syntheticIndexedPngDataUrl({
      width: 3,
      height: 2,
      bitDepth: 8,
      palette: [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 255, 0],
      ],
      // tRNS is shorter than PLTE on purpose: entry 3 must default to opaque.
      paletteAlpha: [0, 128, 255],
      rows: [
        [0, 1, 2],
        [3, 2, 1],
      ],
      rowFilters: [0, 2],
    });

    const texture = await loadStrictIndexedPngTexture(dataUrl);

    expect(texture?.width).toBe(3);
    expect(texture?.height).toBe(2);
    expect(texture?.sourceData?.bytesPerRow).toBe(12);
    expect(Array.from(texture?.sourceData?.bytes ?? [])).toEqual([
      // Row 0: indices 0, 1, 2 with tRNS alpha 0, 128, 255.
      ...[255, 0, 0, 0],
      ...[0, 255, 0, 128],
      ...[0, 0, 255, 255],
      // Row 1: indices 3, 2, 1; entry 3 is past tRNS, so it is opaque.
      ...[255, 255, 0, 255],
      ...[0, 0, 255, 255],
      ...[0, 255, 0, 128],
    ]);
  });

  it.each([1, 2, 4] as const)(
    "strict mode unpacks %i-bit indexed PNG scanlines to exact RGBA bytes",
    async (bitDepth) => {
      // Width 5 leaves a partially-filled trailing byte at every sub-byte
      // depth (scanline = ceil(width * bitDepth / 8) with zero-padded low
      // bits), and the sub/up row filters exercise the 1-byte filter stride
      // that sub-byte depths floor to.
      const dataUrl = syntheticIndexedPngDataUrl({
        width: 5,
        height: 2,
        bitDepth,
        palette: [
          [17, 34, 51],
          [204, 153, 102],
        ],
        rows: [
          [0, 1, 1, 0, 1],
          [1, 0, 0, 1, 0],
        ],
        rowFilters: [1, 2],
      });

      const texture = await loadStrictIndexedPngTexture(dataUrl);

      expect(texture?.width).toBe(5);
      expect(texture?.height).toBe(2);
      expect(texture?.sourceData?.bytesPerRow).toBe(20);
      // Every bit depth must unpack to the same pixels: the palette lookup of
      // indices [0, 1, 1, 0, 1] / [1, 0, 0, 1, 0].
      expect(Array.from(texture?.sourceData?.bytes ?? [])).toEqual([
        ...[17, 34, 51, 255],
        ...[204, 153, 102, 255],
        ...[204, 153, 102, 255],
        ...[17, 34, 51, 255],
        ...[204, 153, 102, 255],
        ...[204, 153, 102, 255],
        ...[17, 34, 51, 255],
        ...[17, 34, 51, 255],
        ...[204, 153, 102, 255],
        ...[17, 34, 51, 255],
      ]);
    },
  );
});

interface LoadedRgba8Texture {
  readonly width?: number;
  readonly height?: number;
  readonly sourceData?: {
    readonly bytes?: Uint8Array;
    readonly bytesPerRow?: number;
  };
}

async function loadStrictIndexedPngTexture(
  dataUrl: string,
): Promise<LoadedRgba8Texture | null | undefined> {
  const runner = await createApertureHeadlessRunner({
    config: defineApertureConfig({
      mode: "headless",
      render: { defaultCamera: false, defaultLight: false },
      assets: {
        indexed: asset.texture(dataUrl, {
          preload: "blocking",
          mimeType: "image/png",
        }),
      },
    }),
    systems: [cubeSystem],
    assetLoader: createNodeApertureAssetLoader({ mode: "strict" }),
  });

  const handle = runner.app.context.assets.texture("indexed").renderHandle;
  const entry = runner.app.lowLevel.assets.get(handle);

  expect(entry?.status).toBe("ready");
  expect(entry?.provenance).toBe("loaded");
  return entry?.asset as LoadedRgba8Texture | null | undefined;
}

function syntheticHdrDataUrl(): string {
  const width = 4;
  const height = 2;
  const rgbe = new Uint8Array(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    rgbe[offset] = 128;
    rgbe[offset + 1] = 96;
    rgbe[offset + 2] = 64;
    rgbe[offset + 3] = 129;
  }

  const header = new TextEncoder().encode(
    `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`,
  );
  const bytes = new Uint8Array(header.byteLength + rgbe.byteLength);
  bytes.set(header, 0);
  bytes.set(rgbe, header.byteLength);

  return `data:image/vnd.radiance;base64,${Buffer.from(bytes).toString(
    "base64",
  )}`;
}

interface SyntheticIndexedPng {
  readonly width: number;
  readonly height: number;
  readonly bitDepth: 1 | 2 | 4 | 8;
  /** RGB palette entries, three PLTE bytes each. */
  readonly palette: ReadonlyArray<readonly [number, number, number]>;
  /** Optional per-entry tRNS alpha; may cover fewer entries than PLTE. */
  readonly paletteAlpha?: readonly number[];
  /** Palette indices per scanline; each row holds `width` samples. */
  readonly rows: ReadonlyArray<readonly number[]>;
  /** PNG filter type per scanline (0 = none, 1 = sub, 2 = up). */
  readonly rowFilters: readonly number[];
}

/**
 * Build a minimal color-type-3 PNG (signature + IHDR/PLTE/[tRNS]/IDAT/IEND
 * with correct CRCs) and return it as a base64 data URL.
 */
function syntheticIndexedPngDataUrl(spec: SyntheticIndexedPng): string {
  const ihdr = new Uint8Array(13);
  writePngUint32(ihdr, 0, spec.width);
  writePngUint32(ihdr, 4, spec.height);
  ihdr[8] = spec.bitDepth;
  ihdr[9] = 3; // indexed color
  // Compression, filter, and interlace methods stay zero-initialized.

  const plte = new Uint8Array(spec.palette.length * 3);
  spec.palette.forEach((entry, index) => {
    plte.set(entry, index * 3);
  });

  const scanlineBytes = Math.ceil((spec.width * spec.bitDepth) / 8);
  const filtered = new Uint8Array(spec.height * (scanlineBytes + 1));
  let previous: Uint8Array = new Uint8Array(scanlineBytes);

  spec.rows.forEach((row, y) => {
    const raw = packPaletteIndices(row, spec.bitDepth, scanlineBytes);
    const filter = spec.rowFilters[y] ?? 0;
    const rowOffset = y * (scanlineBytes + 1);
    filtered[rowOffset] = filter;

    // Indexed samples are below one byte per pixel, so the filter stride is
    // one byte: sub predicts from the previous byte, up from the row above.
    for (let index = 0; index < scanlineBytes; index += 1) {
      const left = index >= 1 ? (raw[index - 1] ?? 0) : 0;
      const up = previous[index] ?? 0;
      const predictor = filter === 1 ? left : filter === 2 ? up : 0;
      filtered[rowOffset + 1 + index] = ((raw[index] ?? 0) - predictor) & 0xff;
    }

    previous = raw;
  });

  const parts: readonly Uint8Array[] = [
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("PLTE", plte),
    ...(spec.paletteAlpha === undefined
      ? []
      : [pngChunk("tRNS", Uint8Array.from(spec.paletteAlpha))]),
    pngChunk("IDAT", new Uint8Array(deflateSync(filtered))),
    pngChunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const png = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    png.set(part, offset);
    offset += part.byteLength;
  }

  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
}

/** Pack palette indices most-significant sample first, as PNG orders them. */
function packPaletteIndices(
  row: readonly number[],
  bitDepth: number,
  scanlineBytes: number,
): Uint8Array {
  const packed = new Uint8Array(scanlineBytes);
  const samplesPerByte = 8 / bitDepth;

  row.forEach((paletteIndex, x) => {
    const byteIndex = Math.floor(x / samplesPerByte);
    const shift = 8 - bitDepth - (x % samplesPerByte) * bitDepth;
    packed[byteIndex] =
      (packed[byteIndex] ?? 0) |
      ((paletteIndex & ((1 << bitDepth) - 1)) << shift);
  });

  return packed;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.byteLength);
  writePngUint32(chunk, 0, data.byteLength);

  for (let index = 0; index < 4; index += 1) {
    chunk[4 + index] = type.charCodeAt(index);
  }

  chunk.set(data, 8);
  writePngUint32(
    chunk,
    8 + data.byteLength,
    crc32(chunk.subarray(4, 8 + data.byteLength)),
  );
  return chunk;
}

function writePngUint32(
  bytes: Uint8Array,
  offset: number,
  value: number,
): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}
