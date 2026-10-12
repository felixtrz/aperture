import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  symlink,
  chmod,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  prepareOpaqueAblation,
  removeKnownOpaqueDiscard,
} from "../../tools/agent-benchmark/prepare-opaque-ablation.mjs";

const block =
  "  if ((material.featureFlags & STANDARD_FEATURE_ALPHA_MASK) != 0u && alpha < material.alphaCutoff) {\n    discard;\n  }";

describe("controlled copied-package opaque discard ablation", () => {
  it("removes precisely the stock alpha-mask block and rejects ambiguous source", () => {
    const source = `before\n${block}\nafter\nif (other) { discard; }`;
    expect(removeKnownOpaqueDiscard(source)).toContain(
      "if (other) { discard; }",
    );
    expect(removeKnownOpaqueDiscard(source)).not.toContain(
      "alpha < material.alphaCutoff",
    );
    expect(() => removeKnownOpaqueDiscard("discard;")).toThrow(/exactly one/);
    expect(() => removeKnownOpaqueDiscard(`${block}\n${block}`)).toThrow(
      /exactly one/,
    );
  });

  it("builds separate sealed copies, pins their inputs and leaves originals unchanged", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "aperture-opaque-ablation-"));
    const source = resolve(root, "source"),
      deps = resolve(root, "deps"),
      output = resolve(root, "result");
    const packageFile =
      "@aperture-engine/webgpu/dist/materials/standard/standard-shader-source.js";
    try {
      await mkdir(source);
      await writeFile(resolve(source, "scene.js"), "opaque-scene");
      await mkdir(
        resolve(deps, "@aperture-engine/webgpu/dist/materials/standard"),
        { recursive: true },
      );
      // Match the actual compiled package: discard is inside a literal WGSL template.
      await writeFile(
        resolve(deps, packageFile),
        "export const shader = `" + block + "`;\n",
      );
      await mkdir(resolve(deps, "vite/bin"), { recursive: true });
      await writeFile(
        resolve(deps, "vite/bin/vite.js"),
        "const fs=require('node:fs');fs.mkdirSync('dist');fs.writeFileSync('dist/app.js',fs.readFileSync('node_modules/@aperture-engine/webgpu/dist/materials/standard/standard-shader-source.js'));\n",
      );
      await symlink("vite", resolve(deps, "internal-vite-link"));
      const original = await readFile(resolve(deps, packageFile), "utf8");
      const result = await prepareOpaqueAblation({
        sourceRoot: source,
        dependenciesRoot: deps,
        outputRoot: output,
      });
      expect(await readFile(resolve(deps, packageFile), "utf8")).toBe(original);
      expect(
        await readFile(
          resolve(output, "base/node_modules", packageFile),
          "utf8",
        ),
      ).toBe(original);
      expect(
        await readFile(
          resolve(output, "opaque-discard-removed/node_modules", packageFile),
          "utf8",
        ),
      ).not.toContain("discard;");
      expect(result.originalDependencies["internal-vite-link"]).toEqual({
        symlink: "vite",
      });
      expect(result.variants.base.sourceFiles).toEqual(
        result.variants["opaque-discard-removed"].sourceFiles,
      );
      expect(result.variants.base.outputFiles).not.toEqual(
        result.variants["opaque-discard-removed"].outputFiles,
      );
      await expect(
        prepareOpaqueAblation({
          sourceRoot: source,
          dependenciesRoot: deps,
          outputRoot: output,
        }),
      ).rejects.toMatchObject({ code: "EEXIST" });
    } finally {
      // Fixtures are deliberately sealed; make their directory trees removable.
      for (const variant of ["base", "opaque-discard-removed"]) {
        await chmod(resolve(output, variant), 0o755).catch(() => {});
        await chmod(resolve(output, variant, "node_modules"), 0o755).catch(
          () => {},
        );
        await chmod(
          resolve(output, variant, "node_modules/@aperture-engine"),
          0o755,
        ).catch(() => {});
        await chmod(
          resolve(output, variant, "node_modules/@aperture-engine/webgpu"),
          0o755,
        ).catch(() => {});
        await chmod(
          resolve(output, variant, "node_modules/@aperture-engine/webgpu/dist"),
          0o755,
        ).catch(() => {});
        await chmod(
          resolve(
            output,
            variant,
            "node_modules/@aperture-engine/webgpu/dist/materials",
          ),
          0o755,
        ).catch(() => {});
        await chmod(
          resolve(
            output,
            variant,
            "node_modules/@aperture-engine/webgpu/dist/materials/standard",
          ),
          0o755,
        ).catch(() => {});
        await chmod(resolve(output, variant, "node_modules/vite"), 0o755).catch(
          () => {},
        );
        await chmod(
          resolve(output, variant, "node_modules/vite/bin"),
          0o755,
        ).catch(() => {});
        await chmod(resolve(output, variant, "dist"), 0o755).catch(() => {});
      }
      await rm(root, { recursive: true, force: true });
    }
  });
});
