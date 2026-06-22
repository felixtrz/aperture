import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

interface CliPackageJson {
  readonly version?: unknown;
}

export const APERTURE_CLI_VERSION = readCliVersion();

function readCliVersion(): string {
  const packageJson = require("../package.json") as CliPackageJson;
  const version = packageJson.version;

  if (typeof version === "string" && isSemver(version)) {
    return version;
  }

  throw new Error(
    `aperture.cli.invalidPackageVersion: expected package.json version to be semver, got ${String(
      version,
    )}`,
  );
}

function isSemver(value: string): boolean {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u.test(
    value,
  );
}
