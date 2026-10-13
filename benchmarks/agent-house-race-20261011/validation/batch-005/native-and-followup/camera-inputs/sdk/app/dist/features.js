import { recordApertureCleanupFailures } from "./internal/bootstrap-safety.js";
import { runDisposersInReverse, } from "@aperture-engine/simulation";
export class ApertureFeatureError extends Error {
    code;
    suggestedFix;
    diagnostics;
    constructor(input) {
        super(input.message, { cause: input.cause });
        this.name = "ApertureFeatureError";
        this.code = input.code;
        this.suggestedFix = input.suggestedFix;
        this.diagnostics = input.diagnostics;
    }
}
export function createFeatureDiagnosticsSink(initial = []) {
    const diagnostics = [...initial];
    const sink = {
        report(diagnostic) {
            diagnostics.push(diagnostic);
        },
        scoped(featureId) {
            return {
                report(diagnostic) {
                    sink.report({
                        ...diagnostic,
                        featureId: diagnostic.featureId ?? featureId,
                    });
                },
            };
        },
        list() {
            return diagnostics.slice();
        },
    };
    return sink;
}
export async function installApertureWorkerFeatures(options) {
    const diagnostics = options.diagnostics ?? createFeatureDiagnosticsSink();
    const orderedFeatures = resolveApertureWorkerFeatureOrder(options.features, diagnostics);
    const disposers = [];
    const registerExtractor = options.registerExtractor ?? createMissingExtractorRegistrar(diagnostics);
    try {
        for (const feature of orderedFeatures) {
            feature.registerComponents?.({
                world: options.world,
                diagnostics,
            });
        }
        for (const feature of orderedFeatures) {
            feature.registerAssets?.({
                registry: options.assets,
                diagnostics,
            });
        }
        for (const feature of orderedFeatures) {
            const result = await feature.installRuntime?.({
                world: options.world,
                assets: options.assets,
                registerFixedStepTask: options.registerFixedStepTask,
                diagnostics,
            });
            pushDisposer(disposers, feature, "installRuntime", result);
        }
        for (const feature of orderedFeatures) {
            const result = await feature.installExtraction?.({
                registerExtractor,
                diagnostics,
            });
            pushDisposer(disposers, feature, "installExtraction", result);
        }
    }
    catch (error) {
        try {
            await rollbackInstalledFeatures(disposers, diagnostics);
        }
        catch (rollbackError) {
            recordApertureCleanupFailures([rollbackError]);
            // The installation error remains primary; diagnostics retain rollback
            // details and further world bootstrap is blocked until process restart.
            throw featureInstallError(error, diagnostics);
        }
        throw featureInstallError(error, diagnostics);
    }
    return {
        order: orderedFeatures.map((feature) => feature.id),
        diagnostics,
        async dispose() {
            await rollbackInstalledFeatures(disposers, diagnostics);
        },
    };
}
export function resolveApertureWorkerFeatureOrder(features, diagnostics = createFeatureDiagnosticsSink()) {
    // Resolution must be a pure function of the feature list: only diagnostics
    // added during THIS call may fail it, never entries a caller-supplied or
    // reused sink already carried.
    const preexistingDiagnostics = diagnostics.list().length;
    const byId = new Map();
    for (const feature of features) {
        if (byId.has(feature.id)) {
            diagnostics.report({
                code: "aperture.feature.duplicate",
                severity: "error",
                featureId: feature.id,
                message: `Feature '${feature.id}' was configured more than once.`,
                suggestedFix: "Remove the duplicate feature entry or compose it through one preset.",
                data: { featureId: feature.id },
            });
            throw featureResolutionError(diagnostics);
        }
        byId.set(feature.id, feature);
    }
    for (const feature of features) {
        for (const requiredId of feature.requires ?? []) {
            if (!byId.has(requiredId)) {
                diagnostics.report({
                    code: "aperture.feature.missingRequired",
                    severity: "error",
                    featureId: feature.id,
                    message: `Feature '${feature.id}' requires missing feature '${requiredId}'.`,
                    suggestedFix: "Add the required feature or remove the dependent feature from the app configuration.",
                    data: { featureId: feature.id, requiredId },
                });
            }
        }
        for (const conflictId of feature.conflictsWith ?? []) {
            if (byId.has(conflictId)) {
                diagnostics.report({
                    code: "aperture.feature.conflict",
                    severity: "error",
                    featureId: feature.id,
                    message: `Feature '${feature.id}' conflicts with configured feature '${conflictId}'.`,
                    suggestedFix: "Remove one of the conflicting features from the app configuration.",
                    data: { featureId: feature.id, conflictId },
                });
            }
        }
    }
    if (diagnostics
        .list()
        .slice(preexistingDiagnostics)
        .some((diagnostic) => diagnostic.severity === "error")) {
        throw featureResolutionError(diagnostics);
    }
    const ordered = [];
    const visited = new Set();
    const visiting = new Set();
    const sccByFeatureId = assignFeatureSccIds(features, byId);
    for (const feature of features) {
        visitFeature(feature, byId, sccByFeatureId, visited, visiting, ordered, diagnostics);
    }
    return ordered;
}
function visitFeature(feature, byId, sccByFeatureId, visited, visiting, ordered, diagnostics) {
    if (visited.has(feature.id)) {
        return;
    }
    if (visiting.has(feature.id)) {
        diagnostics.report({
            code: "aperture.feature.dependencyCycle",
            severity: "error",
            featureId: feature.id,
            message: `Feature dependency cycle includes '${feature.id}'.`,
            suggestedFix: "Break the feature dependency cycle by removing or reordering the feature dependency declarations.",
            data: { featureId: feature.id },
        });
        throw featureResolutionError(diagnostics);
    }
    visiting.add(feature.id);
    for (const requiredId of feature.requires ?? []) {
        const requiredFeature = byId.get(requiredId);
        if (requiredFeature !== undefined) {
            visitFeature(requiredFeature, byId, sccByFeatureId, visited, visiting, ordered, diagnostics);
        }
    }
    for (const optionalId of feature.optional ?? []) {
        const optionalFeature = byId.get(optionalId);
        // `optional` is a soft ordering hint. Every cycle lives inside one
        // strongly connected component, so an optional edge between two features
        // in the same component is exactly a hint that would create a cycle —
        // drop it and keep resolving. Only `requires` cycles are hard errors.
        if (optionalFeature === undefined ||
            sccByFeatureId.get(feature.id) === sccByFeatureId.get(optionalId)) {
            continue;
        }
        visitFeature(optionalFeature, byId, sccByFeatureId, visited, visiting, ordered, diagnostics);
    }
    visiting.delete(feature.id);
    visited.add(feature.id);
    ordered.push(feature);
}
function assignFeatureSccIds(features, byId) {
    const indices = new Map();
    const lowLinks = new Map();
    const onStack = new Set();
    const stack = [];
    const sccIds = new Map();
    let nextIndex = 0;
    let nextSccId = 0;
    const connect = (feature) => {
        const index = nextIndex;
        nextIndex += 1;
        indices.set(feature.id, index);
        lowLinks.set(feature.id, index);
        stack.push(feature.id);
        onStack.add(feature.id);
        for (const dependencyId of [
            ...(feature.requires ?? []),
            ...(feature.optional ?? []),
        ]) {
            const dependency = byId.get(dependencyId);
            if (dependency === undefined) {
                continue;
            }
            if (!indices.has(dependencyId)) {
                connect(dependency);
                lowLinks.set(feature.id, Math.min(lowLinks.get(feature.id) ?? index, lowLinks.get(dependencyId) ?? index));
            }
            else if (onStack.has(dependencyId)) {
                lowLinks.set(feature.id, Math.min(lowLinks.get(feature.id) ?? index, indices.get(dependencyId) ?? index));
            }
        }
        if (lowLinks.get(feature.id) === indices.get(feature.id)) {
            const sccId = nextSccId;
            nextSccId += 1;
            for (;;) {
                const memberId = stack.pop();
                if (memberId === undefined) {
                    break;
                }
                onStack.delete(memberId);
                sccIds.set(memberId, sccId);
                if (memberId === feature.id) {
                    break;
                }
            }
        }
    };
    for (const feature of features) {
        if (!indices.has(feature.id)) {
            connect(feature);
        }
    }
    return sccIds;
}
function pushDisposer(disposers, feature, phase, result) {
    const disposer = installResultToDisposer(result);
    if (disposer === null) {
        return;
    }
    let disposed = false;
    disposers.push({
        featureId: feature.id,
        phase,
        dispose() {
            if (disposed) {
                return;
            }
            disposed = true;
            return disposer();
        },
    });
}
function installResultToDisposer(result) {
    if (result === undefined) {
        return null;
    }
    if (typeof result === "function") {
        return result;
    }
    return () => result.dispose();
}
async function rollbackInstalledFeatures(disposers, diagnostics) {
    await runDisposersInReverse({
        disposers: disposers.map((disposer) => () => disposer.dispose()),
        failureMessage: "One or more feature disposers failed.",
        onError(error, index) {
            const disposer = disposers[index];
            diagnostics.report({
                code: "aperture.feature.disposeFailed",
                severity: "error",
                featureId: disposer?.featureId ?? "feature-resolver",
                message: "Feature disposer failed.",
                suggestedFix: "Inspect the feature disposer and ensure teardown can run safely during app shutdown or rollback.",
                data: {
                    phase: disposer?.phase,
                    message: error instanceof Error ? error.message : String(error),
                },
            });
        },
    });
}
function featureResolutionError(diagnostics) {
    return new ApertureFeatureError({
        code: "aperture.feature.resolutionFailed",
        message: "Aperture feature resolution failed.",
        suggestedFix: "Inspect the feature diagnostics and fix duplicate, missing, conflicting, or cyclic feature declarations.",
        diagnostics: diagnostics.list(),
    });
}
function featureInstallError(error, diagnostics) {
    if (error instanceof ApertureFeatureError) {
        return error;
    }
    diagnostics.report({
        code: "aperture.feature.installFailed",
        severity: "error",
        featureId: "feature-resolver",
        message: error instanceof Error
            ? error.message
            : "Aperture feature installation failed.",
        suggestedFix: "Inspect the feature diagnostics and fix the failing feature install hook.",
    });
    return new ApertureFeatureError({
        code: "aperture.feature.installFailed",
        message: "Aperture feature installation failed.",
        suggestedFix: "Inspect the feature diagnostics and fix the failing feature install hook.",
        diagnostics: diagnostics.list(),
        cause: error,
    });
}
function createMissingExtractorRegistrar(diagnostics) {
    return (hook) => {
        diagnostics.report({
            code: "aperture.feature.extractorRegistryMissing",
            severity: "error",
            featureId: hook.id,
            message: `Feature '${hook.id}' attempted to register extraction without an extraction registry.`,
            suggestedFix: "Install the feature through a resolver that provides an extraction registry, or remove the extraction hook from this phase.",
            data: { packetFamilies: hook.packetFamilies },
        });
        throw featureResolutionError(diagnostics);
    };
}
//# sourceMappingURL=features.js.map