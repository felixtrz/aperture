import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApertureCliError } from "../errors.js";

export async function runShaderCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
}): Promise<number> {
  const [command, input, ...rest] = options.argv;
  if (command === "render") {
    const { runRenderCommand } = await import("./render.js");
    return runRenderCommand({ ...options, argv: options.argv.slice(1) });
  }
  if (
    command === undefined ||
    options.argv.some((arg) => arg === "--help" || arg === "-h")
  ) {
    options.stdout(
      'Usage:\n  aperture shader build <entry.wgsl> --out <artifact.json> [--types <parameters.d.ts>]\n  aperture shader inspect <artifact.json>\n  aperture shader render <job.json> --out <frame.png> [--backend dawn|browser]\n\nModules use // @import "./library.wgsl"; actual device compilation validates WGSL semantics.\n',
    );
    return 0;
  }
  if (input === undefined)
    throw new ApertureCliError(
      "aperture.shader.inputRequired",
      "Provide a shader entry or artifact path.",
    );
  if (command === "inspect") {
    if (rest.length > 0)
      throw new ApertureCliError(
        "aperture.shader.invalidArguments",
        "shader inspect accepts one artifact path.",
      );
    const artifact = JSON.parse(
      await readFile(path.resolve(options.cwd, input), "utf8"),
    ) as { format?: string; version?: number };
    if (artifact.format !== "aperture.shader" || artifact.version !== 1)
      throw new ApertureCliError(
        "aperture.shader.invalidArtifact",
        "Expected an aperture.shader version 1 artifact.",
      );
    options.stdout(JSON.stringify(artifact, null, 2) + "\n");
    return 0;
  }
  if (command !== "build")
    throw new ApertureCliError(
      "aperture.shader.unknownCommand",
      `Unknown shader command '${command}'.`,
    );
  let output: string | undefined, types: string | undefined;
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i],
      value = rest[i + 1];
    if (
      value === undefined ||
      value.startsWith("--") ||
      (flag !== "--out" && flag !== "--types")
    )
      throw new ApertureCliError(
        "aperture.shader.invalidArguments",
        "Expected --out <artifact.json> and optional --types <parameters.d.ts>.",
      );
    if (flag === "--out") output = path.resolve(options.cwd, value);
    else types = path.resolve(options.cwd, value);
  }
  if (output === undefined)
    throw new ApertureCliError(
      "aperture.shader.outputRequired",
      "shader build requires --out <artifact.json>.",
    );
  const { compileShaderFile, generateShaderTypes } =
    await import("@aperture-engine/shader/compiler");
  const artifact = await compileShaderFile(path.resolve(options.cwd, input));
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(artifact, null, 2) + "\n");
  if (types !== undefined) {
    await mkdir(path.dirname(types), { recursive: true });
    await writeFile(types, generateShaderTypes(artifact));
  }
  options.stdout(
    JSON.stringify({
      ok: true,
      output,
      types,
      hash: artifact.hash,
      layoutHash: artifact.layoutHash,
      entryPoints: artifact.entryPoints,
      bindings: artifact.bindings,
    }) + "\n",
  );
  return 0;
}
