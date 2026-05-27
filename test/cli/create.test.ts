import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createApertureProject,
  runApertureCli,
  syncApertureAdapters,
} from "@aperture-engine/cli";

const tempRoots: string[] = [];

describe("Aperture CLI create command", () => {
  afterEach(async () => {
    for (const root of tempRoots.splice(0)) {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("prints top-level and create help", async () => {
    const root = await tempRoot();
    const topLevel = await runCli(["--help"], root);
    const create = await runCli(["create", "--help"], root);
    const adapter = await runCli(["adapter", "--help"], root);

    expect(topLevel.exitCode).toBe(0);
    expect(topLevel.stdout).toContain("aperture create");
    expect(topLevel.stdout).toContain("aperture adapter sync");
    expect(topLevel.stdout).toContain("aperture dev <subcommand>");
    expect(topLevel.stdout).toContain("aperture tool <name>");
    expect(topLevel.stdout).toContain("aperture mcp stdio");
    expect(create.exitCode).toBe(0);
    expect(create.stdout).toContain("aperture create <path>");
    expect(create.stdout).toContain("--force");
    expect(create.stdout).toContain("--template");
    expect(adapter.exitCode).toBe(0);
    expect(adapter.stdout).toContain("aperture adapter sync");
  });

  it("rejects missing project names and unknown commands with actionable errors", async () => {
    const root = await tempRoot();
    const missing = await runCli(["create"], root);
    const unknown = await runCli(["unknown"], root);

    expect(missing.exitCode).toBe(1);
    expect(missing.stderr).toContain("aperture.create.missingName");
    expect(missing.stderr).toContain("aperture create my-app");
    expect(unknown.exitCode).toBe(1);
    expect(unknown.stderr).toContain("aperture.cli.unknownCommand");
    expect(unknown.stderr).toContain("aperture --help");
  });

  it("reports deterministic diagnostics for unknown AI tooling subcommands and options", async () => {
    const root = await tempRoot();
    const adapterSubcommand = await runCli(["adapter", "unknown"], root);
    const adapterOption = await runCli(["adapter", "sync", "--unknown"], root);
    const devSubcommand = await runCli(["dev", "unknown"], root);
    const devOption = await runCli(["dev", "up", "--unknown"], root);
    const mcpSubcommand = await runCli(["mcp", "unknown"], root);
    const toolMissing = await runCli(["tool"], root);
    const toolInvalidJson = await runCli(
      ["tool", "browser_status", "--json", "[]"],
      root,
    );
    const invalidTemplate = await runCli(
      ["create", "bad-template", "--template", "empty"],
      root,
    );
    const referenceSubcommand = await runCli(["reference", "unknown"], root);
    const referenceOption = await runCli(
      ["reference", "search", "--unknown", "crate"],
      root,
    );

    expect(adapterSubcommand).toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("aperture.adapter.unknownSubcommand"),
    });
    expect(adapterOption).toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("aperture.adapter.unknownOption"),
    });
    expect(devSubcommand).toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("aperture.dev.unknownSubcommand"),
    });
    expect(devOption).toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("aperture.dev.unknownOption"),
    });
    expect(mcpSubcommand).toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("aperture.mcp.unknownSubcommand"),
    });
    expect(toolMissing).toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("aperture.tool.missingName"),
    });
    expect(toolInvalidJson).toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("aperture.tool.invalidJson"),
    });
    expect(invalidTemplate).toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("aperture.create.invalidTemplate"),
    });
    expect(referenceSubcommand).toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("aperture.reference.unknownSubcommand"),
    });
    expect(referenceOption).toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("aperture.reference.unknownOption"),
    });
  });

  it("scaffolds a Vite Aperture app with starter systems and AI adapter files", async () => {
    const root = await tempRoot();
    const report = await createApertureProject({
      cwd: root,
      name: "starter app",
    });

    expect(report.packageName).toBe("starter-app");
    expect(report.template).toBe("minimal");
    expect(report.files).toEqual(
      expect.arrayContaining([
        "package.json",
        "index.html",
        "aperture.config.ts",
        "vite.config.ts",
        "src/systems/setup.system.ts",
        "src/systems/spin.system.ts",
        "AGENTS.md",
        "CLAUDE.md",
        ".claude/settings.json",
        ".cursor/rules/aperture.mdc",
        ".github/copilot-instructions.md",
        ".codex/config.toml",
        ".mcp.json",
      ]),
    );

    const packageJson = JSON.parse(
      await readFile(path.join(report.targetDir, "package.json"), "utf8"),
    ) as {
      readonly scripts: Record<string, string>;
      readonly dependencies: Record<string, string>;
      readonly devDependencies: Record<string, string>;
    };
    const viteConfig = await readFile(
      path.join(report.targetDir, "vite.config.ts"),
      "utf8",
    );
    const apertureConfig = await readFile(
      path.join(report.targetDir, "aperture.config.ts"),
      "utf8",
    );
    const setupSystem = await readFile(
      path.join(report.targetDir, "src/systems/setup.system.ts"),
      "utf8",
    );
    const codexConfig = await readFile(
      path.join(report.targetDir, ".codex/config.toml"),
      "utf8",
    );

    expect(packageJson.scripts).toMatchObject({
      dev: "vite --host 127.0.0.1",
      build: "vite build",
      typecheck: "tsc --noEmit",
    });
    expect(packageJson.dependencies).toMatchObject({
      "@aperture-engine/app": "workspace:*",
      "@aperture-engine/vite-plugin": "workspace:*",
    });
    expect(packageJson.devDependencies).toMatchObject({
      "@aperture-engine/cli": "workspace:*",
    });
    expect(viteConfig).toContain('mode: "agent"');
    expect(apertureConfig).toContain("sampleCount: 4");
    expect(apertureConfig).toContain("maxPixelRatio: 2");
    expect(setupSystem).toContain("this.spawn.camera");
    expect(setupSystem).toContain("starter.cube");
    expect(codexConfig).toContain("aperture");
    expect(codexConfig).toContain("mcp");
  });

  it("scaffolds the GLB viewer template with a local asset and orbit system", async () => {
    const root = await tempRoot();
    const report = await createApertureProject({
      cwd: root,
      name: "viewer",
      template: "glb-viewer",
    });

    expect(report.template).toBe("glb-viewer");
    expect(report.files).toEqual(
      expect.arrayContaining([
        "aperture.config.ts",
        "public/assets/sample-cube.glb",
        "src/systems/setup.system.ts",
        "src/systems/orbit.system.ts",
      ]),
    );

    const asset = await stat(
      path.join(report.targetDir, "public/assets/sample-cube.glb"),
    );
    const config = await readFile(
      path.join(report.targetDir, "aperture.config.ts"),
      "utf8",
    );
    const setupSystem = await readFile(
      path.join(report.targetDir, "src/systems/setup.system.ts"),
      "utf8",
    );
    const orbitSystem = await readFile(
      path.join(report.targetDir, "src/systems/orbit.system.ts"),
      "utf8",
    );

    expect(asset.size).toBeGreaterThan(100);
    expect(config).toContain(
      'sampleCube: asset.gltf("/assets/sample-cube.glb"',
    );
    expect(config).toContain("sampleCount: 4");
    expect(setupSystem).toContain("this.spawn.gltf");
    expect(setupSystem).toContain("viewer.sampleCube");
    expect(orbitSystem).toContain("priority: 20");
  });

  it("scaffolds the game template with gameplay systems, signals, and priorities", async () => {
    const root = await tempRoot();
    const report = await createApertureProject({
      cwd: root,
      name: "game",
      template: "game",
    });

    expect(report.template).toBe("game");
    expect(report.files).toEqual(
      expect.arrayContaining([
        "aperture.config.ts",
        "public/assets/goal-cube.glb",
        "src/systems/setup.system.ts",
        "src/systems/player.system.ts",
        "src/systems/camera-follow.system.ts",
      ]),
    );

    const asset = await stat(
      path.join(report.targetDir, "public/assets/goal-cube.glb"),
    );
    const config = await readFile(
      path.join(report.targetDir, "aperture.config.ts"),
      "utf8",
    );
    const playerSystem = await readFile(
      path.join(report.targetDir, "src/systems/player.system.ts"),
      "utf8",
    );
    const cameraSystem = await readFile(
      path.join(report.targetDir, "src/systems/camera-follow.system.ts"),
      "utf8",
    );

    expect(asset.size).toBeGreaterThan(100);
    expect(config).toContain('goal: asset.gltf("/assets/goal-cube.glb"');
    expect(config).toContain("score: signal.number(0)");
    expect(config).toContain("goalReached: signal.boolean(false)");
    expect(config).toContain("move: input.axis2d");
    expect(config).toContain('input.gamepadButton("south")');
    expect(playerSystem).toContain("priority: 20");
    expect(playerSystem).toContain("this.actions.move");
    expect(playerSystem).toContain("game.collectible.collected");
    expect(cameraSystem).toContain("priority: 80");
  });

  it("refuses non-empty targets unless --force is provided", async () => {
    const root = await tempRoot();
    const target = path.join(root, "existing");
    await mkdir(target);
    await writeFile(path.join(target, "keep.txt"), "user file", "utf8");

    const refused = await runCli(["create", "existing"], root);
    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toContain("aperture.create.targetNotEmpty");

    const forced = await runCli(["create", "existing", "--force"], root);
    expect(forced.exitCode).toBe(0);
    expect(await readdir(target)).toEqual(
      expect.arrayContaining(["keep.txt", "package.json", "src"]),
    );
  });

  it("syncs AI adapter files idempotently without clobbering user edits", async () => {
    const root = await tempRoot();
    const first = await syncApertureAdapters({ cwd: root });

    expect(first.written).toEqual(
      expect.arrayContaining([
        "AGENTS.md",
        "CLAUDE.md",
        ".codex/config.toml",
        ".mcp.json",
      ]),
    );
    expect(first.changed).toEqual([]);
    expect(first.unchanged).toEqual([]);
    expect(first.skipped).toEqual([]);
    expect(first.conflicted).toEqual([]);

    const originalAgents = await readFile(path.join(root, "AGENTS.md"), "utf8");
    await writeFile(
      path.join(root, "AGENTS.md"),
      `${originalAgents}\nUser-owned agent notes.\n`,
      "utf8",
    );
    await writeFile(
      path.join(root, "CLAUDE.md"),
      "custom Claude notes\n",
      "utf8",
    );
    await writeFile(
      path.join(root, ".mcp.json"),
      JSON.stringify(
        {
          mcpServers: {
            custom: { command: "custom-tool", args: ["serve"] },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const second = await syncApertureAdapters({ cwd: root });
    const agentNotes = await readFile(path.join(root, "AGENTS.md"), "utf8");
    const claudeNotes = await readFile(path.join(root, "CLAUDE.md"), "utf8");
    const mcpJson = JSON.parse(
      await readFile(path.join(root, ".mcp.json"), "utf8"),
    ) as {
      readonly mcpServers: Record<string, { readonly command: string }>;
    };

    expect(second.written).toEqual([]);
    expect(second.changed).toEqual(
      expect.arrayContaining(["CLAUDE.md", ".mcp.json"]),
    );
    expect(second.unchanged).toEqual(expect.arrayContaining(["AGENTS.md"]));
    expect(second.conflicted).toEqual([]);
    expect(agentNotes).toContain("User-owned agent notes.");
    expect(claudeNotes).toContain("custom Claude notes");
    expect(claudeNotes).toContain("structured diagnostics");
    expect(mcpJson.mcpServers).toMatchObject({
      custom: { command: "custom-tool" },
      aperture: { command: "pnpm" },
    });

    const third = await syncApertureAdapters({ cwd: root });
    expect(third.written).toEqual([]);
    expect(third.changed).toEqual([]);
    expect(third.unchanged).toEqual(
      expect.arrayContaining([
        "AGENTS.md",
        "CLAUDE.md",
        ".mcp.json",
        ".codex/config.toml",
      ]),
    );

    await writeFile(
      path.join(root, ".codex/config.toml"),
      "# aperture-managed:start aperture-ai-tools\npartial block\n",
      "utf8",
    );
    const conflicted = await syncApertureAdapters({ cwd: root });
    expect(conflicted.conflicted).toEqual([
      {
        path: ".codex/config.toml",
        reason: "Existing file has incomplete Aperture managed block markers.",
      },
    ]);

    const forced = await runCli(["adapter", "sync", "--force"], root);
    expect(forced.exitCode).toBe(0);
    expect(forced.stdout).toContain("Written:");
    expect(forced.stdout).toContain("Changed:");
    expect(forced.stdout).toContain("Conflicted: 0");
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toContain(
      "Aperture app",
    );
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).not.toContain(
      "User-owned agent notes.",
    );
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-cli-"));
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
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });

  return { exitCode, stdout, stderr };
}
