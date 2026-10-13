import type { EcsWorld } from "@aperture-engine/simulation";
import { type RenderDiagnostic, type ViewPacket } from "./snapshot.js";
import { type ViewCullContext } from "./extraction-culling.js";
export declare function extractViews(world: EcsWorld, viewMatrices: number[], diagnostics: RenderDiagnostic[], viewCullContexts: ViewCullContext[]): ViewPacket[];
//# sourceMappingURL=extraction-views.d.ts.map