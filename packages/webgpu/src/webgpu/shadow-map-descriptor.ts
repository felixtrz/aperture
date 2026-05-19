import type { ShadowRequestPacket } from "@aperture-engine/render";

export type ShadowMapDescriptorDiagnosticCode =
  | "shadowMapDescriptor.missingDescriptor"
  | "shadowMapDescriptor.invalidMapSize";

export interface ShadowMapDescriptorSource {
  readonly shadowId: number;
  readonly lightId: number;
  readonly mapSize: number;
  readonly depthBias: number;
  readonly normalBias?: number;
  readonly depthFormat?: "depth24plus";
  readonly faceCount?: 1 | 6;
  readonly viewDimension?: "2d" | "cube";
  readonly resourceKey?: string;
}

export interface ShadowMapDescriptor {
  readonly shadowId: number;
  readonly lightId: number;
  readonly lightKind: NonNullable<ShadowRequestPacket["lightKind"]>;
  readonly resourceKey: string;
  readonly depthFormat: "depth24plus";
  readonly mapSize: number;
  readonly depthBias: number;
  readonly normalBias: number;
  readonly faceCount: 1 | 6;
  readonly viewDimension: "2d" | "cube";
  readonly casterLayerMask: number;
  readonly receiverLayerMask: number;
  readonly ready: boolean;
}

export interface ShadowMapDescriptorDiagnostic {
  readonly code: ShadowMapDescriptorDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly shadowId: number;
  readonly lightId: number;
  readonly message: string;
}

export interface ShadowMapDescriptorReport {
  readonly ready: boolean;
  readonly requestCount: number;
  readonly descriptorCount: number;
  readonly sections: {
    readonly shadowRequests: boolean;
    readonly shadowMapDescriptors: boolean;
    readonly shadowPassSubmission: false;
  };
  readonly descriptors: readonly ShadowMapDescriptor[];
  readonly diagnostics: readonly ShadowMapDescriptorDiagnostic[];
}

export type ShadowMapDescriptorReportJsonValue = ShadowMapDescriptorReport;

export interface ShadowMapDescriptorInput {
  readonly shadowRequests: readonly ShadowRequestPacket[];
  readonly descriptors?: readonly ShadowMapDescriptorSource[];
}

export function createShadowMapDescriptorReport(
  input: ShadowMapDescriptorInput,
): ShadowMapDescriptorReport {
  const sourcesByKey = new Map(
    (input.descriptors ?? []).map((descriptor) => [
      descriptorKey(descriptor.shadowId, descriptor.lightId),
      descriptor,
    ]),
  );
  const diagnostics: ShadowMapDescriptorDiagnostic[] = [];
  const descriptors = input.shadowRequests.map((request) => {
    const lightKind = request.lightKind ?? "directional";
    const source = sourcesByKey.get(
      descriptorKey(request.shadowId, request.lightId),
    );

    if (source === undefined) {
      diagnostics.push({
        code: "shadowMapDescriptor.missingDescriptor",
        severity: "warning",
        shadowId: request.shadowId,
        lightId: request.lightId,
        message: `Shadow request '${request.shadowId}' for light '${request.lightId}' has no renderer-owned shadow-map descriptor.`,
      });
    } else if (!Number.isInteger(source.mapSize) || source.mapSize <= 0) {
      diagnostics.push({
        code: "shadowMapDescriptor.invalidMapSize",
        severity: "error",
        shadowId: request.shadowId,
        lightId: request.lightId,
        message: `Shadow-map descriptor '${request.shadowId}' has invalid map size '${source.mapSize}'.`,
      });
    }

    return {
      shadowId: request.shadowId,
      lightId: request.lightId,
      lightKind,
      resourceKey:
        source?.resourceKey ??
        `shadow-map:${request.shadowId}:light:${request.lightId}`,
      depthFormat: source?.depthFormat ?? "depth24plus",
      mapSize: source?.mapSize ?? 0,
      depthBias: source?.depthBias ?? 0,
      normalBias: source?.normalBias ?? 0,
      faceCount: source?.faceCount ?? (lightKind === "point" ? 6 : 1),
      viewDimension:
        source?.viewDimension ?? (lightKind === "point" ? "cube" : "2d"),
      casterLayerMask: request.casterLayerMask,
      receiverLayerMask: request.receiverLayerMask,
      ready: source !== undefined && source.mapSize > 0,
    };
  });
  const ready =
    diagnostics.length === 0 &&
    descriptors.every((descriptor) => descriptor.ready);

  return {
    ready,
    requestCount: input.shadowRequests.length,
    descriptorCount: descriptors.filter((descriptor) => descriptor.ready)
      .length,
    sections: {
      shadowRequests: true,
      shadowMapDescriptors: ready,
      shadowPassSubmission: false,
    },
    descriptors,
    diagnostics,
  };
}

export function shadowMapDescriptorReportToJsonValue(
  report: ShadowMapDescriptorReport,
): ShadowMapDescriptorReportJsonValue {
  return {
    ready: report.ready,
    requestCount: report.requestCount,
    descriptorCount: report.descriptorCount,
    sections: { ...report.sections },
    descriptors: report.descriptors.map((descriptor) => ({ ...descriptor })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowMapDescriptorReportToJson(
  report: ShadowMapDescriptorReport,
): string {
  return JSON.stringify(shadowMapDescriptorReportToJsonValue(report));
}

function descriptorKey(shadowId: number, lightId: number): string {
  return `${shadowId}:${lightId}`;
}
