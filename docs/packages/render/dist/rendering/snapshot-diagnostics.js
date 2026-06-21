import { summarizeDiagnostics, } from "@aperture-engine/simulation";
export function summarizeRenderSnapshotDiagnostics(snapshot) {
    return {
        frame: snapshot.frame,
        packets: {
            views: snapshot.views.length,
            meshDraws: snapshot.meshDraws.length,
            shadowCasterDraws: snapshot.shadowCasterDraws?.length ?? 0,
            lights: snapshot.lights.length,
            environments: snapshot.environments.length,
            shadowRequests: snapshot.shadowRequests.length,
            bounds: snapshot.bounds.length,
        },
        diagnostics: summarizeDiagnostics(snapshot.diagnostics),
    };
}
//# sourceMappingURL=snapshot-diagnostics.js.map