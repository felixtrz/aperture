import type { EcsWorld } from "@aperture-engine/simulation";
import type { ApertureEntityLookupSnapshot, ApertureEntityLookupSnapshotOptions, ApertureEntitySnapshotDiff } from "./types.js";
export declare function createApertureEntityLookupSnapshot(world: EcsWorld, options?: ApertureEntityLookupSnapshotOptions): ApertureEntityLookupSnapshot;
export declare function diffApertureEntityLookupSnapshots(previous: ApertureEntityLookupSnapshot, next: ApertureEntityLookupSnapshot): ApertureEntitySnapshotDiff;
//# sourceMappingURL=snapshot.d.ts.map