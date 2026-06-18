import { jsonSafeValue } from "../internal/json-safe.js";

export interface StartOptionsSummary {
  readonly count: number;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface StartOptionsAccess {
  has(name: string): boolean;
  get(name: string): unknown;
  string(name: string): string | null;
  number(name: string): number | null;
  boolean(name: string): boolean | null;
  summary(): StartOptionsSummary;
}

const RESERVED_START_OPTION_KEYS = new Set([
  "audioSnapshotMessageRateHz",
  "assetDecoders",
  "entityCapacity",
  "fixedStep",
  "options",
  "physicsInterpolation",
  "sharedSnapshotMessageRateHz",
  "sourceAssetsMessageRateHz",
  "stop",
  "transport",
  "type",
  "workerFullSummaryIntervalMilliseconds",
]);

export function createStartOptionsAccess(
  options: Readonly<Record<string, unknown>> = {},
): StartOptionsAccess {
  return new DefaultStartOptionsAccess(filterSystemStartOptions(options));
}

export function filterSystemStartOptions(
  options: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const values: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(options)) {
    if (RESERVED_START_OPTION_KEYS.has(key)) {
      continue;
    }

    values[key] = value;
  }

  return Object.freeze(values);
}

class DefaultStartOptionsAccess implements StartOptionsAccess {
  readonly #values: Readonly<Record<string, unknown>>;

  constructor(values: Readonly<Record<string, unknown>>) {
    this.#values = values;
  }

  has(name: string): boolean {
    return Object.hasOwn(this.#values, name);
  }

  get(name: string): unknown {
    return this.#values[name];
  }

  string(name: string): string | null {
    const value = this.get(name);

    return typeof value === "string" && value.length > 0 ? value : null;
  }

  number(name: string): number | null {
    const value = this.get(name);

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);

      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  boolean(name: string): boolean | null {
    const value = this.get(name);

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      if (value === "true" || value === "1") {
        return true;
      }

      if (value === "false" || value === "0") {
        return false;
      }
    }

    return null;
  }

  summary(): StartOptionsSummary {
    return {
      count: Object.keys(this.#values).length,
      values: jsonSafeValue(this.#values) as Readonly<Record<string, unknown>>,
    };
  }
}
