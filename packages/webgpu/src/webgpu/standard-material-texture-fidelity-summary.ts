import type {
  StandardMaterialTextureField,
  StandardMaterialTextureReadinessDiagnosticCode,
  StandardMaterialTextureReadinessReportJsonValue,
} from "@aperture-engine/render";

export interface StandardMaterialTextureFidelityFieldSummary {
  readonly field: StandardMaterialTextureField;
  readonly slotCount: number;
  readonly readySlotCount: number;
  readonly blockedSlotCount: number;
}

export interface StandardMaterialTextureFidelityIssueSummary {
  readonly code: StandardMaterialTextureReadinessDiagnosticCode;
  readonly count: number;
}

export interface StandardMaterialTextureFidelitySummary {
  readonly materialCount: number;
  readonly readyMaterialCount: number;
  readonly blockedMaterialCount: number;
  readonly slotCount: number;
  readonly readySlotCount: number;
  readonly blockedSlotCount: number;
  readonly byField: readonly StandardMaterialTextureFidelityFieldSummary[];
  readonly byIssue: readonly StandardMaterialTextureFidelityIssueSummary[];
  readonly samplerIssueCount: number;
  readonly colorSpaceIssueCount: number;
  readonly semanticIssueCount: number;
  readonly texCoordIssueCount: number;
  readonly transformIssueCount: number;
}

const STANDARD_TEXTURE_FIELD_ORDER: readonly StandardMaterialTextureField[] = [
  "baseColorTexture",
  "metallicRoughnessTexture",
  "normalTexture",
  "occlusionTexture",
  "emissiveTexture",
];

export function createStandardMaterialTextureFidelitySummary(
  reports: readonly StandardMaterialTextureReadinessReportJsonValue[],
): StandardMaterialTextureFidelitySummary {
  const fieldCounts = new Map<
    StandardMaterialTextureField,
    MutableStandardMaterialTextureFidelityFieldSummary
  >();
  const issueCounts = new Map<
    StandardMaterialTextureReadinessDiagnosticCode,
    StandardMaterialTextureFidelityIssueSummary
  >();
  let readyMaterialCount = 0;
  let slotCount = 0;
  let readySlotCount = 0;
  let samplerIssueCount = 0;
  let colorSpaceIssueCount = 0;
  let semanticIssueCount = 0;
  let texCoordIssueCount = 0;
  let transformIssueCount = 0;

  for (const report of reports) {
    const fields = new Map<
      StandardMaterialTextureField,
      MutableTextureFieldReadiness
    >();

    if (report.ready) {
      readyMaterialCount += 1;
    }

    for (const slot of report.slots) {
      const field = fieldReadiness(fields, slot.field);

      field.seen = true;
      field.ready = field.ready && slot.ready;
    }

    for (const diagnostic of report.diagnostics) {
      const existingIssue = issueCounts.get(diagnostic.code);

      issueCounts.set(diagnostic.code, {
        code: diagnostic.code,
        count: (existingIssue?.count ?? 0) + 1,
      });

      switch (diagnostic.code) {
        case "standardMaterialTexture.missingSamplerHandle":
        case "standardMaterialTexture.samplerNotReady":
          samplerIssueCount += 1;
          break;
        case "standardMaterialTexture.invalidColorSpace":
        case "standardMaterialTexture.invalidColorSpaceFormat":
          colorSpaceIssueCount += 1;
          break;
        case "standardMaterialTexture.invalidSemantic":
          semanticIssueCount += 1;
          break;
        case "standardMaterialTexture.unsupportedTexCoord":
          texCoordIssueCount += 1;
          break;
        case "standardMaterialTexture.unsupportedTextureTransform":
          transformIssueCount += 1;
          break;
        case "standardMaterialTexture.missingMaterial":
        case "standardMaterialTexture.materialNotReady":
        case "standardMaterialTexture.unsupportedMaterialKind":
        case "standardMaterialTexture.missingTextureHandle":
        case "standardMaterialTexture.textureNotReady":
          break;
      }

      if (diagnostic.field !== undefined) {
        const field = fieldReadiness(fields, diagnostic.field);

        field.seen = true;
        field.ready = false;
      }
    }

    for (const field of fields.values()) {
      const bucket = fieldBucket(fieldCounts, field.field);

      slotCount += 1;
      bucket.slotCount += 1;

      if (field.ready) {
        readySlotCount += 1;
        bucket.readySlotCount += 1;
      } else {
        bucket.blockedSlotCount += 1;
      }
    }
  }

  return {
    materialCount: reports.length,
    readyMaterialCount,
    blockedMaterialCount: reports.length - readyMaterialCount,
    slotCount,
    readySlotCount,
    blockedSlotCount: slotCount - readySlotCount,
    byField: fieldEntries(fieldCounts),
    byIssue: issueEntries(issueCounts),
    samplerIssueCount,
    colorSpaceIssueCount,
    semanticIssueCount,
    texCoordIssueCount,
    transformIssueCount,
  };
}

interface MutableStandardMaterialTextureFidelityFieldSummary {
  field: StandardMaterialTextureField;
  slotCount: number;
  readySlotCount: number;
  blockedSlotCount: number;
}

interface MutableTextureFieldReadiness {
  field: StandardMaterialTextureField;
  seen: boolean;
  ready: boolean;
}

function fieldReadiness(
  fields: Map<StandardMaterialTextureField, MutableTextureFieldReadiness>,
  field: StandardMaterialTextureField,
): MutableTextureFieldReadiness {
  const existing = fields.get(field);

  if (existing !== undefined) {
    return existing;
  }

  const readiness: MutableTextureFieldReadiness = {
    field,
    seen: false,
    ready: true,
  };

  fields.set(field, readiness);
  return readiness;
}

function fieldBucket(
  counts: Map<
    StandardMaterialTextureField,
    MutableStandardMaterialTextureFidelityFieldSummary
  >,
  field: StandardMaterialTextureField,
): MutableStandardMaterialTextureFidelityFieldSummary {
  const existing = counts.get(field);

  if (existing !== undefined) {
    return existing;
  }

  const bucket: MutableStandardMaterialTextureFidelityFieldSummary = {
    field,
    slotCount: 0,
    readySlotCount: 0,
    blockedSlotCount: 0,
  };

  counts.set(field, bucket);
  return bucket;
}

function fieldEntries(
  counts: ReadonlyMap<
    StandardMaterialTextureField,
    MutableStandardMaterialTextureFidelityFieldSummary
  >,
): StandardMaterialTextureFidelityFieldSummary[] {
  return [...counts.values()].sort(
    (a, b) =>
      STANDARD_TEXTURE_FIELD_ORDER.indexOf(a.field) -
      STANDARD_TEXTURE_FIELD_ORDER.indexOf(b.field),
  );
}

function issueEntries(
  counts: ReadonlyMap<
    StandardMaterialTextureReadinessDiagnosticCode,
    StandardMaterialTextureFidelityIssueSummary
  >,
): StandardMaterialTextureFidelityIssueSummary[] {
  return [...counts.values()].sort((a, b) => compareStrings(a.code, b.code));
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
