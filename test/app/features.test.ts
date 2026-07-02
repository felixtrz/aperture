import { describe, expect, it } from "vitest";
import { AssetRegistry, createWorld } from "@aperture-engine/simulation";
import { createApertureApp } from "@aperture-engine/app";
import { defineApertureConfig } from "@aperture-engine/app/config";
import {
  ApertureFeatureError,
  createFeatureDiagnosticsSink,
  installApertureWorkerFeatures,
  resolveApertureWorkerFeatureOrder,
  type ApertureWorkerFeature,
} from "@aperture-engine/app/features";
import { particlesFeature } from "@aperture-engine/particles/app";

describe("app feature resolver", () => {
  it("orders required features before dependents and disposes in reverse order", async () => {
    const events: string[] = [];
    const features: ApertureWorkerFeature[] = [
      runtimeFeature("b", events, { requires: ["a"] }),
      runtimeFeature("a", events),
    ];

    const installed = await installApertureWorkerFeatures({
      features,
      ...workerContext(),
    });

    expect(installed.order).toEqual(["a", "b"]);
    expect(events).toEqual(["install:a", "install:b"]);

    await installed.dispose();

    expect(events).toEqual([
      "install:a",
      "install:b",
      "dispose:b",
      "dispose:a",
    ]);
  });

  it("rolls back already-installed features when a later feature fails", async () => {
    const events: string[] = [];
    const features: ApertureWorkerFeature[] = [
      runtimeFeature("a", events),
      {
        id: "b",
        installRuntime() {
          events.push("install:b");
          throw new Error("boom");
        },
      },
    ];

    await expect(
      installApertureWorkerFeatures({
        features,
        ...workerContext(),
      }),
    ).rejects.toMatchObject({
      code: "aperture.feature.installFailed",
    });

    expect(events).toEqual(["install:a", "install:b", "dispose:a"]);
  });

  it("awaits async feature disposers during dispose and rollback", async () => {
    const events: string[] = [];
    const installed = await installApertureWorkerFeatures({
      features: [
        {
          id: "a",
          installRuntime() {
            events.push("install:a");
            return async () => {
              await Promise.resolve();
              events.push("dispose:a");
            };
          },
        },
        {
          id: "b",
          installExtraction() {
            events.push("install:b");
            return {
              async dispose() {
                await Promise.resolve();
                events.push("dispose:b");
              },
            };
          },
        },
      ],
      ...workerContext(),
    });

    await installed.dispose();

    expect(events).toEqual([
      "install:a",
      "install:b",
      "dispose:b",
      "dispose:a",
    ]);

    events.length = 0;

    await expect(
      installApertureWorkerFeatures({
        features: [
          {
            id: "a",
            installRuntime() {
              events.push("install:a");
              return async () => {
                await Promise.resolve();
                events.push("dispose:a");
              };
            },
          },
          {
            id: "b",
            installRuntime() {
              events.push("install:b");
              throw new Error("boom");
            },
          },
        ],
        ...workerContext(),
      }),
    ).rejects.toMatchObject({
      code: "aperture.feature.installFailed",
    });

    expect(events).toEqual(["install:a", "install:b", "dispose:a"]);
  });

  it("passes a real extractor registrar to extraction features", async () => {
    const registered: string[][] = [];
    const disposed: string[] = [];
    const installed = await installApertureWorkerFeatures({
      features: [
        {
          id: "particles",
          installExtraction({ registerExtractor }) {
            return registerExtractor({
              id: "particles",
              packetFamilies: ["particleEmitters"],
            });
          },
        },
      ],
      ...workerContext(),
      registerExtractor(hook) {
        registered.push([...hook.packetFamilies]);
        return () => {
          disposed.push(hook.id);
        };
      },
    });

    expect(registered).toEqual([["particleEmitters"]]);

    await installed.dispose();

    expect(disposed).toEqual(["particles"]);
  });

  it("reports extraction registration when no registrar is provided", async () => {
    await expect(
      installApertureWorkerFeatures({
        features: [
          {
            id: "particles",
            installExtraction({ registerExtractor }) {
              return registerExtractor({
                id: "particles",
                packetFamilies: ["particleEmitters"],
              });
            },
          },
        ],
        ...workerContext(),
      }),
    ).rejects.toMatchObject({
      code: "aperture.feature.resolutionFailed",
    });
  });

  it("reports duplicate and missing required features before installation", () => {
    const duplicate: ApertureWorkerFeature[] = [
      { id: "physics" },
      { id: "physics" },
    ];
    const missing: ApertureWorkerFeature[] = [
      { id: "physics-rapier", requires: ["physics"] },
    ];

    expect(() => resolveApertureWorkerFeatureOrder(duplicate)).toThrow(
      ApertureFeatureError,
    );
    expect(() => resolveApertureWorkerFeatureOrder(missing)).toThrow(
      ApertureFeatureError,
    );
  });

  it("reports conflicting and cyclic features before installation", () => {
    const conflicting: ApertureWorkerFeature[] = [
      { id: "ui", conflictsWith: ["headless-ui"] },
      { id: "headless-ui" },
    ];
    const cyclic: ApertureWorkerFeature[] = [
      { id: "a", requires: ["b"] },
      { id: "b", requires: ["a"] },
    ];

    expect(() => resolveApertureWorkerFeatureOrder(conflicting)).toThrow(
      ApertureFeatureError,
    );
    expect(() => resolveApertureWorkerFeatureOrder(cyclic)).toThrow(
      ApertureFeatureError,
    );
  });

  it("drops optional ordering hints that would form a cycle instead of failing", () => {
    // Mutual optional hints: either order is valid, so resolution keeps going.
    const mutualOptional = resolveApertureWorkerFeatureOrder([
      { id: "a", optional: ["b"] },
      { id: "b", optional: ["a"] },
    ]);

    expect(mutualOptional.map((feature) => feature.id).sort()).toEqual([
      "a",
      "b",
    ]);

    // A cycle mixing one optional and one required edge resolves by dropping
    // the optional hint and honoring the hard dependency.
    const mixed = resolveApertureWorkerFeatureOrder([
      { id: "a", optional: ["b"] },
      { id: "b", requires: ["a"] },
    ]);

    expect(mixed.map((feature) => feature.id)).toEqual(["a", "b"]);

    // Acyclic optional hints still order features.
    const acyclic = resolveApertureWorkerFeatureOrder([
      { id: "a", optional: ["b"] },
      { id: "b" },
    ]);

    expect(acyclic.map((feature) => feature.id)).toEqual(["b", "a"]);
  });

  it("resolves independently of diagnostics a reused sink already carries", async () => {
    const sink = createFeatureDiagnosticsSink([
      {
        code: "aperture.feature.installFailed",
        severity: "error",
        featureId: "earlier-run",
        message: "A previous install legitimately failed.",
      },
    ]);

    const installed = await installApertureWorkerFeatures({
      features: [{ id: "a" }],
      world: createWorld(),
      assets: new AssetRegistry(),
      registerFixedStepTask: () => () => undefined,
      diagnostics: sink,
    });

    expect(installed.order).toEqual(["a"]);
    // The pre-existing entry is preserved, not counted against this run.
    expect(sink.list()).toHaveLength(1);

    await installed.dispose();
  });

  it("installs configured feature descriptors from app config", async () => {
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        features: [particlesFeature()],
      }),
    });

    expect(app.features.order).toEqual(["particles"]);

    await app.dispose();
  });
});

function runtimeFeature(
  id: string,
  events: string[],
  options: Pick<ApertureWorkerFeature, "requires"> = {},
): ApertureWorkerFeature {
  return {
    id,
    ...options,
    installRuntime() {
      events.push(`install:${id}`);
      return () => {
        events.push(`dispose:${id}`);
      };
    },
  };
}

function workerContext(): Omit<
  Parameters<typeof installApertureWorkerFeatures>[0],
  "features"
> {
  return {
    world: createWorld(),
    assets: new AssetRegistry(),
    registerFixedStepTask() {
      return () => undefined;
    },
  };
}
