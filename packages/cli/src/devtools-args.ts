const RENDER_PACKET_FAMILIES = [
  "views",
  "meshDraws",
  "lights",
  "environments",
  "shadows",
  "bounds",
] as const;

export type ApertureReferenceKind =
  | "doc"
  | "source"
  | "example"
  | "test"
  | "reference"
  | "other"
  | "any";

export function stringArg(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = args[key];

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function numberArg(
  args: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = args[key];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function nestedRecord(
  args: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = args[key];

  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function renderPacketFamiliesArg(
  args: Record<string, unknown>,
): readonly (typeof RENDER_PACKET_FAMILIES)[number][] {
  const requested = Array.isArray(args["families"])
    ? args["families"]
    : typeof args["family"] === "string"
      ? [args["family"]]
      : RENDER_PACKET_FAMILIES;
  const families: (typeof RENDER_PACKET_FAMILIES)[number][] = [];

  for (const family of requested) {
    if (
      typeof family === "string" &&
      isRenderPacketFamily(family) &&
      !families.includes(family)
    ) {
      families.push(family);
    }
  }

  return families.length === 0 ? RENDER_PACKET_FAMILIES : families;
}

export function referenceKindArg(
  args: Record<string, unknown>,
): ApertureReferenceKind | undefined {
  const value = stringArg(args, "kind");

  return value === "doc" ||
    value === "source" ||
    value === "example" ||
    value === "test" ||
    value === "reference" ||
    value === "other" ||
    value === "any"
    ? value
    : undefined;
}

export function optionalNumber(
  key: "endLine" | "limit" | "startLine",
  value: number | undefined,
): {
  readonly endLine?: number;
  readonly limit?: number;
  readonly startLine?: number;
} {
  return value === undefined ? {} : { [key]: value };
}

export function optionalReferenceKind(
  value: ApertureReferenceKind | undefined,
): {
  readonly kind?: ApertureReferenceKind;
} {
  return value === undefined ? {} : { kind: value };
}

function isRenderPacketFamily(
  value: string,
): value is (typeof RENDER_PACKET_FAMILIES)[number] {
  return (RENDER_PACKET_FAMILIES as readonly string[]).includes(value);
}
