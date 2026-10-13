import type { GltfMaterialMappingDiagnostic } from "./gltf-material-types.js";
import type { RenderStateDescriptor } from "./types.js";
export declare function withTransmissionRenderState(renderState: RenderStateDescriptor, transmissionFactor: number): RenderStateDescriptor;
export declare function gltfRenderState(material: Record<string, unknown>, materialKey: string, diagnostics: GltfMaterialMappingDiagnostic[]): RenderStateDescriptor;
//# sourceMappingURL=gltf-material-render-state.d.ts.map