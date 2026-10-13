// Synthetic fixtures exercise the evidence gate; they are not browser benchmark evidence.
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  FAIRNESS_V2,
  DECLARATION_SCHEMA_V2,
  SOURCE_AUDIT_SCHEMA_V2,
  OBSERVATION_SCHEMA_V2,
  FAIRNESS_SOURCE_CHECKS_V2,
  fairnessDeclarationTemplateV2,
  summarizeFairnessResourcesV2,
  validateFairnessV2,
} from "../../tools/agent-benchmark/fairness-v2.mjs";

const sha = (value) => createHash("sha256").update(value).digest("hex");
const clone = (value) => structuredClone(value);
function pin(value) {
  const bytes = Buffer.from(JSON.stringify(value));
  const digest = sha(bytes);
  return {
    pin: {
      path: "/synthetic/evidence.json",
      sha256: digest,
      bytes: bytes.length,
    },
    actualSha256: digest,
    actualBytes: bytes.length,
    hashParity: true,
    error: null,
    value,
  };
}
function inventory() {
  return {
    geometries: [
      {
        id: "shared-box",
        vertexCount: 24,
        placements: 50,
        attributes: [
          { semantic: "POSITION", components: 3, componentBytes: 4 },
          { semantic: "NORMAL", components: 3, componentBytes: 4 },
          { semantic: "TEXCOORD_0", components: 2, componentBytes: 4 },
        ],
        indices: { count: 36, componentBytes: 2 },
        instanceAttributes: [
          { semantic: "INSTANCE_MATRIX", components: 16, componentBytes: 4 },
        ],
      },
    ],
    textures: [
      {
        id: "stucco",
        width: 4,
        height: 2,
        layers: 1,
        bytesPerTexel: 4,
        mipLevels: 3,
      },
    ],
    materials: [
      {
        id: "wall",
        model: "metallic-roughness",
        alphaMode: "opaque",
        extensions: [],
        emissiveIntensity: 0,
        maps: { baseColor: "stucco" },
      },
    ],
    lights: [
      { id: "sun", kind: "directional" },
      { id: "fill", kind: "ambient" },
    ],
  };
}
function fixture(engine = "aperture") {
  const contractSha256 = sha(JSON.stringify(FAIRNESS_V2));
  const scene = {
    houseCount: 1,
    carCount: 1,
    extraBuildings: 0,
    extraVehicles: 0,
    distantLandscape: false,
    trees: 3,
    shrubs: 12,
    extraDecorativeObjects: 20,
    minX: -18,
    maxX: 18,
    minZ: -18,
    maxZ: 18,
  };
  const requiredFeatures = Object.fromEntries(
    FAIRNESS_V2.scene.requiredFeatures.map((feature) => [feature, true]),
  );
  const declaration = pin({
    schema: DECLARATION_SCHEMA_V2,
    engine,
    contractSha256,
    authorId: "author-A",
    settings: clone(FAIRNESS_V2.settings),
    scene,
    requiredFeatures,
    inventory: inventory(),
  });
  const sourceAudit = pin({
    schema: SOURCE_AUDIT_SCHEMA_V2,
    engine,
    contractSha256,
    reviewerId: "reviewer-B",
    sourceSha256: sha("source"),
    buildSha256: sha("build"),
    declarationSha256: declaration.pin.sha256,
    settings: clone(FAIRNESS_V2.settings),
    scene: clone(scene),
    requiredFeatures: clone(requiredFeatures),
    inventory: inventory(),
    checks: Object.fromEntries(
      FAIRNESS_SOURCE_CHECKS_V2.map((check) => [
        check,
        {
          passed: true,
          reason: "Independent source review in this synthetic fixture",
          evidence: [{ path: "src/scene.js", sha256: sha("source-file") }],
        },
      ]),
    ),
    shadowImplementation: {
      filterDescription: "Engine PCF implementation with public radius 1",
      depthBiasConvention: "positive toward light",
    },
  });
  const observation = pin({
    schema: OBSERVATION_SCHEMA_V2,
    engine,
    contractSha256,
    provenance: "independent-native-harness",
    sourceSha256: sha("source"),
    buildSha256: sha("build"),
    nativeWebGpu: true,
    webGlAttempts: 0,
    displayCanvasCount: 1,
    viewport: clone(FAIRNESS_V2.settings.viewport),
    capture: {
      warmupFrames: 60,
      measuredFrames: 120,
      complete: true,
      views: clone(FAIRNESS_V2.measurement.views),
    },
    geometry: {
      complete: true,
      semanticGeometrySha256: sha("geometry"),
      meshCount: 1,
      nativePositionMatchedMeshes: 1,
      unknownTriangleDrawCalls: 0,
      placedTriangles: 600,
      bounds: { min: [-18, -1, -18], max: [18, 10, 18] },
    },
  });
  return {
    contract: FAIRNESS_V2,
    contractSha256,
    engine,
    declaration,
    sourceAudit,
    observation,
  };
}
function repin(inputs) {
  inputs.declaration = pin(inputs.declaration.value);
  inputs.sourceAudit.value.declarationSha256 = inputs.declaration.pin.sha256;
  inputs.sourceAudit = pin(inputs.sourceAudit.value);
  inputs.observation = pin(inputs.observation.value);
  return inputs;
}

describe("engine-neutral fairness v2", () => {
  it.each(["aperture", "three"])(
    "accepts complete audited/native evidence with the same contract for %s",
    (engine) => {
      const result = validateFairnessV2(fixture(engine));
      expect(result.eligible).toBe(true);
      expect(result.reasons).toEqual([]);
      expect(result.verification.authorDeclaration).toContain(
        "not independent proof",
      );
    },
  );

  it("counts shared geometry storage once, placed triangles fifty times, every UV/normal/index byte, and instance attributes", () => {
    const totals = summarizeFairnessResourcesV2(inventory());
    expect(totals.placedTriangles).toBe(600);
    expect(totals.storedGeometryBytes).toBe(24 * (3 + 3 + 2) * 4 + 36 * 2);
    expect(totals.instanceAttributeBytes).toBe(50 * 16 * 4);
    expect(totals.textureExpandedBytes).toBe((4 * 2 + 2 * 1 + 1 * 1) * 4);
  });

  it("accepts independently reconstructed inventory order without changing resource identity", () => {
    const inputs = fixture();
    inputs.sourceAudit.value.inventory.lights.reverse();
    inputs.sourceAudit.value.inventory.geometries[0].attributes.reverse();
    expect(validateFairnessV2(repin(inputs)).eligible).toBe(true);
  });

  it("enforces equal placed-work limits even when instances share tiny source geometry", () => {
    const inputs = fixture();
    inputs.declaration.value.inventory.geometries[0].placements = 25_001;
    inputs.sourceAudit.value.inventory = clone(
      inputs.declaration.value.inventory,
    );
    inputs.observation.value.geometry.placedTriangles = 25_001 * 12;
    const result = validateFairnessV2(repin(inputs));
    expect(result.eligible).toBe(false);
    expect(
      result.reasons.some((reason) =>
        reason.includes("placedTriangles 300012 exceeds 300000"),
      ),
    ).toBe(true);
  });

  it("requires UV bytes rather than treating native position parity as a full attribute inventory", () => {
    const inputs = fixture();
    inputs.contract = clone(FAIRNESS_V2);
    inputs.contract.budgets.storedGeometryBytes = 24 * 6 * 4 + 36 * 2;
    inputs.contractSha256 = sha(JSON.stringify(inputs.contract));
    for (const record of [
      inputs.declaration,
      inputs.sourceAudit,
      inputs.observation,
    ])
      record.value.contractSha256 = inputs.contractSha256;
    const result = validateFairnessV2(repin(inputs));
    expect(result.eligible).toBe(false);
    expect(
      result.reasons.some((reason) =>
        reason.includes("storedGeometryBytes 840 exceeds 648"),
      ),
    ).toBe(true);
  });

  it("counts layered textures and complete mip chains and rejects excess resolution", () => {
    const inputs = fixture();
    inputs.declaration.value.inventory.textures[0] = {
      id: "stucco",
      width: 2048,
      height: 2048,
      layers: 2,
      bytesPerTexel: 4,
      mipLevels: 12,
    };
    inputs.sourceAudit.value.inventory = clone(
      inputs.declaration.value.inventory,
    );
    const result = validateFairnessV2(repin(inputs));
    expect(result.eligible).toBe(false);
    expect(
      result.reasons.some((reason) =>
        reason.includes("textureMaxDimension 2048 exceeds 1024"),
      ),
    ).toBe(true);
    expect(
      result.reasons.some((reason) => reason.includes("textureExpandedBytes")),
    ).toBe(true);
  });

  it("rejects an author declaration on its own even when all author counters and settings conform", () => {
    const inputs = fixture();
    inputs.sourceAudit = undefined;
    inputs.observation = undefined;
    const result = validateFairnessV2(inputs);
    expect(result.eligible).toBe(false);
    expect(result.resources.declared.placedTriangles).toBe(600);
    expect(result.resources.independentlyAudited).toBeNull();
    expect(result.reasons).toHaveLength(2);
  });

  it("rejects unverified pins and a review by the author", () => {
    const inputs = fixture();
    inputs.sourceAudit.value.reviewerId = "author-A";
    repin(inputs);
    inputs.observation.hashParity = false;
    const result = validateFairnessV2(inputs);
    expect(result.eligible).toBe(false);
    expect(
      result.reasons.some((reason) =>
        reason.includes("distinct independent reviewer"),
      ),
    ).toBe(true);
    expect(
      result.reasons.some((reason) =>
        reason.includes("coordinator-verified exact hash"),
      ),
    ).toBe(true);
  });

  it("rejects extra engine effects and physical-material features even when geometry and native draws match", () => {
    const inputs = fixture();
    inputs.declaration.value.settings.effects.ssao = true;
    inputs.sourceAudit.value.settings.effects.ssao = true;
    inputs.declaration.value.inventory.materials[0].extensions = ["clearcoat"];
    inputs.sourceAudit.value.inventory = clone(
      inputs.declaration.value.inventory,
    );
    const result = validateFairnessV2(repin(inputs));
    expect(result.eligible).toBe(false);
    expect(
      result.reasons.some((reason) =>
        reason.includes("baseline settings differ"),
      ),
    ).toBe(true);
    expect(
      result.reasons.some((reason) =>
        reason.includes("prohibited material features"),
      ),
    ).toBe(true);
  });

  it("keeps unknown indirect counts and unmatched geometry ineligible rather than accepting estimates", () => {
    const inputs = fixture();
    inputs.observation.value.geometry.unknownTriangleDrawCalls = 1;
    inputs.observation.value.geometry.nativePositionMatchedMeshes = 0;
    inputs.observation.value.geometry.placedTriangles = 12;
    const result = validateFairnessV2(repin(inputs));
    expect(result.eligible).toBe(false);
    expect(
      result.reasons.some((reason) =>
        reason.includes("native position/triangle proof"),
      ),
    ).toBe(true);
    expect(
      result.reasons.some((reason) =>
        reason.includes("exported placed triangles differ"),
      ),
    ).toBe(true);
  });

  it("rejects mismatched frozen source, missing captures and invented source-review claims", () => {
    const inputs = fixture();
    inputs.observation.value.buildSha256 = sha("other-build");
    inputs.observation.value.capture.views = ["canonical"];
    inputs.sourceAudit.value.checks.materialAndTextureInventoryReviewed = {
      passed: true,
      reason: "checked",
      evidence: [],
    };
    const result = validateFairnessV2(repin(inputs));
    expect(result.eligible).toBe(false);
    expect(
      result.reasons.some((reason) =>
        reason.includes("rendered source/build differ"),
      ),
    ).toBe(true);
    expect(
      result.reasons.some((reason) => reason.includes("three-view capture")),
    ).toBe(true);
    expect(
      result.reasons.some((reason) =>
        reason.includes("materialAndTextureInventoryReviewed"),
      ),
    ).toBe(true);
  });

  it("rejects missing named features and unrelated distant geometry beyond the common site", () => {
    const inputs = fixture();
    inputs.sourceAudit.value.requiredFeatures.fourWheels = false;
    inputs.observation.value.geometry.bounds.max[0] = 50;
    const result = validateFairnessV2(repin(inputs));
    expect(result.eligible).toBe(false);
    expect(
      result.reasons.some((reason) => reason.includes("fourWheels missing")),
    ).toBe(true);
    expect(
      result.reasons.some((reason) =>
        reason.includes("beyond fixed site bounds"),
      ),
    ).toBe(true);
  });

  it("fails malformed inventories and impossible arithmetic instead of returning partial budget totals", () => {
    const resources = inventory();
    resources.geometries[0].indices = undefined;
    expect(() => summarizeFairnessResourcesV2(resources)).toThrow(
      "actual index layout or explicit null",
    );
    resources.geometries[0].indices = null;
    resources.geometries[0].vertexCount = Number.MAX_SAFE_INTEGER;
    expect(() => summarizeFairnessResourcesV2(resources)).toThrow(
      "safe integer",
    );
    expect(validateFairnessV2({ contract: {} }).eligible).toBe(false);
    const inputs = fixture();
    inputs.contract = clone(FAIRNESS_V2);
    inputs.contract.materials.alphaModes = null;
    expect(validateFairnessV2(inputs).eligible).toBe(false);
  });

  it("makes fresh declarations incomplete and deeply freezes the shared contract", () => {
    const declaration = fairnessDeclarationTemplateV2("three", sha("contract"));
    expect(declaration.requiredFeatures.house).toBe(false);
    declaration.settings.effects.ssao = true;
    expect(FAIRNESS_V2.settings.effects.ssao).toBe(false);
    expect(Object.isFrozen(FAIRNESS_V2.settings.shadow)).toBe(true);
  });
});
