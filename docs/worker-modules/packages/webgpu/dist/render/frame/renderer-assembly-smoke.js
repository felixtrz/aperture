import { summarizeDiagnostics, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
export function createRendererAssemblySmokeReport(input) {
    const snapshot = evaluateSnapshot(input.snapshot);
    const cloneability = evaluateCloneability(input.cloneability);
    const packages = evaluatePackages(input.packages);
    const resources = evaluateResources(input.resources);
    const frame = evaluateFrame(input.frame);
    const sections = {
        snapshot: snapshot.status,
        cloneability: cloneability.status,
        packages: packages.status,
        resources: resources.status,
        frame: frame.status,
    };
    const diagnostics = [
        ...snapshot.diagnostics,
        ...cloneability.diagnostics,
        ...packages.diagnostics,
        ...resources.diagnostics,
        ...frame.diagnostics,
    ];
    return {
        ready: Object.values(sections).every((section) => section.ready),
        sections,
        diagnostics,
        summary: {
            snapshot: input.snapshot?.counts ?? null,
            cloneability: input.cloneability === null
                ? null
                : {
                    valid: input.cloneability.valid,
                    diagnostics: input.cloneability.diagnostics,
                },
            packages: input.packages === null
                ? null
                : {
                    packageCount: input.packages.packageCount,
                    diagnostics: input.packages.diagnostics,
                },
            resources: input.resources?.counts ?? null,
            frame: input.frame === null
                ? null
                : {
                    frame: input.frame.frame,
                    ready: input.frame.ready,
                    draws: input.frame.draws,
                    batches: input.frame.batches,
                    diagnostics: input.frame.diagnostics,
                },
        },
    };
}
export function rendererAssemblySmokeReportToJsonValue(report) {
    const diagnostics = summarizeDiagnostics(report.diagnostics);
    return {
        ready: report.ready,
        sections: {
            snapshot: sectionToJsonValue(report.sections.snapshot),
            cloneability: sectionToJsonValue(report.sections.cloneability),
            packages: sectionToJsonValue(report.sections.packages),
            resources: sectionToJsonValue(report.sections.resources),
            frame: sectionToJsonValue(report.sections.frame),
        },
        summary: {
            snapshot: report.summary.snapshot,
            cloneability: report.summary.cloneability === null
                ? null
                : {
                    valid: report.summary.cloneability.valid,
                    diagnostics: summarizeDiagnostics(report.summary.cloneability.diagnostics),
                },
            packages: report.summary.packages === null
                ? null
                : {
                    packageCount: report.summary.packages.packageCount,
                    diagnostics: summarizeDiagnostics(report.summary.packages.diagnostics),
                },
            resources: report.summary.resources,
            frame: report.summary.frame === null
                ? null
                : {
                    frame: report.summary.frame.frame,
                    ready: report.summary.frame.ready,
                    draws: report.summary.frame.draws,
                    batches: report.summary.frame.batches,
                    diagnostics: {
                        total: report.summary.frame.diagnostics.total,
                        bySeverity: {
                            info: report.summary.frame.diagnostics.bySeverity.info,
                            warning: report.summary.frame.diagnostics.bySeverity.warning,
                            error: report.summary.frame.diagnostics.bySeverity.error,
                        },
                        byCode: { ...report.summary.frame.diagnostics.byCode },
                    },
                },
        },
        diagnostics: {
            total: diagnostics.total,
            bySeverity: {
                info: diagnostics.bySeverity.info,
                warning: diagnostics.bySeverity.warning,
                error: diagnostics.bySeverity.error,
            },
            byCode: { ...diagnostics.byCode },
        },
    };
}
export function rendererAssemblySmokeReportToJson(report) {
    return JSON.stringify(rendererAssemblySmokeReportToJsonValue(report));
}
export function summarizeRendererAssemblyDiagnosticsBySection(report) {
    const diagnostics = summarizeDiagnostics(report.diagnostics);
    return {
        ready: diagnostics.total === 0,
        sections: {
            snapshot: summarizeSectionDiagnostics("snapshot", report),
            cloneability: summarizeSectionDiagnostics("cloneability", report),
            packages: summarizeSectionDiagnostics("packages", report),
            resources: summarizeSectionDiagnostics("resources", report),
            frame: summarizeSectionDiagnostics("frame", report),
        },
        diagnostics,
    };
}
function summarizeSectionDiagnostics(section, report) {
    return {
        section,
        diagnostics: summarizeDiagnostics(report.diagnostics.filter((diagnostic) => diagnostic.section === section)),
    };
}
function sectionToJsonValue(section) {
    return {
        present: section.present,
        ready: section.ready,
        diagnosticCodes: [...section.diagnosticCodes],
    };
}
function evaluateSnapshot(report) {
    if (report === null) {
        return missing("snapshot", "rendererAssembly.missingSnapshotInspection", "Renderer assembly smoke report is missing render snapshot inspection output.");
    }
    const diagnostics = [];
    if (report.counts.views === 0) {
        diagnostics.push({
            code: "rendererAssembly.missingSnapshotViews",
            message: "Render snapshot inspection has no extracted views.",
            severity: "warning",
            section: "snapshot",
        });
    }
    if (report.counts.meshDraws === 0) {
        diagnostics.push({
            code: "rendererAssembly.missingSnapshotDraws",
            message: "Render snapshot inspection has no extracted mesh draws.",
            severity: "warning",
            section: "snapshot",
        });
    }
    return present("snapshot", diagnostics);
}
function evaluateCloneability(result) {
    if (result === null) {
        return missing("cloneability", "rendererAssembly.missingCloneability", "Renderer assembly smoke report is missing render snapshot cloneability output.");
    }
    if (!result.valid) {
        return present("cloneability", [
            {
                code: "rendererAssembly.snapshotNotCloneable",
                message: "Render snapshot cloneability validation failed.",
                severity: "error",
                section: "cloneability",
            },
        ]);
    }
    return present("cloneability", []);
}
function evaluatePackages(report) {
    if (report === null) {
        return missing("packages", "rendererAssembly.missingPackageInspection", "Renderer assembly smoke report is missing draw package inspection output.");
    }
    if (report.packageCount === 0) {
        return present("packages", [
            {
                code: "rendererAssembly.missingPackages",
                message: "Draw package inspection has no packages ready for submission.",
                severity: "warning",
                section: "packages",
            },
        ]);
    }
    return present("packages", []);
}
function evaluateResources(report) {
    if (report === null) {
        return missing("resources", "rendererAssembly.missingResourceSummary", "Renderer assembly smoke report is missing renderer resource summary output.");
    }
    const diagnostics = [];
    const missingGroups = missingResourceGroups(report.counts);
    if (missingGroups.length > 0) {
        diagnostics.push({
            code: "rendererAssembly.missingResources",
            message: `Renderer resource summary is missing resource groups: ${missingGroups.join(", ")}.`,
            severity: "warning",
            section: "resources",
        });
    }
    if (report.counts.errors > 0) {
        diagnostics.push({
            code: "rendererAssembly.resourceErrors",
            message: `Renderer resource summary has ${report.counts.errors} error diagnostics.`,
            severity: "error",
            section: "resources",
        });
    }
    return present("resources", diagnostics);
}
function evaluateFrame(report) {
    if (report === null) {
        return missing("frame", "rendererAssembly.missingFrameReport", "Renderer assembly smoke report is missing frame report output.");
    }
    if (!report.ready) {
        return present("frame", [
            {
                code: "rendererAssembly.frameNotReady",
                message: `Frame report ${report.frame} is not ready for rendering.`,
                severity: "warning",
                section: "frame",
            },
        ]);
    }
    return present("frame", []);
}
function missing(section, code, message) {
    const diagnostic = {
        code,
        message,
        severity: "error",
        section,
    };
    return {
        status: {
            section,
            present: false,
            ready: false,
            diagnosticCodes: [code],
        },
        diagnostics: [diagnostic],
    };
}
function present(section, diagnostics) {
    return {
        status: {
            section,
            present: true,
            ready: diagnostics.length === 0,
            diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
        },
        diagnostics,
    };
}
function missingResourceGroups(counts) {
    const missing = [];
    if (counts.meshResources === 0) {
        missing.push("mesh");
    }
    if (counts.materialBuffers === 0) {
        missing.push("material");
    }
    if (counts.viewUniformBuffers === 0) {
        missing.push("view");
    }
    if (counts.shaderModules === 0) {
        missing.push("shader");
    }
    if (counts.pipelineHits + counts.pipelineMisses === 0) {
        missing.push("pipeline");
    }
    return missing;
}
//# sourceMappingURL=renderer-assembly-smoke.js.map