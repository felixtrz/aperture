import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const APERTURE_REFERENCE_ASSETS_PACKAGE =
  "@aperture-engine/reference-assets";
export const APERTURE_REFERENCE_ASSETS_BASE_URL_ENV =
  "APERTURE_REFERENCE_ASSETS_BASE_URL";
export const APERTURE_REFERENCE_ASSETS_VERSION_ENV =
  "APERTURE_REFERENCE_ASSETS_VERSION";

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export function getApertureCliPackageVersion(): string {
  const packageJson = JSON.parse(
    readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"),
  ) as { readonly version?: string };

  return packageJson.version ?? "0.0.0";
}

export function getApertureReferenceAssetsPackageVersion(): string {
  return (
    process.env[APERTURE_REFERENCE_ASSETS_VERSION_ENV] ??
    getApertureCliPackageVersion()
  );
}

export function getApertureReferenceAssetsBaseUrls(): readonly string[] {
  const override = process.env[APERTURE_REFERENCE_ASSETS_BASE_URL_ENV];

  if (override !== undefined && override.trim().length > 0) {
    return override
      .split(",")
      .map((entry) => trimTrailingSlash(entry.trim()))
      .filter((entry) => entry.length > 0);
  }

  const version = getApertureReferenceAssetsPackageVersion();

  return [
    `https://unpkg.com/${APERTURE_REFERENCE_ASSETS_PACKAGE}@${version}/dist`,
  ];
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
