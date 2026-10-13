import { type AssetHandle } from "@aperture-engine/simulation";
import type { Entity } from "@aperture-engine/simulation";
import type { RenderDiagnostic, RenderEntityRef } from "./snapshot.js";
export declare function entityRef(entity: Entity): RenderEntityRef;
export declare function diagnostic(code: string, entity: Entity, handle?: AssetHandle): RenderDiagnostic;
//# sourceMappingURL=extraction-diagnostics.d.ts.map