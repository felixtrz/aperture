import { describe, expect, it } from "vitest";

import {
  createWebGpuAppEnvironmentFramePreparer,
  environmentAssetInputsFromRegistry,
  firstSnapshotEnvironmentHandle,
} from "@aperture-engine/webgpu";
import {
  AssetRegistry,
  createEnvironmentMapHandle,
} from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";

function readyEnvironmentRegistry(id: string): AssetRegistry {
  const registry = new AssetRegistry();
  const handle = createEnvironmentMapHandle(id);

  registry.register(handle, { label: `${id} label` });
  registry.markReady(handle, {
    kind: "environment-map",
    label: `${id} label`,
    diffuseResourceKey: `environment-map:${id}:diffuse`,
    specularResourceKey: `environment-map:${id}:specular`,
    equirectSource: {
      label: id,
      resourceKey: `environment-map:${id}:equirect-cube`,
      width: 4,
      height: 2,
      data: new Uint8Array(4 * 2 * 4),
      faceSize: 4,
      format: "rgba8unorm",
      mipLevelCount: 1,
    },
    standardMaterialCount: 1,
  });
  return registry;
}

function snapshotWithEnvironment(id: string | null): RenderSnapshot {
  return {
    environments:
      id === null
        ? []
        : [
            {
              environmentId: 1,
              handle: createEnvironmentMapHandle(id),
              color: [1, 1, 1, 1],
              intensity: 1,
              layerMask: 1,
            },
          ],
  } as unknown as RenderSnapshot;
}

describe("firstSnapshotEnvironmentHandle", () => {
  it("returns the first non-null environment handle", () => {
    expect(
      firstSnapshotEnvironmentHandle(snapshotWithEnvironment("env.a"))?.id,
    ).toBe("env.a");
    expect(firstSnapshotEnvironmentHandle(snapshotWithEnvironment(null))).toBe(
      null,
    );
    expect(
      firstSnapshotEnvironmentHandle({} as unknown as RenderSnapshot),
    ).toBe(null);
  });
});

describe("environmentAssetInputsFromRegistry", () => {
  it("maps ready environment-map entries with equirect sources", () => {
    const inputs = environmentAssetInputsFromRegistry(
      readyEnvironmentRegistry("env.a"),
    );

    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({
      label: "env.a label",
      diffuseResourceKey: "environment-map:env.a:diffuse",
      specularResourceKey: "environment-map:env.a:specular",
      standardMaterialCount: 1,
      equirectSource: {
        width: 4,
        height: 2,
        faceSize: 4,
        format: "rgba8unorm",
      },
    });
    expect(inputs[0]?.handle.id).toBe("env.a");
  });

  it("skips entries without pixel data (e.g. URL-only browser HDR entries)", () => {
    const registry = new AssetRegistry();
    const handle = createEnvironmentMapHandle("env.url-only");

    registry.register(handle);
    // The browser built-in loader marks HDR config assets ready with only
    // { id, kind, url } — no equirectSource. Those must not produce inputs.
    registry.markReady(handle, { kind: "environment-map", url: "/sky.hdr" });

    expect(environmentAssetInputsFromRegistry(registry)).toHaveLength(0);
  });

  it("derives fallback resource keys when the asset omits them", () => {
    const registry = new AssetRegistry();
    const handle = createEnvironmentMapHandle("env.bare");

    registry.register(handle);
    registry.markReady(handle, {
      kind: "environment-map",
      equirectSource: {
        width: 2,
        height: 1,
        data: new Uint8Array(2 * 1 * 4),
      },
    });

    const inputs = environmentAssetInputsFromRegistry(registry);

    expect(inputs[0]).toMatchObject({
      diffuseResourceKey: "environment-map:env.bare:diffuse",
      specularResourceKey: "environment-map:env.bare:specular",
    });
  });
});

describe("createWebGpuAppEnvironmentFramePreparer", () => {
  it("returns undefined when the snapshot has no environment", () => {
    const preparer = createWebGpuAppEnvironmentFramePreparer({
      app: {},
      registry: readyEnvironmentRegistry("env.a"),
    });

    expect(preparer.resolve(snapshotWithEnvironment(null))).toBeUndefined();
  });

  it("returns undefined when no ready environment asset exists", () => {
    const preparer = createWebGpuAppEnvironmentFramePreparer({
      app: {},
      registry: new AssetRegistry(),
    });

    expect(preparer.resolve(snapshotWithEnvironment("env.a"))).toBeUndefined();
  });

  it("memoizes preparation per asset version, including failures", () => {
    // An empty device-like cannot prepare IBL resources; the preparer must
    // cache that outcome instead of re-running the preparation chain per
    // frame. registry.markReady bumps the version, which invalidates the key.
    const registry = readyEnvironmentRegistry("env.a");
    const preparer = createWebGpuAppEnvironmentFramePreparer({
      app: {},
      registry,
    });
    const snapshot = snapshotWithEnvironment("env.a");

    const first = preparer.resolve(snapshot);
    const second = preparer.resolve(snapshot);

    expect(first).toBeUndefined();
    expect(second).toBeUndefined();

    const entry = registry.get(createEnvironmentMapHandle("env.a"));
    const versionBefore = entry?.version;

    registry.markReady(createEnvironmentMapHandle("env.a"), entry?.asset);
    expect(registry.get(createEnvironmentMapHandle("env.a"))?.version).not.toBe(
      versionBefore,
    );
    // A version bump re-prepares without throwing (still unsupported device).
    expect(preparer.resolve(snapshot)).toBeUndefined();
  });
});
