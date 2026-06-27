import { createServer, createServerModuleRunner, type Alias } from "vite";

// The engine packages register ECS components and other module-global state on
// first import. Vite treats pnpm-linked workspace packages as source to
// transform, which would re-evaluate them inside the runner's isolated module
// graph and collide with the copy the host process already loaded (e.g.
// "Component 'aperture.transform.local' already exists"). Externalizing the
// whole engine scope makes the runner defer to the host's native instances —
// the same ones the CLI's own imports use — so the loaded systems and
// `createApertureHeadlessRunner` share one realm and one registration.
const ENGINE_PACKAGES: readonly string[] = [
  "@aperture-engine/app",
  "@aperture-engine/render",
  "@aperture-engine/simulation",
  "@aperture-engine/runtime",
  "@aperture-engine/physics",
  "@aperture-engine/physics-rapier",
  "@aperture-engine/webgpu",
  "@aperture-engine/audio",
  "@aperture-engine/math",
  "@aperture-engine/vite-plugin",
];

// A thin wrapper around a middleware-mode Vite server plus its SSR module
// runner. This is how the headless command loads a user's `aperture.config.ts`
// and `*.system.ts` files in pure Node: Vite transforms the TypeScript while
// externalizing `node_modules` (so the engine packages resolve to the SAME
// native module instances the CLI already imports — no dual-realm split between
// the loaded systems and `createApertureHeadlessRunner`).
export interface HeadlessViteRuntime {
  importModule(id: string): Promise<Record<string, unknown>>;
  dispose(): Promise<void>;
}

export async function createHeadlessViteRuntime(options: {
  readonly root: string;
  readonly aliases?: readonly Alias[];
}): Promise<HeadlessViteRuntime> {
  const server = await createServer({
    root: options.root,
    configFile: false,
    appType: "custom",
    logLevel: "error",
    ssr: { external: [...ENGINE_PACKAGES] },
    optimizeDeps: { noDiscovery: true },
    server: {
      middlewareMode: true,
      hmr: false,
      // A persisted file watcher keeps the process alive after dispose; the
      // headless loop loads modules once and never needs change notifications.
      watch: null,
    },
    ...(options.aliases === undefined
      ? {}
      : { resolve: { alias: [...options.aliases] } }),
  });

  const runner = createServerModuleRunner(server.environments.ssr);

  return {
    async importModule(id: string): Promise<Record<string, unknown>> {
      return (await runner.import(id)) as Record<string, unknown>;
    },
    async dispose(): Promise<void> {
      await server.close();
    },
  };
}
