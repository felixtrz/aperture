import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SAMPLE_ROOTS = ["examples", "showcase"];
const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".tsx"]);
const SKIPPED_DIRECTORIES = new Set([
  ".aperture",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
]);
const PARTICLE_ASSET_CALLEES = [
  "asset.particleEffect",
  "createParticleEffectAsset",
] as const;
const LEGACY_TOP_LEVEL_PARTICLE_KEYS = new Set([
  "capacity",
  "duration",
  "looping",
  "prewarm",
  "emissionRate",
  "bursts",
  "lifetime",
  "startSpeed",
  "startSize",
  "startColor",
  "endColor",
  "gravity",
  "linearDamping",
  "blendMode",
  "texture",
  "sampler",
  "atlasFrameCount",
]);

describe("sample particle effect assets", () => {
  it("use the v2 Shuriken-style module schema", () => {
    const violations: string[] = [];

    for (const file of sampleSourceFiles()) {
      violations.push(...legacyParticleAssetViolations(file));
    }

    expect(violations).toEqual([]);
  });
});

function sampleSourceFiles(): string[] {
  const files: string[] = [];

  for (const root of SAMPLE_ROOTS) {
    collectSourceFiles(root, files);
  }

  return files.sort();
}

function collectSourceFiles(directory: string, output: string[]): void {
  for (const entry of readdirSync(directory)) {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      continue;
    }

    const path = join(directory, entry);
    const status = statSync(path);

    if (status.isDirectory()) {
      collectSourceFiles(path, output);
    } else if (SOURCE_EXTENSIONS.has(extensionOf(path))) {
      output.push(path);
    }
  }
}

function legacyParticleAssetViolations(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const violations: string[] = [];

  for (const callee of PARTICLE_ASSET_CALLEES) {
    let index = -1;

    while ((index = source.indexOf(callee, index + 1)) !== -1) {
      const paren = source.indexOf("(", index + callee.length);
      const objectStart = paren === -1 ? -1 : source.indexOf("{", paren);
      const objectEnd =
        objectStart === -1 ? -1 : findMatching(source, objectStart, "{", "}");

      if (objectStart === -1 || objectEnd === -1) {
        continue;
      }

      const line = source.slice(0, objectStart).split("\n").length;
      const objectSource = source.slice(objectStart, objectEnd + 1);

      for (const key of topLevelObjectKeys(objectSource)) {
        if (LEGACY_TOP_LEVEL_PARTICLE_KEYS.has(key)) {
          violations.push(
            `${file}:${line} ${callee} uses legacy top-level particle field '${key}'`,
          );
        }
      }
    }
  }

  return violations;
}

function topLevelObjectKeys(objectSource: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;
  let token = "";

  for (let index = 1; index < objectSource.length - 1; index += 1) {
    const char = objectSource[index];

    if (char === undefined) {
      continue;
    }

    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      if (depth === 0) {
        token += char;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      if (depth === 0) {
        token += char;
      }
      continue;
    }

    if (char === "{" || char === "[" || char === "(") {
      depth += 1;
      if (depth === 1) {
        token = "";
      }
      continue;
    }

    if (char === "}" || char === "]" || char === ")") {
      depth -= 1;
      continue;
    }

    if (depth === 0) {
      token += char;
      const match = token.match(
        /(?:^|[,\s])(?:\.\.\.)?([A-Za-z_$][\w$]*)\s*:\s*$/,
      );

      if (match?.[1] !== undefined) {
        keys.push(match[1]);
        token = "";
      }
    }
  }

  return keys;
}

function findMatching(
  source: string,
  start: number,
  open: string,
  close: string,
): number {
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (char === undefined) {
      continue;
    }

    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function extensionOf(path: string): string {
  const index = path.lastIndexOf(".");

  return index === -1 ? "" : path.slice(index);
}
