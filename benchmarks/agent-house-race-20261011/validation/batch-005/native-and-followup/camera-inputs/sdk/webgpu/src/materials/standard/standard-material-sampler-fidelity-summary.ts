import type {
  StandardMaterialSamplerFidelityDiagnosticCode,
  StandardMaterialSamplerFidelityReportJsonValue,
  StandardMaterialTextureField,
} from "@aperture-engine/render";

export interface StandardMaterialSamplerFidelityFieldSummary {
  readonly field: StandardMaterialTextureField;
  readonly slotCount: number;
  readonly warningCount: number;
}

export interface StandardMaterialSamplerFidelityIssueSummary {
  readonly code: StandardMaterialSamplerFidelityDiagnosticCode;
  readonly count: number;
}

export interface StandardMaterialSamplerFidelitySummary {
  readonly materialCount: number;
  readonly readyMaterialCount: number;
  readonly blockedMaterialCount: number;
  readonly slotCount: number;
  readonly warningCount: number;
  readonly byField: readonly StandardMaterialSamplerFidelityFieldSummary[];
  readonly byIssue: readonly StandardMaterialSamplerFidelityIssueSummary[];
  readonly mipmapIssueCount: number;
  readonly lodIssueCount: number;
  readonly anisotropyIssueCount: number;
}

const STANDARD_SAMPLER_FIELD_ORDER: readonly StandardMaterialTextureField[] = [
  "baseColorTexture",
  "metallicRoughnessTexture",
  "clearcoatTexture",
  "normalTexture",
  "occlusionTexture",
  "emissiveTexture",
];

export function createStandardMaterialSamplerFidelitySummary(
  reports: readonly StandardMaterialSamplerFidelityReportJsonValue[],
): StandardMaterialSamplerFidelitySummary {
  const fieldCounts = new Map<
    StandardMaterialTextureField,
    MutableStandardMaterialSamplerFidelityFieldSummary
  >();
  const issueCounts = new Map<
    StandardMaterialSamplerFidelityDiagnosticCode,
    StandardMaterialSamplerFidelityIssueSummary
  >();
  let readyMaterialCount = 0;
  let slotCount = 0;
  let warningCount = 0;
  let mipmapIssueCount = 0;
  let lodIssueCount = 0;
  let anisotropyIssueCount = 0;

  for (const report of reports) {
    if (report.ready) {
      readyMaterialCount += 1;
    }

    for (const slot of report.slots) {
      const bucket = fieldBucket(fieldCounts, slot.field);

      slotCount += 1;
      bucket.slotCount += 1;
    }

    for (const diagnostic of report.diagnostics) {
      const existingIssue = issueCounts.get(diagnostic.code);

      issueCounts.set(diagnostic.code, {
        code: diagnostic.code,
        count: (existingIssue?.count ?? 0) + 1,
      });

      if (diagnostic.severity === "warning") {
        warningCount += 1;
      }

      if (diagnostic.field !== undefined) {
        const bucket = fieldBucket(fieldCounts, diagnostic.field);

        bucket.warningCount += diagnostic.severity === "warning" ? 1 : 0;
      }

      switch (diagnostic.code) {
        case "standardMaterialSampler.mipmapFilterWithoutMips":
          mipmapIssueCount += 1;
          break;
        case "standardMaterialSampler.lodMaxExceedsMipRange":
          lodIssueCount += 1;
          break;
        case "standardMaterialSampler.anisotropyNotReported":
          anisotropyIssueCount += 1;
          break;
        case "standardMaterialSampler.missingMaterial":
        case "standardMaterialSampler.materialNotReady":
        case "standardMaterialSampler.unsupportedMaterialKind":
        case "standardMaterialSampler.textureNotReady":
        case "standardMaterialSampler.samplerNotReady":
          break;
      }
    }
  }

  return {
    materialCount: reports.length,
    readyMaterialCount,
    blockedMaterialCount: reports.length - readyMaterialCount,
    slotCount,
    warningCount,
    byField: fieldEntries(fieldCounts),
    byIssue: issueEntries(issueCounts),
    mipmapIssueCount,
    lodIssueCount,
    anisotropyIssueCount,
  };
}

interface MutableStandardMaterialSamplerFidelityFieldSummary {
  field: StandardMaterialTextureField;
  slotCount: number;
  warningCount: number;
}

function fieldBucket(
  counts: Map<
    StandardMaterialTextureField,
    MutableStandardMaterialSamplerFidelityFieldSummary
  >,
  field: StandardMaterialTextureField,
): MutableStandardMaterialSamplerFidelityFieldSummary {
  const existing = counts.get(field);

  if (existing !== undefined) {
    return existing;
  }

  const bucket: MutableStandardMaterialSamplerFidelityFieldSummary = {
    field,
    slotCount: 0,
    warningCount: 0,
  };

  counts.set(field, bucket);
  return bucket;
}

function fieldEntries(
  counts: ReadonlyMap<
    StandardMaterialTextureField,
    MutableStandardMaterialSamplerFidelityFieldSummary
  >,
): StandardMaterialSamplerFidelityFieldSummary[] {
  return [...counts.values()].sort(
    (a, b) =>
      STANDARD_SAMPLER_FIELD_ORDER.indexOf(a.field) -
      STANDARD_SAMPLER_FIELD_ORDER.indexOf(b.field),
  );
}

function issueEntries(
  counts: ReadonlyMap<
    StandardMaterialSamplerFidelityDiagnosticCode,
    StandardMaterialSamplerFidelityIssueSummary
  >,
): StandardMaterialSamplerFidelityIssueSummary[] {
  return [...counts.values()].sort((a, b) => compareStrings(a.code, b.code));
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
