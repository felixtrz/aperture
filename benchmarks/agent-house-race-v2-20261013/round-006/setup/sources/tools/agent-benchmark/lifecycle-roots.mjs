import { readFile, realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { requireValue } from "./contract.mjs";

// Both roots are explicitly supported by cleanup.Config. Restored scratch
// directories retain their original markers and cannot be adopted after relocation.
export const APPROVED_LIFECYCLE_ROOTS = Object.freeze([
  "/workspace/scratch/0190a8c72f8a/aperture-tmp",
  "/workspace/shared/aperture-tmp",
]);

export function validateRootMarker(root, raw, identity) {
  requireValue(
    APPROVED_LIFECYCLE_ROOTS.includes(root),
    "Unsupported lifecycle root",
  );
  const marker = JSON.parse(raw);
  const numeric = (name) => {
    const matches = [
      ...raw.matchAll(new RegExp(`"${name}"\\s*:\\s*(\\d+)(?=\\s*[,}])`, "g")),
    ];
    requireValue(matches.length === 1, "Ambiguous lifecycle root identity");
    return BigInt(matches[0][1]);
  };
  requireValue(
    Object.keys(marker).sort().join(",") === "device,inode,path,schema" &&
      marker.schema === "aperture.disposable-root.v2" &&
      marker.path === root &&
      numeric("device") === identity.dev &&
      numeric("inode") === identity.ino,
    "Lifecycle root marker differs from physical directory",
  );
}

export async function verifyLifecycleRoot(root) {
  requireValue(
    APPROVED_LIFECYCLE_ROOTS.includes(root),
    "Unsupported lifecycle root",
  );
  requireValue(
    (await realpath(root)) === root,
    "Lifecycle root must be canonical",
  );
  const identity = await stat(root, { bigint: true });
  requireValue(identity.isDirectory(), "Lifecycle root must be a directory");
  const marker = await readFile(
    resolve(root, ".aperture-disposable-root.json"),
    "utf8",
  );
  requireValue(marker.length <= 1024, "Lifecycle root marker exceeds bound");
  validateRootMarker(root, marker, identity);
}
