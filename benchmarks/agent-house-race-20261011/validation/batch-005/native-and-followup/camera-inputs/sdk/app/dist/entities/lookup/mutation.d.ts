import { type EcsWorld } from "@aperture-engine/simulation";
import type { ApertureEntitySetComponentFieldReport, ApertureEntitySetComponentFieldRequest } from "./types.js";
export declare function setApertureEntityComponentField(world: EcsWorld, request: ApertureEntitySetComponentFieldRequest): ApertureEntitySetComponentFieldReport;
/**
 * The mutable component/field whitelist, derived from the registry itself so
 * docs and tools can stay in lockstep (a test asserts docs/AI_TOOLING.md lists
 * exactly these entries).
 */
export declare function listMutableComponentFields(): Readonly<Record<string, readonly string[]>>;
//# sourceMappingURL=mutation.d.ts.map