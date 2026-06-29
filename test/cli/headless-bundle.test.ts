import { describe, expect, it } from "vitest";
import {
  APERTURE_SNAPSHOT_BUNDLE_FORMAT,
  APERTURE_SNAPSHOT_BUNDLE_VERSION,
  APERTURE_SOURCE_ASSET_SCHEMA,
  APERTURE_TYPED_ARRAY_JSON_CODEC,
  createApertureSnapshotBundle,
  createApertureSnapshotBundleClosure,
  createNodeApertureAssetLoader,
  preflightApertureSnapshotBundle,
} from "@aperture-engine/cli";
import {
  createApertureHeadlessRunner,
  createApertureSessionSnapshot,
} from "@aperture-engine/app/headless";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { renderSnapshotFromJsonValue } from "@aperture-engine/render";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";

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

const hdrEnvironmentSystem: ApertureSystemModule = {
  default: class HdrEnvironmentScene extends createSystem({ priority: 0 }) {
    override init(): void {
      const studio = this.assets.hdr("studio");

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
      this.spawn.light({
        key: "environment",
        kind: "environment",
        light: {
          environmentMap: studio.renderHandle,
        },
      });
    }
  },
};

function meshHandleIds(value: unknown): string[] {
  const snapshot = value as {
    meshDraws?: ReadonlyArray<{ mesh?: { id?: string } }>;
  };
  return (snapshot.meshDraws ?? [])
    .map((draw) => draw.mesh?.id)
    .filter((id): id is string => typeof id === "string");
}

interface TestSourceAssetEntry {
  readonly handle: { readonly kind: string; readonly id: string };
  readonly label: string;
  readonly status: string;
  readonly version: number;
  readonly asset: unknown;
  readonly dependencies: readonly {
    readonly kind: string;
    readonly id: string;
  }[];
  readonly diagnostics: readonly unknown[];
}

function sourceAssetEntry(
  kind: string,
  id: string,
  options: {
    readonly asset?: unknown;
    readonly dependencies?: TestSourceAssetEntry["dependencies"];
  } = {},
): TestSourceAssetEntry {
  return {
    handle: { kind, id },
    label: id,
    status: "ready",
    version: 1,
    asset: options.asset ?? null,
    dependencies: options.dependencies ?? [],
    diagnostics: [],
  };
}

function preflightBundle(
  snapshot: unknown,
  entries: readonly TestSourceAssetEntry[],
) {
  return preflightApertureSnapshotBundle({
    format: APERTURE_SNAPSHOT_BUNDLE_FORMAT,
    version: APERTURE_SNAPSHOT_BUNDLE_VERSION,
    engine: {
      apertureVersion: "0.0.0",
      snapshotSchema: "aperture.render-snapshot.v1",
      assetSchema: APERTURE_SOURCE_ASSET_SCHEMA,
      createdBy: "test",
    },
    frame: 0,
    renderTarget: {
      width: 64,
      height: 64,
      colorSpace: "srgb",
      sampleCount: 4,
    },
    requirements: { webgpuFeatures: [], textureFormats: [] },
    snapshot: { codec: APERTURE_TYPED_ARRAY_JSON_CODEC, value: snapshot },
    assets: {
      schema: APERTURE_SOURCE_ASSET_SCHEMA,
      completeness: "complete",
      allowPlaceholders: false,
      entries,
    },
    closure: createApertureSnapshotBundleClosure({
      snapshot,
      sourceAssets: { entries },
    }),
    diagnostics: [],
    digest: {
      algorithm: "fnv1a32-stable-json-v1",
      hash: "00000000",
      byteLength: 0,
    },
  });
}

describe("createApertureSnapshotBundle (P1.6)", () => {
  it("emits a versioned bundle whose snapshot round-trips through the codec", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [cubeSystem],
    });
    const { snapshot } = runner.step(1 / 60, 0);

    const bundle = createApertureSnapshotBundle({
      snapshot,
      assets: runner.app.lowLevel.assets,
    });

    expect(bundle.format).toBe(APERTURE_SNAPSHOT_BUNDLE_FORMAT);
    expect(bundle.version).toBe(APERTURE_SNAPSHOT_BUNDLE_VERSION);
    expect(bundle.engine.snapshotSchema).toBe("aperture.render-snapshot.v1");
    expect(bundle.engine.assetSchema).toBe(APERTURE_SOURCE_ASSET_SCHEMA);
    expect(bundle.snapshot.codec).toBe(APERTURE_TYPED_ARRAY_JSON_CODEC);
    expect(bundle.renderTarget).toMatchObject({
      width: 960,
      height: 640,
      colorSpace: "srgb",
      sampleCount: 4,
    });
    expect(bundle.digest.hash).toMatch(/^[0-9a-f]{8}$/u);
    expect(bundle.frame).toBe(snapshot.frame);

    // The bundle must survive JSON serialization (it is written to disk).
    const onDisk = JSON.parse(JSON.stringify(bundle)) as typeof bundle;
    const rebuilt = renderSnapshotFromJsonValue(onDisk.snapshot.value);
    expect(rebuilt.meshDraws.length).toBe(snapshot.meshDraws.length);
    expect(Array.from(rebuilt.transforms)).toEqual(
      Array.from(snapshot.transforms),
    );
  });

  it("co-persists a source-asset entry for every mesh draw handle", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [cubeSystem],
    });
    const { snapshot } = runner.step(1 / 60, 0);
    const bundle = createApertureSnapshotBundle({
      snapshot,
      assets: runner.app.lowLevel.assets,
    });

    const assetIds = new Set(
      bundle.assets.entries
        .map((entry) => entry.handle.id)
        .filter((id): id is string => typeof id === "string"),
    );

    const drawIds = meshHandleIds(snapshot);
    expect(drawIds.length).toBeGreaterThan(0);
    for (const id of drawIds) {
      expect(assetIds.has(id)).toBe(true);
      expect(bundle.closure.roots).toContain(`mesh:${id}`);
      expect(bundle.closure.referenced).toContain(`mesh:${id}`);
    }

    expect(bundle.closure.missing).toEqual([]);
    expect(bundle.closure.unready).toEqual([]);
    expect(bundle.closure.placeholders).toEqual([]);
  });

  it("can attach a render bundle as a session snapshot inspection sidecar", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [cubeSystem],
    });
    const { snapshot } = runner.step(1 / 60, 0);
    const bundle = createApertureSnapshotBundle({
      snapshot,
      assets: runner.app.lowLevel.assets,
    });

    const session = createApertureSessionSnapshot(runner, {
      inspection: { renderBundle: bundle },
    });
    const onDisk = JSON.parse(JSON.stringify(session)) as typeof session;

    expect(onDisk.inspection?.renderBundle).toMatchObject({
      format: APERTURE_SNAPSHOT_BUNDLE_FORMAT,
      version: APERTURE_SNAPSHOT_BUNDLE_VERSION,
      digest: bundle.digest,
    });
  });

  it("co-persists embedded HDR environment payloads referenced by extraction", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          studio: asset.hdr(syntheticHdrDataUrl(), { preload: "blocking" }),
        },
      }),
      systems: [hdrEnvironmentSystem],
      assetLoader: createNodeApertureAssetLoader({ mode: "strict" }),
    });
    const { snapshot } = runner.step(1 / 60, 0);

    expect(snapshot.environments).toHaveLength(1);

    const bundle = createApertureSnapshotBundle({
      snapshot,
      assets: runner.app.lowLevel.assets,
    });
    const environmentEntry = bundle.assets.entries.find(
      (entry) =>
        entry.handle.kind === "environment-map" && entry.handle.id === "studio",
    );
    const environmentAsset = environmentEntry?.asset as
      | {
          readonly equirectSource?: {
            readonly data?: unknown;
          };
        }
      | null
      | undefined;

    expect(bundle.closure.roots).toContain("environment-map:studio");
    expect(bundle.closure.referenced).toContain("environment-map:studio");
    expect(environmentAsset?.equirectSource?.data).toBeDefined();
    expect(preflightApertureSnapshotBundle(bundle).ok).toBe(true);
  });

  it("preflights direct and transitive source-asset closure", () => {
    const snapshot = {
      meshDraws: [
        {
          mesh: { kind: "mesh", id: "cube" },
          material: { kind: "material", id: "textured" },
        },
      ],
    };
    const sourceAssets = {
      entries: [
        {
          handle: { kind: "mesh", id: "cube" },
          label: "cube",
          status: "ready",
          version: 1,
          asset: null,
          dependencies: [],
          diagnostics: [],
        },
        {
          handle: { kind: "material", id: "textured" },
          label: "textured",
          status: "ready",
          version: 1,
          asset: null,
          dependencies: [
            { kind: "texture", id: "albedo" },
            { kind: "sampler", id: "linear" },
          ],
          diagnostics: [],
        },
        {
          handle: { kind: "texture", id: "albedo" },
          label: "albedo",
          status: "ready",
          version: 1,
          asset: null,
          dependencies: [],
          diagnostics: [],
        },
        {
          handle: { kind: "sampler", id: "linear" },
          label: "linear",
          status: "ready",
          version: 1,
          asset: null,
          dependencies: [],
          diagnostics: [],
        },
      ],
    };
    const result = preflightApertureSnapshotBundle({
      format: APERTURE_SNAPSHOT_BUNDLE_FORMAT,
      version: APERTURE_SNAPSHOT_BUNDLE_VERSION,
      engine: {
        apertureVersion: "0.0.0",
        snapshotSchema: "aperture.render-snapshot.v1",
        assetSchema: APERTURE_SOURCE_ASSET_SCHEMA,
        createdBy: "test",
      },
      frame: 0,
      renderTarget: {
        width: 64,
        height: 64,
        colorSpace: "srgb",
        sampleCount: 4,
      },
      requirements: { webgpuFeatures: [], textureFormats: [] },
      snapshot: { codec: APERTURE_TYPED_ARRAY_JSON_CODEC, value: snapshot },
      assets: {
        schema: APERTURE_SOURCE_ASSET_SCHEMA,
        completeness: "complete",
        allowPlaceholders: false,
        entries: sourceAssets.entries,
      },
      closure: createApertureSnapshotBundleClosure({
        snapshot,
        sourceAssets,
      }),
      diagnostics: [],
      digest: {
        algorithm: "fnv1a32-stable-json-v1",
        hash: "00000000",
        byteLength: 0,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.closure.roots).toEqual(["material:textured", "mesh:cube"]);
    expect(result.closure.referenced).toEqual([
      "material:textured",
      "mesh:cube",
      "sampler:linear",
      "texture:albedo",
    ]);
  });

  it("rejects unsupported asset-handle-shaped snapshot values", () => {
    const result = preflightBundle(
      {
        meshDraws: [
          {
            mesh: { kind: "mesh", id: "cube" },
            material: { kind: "future-material", id: "x" },
          },
        ],
      },
      [sourceAssetEntry("mesh", "cube")],
    );

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      "unsupported asset handles: future-material:x",
    );
  });

  it("rejects mesh patch payloads without a base mesh in the bundle", () => {
    const result = preflightBundle(
      {
        meshDraws: [{ mesh: { kind: "mesh", id: "cube" } }],
      },
      [
        sourceAssetEntry("mesh", "cube", {
          asset: {
            kind: "aperture.meshAssetPatch.v1",
            meshLayoutKey: "layout",
            vertexStreams: [],
            submeshes: [],
            materialSlots: [],
          },
        }),
      ],
    );

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      "mesh patch assets without base payload: mesh:cube",
    );
  });

  it("rejects referenced assets that still need runtime URL fetches", () => {
    const result = preflightBundle(
      {
        meshDraws: [
          {
            mesh: { kind: "mesh", id: "cube" },
            material: { kind: "material", id: "textured" },
          },
        ],
      },
      [
        sourceAssetEntry("mesh", "cube"),
        sourceAssetEntry("material", "textured", {
          dependencies: [{ kind: "texture", id: "albedo" }],
        }),
        sourceAssetEntry("texture", "albedo", {
          asset: {
            kind: "texture",
            url: "/assets/albedo.png",
          },
        }),
      ],
    );

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      "runtime external asset dependencies: texture:albedo (texture URL without embedded sourceData)",
    );
  });

  it("rejects referenced environment maps that still need runtime URL fetches", () => {
    const result = preflightBundle(
      {
        environments: [
          {
            environmentId: 1,
            handle: { kind: "environment-map", id: "studio" },
            intensity: 1,
          },
        ],
      },
      [
        sourceAssetEntry("environment-map", "studio", {
          asset: {
            kind: "hdr",
            url: "/assets/studio.hdr",
          },
        }),
      ],
    );

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      "runtime external asset dependencies: environment-map:studio (environment-map URL without embedded environment payload)",
    );
  });

  it("rejects referenced environment maps without embedded payloads", () => {
    const result = preflightBundle(
      {
        environments: [
          {
            environmentId: 1,
            handle: { kind: "environment-map", id: "studio" },
            intensity: 1,
          },
        ],
      },
      [
        sourceAssetEntry("environment-map", "studio", {
          asset: {
            kind: "environment-map",
          },
        }),
      ],
    );

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      "runtime external asset dependencies: environment-map:studio (environment-map without embedded environment payload)",
    );
  });

  it("accepts referenced environment maps with embedded equirect payloads", () => {
    const result = preflightBundle(
      {
        environments: [
          {
            environmentId: 1,
            handle: { kind: "environment-map", id: "studio" },
            intensity: 1,
          },
        ],
      },
      [
        sourceAssetEntry("environment-map", "studio", {
          asset: {
            kind: "environment-map",
            url: "/assets/studio.hdr",
            equirectSource: {
              width: 1,
              height: 1,
              data: {
                $typedArray: "Uint8Array",
                base64: "/////w==",
                length: 4,
              },
            },
          },
        }),
      ],
    );

    expect(result.ok).toBe(true);
  });
});

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
