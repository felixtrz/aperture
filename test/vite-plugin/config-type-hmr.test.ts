import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aperture } from "../../packages/vite-plugin/src/index.js";
import * as codegen from "../../packages/vite-plugin/src/generated-action-types.js";
import {
  refreshApertureConfigTypesForHotUpdate,
  type ApertureConfigHmrModule,
} from "../../packages/vite-plugin/src/config-type-hmr.js";

const roots: string[] = [];
const servers: ViteDevServer[] = [];

describe("config type hot updates through Vite's module graph", () => {
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
    vi.restoreAllMocks();
  });

  it("does not refresh unrelated cyclic importer graphs", async () => {
    const generate = vi
      .spyOn(codegen, "writeApertureGeneratedActionTypes")
      .mockResolvedValue("unused");
    const root = path.join(tmpdir(), "aperture-config-hmr-cycle");
    const firstImporters = new Set<ApertureConfigHmrModule>();
    const secondImporters = new Set<ApertureConfigHmrModule>();
    const first = {
      file: path.join(root, "first.ts"),
      importers: firstImporters,
    };
    const second = {
      file: path.join(root, "second.ts"),
      importers: secondImporters,
    };
    firstImporters.add(second);
    secondImporters.add(first);

    await refreshApertureConfigTypesForHotUpdate({
      root,
      file: first.file,
      modules: [first],
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it.each(["aperture.config.ts", "custom.config.ts"])(
    "refreshes transitive and root changes to %s without unrelated-load codegen",
    async (configName) => {
      const root = await mkdtemp(path.join(tmpdir(), "aperture-config-hmr-"));
      roots.push(root);
      const config = path.join(root, configName);
      const shared = path.join(root, "shared.ts");
      const nested = path.join(root, "nested.ts");
      const unrelated = path.join(root, "unrelated.ts");
      await writeFile(path.join(root, "package.json"), '{"type":"module"}');
      await writeFile(config, 'export { default } from "./shared.ts";');
      await writeFile(shared, 'export { default } from "./nested.ts";');
      await writeFile(nested, descriptor("before"));
      await writeFile(unrelated, "export const value = 1;");
      const generate = vi.spyOn(codegen, "writeApertureGeneratedActionTypes");
      const plugin = aperture({ configFile: configName, ai: { mode: "off" } });
      // Exercise the real hooks with Vite's transforms and graph, without
      // prebundling engine dependencies or opening HTTP/WebSocket listeners.
      // This assignment also checks the hook's Vite interface compatibility.
      const vitePlugin: Plugin = {
        name: plugin.name,
        configResolved: plugin.configResolved!,
        resolveId: plugin.resolveId!,
        load: plugin.load!,
        handleHotUpdate: plugin.handleHotUpdate!,
      };
      const server = await createServer({
        root,
        configFile: false,
        plugins: [vitePlugin],
        logLevel: "error",
        server: { middlewareMode: true, hmr: false, watch: null },
        optimizeDeps: { noDiscovery: true, include: [] },
      });
      servers.push(server);
      const virtualId = "virtual:aperture/config";
      for (const id of [
        virtualId,
        `/${configName}`,
        "/shared.ts",
        "/nested.ts",
        "/unrelated.ts",
      ])
        await server.transformRequest(id);
      await Promise.all(generate.mock.results.map((result) => result.value));
      const output = path.join(root, ".aperture/generated/aperture-env.d.ts");
      expect(await readFile(output, "utf8")).toContain("readonly before:");
      const virtualModule = server.moduleGraph.getModuleById(`\0${virtualId}`)!;

      await writeFile(nested, descriptor("after"));
      server.moduleGraph.onFileChange(nested);
      expect(virtualModule.transformResult).toBeNull();
      generate.mockClear();
      // This is Vite's hot-update boundary with its real importer graph. A
      // plain request for the soft-invalidated virtual module won't call load.
      await plugin.handleHotUpdate!({
        file: nested,
        modules: [...server.moduleGraph.getModulesByFile(nested)!],
      });
      expect(generate).toHaveBeenCalledOnce();
      await server.transformRequest(virtualId);
      expect(generate).toHaveBeenCalledOnce();
      expect(await readFile(output, "utf8")).toContain("readonly after:");
      expect(await readFile(output, "utf8")).not.toContain("readonly before:");

      generate.mockClear();
      await writeFile(unrelated, "export const value = 2;");
      server.moduleGraph.onFileChange(unrelated);
      await plugin.handleHotUpdate!({
        file: unrelated,
        modules: [...server.moduleGraph.getModulesByFile(unrelated)!],
      });
      await server.transformRequest("/unrelated.ts");
      expect(generate).not.toHaveBeenCalled();

      await writeFile(config, descriptor("rootAfter"));
      server.moduleGraph.onFileChange(config);
      await plugin.handleHotUpdate!({ file: config, modules: [] });
      expect(generate).toHaveBeenCalledOnce();
      expect(await readFile(output, "utf8")).toContain("readonly rootAfter:");
    },
    30_000,
  );
});

function descriptor(name: string): string {
  return `export default {
    input: { actions: { ${name}: { kind: "button" } } },
    signals: { ${name}: { kind: "number" } }
  };`;
}
