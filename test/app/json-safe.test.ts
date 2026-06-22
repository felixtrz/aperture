import { describe, expect, it } from "vitest";

import { jsonSafeValue } from "../../packages/app/src/internal/json-safe.js";
import { jsonSafeValue as entitySummaryJsonSafeValue } from "../../packages/app/src/entities/lookup/summary.js";
import { jsonSafeValue as systemsJsonSafeValue } from "../../packages/app/src/systems/json.js";
import { jsonSafeValue as workerJsonSafeValue } from "../../packages/app/src/worker/payload.js";

describe("app JSON-safe value projection", () => {
  it("converts undefined to null and otherwise returns JSON round-trippable values", () => {
    expect(jsonSafeValue(undefined)).toBeNull();
    expect(
      jsonSafeValue({
        ok: true,
        missing: undefined,
        nested: { value: 1 },
      }),
    ).toEqual({ ok: true, nested: { value: 1 } });
  });

  it("falls back to string conversion when JSON serialization fails", () => {
    expect(jsonSafeValue(10n)).toBe("10");
  });

  it("preserves existing module re-export identities", () => {
    expect(systemsJsonSafeValue).toBe(jsonSafeValue);
    expect(workerJsonSafeValue).toBe(jsonSafeValue);
    expect(entitySummaryJsonSafeValue).toBe(jsonSafeValue);
  });
});
