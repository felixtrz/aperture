import { describe, expect, it } from "vitest";
import { errorToApertureDiagnostic } from "../../packages/app/src/diagnostics.js";
import { ApertureFeatureError } from "@aperture-engine/app/features";

describe("worker feature error boundary", () => {
  it("forwards ApertureFeatureError diagnostics across the worker error boundary", () => {
    const error = new ApertureFeatureError({
      code: "aperture.feature.installFailed",
      message: "Aperture feature installation failed.",
      suggestedFix: "Inspect the feature diagnostics.",
      diagnostics: [
        {
          code: "aperture.feature.missingRequired",
          severity: "error",
          featureId: "decals",
          message: "Feature 'decals' requires missing feature 'physics'.",
        },
      ],
    });

    const diagnostic = errorToApertureDiagnostic(error, {
      code: "aperture.generatedWorker.failed",
      severity: "error",
      message: "Generated Aperture simulation worker failed during startup.",
      suggestedFix: "Inspect aperture.config.ts.",
      source: { worker: "generated-simulation" },
    });

    expect(diagnostic.code).toBe("aperture.feature.installFailed");
    expect(diagnostic.data?.["diagnostics"]).toEqual([
      expect.objectContaining({
        code: "aperture.feature.missingRequired",
        featureId: "decals",
      }),
    ]);
  });

  it("keeps the fallback payload when the error carries no diagnostics", () => {
    const diagnostic = errorToApertureDiagnostic(new Error("boom"), {
      code: "aperture.generatedWorker.failed",
      severity: "error",
      message: "Generated Aperture simulation worker failed during startup.",
      suggestedFix: "Inspect aperture.config.ts.",
    });

    expect(diagnostic.code).toBe("aperture.generatedWorker.failed");
    expect(diagnostic.message).toBe("boom");
    expect(diagnostic.data).toBeUndefined();
  });
});
