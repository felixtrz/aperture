import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  validateFreezeMetadata,
  verifyExperimentFreezes,
  verifyPreservedEvidence,
} from "../../scripts/check-preserved-evidence.mjs";
import { formatRepository } from "../../scripts/format-repository.mjs";
import { sealReviewedExperiment } from "../../scripts/seal-experiment-evidence.mjs";

const directories = [];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const repo = fileURLToPath(new URL("../../", import.meta.url));

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-fresh-freeze-"));
  directories.push(root);
  const input = "benchmarks/fresh-race/inputs/scene.mjs";
  const raw = "benchmarks/fresh-race/attempt-001/raw.json";
  const outputPath = "benchmarks/fresh-race/freezes/batch-001.json";
  await mkdir(path.dirname(path.join(root, input)), { recursive: true });
  await mkdir(path.dirname(path.join(root, raw)), { recursive: true });
  await writeFile(
    path.join(root, input),
    "export const scene={house:true,car:true}\n",
  );
  await writeFile(path.join(root, raw), '{"actualDraws":12,"failed":false}\n');
  const specification = {
    schema: "aperture.experiment-freeze-request.v1",
    purpose: "Retain all original bytes from synthetic attempt 001",
    review: {
      reviewedBy: "synthetic fixture",
      reviewedAt: "2020-01-01T00:00:00Z",
    },
    provenance: {
      kind: "working-tree-snapshot",
      note: "Synthetic source copy; no Git revision is claimed",
      inputs: { "actor-a/src/scene.mjs": input },
    },
    files: {
      [input]: "Synthetic original source copy",
      [raw]: "Synthetic actual raw capture output",
    },
  };
  const registry = {
    schema: "aperture.experiment-freeze-registry.v1",
    purpose: "Explicit synthetic registrations",
    inventories: [],
  };
  const registration = await sealReviewedExperiment(specification, {
    root,
    outputPath,
  });
  registry.inventories.push(registration);
  return {
    root,
    input,
    raw,
    outputPath,
    specification,
    registration,
    registry,
  };
}

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("reviewed fresh experiment freezes", () => {
  it("records exact working-tree copy hashes with separate truthful provenance", async () => {
    const { root, input, raw, outputPath, registry } = await fixture();
    const freeze = JSON.parse(
      await readFile(path.join(root, outputPath), "utf8"),
    );
    expect(freeze.provenance.inputs["actor-a/src/scene.mjs"]).toEqual({
      snapshotPath: input,
      sha256: hash(await readFile(path.join(root, input))),
      bytes: (await readFile(path.join(root, input))).length,
    });
    expect(freeze).not.toHaveProperty("baselineRevision");
    expect(freeze.provenance).not.toHaveProperty("gitRevision");
    await expect(verifyExperimentFreezes(root, registry)).resolves.toEqual(
      [input, raw, outputPath].sort(),
    );
  });

  it("rejects changed and missing attempt artifacts", async () => {
    const { root, raw, registry } = await fixture();
    await writeFile(path.join(root, raw), '{"actualDraws":99}\n');
    await expect(verifyExperimentFreezes(root, registry)).rejects.toThrow(
      "Modified experiment evidence",
    );
    await unlink(path.join(root, raw));
    await expect(verifyExperimentFreezes(root, registry)).rejects.toThrow(
      "ENOENT",
    );
  });

  it("rejects changed and missing manifest bytes before trusting their exclusions", async () => {
    const { root, outputPath, registry } = await fixture();
    await writeFile(path.join(root, outputPath), "{}\n");
    await expect(verifyExperimentFreezes(root, registry)).rejects.toThrow(
      "Modified experiment inventory",
    );
    await unlink(path.join(root, outputPath));
    await expect(verifyExperimentFreezes(root, registry)).rejects.toThrow(
      "ENOENT",
    );
  });

  it("refuses to overwrite a surviving freeze", async () => {
    const { root, outputPath, specification } = await fixture();
    const before = await readFile(path.join(root, outputPath));
    await expect(
      sealReviewedExperiment(specification, { root, outputPath }),
    ).rejects.toThrow("EEXIST");
    expect(await readFile(path.join(root, outputPath))).toEqual(before);
  });

  it("checks declared byte counts independently of content hashes", async () => {
    const { root, raw, outputPath, registry } = await fixture();
    const freeze = JSON.parse(
      await readFile(path.join(root, outputPath), "utf8"),
    );
    freeze.files[raw].bytes++;
    const payload = JSON.stringify(freeze);
    await writeFile(path.join(root, outputPath), payload);
    registry.inventories[0].sha256 = hash(payload);
    await expect(verifyExperimentFreezes(root, registry)).rejects.toThrow(
      "Experiment byte count mismatch",
    );
  });

  it("rejects source-copy mismatch and invented revision metadata", async () => {
    const { root, outputPath } = await fixture();
    const freeze = JSON.parse(
      await readFile(path.join(root, outputPath), "utf8"),
    );
    freeze.provenance.inputs["actor-a/src/scene.mjs"].sha256 = "b".repeat(64);
    expect(() => validateFreezeMetadata(freeze)).toThrow(
      "Input hash does not match retained copy",
    );
    freeze.provenance.gitRevision = "a".repeat(40);
    expect(() => validateFreezeMetadata(freeze)).toThrow(
      "Unexpected evidence metadata fields",
    );
  });

  it("never scans private environments, directory globs, or editable package files", async () => {
    const { root, specification } = await fixture();
    for (const target of [
      ".aperture-env/actors/raw.json",
      "benchmarks/fresh-race/.aperture-env/raw.json",
      "benchmarks/fresh-race/.aperture-env/@types+node@1.json",
      "benchmarks/fresh-race/**",
      "benchmarks/fresh-race/@types+node@1*.json",
      "benchmarks/fresh-race/@types+node@1[2].json",
      "benchmarks/fresh-race/@types+node@1/../raw.json",
      "benchmarks/../packages/app/src/index.ts",
      "packages/app/src/index.ts",
    ]) {
      await expect(
        sealReviewedExperiment(
          { ...specification, files: { [target]: "Unacceptable test input" } },
          { root, outputPath: "benchmarks/fresh-race/freezes/rejected.json" },
        ),
      ).rejects.toThrow();
    }
  });

  it("hash-verifies literal + and @ package filenames without exempting siblings or broadening the historical inventory", async () => {
    const { root, specification, registry } = await fixture();
    const index =
      "benchmarks/fresh-race/source/.pnpm-store/index/hash-@types+node@1.0.0.json";
    const sibling =
      "benchmarks/fresh-race/source/.pnpm-store/index/hash-@types+node@2.0.0.json";
    await mkdir(path.dirname(path.join(root, index)), { recursive: true });
    const original = '{"name":"@types/node","version":"1.0.0","files":{}}\n';
    await writeFile(path.join(root, index), original);
    await writeFile(path.join(root, sibling), '{"active":true}\n');
    specification.files[index] =
      "Synthetic individually reviewed package index";
    specification.provenance.inputs["actor-a/store/@types+node@1.0.0.json"] =
      index;
    const registration = await sealReviewedExperiment(specification, {
      root,
      outputPath: "benchmarks/fresh-race/freezes/package-metadata.json",
    });
    registry.inventories.push(registration);
    const preserved = await verifyExperimentFreezes(root, registry);
    expect(preserved).toContain(index);
    expect(preserved).not.toContain(sibling);
    await expect(
      verifyPreservedEvidence(root, {
        schema: "aperture.preserved-evidence.v1",
        baselineRevision: "a".repeat(40),
        files: { [index]: hash(original) },
      }),
    ).rejects.toThrow("Invalid preserved evidence path");
    await writeFile(path.join(root, index), '{"changed":true}\n');
    await expect(verifyExperimentFreezes(root, registry)).rejects.toThrow(
      "Modified experiment evidence",
    );
  });

  it("retains genuinely empty failed-attempt artifacts without fabricating bytes", async () => {
    const { root, specification, registry } = await fixture();
    const empty = "benchmarks/fresh-race/attempt-001/empty-output.bin";
    await writeFile(path.join(root, empty), "");
    specification.files[empty] =
      "Synthetic genuinely empty failed-attempt output";
    const registration = await sealReviewedExperiment(specification, {
      root,
      outputPath: "benchmarks/fresh-race/freezes/batch-002.json",
    });
    registry.inventories.push(registration);
    await expect(verifyExperimentFreezes(root, registry)).resolves.toContain(
      empty,
    );
  });

  it("excludes only registered bytes while new trial source remains formatted", async () => {
    const { root, input, raw, registry } = await fixture();
    await writeFile(path.join(root, ".gitignore"), "");
    await writeFile(path.join(root, ".prettierignore"), "");
    const baseline = "benchmarks/old/receipt.txt";
    await mkdir(path.dirname(path.join(root, baseline)), { recursive: true });
    await writeFile(path.join(root, baseline), "original\n");
    const inventory = {
      schema: "aperture.preserved-evidence.v1",
      baselineRevision: "a".repeat(40),
      files: { [baseline]: hash("original\n") },
    };
    const active = "benchmarks/fresh-race/new-scene.mjs";
    await writeFile(
      path.join(root, active),
      "export const detail={tree:true}\n",
    );
    let output;
    const spawn = (command, argv, options) => {
      const result = spawnSync(
        command,
        [
          path.join(repo, "node_modules/prettier/bin/prettier.cjs"),
          ...argv.slice(1),
        ],
        { ...options, stdio: "pipe", encoding: "utf8" },
      );
      output = result.stdout + result.stderr;
      return result;
    };
    expect(
      await formatRepository("--check", {
        root,
        inventory,
        experimentRegistry: registry,
        spawn,
      }),
    ).toBe(1);
    expect(output).toContain(active);
    expect(output).not.toContain(raw);
    expect(output).not.toContain(input);
    await writeFile(path.join(root, raw), "changed\n");
    const forbiddenSpawn = vi.fn();
    await expect(
      formatRepository("--write", {
        root,
        inventory,
        experimentRegistry: registry,
        spawn: forbiddenSpawn,
      }),
    ).rejects.toThrow("Modified experiment evidence");
    expect(forbiddenSpawn).not.toHaveBeenCalled();
  }, 15000);
});
