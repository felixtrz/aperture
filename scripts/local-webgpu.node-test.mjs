import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  launchOptions,
  localRequestPolicy,
  withLocalWebGPU,
  RUNTIME_VERSIONS,
} from "./local-webgpu.mjs";

test("exact proven launch flags, sandbox, no default arguments", () => {
  assert.deepEqual(launchOptions("/browser/chromium", "/scratch/profile"), {
    executablePath: "/browser/chromium",
    chromiumSandbox: true,
    ignoreDefaultArgs: true,
    timeout: 30000,
    args: [
      "--headless",
      "--remote-debugging-pipe",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--user-data-dir=/scratch/profile",
      "--use-webgpu-adapter=swiftshader",
      "--use-vulkan=swiftshader",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-features=Vulkan",
      "--enable-logging=stderr",
      "--enable-unsafe-webgpu",
    ],
  });
  assert.deepEqual(RUNTIME_VERSIONS, {
    "playwright-core": "1.60.0",
    "@sparticuz/chromium": "153.0.0",
  });
  assert.throws(() => launchOptions("relative", "/scratch/profile"));
});

test("explicit origin matching rejects external, wrong port, credentials and non-HTTP", () => {
  const permits = localRequestPolicy([
    "http://127.0.0.1:4321",
    "http://[::1]:4321",
  ]);
  assert.equal(permits("http://127.0.0.1:4321/scene.mjs?x=1"), true);
  assert.equal(permits("http://[::1]:4321/"), true);
  for (const url of [
    "http://example.com/",
    "http://127.0.0.1:4322/",
    "https://127.0.0.1:4321/",
    "http://127.0.0.1.evil.test:4321/",
    "http://user@127.0.0.1:4321/",
    "file:///etc/passwd",
    "data:text/plain,x",
    "blob:http://127.0.0.1:4321/id",
    "ws://127.0.0.1:4321/",
    "garbage",
  ])
    assert.equal(permits(url), false, url);
  for (const origins of [
    [],
    ["http://localhost:4321"],
    ["http://example.com"],
    ["file:///"],
    ["http://127.0.0.1:4321/"],
    ["http://127.0.0.1:4321/path"],
    ["https://127.0.0.1"],
  ]) {
    assert.throws(() => localRequestPolicy(origins));
  }
});

async function fixture(
  t,
  {
    workFails = false,
    routeFails = false,
    closeFails = false,
    launchFails = false,
  } = {},
) {
  const scratchRoot = await mkdtemp(join(tmpdir(), "local-webgpu-unit-"));
  t.after(() => rm(scratchRoot, { recursive: true, force: true }));
  const calls = [],
    handlers = {},
    blocked = [];
  let profile;
  const context = {
    async route(pattern, fn) {
      calls.push("route");
      handlers.http = fn;
      if (routeFails) throw new Error("route failed");
    },
    async routeWebSocket(pattern, fn) {
      calls.push("websocket");
      handlers.ws = fn;
    },
    async close() {
      calls.push("context.close");
    },
  };
  const browser = {
    async newContext(options) {
      calls.push("context");
      assert.equal(options.serviceWorkers, "block");
      return context;
    },
    async close() {
      calls.push("browser.close");
      if (closeFails) throw new Error("close failed");
    },
  };
  const runtime = {
    chromium: {
      async executablePath() {
        return "/mock/chromium";
      },
    },
    playwright: {
      async launch(options) {
        calls.push("launch");
        profile = options.args[5].slice("--user-data-dir=".length);
        if (launchFails) throw new Error("launch failed");
        return browser;
      },
    },
  };
  const run = () =>
    withLocalWebGPU(
      {
        runtime,
        scratchRoot,
        allowedOrigins: ["http://127.0.0.1:4321"],
        onBlocked: (url) => blocked.push(url),
      },
      async () => {
        calls.push("work");
        for (const url of [
          "http://127.0.0.1:4321/",
          "https://example.com/",
          "http://127.0.0.1:4322/",
        ]) {
          await handlers.http({
            request: () => ({ url: () => url }),
            continue: () => calls.push(`allow:${url}`),
            abort: () => calls.push(`abort:${url}`),
          });
        }
        await handlers.ws({ close: () => calls.push("socket.close") });
        if (workFails) throw new Error("work failed");
        return "result";
      },
    );
  return { run, calls, blocked, profile: () => profile };
}

test("routes installed before work, external requests abort, sockets close, lifecycle cleans profile", async (t) => {
  const f = await fixture(t);
  assert.equal(await f.run(), "result");
  assert.deepEqual(f.calls.slice(0, 5), [
    "launch",
    "context",
    "route",
    "websocket",
    "work",
  ]);
  assert.deepEqual(f.blocked, [
    "https://example.com/",
    "http://127.0.0.1:4322/",
  ]);
  assert.ok(f.calls.includes("socket.close"));
  assert.deepEqual(f.calls.slice(-2), ["context.close", "browser.close"]);
  await assert.rejects(access(f.profile()));
});
for (const scenario of ["workFails", "routeFails"])
  test(`${scenario} closes browser and removes profile`, async (t) => {
    const f = await fixture(t, { [scenario]: true });
    await assert.rejects(f.run());
    assert.deepEqual(f.calls.slice(-2), ["context.close", "browser.close"]);
    await assert.rejects(access(f.profile()));
  });
for (const scenario of ["closeFails", "launchFails"])
  test(`${scenario} preserves profile and reports uncertainty`, async (t) => {
    const f = await fixture(t, { [scenario]: true });
    await assert.rejects(
      f.run(),
      (error) =>
        error instanceof AggregateError &&
        error.errors.some((e) => /profile preserved/.test(e.message)),
    );
    await access(f.profile());
  });
