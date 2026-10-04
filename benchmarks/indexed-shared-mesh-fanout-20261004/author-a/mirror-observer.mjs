import { AssetRegistry } from "/worker-modules/packages/simulation/dist/index.js";
import { nativeMeshEvidence } from "./native-evidence.mjs";
/** Observe the main realm's actual registry, never construct a replacement mirror. */
export function installMirrorObserver() {
  const registries = new Set(),
    native = AssetRegistry.prototype.markReady;
  AssetRegistry.prototype.markReady = function (...args) {
    const result = native.apply(this, args);
    if (args[0]?.kind === "mesh") registries.add(this);
    return result;
  };
  return {
    capture(snapshot) {
      const handles = [
          ...new Map(
            snapshot.meshDraws.map((p) => [p.mesh.id, p.mesh]),
          ).values(),
        ],
        matches = [...registries].filter((r) =>
          handles.every((h) => r.get(h)?.asset),
        );
      if (matches.length !== 1)
        throw Error(
          `Actual main-thread mirror is ambiguous: ${matches.length}`,
        );
      const registry = matches[0];
      return handles.map((h) => {
        const e = registry.get(h);
        return nativeMeshEvidence(h.id, e.asset, [], {
          meshId: h.id,
          assetVersion: e.version,
          assetLabel: e.asset.label,
          assetKey: e.key,
        });
      });
    },
  };
}
