import { afterEach, describe, expect, it, vi } from "vitest";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem } from "@aperture-engine/app/systems";
import {
  disposeApertureApp,
  preflightApertureApp,
} from "@aperture-engine/app/advanced";
import {
  createApertureSessionSnapshot,
  restoreApertureHeadlessRunnerFromSessionSnapshot,
} from "@aperture-engine/app/headless";
import {
  createSystem as createEcsSystem,
  Name,
  type Entity,
} from "@aperture-engine/simulation";
import { createHeadlessSessionController } from "../../packages/cli/src/headless/session-controller.js";
import { ApertureMcpSessionManager } from "../../packages/cli/src/mcp-session-manager.js";
import * as configLoader from "../../packages/cli/src/headless/config-loader.js";
import * as assetLoader from "../../packages/cli/src/headless/node-asset-loader.js";
import {
  deferred,
  entityName,
  resetFeatureFixture,
  resetOptions,
  resetRender,
} from "../helpers/reset-isolation-fixture.js";

vi.setConfig({ testTimeout: 60_000 });
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Headless world replacement isolation", () => {
  it("disposes old systems before reset initializes matching component rows", async () => {
    const entities: Entity[] = [];
    const events: string[] = [];
    class ProbeSystem extends createSystem() {
      #entity!: Entity;
      override init(): void {
        this.#entity = this.createEntity().addComponent(Name, {
          value: `boot-${entities.length + 1}`,
        });
        entities.push(this.#entity);
        events.push(`init-${entities.length}`);
      }
      override destroy(): void {
        events.push(`destroy-${entities.indexOf(this.#entity) + 1}`);
        this.#entity.setValue(Name, "value", "old-cleanup");
      }
    }
    const controller = await createHeadlessSessionController({
      ...resetOptions,
      config: defineApertureConfig({ mode: "headless", render: resetRender }),
      systems: [{ default: ProbeSystem }],
    });
    try {
      await controller.reset({ seed: 9 });
      expect(entities.map((entity) => entity.index)).toEqual([0, 0]);
      expect(entityName(entities[1]!)).toBe("boot-2");
      expect(events).toEqual(["init-1", "destroy-1", "init-2"]);
      expect(controller.seed).toBe(9);
    } finally {
      await controller.dispose();
    }
  });

  it("awaits async cleanup with an explicit unavailable state and prevents overlapping resets", async () => {
    const started = deferred();
    const release = deferred();
    const fixture = resetFeatureFixture(async (entity, generation) => {
      if (generation === 1) {
        started.resolve();
        await release.promise;
        entity.setValue(Name, "value", "old-async-cleanup");
      }
    });
    const controller = await createHeadlessSessionController({
      ...resetOptions,
      config: fixture.config,
      systems: [],
    });
    try {
      const pending = controller.reset();
      await started.promise;
      expect(fixture.entities).toHaveLength(1);
      expect(controller.lifecycle).toBe("replacing");
      expect(controller.status()).toMatchObject({
        running: false,
        lifecycle: "replacing",
      });
      expect(() => controller.step()).toThrow("session is replacing");
      expect(() => controller.runner).toThrow("session is replacing");
      expect(controller.callTool({ name: "logs_read", arguments: {} }).ok).toBe(
        true,
      );
      await expect(controller.reset()).rejects.toThrow("already in progress");
      release.resolve();
      await pending;
      expect(entityName(fixture.entities[1]!)).toBe("boot-2");
      expect(fixture.events).toEqual(["boot-1", "dispose-1", "boot-2"]);
    } finally {
      release.resolve();
      await controller.dispose();
    }
  });

  it("restores checkpoint values only after old feature cleanup", async () => {
    const fixture = resetFeatureFixture((entity, generation) => {
      if (generation === 1)
        entity.setValue(Name, "value", "old-feature-cleanup");
    });
    const controller = await createHeadlessSessionController({
      ...resetOptions,
      config: fixture.config,
      systems: [],
    });
    try {
      fixture.entities[0]!.setValue(Name, "value", "checkpoint-name");
      const snapshot = createApertureSessionSnapshot(controller.runner);
      await expect(
        controller.restoreSessionSnapshot({ snapshot }),
      ).resolves.toMatchObject({ ok: true });
      const restoredEntity =
        controller.runner.app.lowLevel.world.entityManager.getEntityByIndex(0)!;
      expect(entityName(restoredEntity)).toBe("checkpoint-name");
      expect(fixture.events).toEqual(["boot-1", "dispose-1", "boot-2"]);
    } finally {
      await controller.dispose();
    }
  });

  it("preserves the old session on snapshot preflight failure without booting a candidate", async () => {
    const fixture = resetFeatureFixture();
    const controller = await createHeadlessSessionController({
      ...resetOptions,
      config: fixture.config,
      systems: [],
    });
    try {
      const old = controller.runner;
      const snapshot = createApertureSessionSnapshot(old);
      const invalid = {
        ...snapshot,
        version: 999,
      } as unknown as typeof snapshot;
      await expect(
        controller.restoreSessionSnapshot({ snapshot: invalid }),
      ).rejects.toThrow("Unsupported Aperture session snapshot");
      await expect(
        restoreApertureHeadlessRunnerFromSessionSnapshot({
          config: fixture.config,
          systems: [],
          snapshot: invalid,
        }),
      ).rejects.toThrow("Unsupported Aperture session snapshot");
      expect(controller.runner).toBe(old);
      expect(entityName(fixture.entities[0]!)).toBe("boot-1");
      expect(fixture.events).toEqual(["boot-1"]);
    } finally {
      await controller.dispose();
    }
  });

  it("stops old timers before the replacement waits for blocking assets", async () => {
    const loading = deferred();
    const release = deferred();
    let oldTimer: ReturnType<typeof setInterval> | undefined;
    const fixture = resetFeatureFixture();
    const feature = fixture.config.features![0]!;
    const config = defineApertureConfig({
      ...fixture.config,
      assets: {
        probe: asset.texture("/irrelevant.png", { preload: "blocking" }),
      },
      features: [
        {
          ...feature,
          installRuntime(context) {
            const dispose = feature.installRuntime!(
              context,
            ) as () => Promise<void>;
            if (fixture.entities.length === 1) {
              const entity = fixture.entities[0]!;
              oldTimer = setInterval(
                () => entity.setValue(Name, "value", "old-timer-write"),
                1,
              );
              return async () => {
                clearInterval(oldTimer);
                oldTimer = undefined;
                await dispose();
              };
            }
            return dispose;
          },
        },
      ],
    });
    let loads = 0;
    const createLoader = assetLoader.createNodeApertureAssetLoader;
    vi.spyOn(assetLoader, "createNodeApertureAssetLoader").mockImplementation(
      (options) => {
        const actual = createLoader(options);
        return {
          async load(handle, context) {
            if (++loads === 2) {
              loading.resolve();
              await release.promise;
            }
            return actual.load(handle, context);
          },
        };
      },
    );
    vi.useFakeTimers();
    const controller = await createHeadlessSessionController({
      ...resetOptions,
      config,
      systems: [],
    });
    try {
      const pending = controller.reset();
      await loading.promise;
      expect(oldTimer).toBeUndefined();
      await vi.advanceTimersByTimeAsync(100);
      expect(entityName(fixture.entities[1]!)).toBe("boot-2");
      release.resolve();
      await pending;
      expect(entityName(fixture.entities[1]!)).toBe("boot-2");
    } finally {
      clearInterval(oldTimer);
      release.resolve();
      await controller.dispose();
    }
  });

  it("releases initialized and throwing-initializer systems before a clean failed reset can retry", async () => {
    const fixture = resetFeatureFixture();
    const destroyed: string[] = [];
    let owners = 0;
    let boots = 0;
    class AOwnsResources extends createSystem({ priority: 0 }) {
      #id = ++owners;
      override async destroy(): Promise<void> {
        await Promise.resolve();
        destroyed.push(`owner-${this.#id}`);
      }
    }
    class BFails extends createSystem({ priority: 1 }) {
      #id = ++boots;
      override init(): void {
        if (this.#id === 2) throw new Error("primary bootstrap failure");
      }
      override async destroy(): Promise<void> {
        await Promise.resolve();
        destroyed.push(`initializer-${this.#id}`);
      }
    }
    const controller = await createHeadlessSessionController({
      ...resetOptions,
      config: fixture.config,
      systems: [{ default: AOwnsResources }, { default: BFails }],
    });
    try {
      await expect(controller.reset({ seed: 99 })).rejects.toThrow(
        "primary bootstrap failure",
      );
      expect(controller.status()).toMatchObject({
        lifecycle: "failed",
        running: false,
        retryable: true,
        cleanupBlocked: false,
        seed: 0,
      });
      expect(() => controller.runner).toThrow("session is failed");
      expect(() => controller.step()).toThrow("session is failed");
      expect(destroyed).toEqual([
        "owner-1",
        "initializer-1",
        "owner-2",
        "initializer-2",
      ]);
      expect(fixture.events).toEqual([
        "boot-1",
        "dispose-1",
        "boot-2",
        "dispose-2",
      ]);
      await controller.reset({ seed: 7 });
      expect(controller.lifecycle).toBe("ready");
      expect(controller.seed).toBe(7);
      expect(entityName(fixture.entities[2]!)).toBe("boot-3");
    } finally {
      await controller.dispose();
    }
  });

  it("cleans a candidate when restoration throws and permits a subsequent restore", async () => {
    const fixture = resetFeatureFixture();
    let fail = true;
    const primary = new Error("primary restore failure");
    const destroyed: number[] = [];
    let instances = 0;
    class Restorer extends createSystem() {
      #id = ++instances;
      override afterRestore(): void {
        if (fail) {
          fail = false;
          throw primary;
        }
      }
      override destroy(): void {
        destroyed.push(this.#id);
      }
    }
    const controller = await createHeadlessSessionController({
      ...resetOptions,
      config: fixture.config,
      systems: [{ default: Restorer }],
    });
    try {
      const snapshot = createApertureSessionSnapshot(controller.runner);
      await expect(
        controller.restoreSessionSnapshot({ snapshot }),
      ).rejects.toBe(primary);
      expect(controller.status()).toMatchObject({
        lifecycle: "failed",
        retryable: true,
      });
      expect(destroyed).toEqual([1, 2]);
      expect(
        JSON.stringify(controller.callTool({ name: "logs_read" })),
      ).toContain(primary.message);
      await expect(
        controller.restoreSessionSnapshot({ snapshot }),
      ).resolves.toMatchObject({ ok: true });
      expect(controller.lifecycle).toBe("ready");
    } finally {
      await controller.dispose();
    }
  });

  it("MCP preserves old availability through preflight, then safely replaces and retries failed boot", async () => {
    const fixture = resetFeatureFixture((entity, generation) => {
      if (generation === 1) entity.setValue(Name, "value", "old-mcp-cleanup");
    });
    let boots = 0;
    class FailThirdBoot extends createSystem() {
      override init(): void {
        if (++boots === 3) throw new Error("MCP candidate failed");
      }
    }
    const load = vi
      .spyOn(configLoader, "loadApertureHeadlessApp")
      .mockResolvedValue({
        config: fixture.config,
        systems: [{ default: FailThirdBoot }],
        diagnostics: [],
        configFile: "/audit/config.ts",
        root: "/audit",
      });
    const manager = new ApertureMcpSessionManager({ cwd: process.cwd() });
    const start = () =>
      manager.call({
        name: "app_start",
        args: { target: "headless", config: "/audit/config.ts" },
      });
    const status = () =>
      manager.call({ name: "app_status", args: { target: "headless" } });
    try {
      await expect(start()).resolves.toMatchObject({ ok: true });
      load.mockRejectedValueOnce(new Error("config preflight failed"));
      await expect(start()).resolves.toMatchObject({ ok: false });
      await expect(status()).resolves.toMatchObject({ running: true });
      expect(fixture.events).toEqual(["boot-1"]);
      await expect(start()).resolves.toMatchObject({ ok: true });
      expect(entityName(fixture.entities[1]!)).toBe("boot-2");
      expect(fixture.events).toEqual(["boot-1", "dispose-1", "boot-2"]);
      const failed = await start();
      expect(JSON.stringify(failed)).toContain("MCP candidate failed");
      expect(failed).toMatchObject({ ok: false });
      await expect(status()).resolves.toMatchObject({
        running: false,
        lifecycle: "failed",
        retryable: true,
      });
      await expect(start()).resolves.toMatchObject({ ok: true });
      await expect(status()).resolves.toMatchObject({ running: true });
      expect(entityName(fixture.entities[3]!)).toBe("boot-4");
    } finally {
      await manager.dispose();
    }
  });
});

describe("Headless lifecycle concurrency", () => {
  it("rejects reset/restore overlap and waits for accepted reset before idempotent disposal", async () => {
    const started = deferred();
    const release = deferred();
    const fixture = resetFeatureFixture(async (_entity, generation) => {
      if (generation === 1) {
        started.resolve();
        await release.promise;
      }
    });
    const controller = await createHeadlessSessionController({
      ...resetOptions,
      config: fixture.config,
      systems: [],
    });
    const snapshot = createApertureSessionSnapshot(controller.runner);
    const reset = controller.reset();
    await started.promise;
    await expect(
      controller.restoreSessionSnapshot({ snapshot }),
    ).rejects.toThrow("already in progress");
    const disposed = controller.dispose();
    expect(controller.dispose()).toBe(disposed);
    expect(controller.lifecycle).toBe("disposed");
    await expect(controller.reset()).rejects.toThrow("disposed");
    release.resolve();
    await reset;
    await disposed;
    expect(fixture.events).toEqual([
      "boot-1",
      "dispose-1",
      "boot-2",
      "dispose-2",
    ]);
    expect(controller.status()).toMatchObject({
      lifecycle: "disposed",
      running: false,
      retryable: false,
    });
  });

  it("MCP rejects overlapping start/reset/restore and disposal waits for its accepted transition", async () => {
    const started = deferred();
    const release = deferred();
    const fixture = resetFeatureFixture(async (_entity, generation) => {
      if (generation === 1) {
        started.resolve();
        await release.promise;
      }
    });
    vi.spyOn(configLoader, "loadApertureHeadlessApp").mockResolvedValue({
      config: fixture.config,
      systems: [],
      diagnostics: [],
      configFile: "/audit/config.ts",
      root: "/audit",
    });
    const manager = new ApertureMcpSessionManager({ cwd: process.cwd() });
    const start = () =>
      manager.call({
        name: "app_start",
        args: { target: "headless", config: "/audit/config.ts" },
      });
    await start();
    const next = start();
    await started.promise;
    for (const name of ["app_start", "app_reset", "session_snapshot_restore"]) {
      const rejected = await manager.call({
        name,
        args: { target: "headless", config: "/audit/config.ts" },
      });
      expect(rejected).toMatchObject({ ok: false });
      expect(JSON.stringify(rejected)).toContain("already in progress");
    }
    await expect(
      manager.call({ name: "app_status", args: { target: "headless" } }),
    ).resolves.toMatchObject({ running: false, lifecycle: "replacing" });
    await expect(
      manager.call({ name: "logs_read", args: { target: "headless" } }),
    ).resolves.toMatchObject({ ok: true, entries: [] });
    expect(fixture.entities).toHaveLength(1);
    const dispose = manager.dispose();
    expect(manager.dispose()).toBe(dispose);
    release.resolve();
    await next;
    await dispose;
    expect(fixture.events).toEqual([
      "boot-1",
      "dispose-1",
      "boot-2",
      "dispose-2",
    ]);
    await expect(start()).rejects.toThrow("disposed");
  });
});

it("does not expose a partially restored candidate when the restore report is unsuccessful", async () => {
  const fixture = resetFeatureFixture();
  const controller = await createHeadlessSessionController({
    ...resetOptions,
    config: fixture.config,
    systems: [],
  });
  try {
    const snapshot = createApertureSessionSnapshot(controller.runner);
    const incomplete = {
      ...snapshot,
      runtime: {
        ...snapshot.runtime,
        systems: [
          {
            index: 0,
            system: "missing-system",
            version: 1 as const,
            payload: {},
          },
        ],
      },
    };
    await expect(
      controller.restoreSessionSnapshot({ snapshot: incomplete }),
    ).resolves.toMatchObject({
      ok: false,
      restore: { systems: { missing: ["missing-system#0"] } },
      status: { lifecycle: "failed", retryable: true, running: false },
    });
    expect(() => controller.step()).toThrow("session is failed");
    expect(fixture.events).toEqual([
      "boot-1",
      "dispose-1",
      "boot-2",
      "dispose-2",
    ]);
    await controller.reset();
    expect(controller.lifecycle).toBe("ready");
  } finally {
    await controller.dispose();
  }
});

it("cleans a raw EliCS system whose feature-installed initializer throws before retrying", async () => {
  const events: string[] = [];
  let fail = true;
  class RawOwner extends createEcsSystem() {
    override init(): void {
      events.push("raw-init");
      if (fail) {
        fail = false;
        throw new Error("raw initializer failed");
      }
    }
    override async destroy(): Promise<void> {
      await Promise.resolve();
      events.push("raw-destroy");
    }
  }
  const config = defineApertureConfig({
    mode: "headless",
    render: resetRender,
    features: [
      {
        id: "raw-owner",
        installRuntime({ world }) {
          world.registerSystem(RawOwner);
          expect(world.getSystem(RawOwner)).toBeInstanceOf(RawOwner);
          expect(world.getSystem(RawOwner)?.constructor).toBe(RawOwner);
        },
      },
    ],
  });
  const options = { ...resetOptions, config, systems: [] };
  await expect(createHeadlessSessionController(options)).rejects.toMatchObject({
    cause: expect.objectContaining({ message: "raw initializer failed" }),
  });
  expect(events).toEqual(["raw-init", "raw-destroy"]);
  const controller = await createHeadlessSessionController(options);
  try {
    expect(controller.lifecycle).toBe("ready");
  } finally {
    await controller.dispose();
  }
  expect(events).toEqual([
    "raw-init",
    "raw-destroy",
    "raw-init",
    "raw-destroy",
  ]);
});

it("waits for feature rollback's already-started async system destruction before retrying", async () => {
  const started = deferred();
  const release = deferred();
  const events: string[] = [];
  let boots = 0;
  const primary = new Error("feature bootstrap failed");
  class Owner extends createEcsSystem() {
    #disposing = false;
    #id = ++boots;
    override async destroy(): Promise<void> {
      if (this.#disposing) return;
      this.#disposing = true;
      events.push(`destroy-start-${this.#id}`);
      if (this.#id === 2) {
        started.resolve();
        await release.promise;
      }
      events.push(`destroy-end-${this.#id}`);
    }
  }
  const config = defineApertureConfig({
    mode: "headless",
    render: resetRender,
    features: [
      {
        id: "owner",
        installRuntime({ world }) {
          world.registerSystem(Owner);
          return () => world.unregisterSystem(Owner);
        },
      },
      {
        id: "later",
        requires: ["owner"],
        installRuntime() {
          if (boots === 2) throw primary;
        },
      },
    ],
  });
  const controller = await createHeadlessSessionController({
    ...resetOptions,
    config,
    systems: [],
  });
  try {
    let settled = false;
    const failure = controller
      .reset()
      .then(
        () => undefined,
        (error: unknown) => error,
      )
      .finally(() => {
        settled = true;
      });
    await started.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);
    expect(controller.lifecycle).toBe("replacing");
    release.resolve();
    expect(await failure).toMatchObject({ cause: primary });
    expect(events).toEqual([
      "destroy-start-1",
      "destroy-end-1",
      "destroy-start-2",
      "destroy-end-2",
    ]);
    await controller.reset();
    expect(controller.lifecycle).toBe("ready");
  } finally {
    release.resolve();
    await controller.dispose();
  }
  expect(events).toEqual([
    "destroy-start-1",
    "destroy-end-1",
    "destroy-start-2",
    "destroy-end-2",
    "destroy-start-3",
    "destroy-end-3",
  ]);
});

it("publishes app disposal ownership before a feature disposer synchronously reenters", async () => {
  const started = deferred();
  const release = deferred();
  let nested: Promise<readonly unknown[]> | undefined;
  const controller = await createHeadlessSessionController({
    ...resetOptions,
    systems: [],
    config: defineApertureConfig({
      mode: "headless",
      render: resetRender,
      features: [
        {
          id: "reentrant",
          installRuntime() {
            return async () => {
              nested = disposeApertureApp(app);
              started.resolve();
              await release.promise;
            };
          },
        },
      ],
    }),
  });
  const app = controller.runner.app;
  const outer = disposeApertureApp(app);
  try {
    await started.promise;
    expect(nested).toBe(outer);
    let settled = false;
    void outer.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
  } finally {
    release.resolve();
    await outer;
    await controller.dispose();
  }
});

it("preserves a running MCP world when feature dependencies fail pure preflight", async () => {
  const fixture = resetFeatureFixture();
  const load = vi
    .spyOn(configLoader, "loadApertureHeadlessApp")
    .mockResolvedValue({
      config: fixture.config,
      systems: [],
      diagnostics: [],
      configFile: "/audit/config.ts",
      root: "/audit",
    });
  const manager = new ApertureMcpSessionManager({ cwd: process.cwd() });
  const start = () =>
    manager.call({
      name: "app_start",
      args: { target: "headless", config: "/audit/config.ts" },
    });
  try {
    await expect(start()).resolves.toMatchObject({ ok: true });
    load.mockResolvedValueOnce({
      config: defineApertureConfig({
        mode: "headless",
        render: resetRender,
        features: [{ id: "invalid", requires: ["missing"] }],
      }),
      systems: [],
      diagnostics: [],
      configFile: "/audit/config.ts",
      root: "/audit",
    });
    await expect(start()).resolves.toMatchObject({ ok: false });
    await expect(
      manager.call({ name: "app_status", args: { target: "headless" } }),
    ).resolves.toMatchObject({ running: true });
    expect(fixture.events).toEqual(["boot-1"]);
    expect(entityName(fixture.entities[0]!)).toBe("boot-1");
  } finally {
    await manager.dispose();
  }
  expect(() =>
    preflightApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        physics: true,
        features: [{ id: "uses-physics", requires: ["physics"] }],
      }),
      systems: [],
    }),
  ).not.toThrow();
  expect(() =>
    preflightApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        physics: { enabled: false },
        features: [{ id: "uses-physics", requires: ["physics"] }],
      }),
      systems: [],
    }),
  ).toThrow();
});

it("releases an app when runner manifest assembly fails before ownership handoff", async () => {
  const fixture = resetFeatureFixture();
  const config = Object.assign(
    Object.create(null) as typeof fixture.config & { self?: unknown },
    fixture.config,
  );
  config.self = config;
  await expect(
    createHeadlessSessionController({ ...resetOptions, config, systems: [] }),
  ).rejects.toBeInstanceOf(TypeError);
  expect(fixture.events).toEqual(["boot-1", "dispose-1"]);
  const controller = await createHeadlessSessionController({
    ...resetOptions,
    config: fixture.config,
    systems: [],
  });
  try {
    expect(controller.lifecycle).toBe("ready");
  } finally {
    await controller.dispose();
  }
  expect(fixture.events).toEqual([
    "boot-1",
    "dispose-1",
    "boot-2",
    "dispose-2",
  ]);
});
