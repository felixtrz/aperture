import type { AssetRegistry } from "@aperture-engine/simulation";
import {
  createMaterialDependencyReadinessReport,
  materialDependencyReadinessReportToJsonValue,
  type RenderSnapshot,
} from "@aperture-engine/render";
import type { WebGpuAppMaterialDependencyDiagnostic } from "./app.js";

export function diagnoseSnapshotMaterialDependencies(
  assets: AssetRegistry,
  snapshot: RenderSnapshot,
): WebGpuAppMaterialDependencyDiagnostic[] {
  const diagnostics: WebGpuAppMaterialDependencyDiagnostic[] = [];
  const seenMaterialKeys = new Set<string>();

  for (const draw of snapshot.meshDraws) {
    pushMaterialDependencyDiagnostic(assets, draw.material, {
      diagnostics,
      seenMaterialKeys,
    });
  }

  if (
    diagnostics.length === 0 &&
    snapshot.diagnostics.some(isMaterialDependencyRenderDiagnostic)
  ) {
    for (const entry of assets.list({ kind: "material", status: "ready" })) {
      if (entry.asset === null) {
        continue;
      }

      pushMaterialDependencyDiagnostic(
        assets,
        entry.handle as Parameters<
          typeof createMaterialDependencyReadinessReport
        >[0]["material"],
        { diagnostics, seenMaterialKeys },
      );
    }
  }

  return diagnostics;
}

function pushMaterialDependencyDiagnostic(
  assets: AssetRegistry,
  material: Parameters<
    typeof createMaterialDependencyReadinessReport
  >[0]["material"],
  output: {
    readonly diagnostics: WebGpuAppMaterialDependencyDiagnostic[];
    readonly seenMaterialKeys: Set<string>;
  },
): void {
  const report = createMaterialDependencyReadinessReport({
    registry: assets,
    material,
  });

  if (report.ready || output.seenMaterialKeys.has(report.materialKey)) {
    return;
  }

  output.seenMaterialKeys.add(report.materialKey);
  output.diagnostics.push(createWebGpuAppMaterialDependencyDiagnostic(report));
}

export function createWebGpuAppMaterialDependencyDiagnostic(
  materialDependencyReadiness: Parameters<
    typeof materialDependencyReadinessReportToJsonValue
  >[0],
): WebGpuAppMaterialDependencyDiagnostic {
  const json = materialDependencyReadinessReportToJsonValue(
    materialDependencyReadiness,
  );

  return {
    code: "webGpuApp.materialDependenciesNotReady",
    materialDependencyReadiness: json,
    message: `Material '${json.materialKey}' has source asset dependencies that are not ready for app rendering.`,
  };
}

function isMaterialDependencyRenderDiagnostic(
  diagnostic: unknown,
): diagnostic is {
  readonly code: string;
} {
  if (typeof diagnostic !== "object" || diagnostic === null) {
    return false;
  }

  const code = (diagnostic as { readonly code?: unknown }).code;

  return (
    typeof code === "string" &&
    (code === "render.material.missingTextureHandle" ||
      code === "render.material.missingSamplerHandle" ||
      code.startsWith("render.standardMaterialTexture.") ||
      code.startsWith("render.texture.") ||
      code.startsWith("render.sampler."))
  );
}
