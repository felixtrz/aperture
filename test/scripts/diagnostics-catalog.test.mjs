import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectDiagnosticCodes,
  renderCatalog,
} from "../../scripts/generate-diagnostics-catalog.mjs";

const directories = [];

async function collectFixture(source) {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-code-catalog-"));
  directories.push(root);
  await mkdir(path.join(root, "packages", "app"), { recursive: true });
  await writeFile(path.join(root, "packages", "app", "errors.ts"), source);
  return collectDiagnosticCodes(root);
}

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("agent-visible diagnostic constructor catalog", () => {
  it("publishes stable system constructor messages and required recovery guidance", async () => {
    const entries = await collectFixture(`
      throw new ApertureSystemError(
        "aperture.color.invalidHex",
        "Use a valid CSS hex color.",
        "Pass #rgb, #rgba, #rrggbb or #rrggbbaa.",
        { message: "Metadata is not the error message" },
      );
      throw new ApertureSystemError(
        "aperture.fixture.lifecycleFailed",
        \`System \${systemId} failed during \${phase}.\`,
        recoverySuggestion,
      );
    `);
    expect(entries).toEqual([
      {
        code: "aperture.color.invalidHex",
        files: new Set(["packages/app/errors.ts"]),
        message: "Use a valid CSS hex color.",
        hasSuggestedFix: true,
      },
      {
        code: "aperture.fixture.lifecycleFailed",
        files: new Set(["packages/app/errors.ts"]),
        message: "System … failed during ….",
        hasSuggestedFix: true,
      },
    ]);
    expect(renderCatalog(entries)).toContain(
      "| `aperture.color.invalidHex` | Use a valid CSS hex color. | yes | `packages/app/errors.ts` |",
    );
  });

  it("retains CLI diagnostics and excludes dynamically composed system codes", async () => {
    const entries = await collectFixture(`
      throw new ApertureCliError(
        "aperture.cli.disconnected",
        "The session disconnected.",
        { suggestedFix: "Connect to an active session." },
      );
      throw new ApertureSystemError(dynamicCode, dynamicMessage, recoverySuggestion);
      throw new ApertureSystemError("aperture." + suffix, dynamicMessage, recoverySuggestion);
      throw new ApertureSystemError("aperture.fixture.dynamic" + suffix, dynamicMessage, recoverySuggestion);
    `);
    expect(entries).toEqual([
      {
        code: "aperture.cli.disconnected",
        files: new Set(["packages/app/errors.ts"]),
        message: "The session disconnected.",
        hasSuggestedFix: true,
      },
    ]);
  });
});
