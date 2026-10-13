import { assetHandleKey } from "@aperture-engine/simulation";
export function inspectRenderSnapshot(snapshot) {
    const diagnostics = [...snapshot.diagnostics];
    if (snapshot.views.length === 0 &&
        snapshot.meshDraws.length === 0 &&
        snapshot.lights.length === 0 &&
        snapshot.environments.length === 0 &&
        snapshot.shadowRequests.length === 0 &&
        (snapshot.proceduralSkies?.length ?? 0) === 0 &&
        (snapshot.runtimeUniforms?.length ?? 0) === 0 &&
        snapshot.bounds.length === 0) {
        diagnostics.push({
            code: "renderSnapshot.empty",
            message: "Render snapshot contains no packets.",
            severity: "info",
        });
    }
    return {
        counts: {
            views: snapshot.views.length,
            meshDraws: snapshot.meshDraws.length,
            shadowCasterDraws: snapshot.shadowCasterDraws?.length ?? 0,
            lights: snapshot.lights.length,
            environments: snapshot.environments.length,
            shadowRequests: snapshot.shadowRequests.length,
            proceduralSkies: snapshot.proceduralSkies?.length ?? 0,
            runtimeUniforms: snapshot.runtimeUniforms?.length ?? 0,
            bounds: snapshot.bounds.length,
            transformFloats: snapshot.transforms.length,
            viewMatrixFloats: snapshot.viewMatrices.length,
            diagnostics: diagnostics.length,
        },
        handles: {
            meshKeys: uniqueSorted([...snapshot.meshDraws, ...(snapshot.shadowCasterDraws ?? [])].map((draw) => assetHandleKey(draw.mesh))),
            materialKeys: uniqueSorted([...snapshot.meshDraws, ...(snapshot.shadowCasterDraws ?? [])].map((draw) => assetHandleKey(draw.material))),
            renderTargetKeys: uniqueSorted(snapshot.views.flatMap((view) => view.renderTarget === null ? [] : [assetHandleKey(view.renderTarget)])),
            environmentMapKeys: uniqueSorted(snapshot.environments.flatMap((environment) => environment.handle === null
                ? []
                : [assetHandleKey(environment.handle)])),
        },
        diagnostics,
    };
}
export function explainRenderSnapshotEntity(snapshot, entity) {
    const draws = snapshot.meshDraws.filter((draw) => sameEntity(draw.entity, entity));
    const diagnostics = snapshot.diagnostics.filter((diagnostic) => sameOptionalEntity(diagnostic.entity, entity));
    const rendered = draws.length > 0;
    const skipped = !rendered && diagnostics.length > 0;
    const status = rendered
        ? "rendered"
        : skipped
            ? "skipped"
            : "unknown";
    return {
        entity,
        status,
        rendered,
        skipped,
        drawCount: draws.length,
        renderIds: draws.map((draw) => draw.renderId),
        diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
        reasons: entityExplanationReasons(diagnostics),
    };
}
function uniqueSorted(values) {
    return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
function sameOptionalEntity(value, entity) {
    return value !== undefined && sameEntity(value, entity);
}
function sameEntity(a, b) {
    return a.index === b.index && a.generation === b.generation;
}
function entityExplanationReasons(diagnostics) {
    return uniqueSorted(diagnostics.map((diagnostic) => reasonForDiagnosticCode(diagnostic.code)));
}
function reasonForDiagnosticCode(code) {
    switch (code) {
        case "render.disabled":
            return "disabled";
        case "render.invisible":
            return "visibility-hidden";
        case "render.layerMismatch":
            return "layer-mismatch";
        case "render.missingMeshHandle":
            return "missing-mesh-handle";
        case "render.missingMaterialHandle":
            return "missing-material-handle";
        default:
            return code;
    }
}
//# sourceMappingURL=snapshot-inspection.js.map