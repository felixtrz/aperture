import { mkdtemp, rm, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";

export const RUNTIME_VERSIONS = Object.freeze({
  "playwright-core": "1.60.0",
  "@sparticuz/chromium": "153.0.0",
});

// Same flags as the proven Aperture/Three SwiftShader + Vulkan runs.
export function launchOptions(executablePath, profileDirectory) {
  if (
    ![executablePath, profileDirectory].every(
      (p) => typeof p === "string" && isAbsolute(p),
    )
  ) {
    throw new TypeError(
      "Executable and dedicated profile paths must be absolute",
    );
  }
  return {
    executablePath,
    chromiumSandbox: true,
    ignoreDefaultArgs: true,
    timeout: 30000,
    args: [
      "--headless",
      "--remote-debugging-pipe",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      `--user-data-dir=${profileDirectory}`,
      "--use-webgpu-adapter=swiftshader",
      "--use-vulkan=swiftshader",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-features=Vulkan",
      "--enable-logging=stderr",
      "--enable-unsafe-webgpu",
    ],
  };
}

export function localRequestPolicy(allowedOrigins) {
  if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) {
    throw new TypeError("Provide at least one explicit loopback HTTP origin");
  }
  const origins = new Set(
    allowedOrigins.map((origin) => {
      const url = new URL(origin);
      if (
        origin !== url.origin ||
        url.protocol !== "http:" ||
        !["127.0.0.1", "[::1]"].includes(url.hostname) ||
        url.username ||
        url.password
      ) {
        throw new TypeError(
          `Expected an exact numeric-loopback HTTP origin: ${origin}`,
        );
      }
      return url.origin;
    }),
  );
  return (requestUrl) => {
    try {
      const url = new URL(requestUrl);
      return (
        url.protocol === "http:" &&
        !url.username &&
        !url.password &&
        origins.has(url.origin)
      );
    } catch {
      return false;
    }
  };
}

// Loads existing packages only. Does not install, download or launch a browser.
export async function loadRuntime(runtimeRoot) {
  if (typeof runtimeRoot !== "string" || !isAbsolute(runtimeRoot)) {
    throw new TypeError("runtimeRoot must be absolute");
  }
  const require = createRequire(join(runtimeRoot, "package.json"));
  for (const [name, version] of Object.entries(RUNTIME_VERSIONS)) {
    const metadata = JSON.parse(
      await readFile(
        join(runtimeRoot, "node_modules", name, "package.json"),
        "utf8",
      ),
    );
    if (metadata.version !== version)
      throw new Error(`${name}: expected ${version}, got ${metadata.version}`);
  }
  const playwright = await import(
    pathToFileURL(require.resolve("playwright-core")).href
  );
  const chromium = await import(
    pathToFileURL(require.resolve("@sparticuz/chromium")).href
  );
  return {
    playwright: playwright.chromium ?? playwright.default.chromium,
    chromium: chromium.default,
  };
}

// Caller starts/stops its HTTP server and supplies only trusted local content.
export async function withLocalWebGPU(
  {
    runtime,
    allowedOrigins,
    scratchRoot,
    viewport = { width: 800, height: 600 },
    onBlocked = () => {},
  },
  work,
) {
  const permits = localRequestPolicy(allowedOrigins);
  if (typeof scratchRoot !== "string" || !isAbsolute(scratchRoot))
    throw new TypeError("scratchRoot must be absolute");
  if (typeof work !== "function")
    throw new TypeError("work must be a function");
  if (typeof onBlocked !== "function")
    throw new TypeError("onBlocked must be a function");
  // Resolve packaged executable before allocating the fresh profile.
  const executablePath = await runtime.chromium.executablePath();
  const profileDirectory = await mkdtemp(join(scratchRoot, "aperture-webgpu-"));
  const options = launchOptions(executablePath, profileDirectory);
  let browser, context, value;
  const errors = [];
  let browserClosed = false;
  try {
    browser = await runtime.playwright.launch(options);
    context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      serviceWorkers: "block",
    });
    await context.route("**/*", async (route) => {
      const url = route.request().url();
      if (permits(url)) return route.continue();
      // Abort first, so an observer cannot accidentally leave a request unhandled.
      await route.abort();
      onBlocked(url);
    });
    await context.routeWebSocket("**/*", (socket) => socket.close());
    value = await work({ browser, context, launch: options, profileDirectory });
  } catch (error) {
    errors.push(error);
  } finally {
    try {
      if (context) await context.close();
    } catch (error) {
      errors.push(error);
    }
    try {
      if (browser) {
        await browser.close();
        browserClosed = true;
      }
    } catch (error) {
      errors.push(error);
    }
    // If launch or close is ambiguous, preserve the profile for reconciliation.
    if (browserClosed) {
      try {
        await rm(profileDirectory, { recursive: true, force: true });
      } catch (error) {
        errors.push(error);
      }
    } else {
      errors.push(
        new Error(
          `Browser termination unverified; profile preserved at ${profileDirectory}`,
        ),
      );
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length)
    throw new AggregateError(errors, "Local WebGPU run or cleanup failed");
  return value;
}
