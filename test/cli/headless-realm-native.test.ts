import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import type * as CliApi from "../../packages/cli/src/index.js";
import type { HeadlessSessionClient } from "../../packages/cli/src/headless/realm-client.js";
import type { RealmSnapshot } from "../../packages/cli/src/headless/realm-protocol.js";
import { waitFor } from "../helpers/wait.js";
import { headlessLifecycleFixture } from "../helpers/headless-lifecycle-fixture.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CLI = path.join(ROOT, "packages/cli/dist/index.js");
async function api() {
  await stat(CLI);
  // The Worker executes the built Node CLI without Vitest aliases or ECS mocks.
  return import(pathToFileURL(CLI).href) as Promise<typeof CliApi>;
}
async function project(
  options: {
    value?: number;
    type?: "Int32" | "Float32";
    physicalSdk?: boolean;
  } = {},
) {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-realm-source-"));
  const scope = path.join(root, "node_modules/@aperture-engine");
  await mkdir(scope, { recursive: true });
  for (const entry of [
    "app",
    "simulation",
    "render",
    "math",
    "audio",
    "particles",
    "physics",
    "physics-rapier",
    "reference-assets",
    "runtime",
    "ui",
  ]) {
    const origin = path.join(ROOT, "packages", entry);
    const target = path.join(scope, entry);
    if (
      options.physicalSdk &&
      ["app", "simulation", "render"].includes(entry)
    ) {
      await mkdir(target);
      await cp(path.join(origin, "dist"), path.join(target, "dist"), {
        recursive: true,
      });
      await cp(
        path.join(origin, "package.json"),
        path.join(target, "package.json"),
      );
    } else await symlink(origin, target, "dir");
  }
  await linkDependencies(root);
  if (options.physicalSdk) {
    await rm(path.join(root, "node_modules/elics"));
    await cp(
      path.join(ROOT, "node_modules/elics"),
      path.join(root, "node_modules/elics"),
      { recursive: true, dereference: true },
    );
  }
  await writeFile(path.join(root, "package.json"), '{"type":"module"}\n');
  await writeFile(
    path.join(root, "shared.ts"),
    `export const increment = ${options.value ?? 2};\n`,
  );
  await writeFile(
    path.join(root, "component.ts"),
    `import { defineComponent, EcsType } from '@aperture-engine/simulation';\nexport const Counter = defineComponent('test.realm.shared-counter', { hits: { type: EcsType.${options.type ?? "Int32"}, default: 0 } });\n`,
  );
  await writeFile(path.join(root, "scene.system.ts"), system());
  await writeFile(
    path.join(root, "app.ts"),
    `export default { mode:'headless', systems:['*.system.ts'], render:{defaultCamera:false,defaultLight:false,defaultEnvironment:false} };\n`,
  );
  return {
    root,
    configFile: path.join(root, "app.ts"),
    options: {
      root,
      configFile: path.join(root, "app.ts"),
      seed: 7,
      assetMode: "placeholder" as const,
      publicDir: "public",
      allowHttpAssets: false,
      determinism: "off" as const,
    },
  };
}
async function linkDependencies(root: string): Promise<void> {
  const target = path.join(root, "node_modules");
  await mkdir(target, { recursive: true });
  const roots = [
    path.join(ROOT, "node_modules"),
    ...(await readdir(path.join(ROOT, "packages"))).map((name) =>
      path.join(ROOT, "packages", name, "node_modules"),
    ),
  ];
  async function link(origin: string, destination: string) {
    try {
      await stat(destination);
      return;
    } catch {
      /* A new test installation entry. */
    }
    await symlink(origin, destination, "dir");
  }
  for (const origin of roots) {
    let entries: string[];
    try {
      entries = await readdir(origin);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.startsWith(".") || entry === "@aperture-engine") continue;
      if (entry.startsWith("@")) {
        await mkdir(path.join(target, entry), { recursive: true });
        for (const name of await readdir(path.join(origin, entry)))
          await link(
            path.join(origin, entry, name),
            path.join(target, entry, name),
          );
      } else await link(path.join(origin, entry), path.join(target, entry));
    }
  }
}
async function installedCli() {
  // Copy the actual published files to an installation outside the project.
  // No Vitest aliases or source imports enter this CLI/Worker runtime graph.
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-global-cli-"));
  const pkg = path.join(root, "node_modules/@aperture-engine/cli");
  await mkdir(pkg, { recursive: true });
  await linkDependencies(root);
  for (const file of ["dist", "assets", "package.json", "LICENSE"]) {
    const origin = path.join(ROOT, "packages/cli", file);
    try {
      await cp(origin, path.join(pkg, file), { recursive: true });
    } catch (error: unknown) {
      if (file !== "LICENSE") throw error;
    }
  }
  for (const name of await readdir(path.join(ROOT, "packages"))) {
    if (name === "cli") continue;
    await symlink(
      path.join(ROOT, "packages", name),
      path.join(root, "node_modules/@aperture-engine", name),
      "dir",
    );
  }
  return { root, entry: path.join(pkg, "dist/headless/realm-client.js") };
}
function system(extraInit = "", extraDestroy = ""): string {
  return `
import { createSystem, defineResource, resource, mesh, material } from '@aperture-engine/app/systems';
import { Counter } from './component.ts';
import { increment } from './shared.ts';
const Stats = defineResource('test.realm.stats', { hits:resource.number(0), random:resource.number(0), clock:resource.number(0) });
export default class Probe extends createSystem() {
  #hits=0;
  init(){ this.spawn.mesh({key:'probe',mesh:mesh.box({size:[1,1,1]}),material:material.standard()}).addComponent(Counter,{hits:increment}); this.resources.read(Stats); ${extraInit} }
  update(){ this.#hits+=increment; const state=this.resources.read(Stats); state.hits=this.#hits;state.random=this.random.next();state.clock=this.time.elapsed; }
  snapshotState(){return {hits:this.#hits};}
  restoreState(payload){this.#hits=payload.hits;}
  destroy(){ ${extraDestroy} }
}
`;
}
async function values(
  client: HeadlessSessionClient,
): Promise<Record<string, number>> {
  const response = await client.callTool({
    name: "resource_get",
    arguments: { id: "test.realm.stats" },
  });
  expect(response.ok).toBe(true);
  return (response.result as { resource: { values: Record<string, number> } })
    .resource.values;
}
async function close(client: HeadlessSessionClient | undefined, root: string) {
  try {
    await client?.dispose();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("fresh file-source headless realms (actual Node imports)", () => {
  it("reloads a same-path nested import and newly discovered system through reset and a fresh start", async () => {
    const fixture = await project();
    const { createHeadlessSessionClient } = await api();
    let client = await createHeadlessSessionClient(fixture.options);
    try {
      await client.step();
      expect((await values(client)).hits).toBe(2);
      const revision = client.sourceRevision;
      const execution = client.executionRevision;
      await writeFile(
        path.join(fixture.root, "shared.ts"),
        "export const increment = 9;\n",
      );
      await writeFile(
        path.join(fixture.root, "extra.system.ts"),
        `import {createSystem} from '@aperture-engine/app/systems';export default class Added extends createSystem(){init(){this.createEntity();}}\n`,
      );
      await client.reset();
      await client.step();
      expect((await values(client)).hits).toBe(9);
      expect(client.executionRevision).not.toBe(execution);
      expect(client.sourceRevision).not.toBe(revision);
      const listed = await client.callTool({ name: "ecs_list_systems" });
      expect(JSON.stringify(listed)).toContain("Added");
      expect(
        client.exitHistory.every(
          (entry) => entry.graceful && entry.exitObserved,
        ),
      ).toBe(true);
      await rm(path.join(fixture.root, "extra.system.ts"));
      await client.reset();
      expect(
        JSON.stringify(await client.callTool({ name: "ecs_list_systems" })),
      ).not.toContain("Added");
      await client.dispose();
      await writeFile(
        path.join(fixture.root, "shared.ts"),
        "export const increment = 12;\n",
      );
      await writeFile(
        path.join(fixture.root, "scene.system.ts"),
        system().replace("+=increment;", "+=increment*2;"),
      );
      await writeFile(
        fixture.configFile,
        `export default {mode:'headless',systems:['scene.system.ts'],render:{defaultCamera:false,defaultLight:false,defaultEnvironment:false}};\n`,
      );
      await writeFile(
        path.join(fixture.root, "extra.system.ts"),
        `import {createSystem} from '@aperture-engine/app/systems';export default class Added extends createSystem(){}\n`,
      );
      client = await createHeadlessSessionClient(fixture.options);
      await client.step();
      expect((await values(client)).hits).toBe(24);
      expect(
        JSON.stringify(await client.callTool({ name: "ecs_list_systems" })),
      ).not.toContain("Added");
    } finally {
      await close(client, fixture.root);
    }
  }, 60_000);

  it("isolates simultaneous sessions declaring the same component ID with different schemas", async () => {
    const a = await project({ value: 3, type: "Int32" });
    const b = await project({ value: 11, type: "Float32" });
    const { createHeadlessSessionClient } = await api();
    const [first, second] = await Promise.all([
      createHeadlessSessionClient(a.options),
      createHeadlessSessionClient(b.options),
    ]);
    try {
      await Promise.all([
        first.step({ frames: 2 }),
        second.step({ frames: 3 }),
      ]);
      expect((await values(first)).hits).toBe(6);
      expect((await values(second)).hits).toBe(33);
      await first.reset();
      await first.step();
      expect((await values(first)).hits).toBe(3);
      expect((await values(second)).hits).toBe(33);
      expect(
        (
          await second.callTool({
            name: "ecs_query",
            arguments: { withComponents: ["test.realm.shared-counter"] },
          })
        ).ok,
      ).toBe(true);
    } finally {
      await Promise.all([close(first, a.root), close(second, b.root)]);
    }
  }, 60_000);

  it("restores private state, RNG, resources, time and actual source assets in a fresh realm", async () => {
    const fixture = await project();
    const { createHeadlessSessionClient } = await api();
    const client = await createHeadlessSessionClient(fixture.options);
    try {
      await client.step({ frames: 3, delta: 0.25 });
      const out = path.join(fixture.root, "snapshot.json");
      await client.saveSessionSnapshot({ out });
      const snapshot = JSON.parse(await readFile(out, "utf8")) as RealmSnapshot;
      expect(
        snapshot.headlessExecution?.compatibility.components.some(
          (entry) => entry.id === "test.realm.shared-counter",
        ),
      ).toBe(true);
      const blocked = path.join(fixture.root, "blocked-snapshot.json");
      await mkdir(blocked);
      await expect(
        client.saveSessionSnapshot({ out: blocked }),
      ).rejects.toThrow();
      expect(
        (await readdir(fixture.root)).filter((name) =>
          name.startsWith("blocked-snapshot.json"),
        ),
      ).toEqual(["blocked-snapshot.json"]);
      expect(JSON.parse(await readFile(out, "utf8"))).toEqual(snapshot);
      const execution = client.executionRevision;
      await client.step({ frames: 4, delta: 0.25 });
      const continuation = await values(client);
      const restored = await client.restoreSessionSnapshot({ snapshot });
      expect(restored).toMatchObject({
        ok: true,
        compatibility: "verified",
        restore: { ok: true },
      });
      expect(client.executionRevision).not.toBe(execution);
      await client.step({ frames: 4, delta: 0.25 });
      expect(await values(client)).toEqual(continuation);
      const bundle = await client.createBundle({
        out: path.join(fixture.root, "bundle.json"),
      });
      expect(JSON.stringify(bundle)).toContain("mesh");
      const legacy = { ...snapshot };
      delete (legacy as { headlessExecution?: unknown }).headlessExecution;
      expect(
        await client.restoreSessionSnapshot({ snapshot: legacy }),
      ).toMatchObject({ compatibility: "legacy-unverified" });
    } finally {
      await close(client, fixture.root);
    }
  }, 60_000);

  it("rejects changed component schemas before disposing the old ready world", async () => {
    const fixture = await project();
    const { createHeadlessSessionClient } = await api();
    const client = await createHeadlessSessionClient(fixture.options);
    try {
      await client.step();
      const out = path.join(fixture.root, "snapshot.json");
      await client.saveSessionSnapshot({ out });
      const snapshot = JSON.parse(await readFile(out, "utf8")) as RealmSnapshot;
      const execution = client.executionRevision;
      await writeFile(
        path.join(fixture.root, "component.ts"),
        `import {defineComponent,EcsType} from '@aperture-engine/simulation';export const Counter=defineComponent('test.realm.shared-counter',{hits:{type:EcsType.Float32,default:0}});\n`,
      );
      await expect(client.restoreSessionSnapshot({ snapshot })).rejects.toThrow(
        "different field/type/default schema",
      );
      expect(client.lifecycle).toBe("ready");
      expect(client.executionRevision).toBe(execution);
      expect((await values(client)).hits).toBe(2);
    } finally {
      await close(client, fixture.root);
    }
  }, 60_000);

  it("preflights resource and authored-system compatibility without destroying the ready world", async () => {
    const fixture = await project();
    const { createHeadlessSessionClient } = await api();
    const client = await createHeadlessSessionClient(fixture.options);
    try {
      await client.step();
      const out = path.join(fixture.root, "snapshot.json");
      await client.saveSessionSnapshot({ out });
      const snapshot = JSON.parse(await readFile(out, "utf8")) as RealmSnapshot;
      const execution = client.executionRevision;
      for (const [edited, message] of [
        [
          system().replace(
            "hits:resource.number(0)",
            "hits:resource.string('zero')",
          ),
          "different fields or field kinds",
        ],
        [
          system().replace("class Probe ", "class RenamedProbe "),
          "System order, name",
        ],
      ]) {
        await writeFile(path.join(fixture.root, "scene.system.ts"), edited!);
        await expect(
          client.restoreSessionSnapshot({ snapshot }),
        ).rejects.toThrow(message);
        expect(client.executionRevision).toBe(execution);
        expect(client.lifecycle).toBe("ready");
        expect((await values(client)).hits).toBe(2);
      }
    } finally {
      await close(client, fixture.root);
    }
  }, 60_000);

  it("serializes direct callers and drains an accepted host capture lease before reset/disposal", async () => {
    const fixture = await project();
    const { createHeadlessSessionClient } = await api();
    const client = await createHeadlessSessionClient({
      ...fixture.options,
      maxPending: 8,
    });
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let captured = false;
    try {
      await Promise.all([client.step(), client.step(), client.step()]);
      expect((await values(client)).hits).toBe(6);
      const old = client.executionRevision;
      const capture = client.withLease(async (lease) => {
        await lease.createBundle({ out: path.join(fixture.root, "held.json") });
        captured = true;
        await held;
      });
      await waitFor(() => captured, {
        timeoutMs: 10_000,
        label: "actual exported bundle before held host capture",
      });
      const reset = client.reset();
      expect(client.lifecycle).toBe("replacing");
      await expect(client.step()).rejects.toThrow("replacing");
      await expect(client.reset()).rejects.toThrow("overlapping");
      expect(client.executionRevision).toBe(old);
      const disposed = client.dispose();
      expect(client.dispose()).toBe(disposed);
      release();
      await capture;
      await reset.catch(() => undefined);
      await disposed;
      expect(client.lifecycle).toBe("disposed");
      expect(client.exitHistory.every((entry) => entry.exitObserved)).toBe(
        true,
      );
      await expect(client.step()).rejects.toThrow("disposed");
    } finally {
      release();
      await close(client, fixture.root);
    }
  }, 60_000);

  it("recovers from corrected same-path source after syntax and system-init failures", async () => {
    const fixture = await project();
    const { createHeadlessSessionClient } = await api();
    const client = await createHeadlessSessionClient(fixture.options);
    try {
      await writeFile(
        path.join(fixture.root, "shared.ts"),
        "export const increment = ;\n",
      );
      await expect(client.reset()).rejects.toThrow();
      expect(client.lifecycle).toBe("ready");
      await writeFile(
        path.join(fixture.root, "shared.ts"),
        "export const increment = 5;\n",
      );
      await writeFile(
        path.join(fixture.root, "scene.system.ts"),
        system(
          "throw new Error('native-fault-site', {cause:new Error('original-inner-cause')});",
        ),
      );
      const error = await client.reset().catch((failure: unknown) => failure);
      expect(JSON.stringify(error)).toContain("original-inner-cause");
      expect(JSON.stringify(error)).toContain("scene.system.ts");
      expect(client.lifecycle).toBe("failed");
      expect(client.cleanupBlocked).toBe(false);
      await writeFile(path.join(fixture.root, "scene.system.ts"), system());
      await client.reset();
      await client.step();
      expect((await values(client)).hits).toBe(5);
    } finally {
      await close(client, fixture.root);
    }
  }, 60_000);

  it("awaits asynchronous owners and preserves cleanup failures after actual Worker exit", async () => {
    const fixture = await project();
    const { createHeadlessSessionClient } = await api();
    const marker = path.join(fixture.root, "destroyed.txt");
    await writeFile(
      fixture.configFile,
      `import {appendFile} from 'node:fs/promises';export default {mode:'headless',systems:['*.system.ts'],render:{defaultCamera:false,defaultLight:false,defaultEnvironment:false},features:[{id:'disposal',installRuntime:()=>async()=>{await new Promise(r=>setImmediate(r));await appendFile(${JSON.stringify(marker)},'feature\\n');}}]};\n`,
    );
    await writeFile(
      path.join(fixture.root, "scene.system.ts"),
      system(
        "",
        `await import('node:fs/promises').then(fs=>fs.appendFile(${JSON.stringify(marker)},'system\\n'));throw new Error('owner-cleanup-failed');`,
      ).replace("destroy(){", "async destroy(){"),
    );
    const client = await createHeadlessSessionClient(fixture.options);
    try {
      const disposed = client.dispose();
      expect(client.dispose()).toBe(disposed);
      await expect(disposed).rejects.toThrow("disposal failed");
      expect(await readFile(marker, "utf8")).toBe("system\nfeature\n");
      expect(client.cleanupBlocked).toBe(true);
      expect(client.exitOutcome).toMatchObject({
        graceful: false,
        exitObserved: true,
        forcedTermination: false,
        exitCode: 0,
      });
      expect(JSON.stringify(client.exitOutcome)).toContain(
        "owner-cleanup-failed",
      );
      await expect(client.reset()).rejects.toThrow("cleanup blocked");
    } finally {
      await client.dispose().catch(() => undefined);
      await rm(fixture.root, { recursive: true, force: true });
    }
  }, 60_000);

  it("expires a host lease without letting its late callback access a replacement realm", async () => {
    const fixture = await project();
    const { createHeadlessSessionClient } = await api();
    const client = await createHeadlessSessionClient({
      ...fixture.options,
      requestTimeoutMs: 10_000,
    });
    let late!: () => Promise<unknown>;
    try {
      await expect(
        client.withLease(async (lease) => {
          late = () =>
            lease.createBundle({ out: path.join(fixture.root, "late.json") });
          await new Promise<void>((resolve) =>
            lease.signal.addEventListener("abort", () => resolve(), {
              once: true,
            }),
          );
          return late();
        }),
      ).rejects.toThrow(/deadline|expired/u);
      await client.reset();
      await expect(late()).rejects.toThrow("expired or finished");
      await client.step();
      expect((await values(client)).hits).toBe(2);
    } finally {
      await close(client, fixture.root);
    }
  }, 60_000);

  it("holds the old revision until aborted host capture actually settles", async () => {
    const fixture = await project();
    const { createHeadlessSessionClient } = await api();
    const client = await createHeadlessSessionClient({
      ...fixture.options,
      requestTimeoutMs: 10_000,
      disposeTimeoutMs: 10_000,
    });
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let aborted = false;
    try {
      const old = client.executionRevision;
      const capture = client.withLease(async (lease) => {
        lease.signal.addEventListener(
          "abort",
          () => {
            aborted = true;
          },
          { once: true },
        );
        await held;
      });
      const rejected = expect(capture).rejects.toThrow("deadline expired");
      await waitFor(() => aborted, {
        timeoutMs: 15_000,
        label: "lease cancellation before host cleanup completes",
      });
      expect(client.cachedStatus()).toMatchObject({
        hostCleanupPending: true,
        retryable: false,
      });
      await expect(client.step()).rejects.toThrow("failed");
      await expect(client.reset()).rejects.toThrow("unavailable");
      expect(client.executionRevision).toBe(old);
      expect(client.exitHistory).toHaveLength(0);
      release();
      await rejected;
      await client.reset();
      expect(client.executionRevision).not.toBe(old);
      await client.step();
      expect((await values(client)).hits).toBe(2);
    } finally {
      release();
      await close(client, fixture.root);
    }
  }, 60_000);

  it("blocks an already accepted reset when host cancellation cannot settle, without candidate world init", async () => {
    const fixture = await project();
    const { createHeadlessSessionClient } = await api();
    const marker = path.join(fixture.root, "worlds.txt");
    await writeFile(
      path.join(fixture.root, "scene.system.ts"),
      `import {appendFileSync} from 'node:fs';\n` +
        system(`appendFileSync(${JSON.stringify(marker)},'world\\n');`),
    );
    const client = await createHeadlessSessionClient({
      ...fixture.options,
      requestTimeoutMs: 10_000,
      disposeTimeoutMs: 10_000,
    });
    let entered = false;
    try {
      const old = client.executionRevision;
      const capture = client.withLease(async () => {
        entered = true;
        await new Promise<void>(() => {});
      });
      const rejectedCapture = expect(capture).rejects.toThrow(
        "cleanup remains blocked",
      );
      await waitFor(() => entered, {
        timeoutMs: 10_000,
        label: "held host capture before admitting reset",
      });
      const reset = client.reset();
      const rejectedReset = expect(reset).rejects.toThrow(
        "host cleanup is blocked",
      );
      await Promise.all([rejectedCapture, rejectedReset]);
      expect(await readFile(marker, "utf8")).toBe("world\n");
      expect(client.executionRevision).toBe(old);
      expect(client.cachedStatus()).toMatchObject({
        cleanupBlocked: true,
        hostCleanupBlocked: true,
        retryable: false,
      });
      await expect(client.reset()).rejects.toThrow("cleanup blocked");
      await expect(client.dispose()).rejects.toThrow("disposal failed");
      expect(client.exitOutcome).toMatchObject({
        graceful: true,
        forcedTermination: false,
        exitObserved: true,
      });
      expect(client.exitHistory).toHaveLength(2);
      expect(
        client.exitHistory.every((exit) => exit.graceful && exit.exitObserved),
      ).toBe(true);
      expect(client.cleanupBlocked).toBe(true);
    } finally {
      await client.dispose().catch(() => undefined);
      await rm(fixture.root, { recursive: true, force: true });
    }
  }, 60_000);

  it("binds an installed CLI controller and author classes to the same physical project SDK copy", async () => {
    const fixture = await project({ physicalSdk: true });
    const installed = await installedCli();
    const script = path.join(installed.root, "probe.mjs");
    await writeFile(
      script,
      `
      const {createHeadlessSessionClient}=await import(process.argv[2]);
      const options=JSON.parse(process.argv[3]);
      const client=await createHeadlessSessionClient(options);
      try {
        await client.step();
        const state=await client.callTool({name:'resource_get',arguments:{id:'test.realm.stats'}});
        await client.saveSessionSnapshot({out:process.argv[4]});
        await client.reset();await client.step();
        const reset=await client.callTool({name:'resource_get',arguments:{id:'test.realm.stats'}});
        await client.dispose();
        console.log(JSON.stringify({state,reset,exits:client.exitHistory}));
      }finally {await client.dispose();}
    `,
    );
    try {
      const out = path.join(fixture.root, "snapshot.json");
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [
          script,
          pathToFileURL(installed.entry).href,
          JSON.stringify(fixture.options),
          out,
        ],
        { timeout: 60_000 },
      );
      expect(JSON.parse(stdout)).toMatchObject({
        state: { ok: true, result: { resource: { values: { hits: 2 } } } },
        reset: { ok: true, result: { resource: { values: { hits: 2 } } } },
        exits: expect.arrayContaining([
          expect.objectContaining({ graceful: true, exitObserved: true }),
        ]),
      });
      const snapshot = JSON.parse(await readFile(out, "utf8")) as RealmSnapshot;
      expect(snapshot.headlessExecution?.source.appAnchor).toContain(
        fixture.root,
      );
      const bindings = snapshot.headlessExecution?.source.bindings ?? [];
      for (const specifier of [
        "@aperture-engine/app/systems",
        "@aperture-engine/app/advanced",
        "@aperture-engine/simulation",
        "@aperture-engine/render",
        "elics",
      ])
        expect(
          bindings.find((entry) => entry.specifier === specifier)?.url,
        ).toContain(fixture.root);
    } finally {
      await Promise.all([
        rm(fixture.root, { recursive: true, force: true }),
        rm(installed.root, { recursive: true, force: true }),
      ]);
    }
  }, 90_000);

  it("rejects an incomplete/incompatible project SDK without borrowing runtime packages from the global CLI", async () => {
    const fixture = await project({ physicalSdk: true });
    const { createHeadlessSessionClient } = await api();
    try {
      await rm(
        path.join(fixture.root, "node_modules/@aperture-engine/simulation"),
        { recursive: true },
      );
      await expect(
        createHeadlessSessionClient(fixture.options),
      ).rejects.toThrow(/incoherent|cannot resolve|simulation/iu);
      // A deliberately incompatible export is rejected in preflight, not mixed.
      await symlink(
        path.join(ROOT, "packages/simulation"),
        path.join(fixture.root, "node_modules/@aperture-engine/simulation"),
        "dir",
      );
      const pkgPath = path.join(
        fixture.root,
        "node_modules/@aperture-engine/app/package.json",
      );
      const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
      pkg.exports["./advanced"] = { import: "./dist/incompatible.js" };
      await writeFile(pkgPath, JSON.stringify(pkg));
      await writeFile(
        path.join(
          fixture.root,
          "node_modules/@aperture-engine/app/dist/incompatible.js",
        ),
        "export function getApertureCleanupFailures(){return [];}\n",
      );
      await expect(
        createHeadlessSessionClient(fixture.options),
      ).rejects.toThrow(/incompatible|does not provide/iu);
      pkg.exports["./diagnostics"] = { import: "./dist/early-diagnostic.js" };
      await writeFile(pkgPath, JSON.stringify(pkg));
      await writeFile(
        path.join(
          fixture.root,
          "node_modules/@aperture-engine/app/dist/early-diagnostic.js",
        ),
        "throw Object.assign(new Error('early-bootstrap-original',{cause:new Error('early-inner')}),{code:'early.boot.failure'});\n",
      );
      const early = await createHeadlessSessionClient(fixture.options).catch(
        (error: unknown) => error,
      );
      expect(early).toMatchObject({
        diagnostic: {
          code: "early.boot.failure",
          error: {
            message: "early-bootstrap-original",
            cause: { message: "early-inner" },
          },
        },
      });
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }, 90_000);

  it("finishes actual asynchronous timer-owner cleanup even when one-shot structured output throws", async () => {
    const fixture = await headlessLifecycleFixture();
    const { runHeadlessCommand } = await api();
    const primary = new Error("host-output-primary");
    try {
      await expect(
        runHeadlessCommand({
          argv: [
            fixture.config,
            "--out",
            path.join(fixture.root, "frame.json"),
            "--frames",
            "1",
          ],
          cwd: fixture.root,
          stdout() {
            throw primary;
          },
        }),
      ).rejects.toBe(primary);
      expect(await readFile(fixture.marker, "utf8")).toBe("system\nfeature\n");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }, 60_000);

  it("keeps authored stdout out of one-shot JSON and reloads source across exported command calls", async () => {
    const fixture = await project();
    const { runHeadlessCommand } = await api();
    try {
      await writeFile(
        fixture.configFile,
        `console.log('AUTHOR-CONSOLE-NOISE');export default {mode:'headless',systems:['*.system.ts'],render:{defaultCamera:false,defaultLight:false,defaultEnvironment:false}};\n`,
      );
      for (const increment of [2, 13]) {
        await writeFile(
          path.join(fixture.root, "shared.ts"),
          `export const increment=${increment};\n`,
        );
        const stdout: string[] = [],
          stderr: string[] = [];
        const out = path.join(fixture.root, `bundle-${increment}.json`);
        expect(
          await runHeadlessCommand({
            cwd: fixture.root,
            argv: [fixture.configFile, "--out", out, "--frames", "1", "--json"],
            stdout: (value) => stdout.push(value),
            stderr: (value) => stderr.push(value),
          }),
        ).toBe(0);
        expect(JSON.parse(stdout.join(""))).toMatchObject({ seed: 0 });
        expect(stdout.join("")).not.toContain("AUTHOR-CONSOLE-NOISE");
        expect(stderr.join("")).toContain("AUTHOR-CONSOLE-NOISE");
        expect(JSON.parse(await readFile(out, "utf8")).frame).toBe(0);
      }
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }, 90_000);
});
