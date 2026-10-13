import { type Entity, type Vec3Like } from "@aperture-engine/simulation";
import type { SystemTransformInput } from "./types.js";
export declare function addTransform(entity: Entity, input?: SystemTransformInput): void;
export declare function writeTransform(entity: Entity, input?: SystemTransformInput): void;
/**
 * Build the look-at orientation quaternion used by `spawn.camera({ transform:
 * { translation, lookAt } })`. Exported so reusable controllers (the orbit
 * camera) compose the camera rotation with the exact same convention (forward
 * down -Z, world-up [0,1,0]) as the spawn path.
 */
export declare function quatLookAt(translation: Vec3Like, target: Vec3Like): readonly [number, number, number, number];
//# sourceMappingURL=transforms.d.ts.map