import { PassThrough } from "node:stream";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  apertureReferenceIndexFile,
  buildApertureReferenceIndex,
  callApertureTool,
  runApertureCli,
  runApertureMcpServer,
  searchApertureReferences,
} from "@aperture-engine/cli";

const tempRoots: string[] = [];

describe("Aperture reference CLI and MCP tools", () => {
  afterEach(async () => {
    for (const root of tempRoots.splice(0)) {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("builds and searches a workspace-local reference index", async () => {
    const root = await referenceWorkspace();
    const build = await buildApertureReferenceIndex({ cwd: root });

    expect(build.entries).toBeGreaterThan(2);
    expect(build.indexFile).toBe(apertureReferenceIndexFile(root));

    const index = JSON.parse(await readFile(build.indexFile, "utf8")) as {
      readonly entries: readonly { readonly file: string }[];
    };
    expect(index.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: "docs/guide.md" }),
        expect.objectContaining({
          file: "packages/app/src/spin.system.ts",
        }),
      ]),
    );

    const search = await searchApertureReferences({
      cwd: root,
      query: "SpinSystem",
    });
    expect(search.total).toBeGreaterThan(0);
    expect(search.results[0]).toMatchObject({
      file: "packages/app/src/spin.system.ts",
      systems: expect.arrayContaining(["SpinSystem"]),
    });
  });

  it("exposes reference build/search through the CLI", async () => {
    const root = await referenceWorkspace();
    const build = await runCli(["reference", "build"], root);
    const search = await runCli(
      ["reference", "search", "aperture.entityLookup.notFound", "--limit", "2"],
      root,
    );

    expect(build.exitCode).toBe(0);
    expect(build.stdout).toContain("Built Aperture reference index");
    expect(search.exitCode).toBe(0);
    expect(search.stdout).toContain("diagnostics.ts");
    expect(search.stdout).toContain("aperture.entityLookup.notFound");
  });

  it("serves reference tools without a dev browser session", async () => {
    const root = await referenceWorkspace();
    await buildApertureReferenceIndex({ cwd: root });

    const results = await callApertureTool({
      cwd: root,
      name: "reference_search",
      arguments: { query: "DebugMetadata", limit: 3 },
    });
    const components = await callApertureTool({
      cwd: root,
      name: "reference_list_components",
      arguments: {},
    });
    const systems = await callApertureTool({
      cwd: root,
      name: "reference_list_systems",
      arguments: {},
    });

    expect(results).toMatchObject({
      total: expect.any(Number),
      results: expect.arrayContaining([
        expect.objectContaining({
          file: expect.stringContaining("components.ts"),
        }),
      ]),
    });
    expect(components).toMatchObject({
      ok: true,
      components: expect.arrayContaining(["aperture.metadata.debug"]),
    });
    expect(systems).toMatchObject({
      ok: true,
      systems: expect.arrayContaining(["SpinSystem"]),
    });
  });

  it("serves every reference MCP tool over stdio without a dev browser session", async () => {
    const root = await referenceWorkspace();
    await buildApertureReferenceIndex({ cwd: root });

    const search = await callMcpTool(root, "reference_search", {
      query: "SpinSystem",
      limit: 3,
    });
    expect(search.structuredContent).toMatchObject({
      results: expect.arrayContaining([
        expect.objectContaining({
          file: "packages/app/src/spin.system.ts",
        }),
      ]),
    });

    const api = await callMcpTool(root, "reference_api_lookup", {
      symbol: "createSystem",
      limit: 3,
    });
    expect(api.structuredContent).toMatchObject({
      results: expect.arrayContaining([
        expect.objectContaining({
          file: "packages/app/src/spin.system.ts",
        }),
      ]),
    });

    const file = await callMcpTool(root, "reference_file_content", {
      file: "packages/app/src/spin.system.ts",
    });
    expect(file.structuredContent).toMatchObject({
      ok: true,
      entry: {
        file: "packages/app/src/spin.system.ts",
      },
    });

    const examples = await callMcpTool(root, "reference_find_examples", {
      query: "SpinSystem",
      limit: 3,
    });
    expect(examples.structuredContent).toMatchObject({
      results: expect.arrayContaining([
        expect.objectContaining({
          file: "examples/spinning-cube.ts",
        }),
      ]),
    });

    const components = await callMcpTool(root, "reference_list_components", {});
    expect(components.structuredContent).toMatchObject({
      ok: true,
      components: expect.arrayContaining(["aperture.metadata.debug"]),
    });

    const systems = await callMcpTool(root, "reference_list_systems", {});
    expect(systems.structuredContent).toMatchObject({
      ok: true,
      systems: expect.arrayContaining(["SpinSystem"]),
    });

    const dependents = await callMcpTool(root, "reference_find_dependents", {
      symbol: "DebugMetadata",
      limit: 3,
    });
    expect(dependents.structuredContent).toMatchObject({
      results: expect.arrayContaining([
        expect.objectContaining({
          file: "packages/app/src/components.ts",
        }),
      ]),
    });

    const diagnostic = await callMcpTool(root, "reference_explain_diagnostic", {
      code: "aperture.entityLookup.notFound",
      limit: 3,
    });
    expect(diagnostic.structuredContent).toMatchObject({
      results: expect.arrayContaining([
        expect.objectContaining({
          file: "packages/app/src/diagnostics.ts",
        }),
      ]),
    });
  });

  it("prints reference help and missing-query diagnostics", async () => {
    const root = await tempRoot();
    const help = await runCli(["reference", "--help"], root);
    const missing = await runCli(["reference", "search"], root);

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("aperture reference build");
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr).toContain("aperture.reference.missingQuery");
  });
});

async function referenceWorkspace(): Promise<string> {
  const root = await tempRoot();

  await mkdir(path.join(root, "docs"), { recursive: true });
  await mkdir(path.join(root, "examples"), { recursive: true });
  await mkdir(path.join(root, "packages/app/src"), { recursive: true });
  await writeFile(
    path.join(root, "docs/guide.md"),
    "Use DebugMetadata and SpinSystem when inspecting Aperture ECS apps.",
    "utf8",
  );
  await writeFile(
    path.join(root, "examples/spinning-cube.ts"),
    "export const title = 'SpinSystem example';\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/app/src/components.ts"),
    `export const DebugMetadata = createComponent({
  id: "aperture.metadata.debug",
});
`,
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/app/src/spin.system.ts"),
    `export default class SpinSystem extends createSystem({
  priority: 10,
}) {}
`,
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/app/src/diagnostics.ts"),
    `export const diagnostic = {
  code: "aperture.entityLookup.notFound",
  message: "Entity not found",
};
`,
    "utf8",
  );

  return root;
}

async function callMcpTool(
  cwd: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ readonly structuredContent?: unknown }> {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const chunks: string[] = [];

  stdout.on("data", (chunk: Buffer) => {
    chunks.push(chunk.toString());
  });

  const done = runApertureMcpServer({ cwd, stdin, stdout });
  stdin.end(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    })}\n`,
  );
  await done;

  const line = chunks.join("").trim().split("\n")[0];
  if (line === undefined || line.length === 0) {
    throw new Error(`MCP tool ${name} produced no output.`);
  }

  const message = JSON.parse(line) as {
    readonly result?: { readonly structuredContent?: unknown };
    readonly error?: unknown;
  };

  if (message.error !== undefined) {
    throw new Error(
      `MCP tool ${name} failed: ${JSON.stringify(message.error)}`,
    );
  }

  return {
    structuredContent: message.result?.structuredContent,
  };
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-reference-"));
  tempRoots.push(root);
  return root;
}

async function runCli(
  argv: readonly string[],
  cwd: string,
): Promise<{
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  let stdout = "";
  let stderr = "";
  const exitCode = await runApertureCli({
    argv,
    cwd,
    entryPoint: "/tmp/aperture-test-bin.js",
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });

  return { exitCode, stdout, stderr };
}
