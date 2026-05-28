import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { runAdapterCommand } from "./adapter-command.js";
import { runCreateCommand } from "./create-command.js";
import { runDevCommand } from "./dev-command.js";
import { ApertureDevSessionError } from "./dev-session.js";
import { ApertureCliError } from "./errors.js";
import { runMcpCommand } from "./mcp-command.js";
import { runReferenceCommand } from "./reference-command.js";
import { runToolCommand } from "./tool-command.js";
export { ApertureCliError } from "./errors.js";

const CLI_VERSION = "0.0.0";

export interface ApertureCliIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export interface RunApertureCliOptions extends Partial<ApertureCliIo> {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly entryPoint?: string;
}

export interface CreateApertureProjectOptions {
  readonly cwd: string;
  readonly name: string;
  readonly force?: boolean;
  readonly template?: ApertureCreateTemplate;
}

export interface CreateApertureProjectReport {
  readonly targetDir: string;
  readonly packageName: string;
  readonly template: ApertureCreateTemplate;
  readonly files: readonly string[];
}

export interface SyncApertureAdaptersOptions {
  readonly cwd: string;
  readonly force?: boolean;
}

export interface SyncApertureAdaptersReport {
  readonly targetDir: string;
  readonly written: readonly string[];
  readonly changed: readonly string[];
  readonly unchanged: readonly string[];
  readonly skipped: readonly string[];
  readonly conflicted: readonly SyncApertureAdapterConflict[];
}

export interface SyncApertureAdapterConflict {
  readonly path: string;
  readonly reason: string;
}

type TemplateFile = {
  readonly path: string;
  readonly contents: string | Uint8Array;
};

type ApertureCreateTemplate = "minimal" | "glb-viewer" | "game";

type ManagedBlockStyle = "html" | "hash";

type AdapterTemplateFile = Omit<TemplateFile, "contents"> & {
  readonly contents: string;
  readonly sync:
    | {
        readonly kind: "managedBlock";
        readonly style: ManagedBlockStyle;
      }
    | {
        readonly kind: "jsonMcpServer";
      };
};

type SyncApertureAdapterFileResult =
  | { readonly status: "written" | "changed" | "unchanged" | "skipped" }
  | {
      readonly status: "conflicted";
      readonly reason: string;
    };

const MANAGED_BLOCK_ID = "aperture-ai-tools";

export async function runApertureCli(
  options: RunApertureCliOptions,
): Promise<number> {
  const io = resolveIo(options);
  const [command, ...rest] = options.argv;

  try {
    if (command === undefined || isHelpFlag(command)) {
      io.stdout(mainHelp());
      return 0;
    }

    if (command === "--version" || command === "-v") {
      io.stdout(`${CLI_VERSION}\n`);
      return 0;
    }

    if (command === "create") {
      return await runCreateCommand({
        argv: rest,
        cwd: options.cwd,
        stdout: io.stdout,
        createProject: createApertureProject,
      });
    }

    if (command === "adapter") {
      return await runAdapterCommand({
        argv: rest,
        cwd: options.cwd,
        stdout: io.stdout,
        syncAdapters: syncApertureAdapters,
      });
    }

    if (command === "dev") {
      return await runDevCommand({
        argv: rest,
        cwd: options.cwd,
        ...(options.entryPoint === undefined
          ? {}
          : { entryPoint: options.entryPoint }),
        stdout: io.stdout,
      });
    }

    if (command === "mcp") {
      return await runMcpCommand({
        argv: rest,
        cwd: options.cwd,
        stdout: io.stdout,
      });
    }

    if (command === "tool") {
      return await runToolCommand({
        argv: rest,
        cwd: options.cwd,
        stdout: io.stdout,
      });
    }

    if (command === "reference") {
      return await runReferenceCommand({
        argv: rest,
        cwd: options.cwd,
        stdout: io.stdout,
      });
    }

    if (isPlannedCommand(command)) {
      if (rest.some(isHelpFlag)) {
        io.stdout(plannedCommandHelp(command));
        return 0;
      }

      throw new ApertureCliError(
        "aperture.cli.notImplemented",
        `The '${command}' command is planned for Aperture AI tooling but is not implemented yet.`,
      );
    }

    throw new ApertureCliError(
      "aperture.cli.unknownCommand",
      `Unknown Aperture command '${command}'. Run 'aperture --help' for available commands.`,
    );
  } catch (error: unknown) {
    if (
      error instanceof ApertureCliError ||
      error instanceof ApertureDevSessionError
    ) {
      io.stderr(`${error.code}: ${error.message}\n`);
      return error.exitCode;
    }

    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`aperture.cli.failed: ${message}\n`);
    return 1;
  }
}

export async function createApertureProject(
  options: CreateApertureProjectOptions,
): Promise<CreateApertureProjectReport> {
  const targetDir = resolveTargetDir(options.cwd, options.name);
  const packageName = npmPackageNameFromPath(targetDir);

  await assertWritableTarget(targetDir, options.force === true);
  const template = options.template ?? "minimal";
  const files = createTemplateFiles({
    packageName,
    dependencySpec: defaultApertureDependencySpec(),
    template,
  });

  for (const file of files) {
    const absolutePath = path.join(targetDir, file.path);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    if (typeof file.contents === "string") {
      await writeFile(absolutePath, file.contents, "utf8");
    } else {
      await writeFile(absolutePath, file.contents);
    }
  }

  return {
    targetDir,
    packageName,
    template,
    files: files.map((file) => file.path),
  };
}

export async function syncApertureAdapters(
  options: SyncApertureAdaptersOptions,
): Promise<SyncApertureAdaptersReport> {
  const targetDir = path.resolve(options.cwd);
  const written: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];
  const skipped: string[] = [];
  const conflicted: SyncApertureAdapterConflict[] = [];

  for (const file of adapterTemplateFiles()) {
    const result = await syncAdapterTemplateFile({
      file,
      targetDir,
      force: options.force === true,
    });

    if (result.status === "written") {
      written.push(file.path);
    } else if (result.status === "changed") {
      changed.push(file.path);
    } else if (result.status === "unchanged") {
      unchanged.push(file.path);
    } else if (result.status === "skipped") {
      skipped.push(file.path);
    } else if (result.status === "conflicted") {
      conflicted.push({ path: file.path, reason: result.reason });
    }
  }

  return { targetDir, written, changed, unchanged, skipped, conflicted };
}

async function syncAdapterTemplateFile(input: {
  readonly file: AdapterTemplateFile;
  readonly targetDir: string;
  readonly force: boolean;
}): Promise<SyncApertureAdapterFileResult> {
  const absolutePath = path.join(input.targetDir, input.file.path);
  const exists = await fileExists(absolutePath);

  if (!exists) {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.file.contents, "utf8");
    return { status: "written" };
  }

  const existingContents = await readFile(absolutePath, "utf8");

  if (input.force) {
    if (existingContents === input.file.contents) {
      return { status: "unchanged" };
    }

    await writeFile(absolutePath, input.file.contents, "utf8");
    return { status: "changed" };
  }

  if (input.file.sync.kind === "jsonMcpServer") {
    return syncJsonMcpServerFile({
      path: absolutePath,
      desiredContents: input.file.contents,
      existingContents,
    });
  }

  return syncManagedBlockFile({
    path: absolutePath,
    style: input.file.sync.style,
    desiredContents: input.file.contents,
    existingContents,
  });
}

async function syncManagedBlockFile(input: {
  readonly path: string;
  readonly style: ManagedBlockStyle;
  readonly desiredContents: string;
  readonly existingContents: string;
}): Promise<SyncApertureAdapterFileResult> {
  const desiredBlock = readManagedBlock(input.desiredContents, input.style);

  if (desiredBlock.status !== "found") {
    return {
      status: "conflicted",
      reason: "Internal adapter template is missing its managed block markers.",
    };
  }

  const existingBlock = readManagedBlock(input.existingContents, input.style);
  if (existingBlock.status === "partial") {
    return {
      status: "conflicted",
      reason: "Existing file has incomplete Aperture managed block markers.",
    };
  }

  const nextContents =
    existingBlock.status === "found"
      ? `${input.existingContents.slice(0, existingBlock.start)}${
          desiredBlock.block
        }${input.existingContents.slice(existingBlock.end)}`
      : input.existingContents.trim().length === 0
        ? input.desiredContents
        : appendManagedBlock(input.existingContents, desiredBlock.block);

  if (nextContents === input.existingContents) {
    return { status: "unchanged" };
  }

  await writeFile(input.path, nextContents, "utf8");
  return { status: "changed" };
}

async function syncJsonMcpServerFile(input: {
  readonly path: string;
  readonly desiredContents: string;
  readonly existingContents: string;
}): Promise<SyncApertureAdapterFileResult> {
  const desiredJson = parseJsonObject(input.desiredContents);

  if (desiredJson.status !== "ok") {
    return {
      status: "conflicted",
      reason: "Internal adapter template is not valid JSON.",
    };
  }

  const desiredServer = readApertureMcpServer(desiredJson.value);
  if (desiredServer === undefined) {
    return {
      status: "conflicted",
      reason: "Internal adapter template is missing mcpServers.aperture.",
    };
  }

  const existingJson = parseJsonObject(input.existingContents);
  if (existingJson.status !== "ok") {
    return {
      status: "conflicted",
      reason: "Existing JSON could not be parsed.",
    };
  }

  const existingServers = readMcpServers(existingJson.value);
  const existingApertureServer = existingServers.aperture;
  if (jsonEqual(existingApertureServer, desiredServer)) {
    return { status: "unchanged" };
  }

  const nextJson = {
    ...existingJson.value,
    mcpServers: {
      ...existingServers,
      aperture: desiredServer,
    },
  };

  await writeFile(input.path, `${JSON.stringify(nextJson, null, 2)}\n`, "utf8");
  return { status: "changed" };
}

function resolveIo(options: RunApertureCliOptions): ApertureCliIo {
  return {
    stdout: options.stdout ?? (() => undefined),
    stderr: options.stderr ?? (() => undefined),
  };
}

async function assertWritableTarget(
  targetDir: string,
  force: boolean,
): Promise<void> {
  try {
    const targetStat = await stat(targetDir);

    if (!targetStat.isDirectory()) {
      throw new ApertureCliError(
        "aperture.create.targetNotDirectory",
        `Create target '${targetDir}' exists and is not a directory.`,
      );
    }

    const entries = await readdir(targetDir);
    if (!force && entries.length > 0) {
      throw new ApertureCliError(
        "aperture.create.targetNotEmpty",
        `Create target '${targetDir}' is not empty. Re-run with --force to write starter files into it.`,
      );
    }
  } catch (error: unknown) {
    if (error instanceof ApertureCliError) {
      throw error;
    }

    if (isNodeErrorCode(error, "ENOENT")) {
      await mkdir(targetDir, { recursive: true });
      return;
    }

    throw error;
  }
}

function resolveTargetDir(cwd: string, name: string): string {
  return path.resolve(cwd, name);
}

function npmPackageNameFromPath(targetDir: string): string {
  const baseName = path.basename(targetDir).toLowerCase();
  const normalized = baseName
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (/^[a-z0-9][a-z0-9._-]*$/.test(normalized)) {
    return normalized;
  }

  return `aperture-${normalized || "app"}`;
}

function defaultApertureDependencySpec(): string {
  return CLI_VERSION === "0.0.0" ? "workspace:*" : `^${CLI_VERSION}`;
}

function createTemplateFiles(input: {
  readonly packageName: string;
  readonly dependencySpec: string;
  readonly template: ApertureCreateTemplate;
}): readonly TemplateFile[] {
  const packageJson = {
    name: input.packageName,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite --host 127.0.0.1",
      build: "vite build",
      preview: "vite preview",
      typecheck: "tsc --noEmit",
      aperture: "aperture",
    },
    dependencies: {
      "@aperture-engine/app": input.dependencySpec,
      "@aperture-engine/vite-plugin": input.dependencySpec,
    },
    devDependencies: {
      "@aperture-engine/cli": input.dependencySpec,
      typescript: "^6.0.3",
      vite: "^8.0.13",
    },
  };

  const templateFiles = createAppTemplateFiles(input.template);

  return [
    {
      path: "package.json",
      contents: `${JSON.stringify(packageJson, null, 2)}\n`,
    },
    {
      path: "index.html",
      contents: indexHtml(),
    },
    {
      path: "tsconfig.json",
      contents: tsconfigJson(),
    },
    {
      path: "vite.config.ts",
      contents: viteConfigTs(),
    },
    ...templateFiles,
    ...adapterTemplateFiles(),
  ];
}

function createAppTemplateFiles(
  template: ApertureCreateTemplate,
): readonly TemplateFile[] {
  if (template === "glb-viewer") {
    return [
      { path: "aperture.config.ts", contents: glbViewerConfigTs() },
      binaryTemplateFile(
        "public/assets/sample-cube.glb",
        SAMPLE_CUBE_GLB_BASE64,
      ),
      {
        path: "src/systems/setup.system.ts",
        contents: glbViewerSetupSystemTs(),
      },
      {
        path: "src/systems/orbit.system.ts",
        contents: glbViewerOrbitSystemTs(),
      },
    ];
  }

  if (template === "game") {
    return [
      { path: "aperture.config.ts", contents: gameConfigTs() },
      binaryTemplateFile("public/assets/goal-cube.glb", SAMPLE_CUBE_GLB_BASE64),
      {
        path: "src/systems/setup.system.ts",
        contents: gameSetupSystemTs(),
      },
      {
        path: "src/systems/player.system.ts",
        contents: gamePlayerSystemTs(),
      },
      {
        path: "src/systems/camera-follow.system.ts",
        contents: gameCameraFollowSystemTs(),
      },
    ];
  }

  return [
    {
      path: "aperture.config.ts",
      contents: apertureConfigTs(),
    },
    {
      path: "src/systems/setup.system.ts",
      contents: setupSystemTs(),
    },
    {
      path: "src/systems/spin.system.ts",
      contents: spinSystemTs(),
    },
  ];
}

function binaryTemplateFile(path: string, base64: string): TemplateFile {
  return {
    path,
    contents: Buffer.from(base64, "base64"),
  };
}

function adapterTemplateFiles(): readonly AdapterTemplateFile[] {
  return [
    {
      path: "AGENTS.md",
      contents: agentsMd(),
      sync: { kind: "managedBlock", style: "html" },
    },
    {
      path: "CLAUDE.md",
      contents: claudeMd(),
      sync: { kind: "managedBlock", style: "html" },
    },
    {
      path: ".claude/settings.json",
      contents: claudeSettingsJson(),
      sync: { kind: "jsonMcpServer" },
    },
    {
      path: ".cursor/rules/aperture.mdc",
      contents: cursorRule(),
      sync: { kind: "managedBlock", style: "html" },
    },
    {
      path: ".github/copilot-instructions.md",
      contents: copilotInstructions(),
      sync: { kind: "managedBlock", style: "html" },
    },
    {
      path: ".codex/config.toml",
      contents: codexConfigToml(),
      sync: { kind: "managedBlock", style: "hash" },
    },
    {
      path: ".mcp.json",
      contents: mcpJson(),
      sync: { kind: "jsonMcpServer" },
    },
  ];
}

function indexHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aperture App</title>
    <style>
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #0c0f14;
      }

      #aperture {
        display: block;
        width: 100vw;
        height: 100vh;
      }
    </style>
  </head>
  <body>
    <canvas id="aperture"></canvas>
  </body>
</html>
`;
}

function tsconfigJson(): string {
  return `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["aperture.config.ts", "vite.config.ts", "src/**/*.ts", ".aperture/generated/**/*.d.ts"]
}
`;
}

function viteConfigTs(): string {
  return `import { defineConfig } from "vite";
import { aperture } from "@aperture-engine/vite-plugin";

export default defineConfig({
  plugins: [
    aperture({
      ai: {
        mode: "agent",
      },
    }),
  ],
});
`;
}

function apertureConfigTs(): string {
  return `import { defineApertureConfig, input, signal } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  signals: {
    selectedEntity: signal.ref(null),
  },
  input: {
    actions: {
      select: input.button([input.pointer("primary"), input.key("Enter")]),
    },
  },
  render: {
    clearColor: [0.03, 0.035, 0.04, 1],
    defaultCamera: false,
    defaultLight: false,
    sampleCount: 4,
    maxPixelRatio: 2,
  },
  diagnostics: {
    level: "info",
  },
});
`;
}

const SAMPLE_CUBE_GLB_BASE64 =
  "Z2xURgIAAADsAwAAKAMAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJBcGVydHVyZSB0YXNrLTIwMDcgZml4dHVyZSJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJuYW1lIjoiU2FtcGxlQ3ViZSIsIm1lc2giOjAsInJvdGF0aW9uIjpbMCwwLjI1ODgxOSwwLDAuOTY1OTI2XX1dLCJtZXNoZXMiOlt7Im5hbWUiOiJTYW1wbGVDdWJlTWVzaCIsInByaW1pdGl2ZXMiOlt7ImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjB9LCJpbmRpY2VzIjoxLCJtYXRlcmlhbCI6MH1dfV0sIm1hdGVyaWFscyI6W3sibmFtZSI6IlNhbXBsZUN1YmVNaW50IiwicGJyTWV0YWxsaWNSb3VnaG5lc3MiOnsiYmFzZUNvbG9yRmFjdG9yIjpbMC4xNiwwLjc4LDAuNTYsMV19LCJleHRlbnNpb25zIjp7IktIUl9tYXRlcmlhbHNfdW5saXQiOnt9fX1dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoxNjh9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6OTYsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo5NiwiYnl0ZUxlbmd0aCI6NzIsInRhcmdldCI6MzQ5NjN9XSwiYWNjZXNzb3JzIjpbeyJidWZmZXJWaWV3IjowLCJieXRlT2Zmc2V0IjowLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6OCwidHlwZSI6IlZFQzMiLCJtaW4iOlstMC43LC0wLjcsLTAuN10sIm1heCI6WzAuNywwLjcsMC43XX0seyJidWZmZXJWaWV3IjoxLCJieXRlT2Zmc2V0IjowLCJjb21wb25lbnRUeXBlIjo1MTIzLCJjb3VudCI6MzYsInR5cGUiOiJTQ0FMQVIifV19qAAAAEJJTgAzMzO/MzMzvzMzM78zMzM/MzMzvzMzM78zMzM/MzMzPzMzM78zMzO/MzMzPzMzM78zMzO/MzMzvzMzMz8zMzM/MzMzvzMzMz8zMzM/MzMzPzMzMz8zMzO/MzMzPzMzMz8AAAEAAgAAAAIAAwAEAAYABQAEAAcABgAAAAQABQAAAAUAAQABAAUABgABAAYAAgACAAYABwACAAcAAwADAAcABAADAAQAAAA=";

function glbViewerConfigTs(): string {
  return `import { asset, defineApertureConfig, input } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    sampleCube: asset.gltf("/assets/sample-cube.glb", {
      preload: "blocking",
      label: "Sample Cube",
    }),
  },
  input: {
    actions: {
      resetView: input.button([input.key("KeyR")]),
    },
  },
  render: {
    clearColor: [0.03, 0.035, 0.04, 1],
    defaultCamera: false,
    defaultLight: false,
    sampleCount: 4,
    maxPixelRatio: 2,
  },
  diagnostics: {
    level: "info",
  },
});
`;
}

function glbViewerSetupSystemTs(): string {
  return `import { createSystem } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "Main Camera",
      transform: {
        translation: [0, 1.4, 4],
        lookAt: [0, 0.4, 0],
      },
      fovYDegrees: 50,
    });

    this.spawn.light({
      key: "light.key",
      name: "Key Light",
      kind: "directional",
      illuminance: 4,
      transform: {
        rotationEulerDegrees: [-40, 35, 0],
      },
    });

    this.spawn.light({
      key: "light.fill",
      name: "Fill Light",
      kind: "ambient",
      intensity: 0.4,
    });

    this.spawn.gltf(this.assets.gltf("sampleCube"), {
      key: "viewer.sampleCube",
      name: "Sample Cube",
      tags: ["asset", "gltf", "inspectable"],
    });
  }
}
`;
}

function glbViewerOrbitSystemTs(): string {
  return `import {
  AppEntityKey,
  LocalTransform,
  createSystem,
  quatFromAxisAngle,
} from "@aperture-engine/app/systems";

export default class OrbitSystem extends createSystem({
  priority: 20,
  queries: {
    objects: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  override update(_delta: number, time: number): void {
    for (const entity of this.queries.objects.entities) {
      if (entity.getValue(AppEntityKey, "value") !== "viewer.sampleCube") {
        continue;
      }

      entity
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromAxisAngle([0, 1, 0], time * 0.6));
    }
  }
}
`;
}

function gameConfigTs(): string {
  return `import { asset, defineApertureConfig, input, signal } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    goal: asset.gltf("/assets/goal-cube.glb", {
      preload: "blocking",
      label: "Goal Cube",
    }),
  },
  signals: {
    score: signal.number(0),
    playerX: signal.number(0),
    goalReached: signal.boolean(false),
  },
  input: {
    actions: {
      move: input.axis2d([
        input.keyboard2d({
          negativeX: ["ArrowLeft", "KeyA"],
          positiveX: ["ArrowRight", "KeyD"],
        }),
        input.gamepadStick("left"),
      ]),
      jump: input.button([
        input.key("Space"),
        input.key("KeyW"),
        input.gamepadButton("south"),
      ]),
      reset: input.button([input.key("KeyR")]),
    },
  },
  render: {
    clearColor: [0.08, 0.12, 0.16, 1],
    defaultCamera: false,
    defaultLight: false,
    sampleCount: 4,
    maxPixelRatio: 2,
  },
  diagnostics: {
    level: "info",
  },
});
`;
}

function gameSetupSystemTs(): string {
  return `import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "Main Camera",
      transform: {
        translation: [0, 3, 7],
        lookAt: [0, 0.6, 0],
      },
      fovYDegrees: 50,
    });

    this.spawn.light({
      key: "light.key",
      name: "Key Light",
      kind: "directional",
      illuminance: 4,
      transform: {
        rotationEulerDegrees: [-45, 25, 0],
      },
    });

    this.spawn.light({
      key: "light.fill",
      name: "Fill Light",
      kind: "ambient",
      intensity: 0.45,
    });

    this.spawn.mesh({
      key: "level.ground",
      name: "Ground",
      tags: ["level", "ground"],
      mesh: mesh.box({ size: [9, 0.3, 1.5] }),
      material: material.standard({
        baseColor: [0.18, 0.44, 0.32, 1],
        roughness: 0.65,
      }),
      transform: { translation: [0, -0.15, 0] },
    });

    this.spawn.mesh({
      key: "player",
      name: "Player",
      tags: ["player", "controllable"],
      mesh: mesh.box({ size: [0.5, 0.8, 0.5] }),
      material: material.standard({
        baseColor: [0.18, 0.58, 1, 1],
        roughness: 0.45,
      }),
      transform: { translation: [-3.5, 0.55, 0] },
    });

    this.spawn.gltf(this.assets.gltf("goal"), {
      key: "collectible.goal",
      name: "Goal Gem",
      tags: ["collectible", "goal"],
      transform: { translation: [1.8, 0.65, 0], scale: [0.35, 0.35, 0.35] },
    });

    this.spawn.mesh({
      key: "finish.flag",
      name: "Finish",
      tags: ["finish"],
      mesh: mesh.box({ size: [0.25, 1.2, 0.25] }),
      material: material.standard({
        baseColor: [1, 0.25, 0.3, 1],
        roughness: 0.5,
      }),
      transform: { translation: [3.8, 0.6, 0] },
    });
  }
}
`;
}

function gamePlayerSystemTs(): string {
  return `import {
  AppEntityKey,
  LocalTransform,
  createSystem,
} from "@aperture-engine/app/systems";

export default class PlayerSystem extends createSystem({
  priority: 20,
  queries: {
    actors: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  override update(delta: number): void {
    const player = this.findByKey("player");
    const gem = this.findByKey("collectible.goal");
    const score = this.signals.score;
    const playerX = this.signals.playerX;
    const goalReached = this.signals.goalReached;

    if (
      player === null ||
      score === undefined ||
      playerX === undefined ||
      goalReached === undefined
    ) {
      return;
    }

    const playerTranslation = player.getVectorView(LocalTransform, "translation");

    const reset = this.actions.reset;
    if (reset?.kind === "button" && reset.down()) {
      playerTranslation[0] = -3.5;
      score.value = 0;
      goalReached.value = false;
      if (gem !== null) {
        gem.getVectorView(LocalTransform, "translation")[1] = 0.65;
      }
    }

    const move = this.actions.move;
    const direction = move?.kind === "axis2d" ? move.x.value : 0;
    const playerCurrentX = playerTranslation[0] ?? -3.5;
    const playerNextX = Math.max(
      -4,
      Math.min(4.2, playerCurrentX + direction * delta * 3),
    );
    playerTranslation[0] = playerNextX;
    playerX.value = playerNextX;

    if (
      gem !== null &&
      Number(score.value) === 0 &&
      Math.abs(playerNextX - 1.8) < 0.45
    ) {
      score.value = 1;
      gem.getVectorView(LocalTransform, "translation")[1] = -10;
      this.diagnostics.info("game.collectible.collected", {
        score: score.value,
      });
    }

    if (Number(score.value) > 0 && playerNextX > 3.5) {
      goalReached.value = true;
    }
  }

  private findByKey(key: string) {
    for (const entity of this.queries.actors.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) {
        return entity;
      }
    }

    return null;
  }
}
`;
}

function gameCameraFollowSystemTs(): string {
  return `import {
  AppEntityKey,
  LocalTransform,
  createSystem,
} from "@aperture-engine/app/systems";

export default class CameraFollowSystem extends createSystem({
  priority: 80,
  queries: {
    actors: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  override update(): void {
    const player = this.findByKey("player");
    const camera = this.findByKey("camera.main");

    if (player === null || camera === null) {
      return;
    }

    const playerTranslation = player.getVectorView(LocalTransform, "translation");
    const cameraTranslation = camera.getVectorView(LocalTransform, "translation");
    cameraTranslation[0] = playerTranslation[0] ?? 0;
  }

  private findByKey(key: string) {
    for (const entity of this.queries.actors.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) {
        return entity;
      }
    }

    return null;
  }
}
`;
}

function setupSystemTs(): string {
  return `import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "Main Camera",
      transform: {
        translation: [0, 1.4, 5],
        lookAt: [0, 0.6, 0],
      },
      fovYDegrees: 55,
      camera: {
        clearColor: [0.03, 0.035, 0.04, 1],
      },
    });

    this.spawn.light({
      key: "light.key",
      name: "Key Light",
      kind: "directional",
      illuminance: 4,
      transform: {
        rotationEulerDegrees: [-45, 35, 0],
      },
    });

    this.spawn.light({
      key: "light.fill",
      name: "Fill Light",
      kind: "ambient",
      intensity: 0.35,
    });

    this.spawn.mesh({
      key: "starter.cube",
      name: "Starter Cube",
      tags: ["starter", "inspectable"],
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({
        baseColor: [0.18, 0.58, 1, 1],
        roughness: 0.45,
        metallic: 0.05,
      }),
      transform: {
        translation: [0, 0.5, 0],
      },
    });
  }
}
`;
}

function spinSystemTs(): string {
  return `import {
  AppEntityKey,
  EcsType,
  LocalTransform,
  createSystem,
  quatFromAxisAngle,
} from "@aperture-engine/app/systems";

export default class SpinSystem extends createSystem({
  priority: 10,
  queries: {
    cubes: { required: [AppEntityKey, LocalTransform] },
  },
  config: {
    speed: { type: EcsType.Float32, default: 0.8 },
  },
}) {
  override update(_delta: number, time: number): void {
    for (const entity of this.queries.cubes.entities) {
      if (entity.getValue(AppEntityKey, "value") !== "starter.cube") {
        continue;
      }

      entity
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromAxisAngle([0, 1, 0], time * this.config.speed.value));
    }
  }
}
`;
}

function agentsMd(): string {
  return `# AGENTS.md

${managedBlock(
  "html",
  `You are working on an Aperture app.

## Runtime Model

- ECS is the source of truth.
- Systems live in \`src/systems/**/*.system.ts\` and run in the generated simulation worker.
- Rendering is derived from ECS state through Aperture render extraction.
- Do not introduce a mutable scene graph as app state.

## Useful Commands

- \`pnpm run dev\`: start the Vite app.
- \`pnpm run typecheck\`: type-check the app.
- \`pnpm run build\`: build the app.
- \`pnpm exec aperture dev up --open\`: start the managed Aperture browser once AI tooling is available.
- \`pnpm exec aperture mcp stdio\`: expose Aperture tools over MCP once AI tooling is available.
`,
)}`;
}

function claudeMd(): string {
  return `# Claude Instructions

${managedBlock(
  "html",
  `This is an Aperture app. Prefer ECS systems, components, typed assets, and
structured diagnostics. Keep browser/WebGPU-specific logic out of simulation
systems unless an Aperture API explicitly provides it.
`,
)}`;
}

function claudeSettingsJson(): string {
  return `{
  "mcpServers": {
    "aperture": {
      "command": "pnpm",
      "args": ["exec", "aperture", "mcp", "stdio"]
    }
  }
}
`;
}

function cursorRule(): string {
  return `---
description: Aperture app architecture
alwaysApply: true
---

${managedBlock(
  "html",
  `Use Aperture's ECS-first API. Author runtime behavior as systems under
\`src/systems/**/*.system.ts\`. Rendering is derived from ECS components and
assets; do not add a renderer-owned scene graph.
`,
)}`;
}

function copilotInstructions(): string {
  return `# Copilot Instructions

${managedBlock(
  "html",
  `This project is an Aperture app. Keep changes ECS-first:

- Add behavior in \`*.system.ts\` files.
- Use \`@aperture-engine/app/config\` for app config.
- Use \`@aperture-engine/app/systems\` for system authoring.
- Preserve the worker-friendly ECS/render boundary.
`,
)}`;
}

function codexConfigToml(): string {
  return managedBlock(
    "hash",
    `[mcp_servers.aperture]
command = "pnpm"
args = ["exec", "aperture", "mcp", "stdio"]
`,
  );
}

function mcpJson(): string {
  return `{
  "mcpServers": {
    "aperture": {
      "command": "pnpm",
      "args": ["exec", "aperture", "mcp", "stdio"]
    }
  }
}
`;
}

function mainHelp(): string {
  return `Aperture CLI ${CLI_VERSION}

Usage:
  aperture <command> [options]

Commands:
  aperture create <path>        Scaffold an Aperture app with AI tooling files.
  aperture dev <subcommand>     Manage an AI-enabled dev browser session.
  aperture tool <name>          Call one Aperture browser/ECS/render tool.
  aperture mcp stdio            Expose Aperture tools over MCP stdio.
  aperture adapter sync         Sync AI coding-tool adapter files.
  aperture reference <command>  Warm and query the Aperture RAG corpus.

Options:
  -h, --help           Show help.
  -v, --version        Show the CLI version.
`;
}

function plannedCommandHelp(command: string): string {
  return `The '${command}' command is part of the Aperture AI tooling plan but is not implemented yet.

Run 'aperture --help' to see the current command surface.
`;
}

function isPlannedCommand(_command: string): boolean {
  return false;
}

function isHelpFlag(value: string): boolean {
  return value === "--help" || value === "-h";
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { readonly code?: unknown }).code === code
  );
}

function managedBlock(style: ManagedBlockStyle, contents: string): string {
  return `${managedBlockStart(style)}
${contents.trim()}
${managedBlockEnd(style)}
`;
}

function readManagedBlock(
  contents: string,
  style: ManagedBlockStyle,
):
  | {
      readonly status: "found";
      readonly start: number;
      readonly end: number;
      readonly block: string;
    }
  | { readonly status: "missing" }
  | { readonly status: "partial" } {
  const startMarker = managedBlockStart(style);
  const endMarker = managedBlockEnd(style);
  const start = contents.indexOf(startMarker);
  const end = start === -1 ? -1 : contents.indexOf(endMarker, start);

  if (start === -1 && contents.indexOf(endMarker) === -1) {
    return { status: "missing" };
  }

  if (start === -1 || end === -1) {
    return { status: "partial" };
  }

  const endMarkerEnd = end + endMarker.length;
  const blockEnd = contents.startsWith("\r\n", endMarkerEnd)
    ? endMarkerEnd + 2
    : contents.startsWith("\n", endMarkerEnd)
      ? endMarkerEnd + 1
      : endMarkerEnd;

  return {
    status: "found",
    start,
    end: blockEnd,
    block: contents.slice(start, blockEnd),
  };
}

function appendManagedBlock(contents: string, block: string): string {
  const trimmed = contents.trimEnd();
  const normalizedBlock = block.endsWith("\n") ? block : `${block}\n`;

  return `${trimmed}\n\n${normalizedBlock}`;
}

function managedBlockStart(style: ManagedBlockStyle): string {
  return style === "hash"
    ? `# aperture-managed:start ${MANAGED_BLOCK_ID}`
    : `<!-- aperture-managed:start ${MANAGED_BLOCK_ID} -->`;
}

function managedBlockEnd(style: ManagedBlockStyle): string {
  return style === "hash"
    ? `# aperture-managed:end ${MANAGED_BLOCK_ID}`
    : `<!-- aperture-managed:end ${MANAGED_BLOCK_ID} -->`;
}

function parseJsonObject(
  contents: string,
):
  | { readonly status: "ok"; readonly value: Record<string, unknown> }
  | { readonly status: "error" } {
  try {
    const value = JSON.parse(contents) as unknown;

    if (isRecord(value)) {
      return { status: "ok", value };
    }
  } catch {
    return { status: "error" };
  }

  return { status: "error" };
}

function readApertureMcpServer(
  value: Record<string, unknown>,
): unknown | undefined {
  const servers = readMcpServers(value);

  return servers.aperture;
}

function readMcpServers(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const servers = value.mcpServers;

  return isRecord(servers) ? servers : {};
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error: unknown) {
    if (isNodeErrorCode(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}
