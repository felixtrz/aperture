/** Read-only comparison against preserved Git blobs; never reconstruct native evidence. */
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
export const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export async function verifyArchive(
  commit,
  prefix,
  expectedFiles,
  expectedBytes,
) {
  const rows = execFileSync(
      "git",
      ["ls-tree", "-r", "-z", commit, "--", prefix],
      { cwd: repo, maxBuffer: 8 * 1024 * 1024 },
    )
      .toString()
      .split("\0")
      .filter(Boolean),
    files = {};
  let total = 0;
  for (const row of rows) {
    const [metadata, name] = row.split("\t"),
      oid = metadata.split(" ")[2],
      actual = await readFile(resolve(repo, name)),
      original = execFileSync("git", ["cat-file", "blob", oid], {
        cwd: repo,
        maxBuffer: 32 * 1024 * 1024,
      });
    if (!actual.equals(original))
      throw Error("Preserved archive differs: " + name);
    files[name] = {
      bytes: actual.length,
      sha256: sha256(actual),
      gitBlob: oid,
    };
    total += actual.length;
  }
  if (
    rows.length !== expectedFiles ||
    (expectedBytes !== undefined && total !== expectedBytes)
  )
    throw Error("Preserved archive inventory differs: " + prefix);
  return { commit, prefix, filesExact: rows.length, totalBytes: total, files };
}
export async function verifyPreservedArchives() {
  const commit = "6f3ca39472e896573c0ab0bc59d381ba3cf4f75f",
    path = "tools/coordination/checkpoints/current.snapshot",
    gitBlob = "111ec1c75b4e21e2db775067168f4a80477c5752",
    archived = execFileSync("git", ["show", `${commit}:${path}`], {
      cwd: repo,
      maxBuffer: 1024 * 1024,
    }),
    blob = execFileSync("git", ["cat-file", "blob", gitBlob], {
      cwd: repo,
      maxBuffer: 1024 * 1024,
    });
  if (!archived.equals(blob) || archived.length !== 126317)
    throw Error("Archived publication checkpoint differs");
  const v1 = await verifyArchive(
    commit,
    "benchmarks/shared-mesh-fanout-20261003",
    93,
    5871362,
  );
  return {
    v1: {
      ...v1,
      publication: {
        files: 94,
        bytes: 5997679,
        checkpoint: {
          path,
          gitBlob,
          bytes: archived.length,
          sha256: sha256(archived),
          scope:
            "Archived Git blob only; current mutable checkpoint is neither read nor pinned",
        },
      },
    },
    topology: await verifyArchive(
      "8a2e900edd794d0392b133c332a3f1ba161f8302",
      "benchmarks/crane-topology-regression-20261003",
      265,
    ),
  };
}
