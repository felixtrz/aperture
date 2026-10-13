/** Engine-neutral limits. Evidence records must come from the coordinator's pin verifier. */
export const FAIRNESS_SCHEMA_V2 = "aperture.agent-house-fairness.v2";
export const DECLARATION_SCHEMA_V2 =
  "aperture.agent-house-fairness-declaration.v2";
export const SOURCE_AUDIT_SCHEMA_V2 =
  "aperture.agent-house-fairness-source-audit.v2";
export const OBSERVATION_SCHEMA_V2 =
  "aperture.agent-house-fairness-observation.v2";

const requiredFeatures = [
  "house",
  "roof",
  "chimney",
  "windows",
  "porch",
  "path",
  "boundary",
  "garden",
  "mailbox",
  "curvedRoad",
  "curbs",
  "markings",
  "blueCar",
  "fourWheels",
];
const sourceChecks = [
  "independentOfAuthor",
  "completeRenderedSceneInventory",
  "actualGeometryBuffersReviewed",
  "allVertexAttributesAndIndicesReviewed",
  "allPlacementsAndInstancesReviewed",
  "materialAndTextureInventoryReviewed",
  "lightingAndShadowRecipeReviewed",
  "optionalEffectsDisabled",
  "defaultEnvironmentDisabled",
  "requiredFeaturesReviewed",
  "noBillboardsOrBakedScene",
  "noHarnessOrNativeApiTampering",
  "builtSourceAndDependenciesMatch",
];

function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export const FAIRNESS_V2 = deepFreeze({
  schema: FAIRNESS_SCHEMA_V2,
  version: "2.0.0",
  mode: "independent-authoring",
  freezePolicy:
    "Hash the complete contract before authors start; changes require a new version and fresh author pair.",
  settings: {
    viewport: { width: 1024, height: 768, devicePixelRatio: 1 },
    render: {
      backend: "webgpu",
      msaa: 4,
      tonemap: "aces",
      exposure: 1,
      outputColorSpace: "srgb",
    },
    effects: {
      ssao: false,
      bloom: false,
      transmission: false,
      clearcoat: false,
      sheen: false,
      customShaders: false,
      extraPostEffects: false,
      fog: false,
    },
    lighting: {
      sun: {
        directionToLight: [-11, 16, 12],
        colorLinear: [1, 0.7454, 0.4342],
        intensity: 3,
      },
      fill: {
        kind: "constant-ambient",
        colorLinear: [0.6902, 0.749, 0.7843],
        intensity: 0.55,
      },
      defaultEnvironment: false,
      imageBasedLighting: false,
      hemisphereLight: false,
      environmentTextures: false,
    },
    background: { kind: "solid", colorSrgb: "#b9cee2" },
    shadow: {
      enabled: true,
      mapSize: 2048,
      cascadeCount: 1,
      orthographicSize: 38,
      center: [0, 2.5, 0],
      near: 0.5,
      far: 60,
      lightDistance: 30,
      filter: "pcf",
      filterRadiusTexels: 1,
      normalBias: 0.04,
      depthBiasMagnitude: 0.0004,
      strength: 1,
      updatePolicy: "reuse-until-light-or-caster-changes",
    },
  },
  budgets: {
    placedTriangles: 300_000,
    storedGeometryBytes: 24 * 1024 * 1024,
    instanceAttributeBytes: 4 * 1024 * 1024,
    materialCount: 64,
    authoredTextureCount: 16,
    textureMaxDimension: 1024,
    textureExpandedBytes: 16 * 1024 * 1024,
    directionalLights: 1,
    ambientLights: 1,
    otherLights: 0,
    trees: 6,
    shrubs: 48,
    extraDecorativeObjects: 256,
  },
  scene: {
    houseCount: 1,
    carCount: 1,
    extraBuildings: 0,
    extraVehicles: 0,
    minX: -18,
    maxX: 18,
    minZ: -18,
    maxZ: 18,
    distantLandscape: false,
    requiredFeatures,
  },
  materials: {
    model: "metallic-roughness",
    alphaModes: ["opaque", "mask"],
    maps: ["baseColor", "normal", "metallicRoughness", "emissive"],
    maximumEmissiveIntensity: 1,
  },
  measurement: {
    warmupFrames: 60,
    measuredFrames: 120,
    trialsPerEngine: 3,
    views: ["canonical", "left-orbit", "rear-orbit"],
  },
  allowedOptimizations: [
    "indexing",
    "instancing",
    "batching",
    "geometry-sharing",
    "static-shadow-caching",
  ],
  limitations: [
    "Matched public PCF settings do not imply identical taps, shaders or shadow pixels; audit both implementations.",
    "Authored storage bytes include every vertex attribute and index; native allocation bytes also include engine overhead and are reported separately.",
    "Native position-upload parity does not prove material features, UVs, source coverage or semantic object identity; independent source review is required.",
    "Independent scenes within equal budgets still have different shading and coverage; use the separate controlled workload for renderer-speed claims.",
  ],
});

const hash = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const stable = (value) =>
  JSON.stringify(value, (_key, item) =>
    object(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
const equal = (left, right) => stable(left) === stable(right);
function inventoryIdentity(inventory) {
  if (!object(inventory)) return inventory;
  return Object.fromEntries(
    Object.entries(inventory).map(([kind, entries]) => [
      kind,
      Array.isArray(entries)
        ? entries
            .map((entry) => ({
              ...entry,
              ...(kind === "geometries"
                ? Object.fromEntries(
                    ["attributes", "instanceAttributes"].map((key) => [
                      key,
                      Array.isArray(entry?.[key])
                        ? [...entry[key]].sort((a, b) =>
                            String(a?.semantic).localeCompare(
                              String(b?.semantic),
                            ),
                          )
                        : entry?.[key],
                    ]),
                  )
                : {}),
            }))
            .sort((a, b) => String(a?.id).localeCompare(String(b?.id)))
        : entries,
    ]),
  );
}
const demand = (condition, message) => {
  if (!condition) throw new Error(message);
};
const checkedAdd = (left, right) => {
  const result = left + right;
  demand(integer(result), "Resource total exceeds safe integer range");
  return result;
};
const checkedMultiply = (left, right) => {
  const result = left * right;
  demand(integer(result), "Resource product exceeds safe integer range");
  return result;
};

function uniqueIds(entries, name) {
  demand(Array.isArray(entries), `${name} inventory must be an array`);
  const ids = new Set();
  for (const entry of entries) {
    demand(
      text(entry?.id) && !ids.has(entry.id),
      `${name} ids must be nonempty and unique`,
    );
    ids.add(entry.id);
  }
}

function attributeBytes(attributes, count, name) {
  demand(
    Array.isArray(attributes) && attributes.length > 0,
    `${name}: full attribute inventory required`,
  );
  const semantics = new Set();
  let bytes = 0;
  for (const attribute of attributes) {
    demand(
      text(attribute?.semantic) && !semantics.has(attribute.semantic),
      `${name}: unique attribute semantics required`,
    );
    semantics.add(attribute.semantic);
    demand(
      integer(attribute.components) &&
        attribute.components > 0 &&
        attribute.components <= 16 &&
        [1, 2, 4, 8].includes(attribute.componentBytes),
      `${name}: unsupported attribute layout`,
    );
    bytes = checkedAdd(
      bytes,
      checkedMultiply(count, attribute.components * attribute.componentBytes),
    );
  }
  return { bytes, semantics };
}

/** Inventory uses actual authored component widths, not export-array widths or native padding. */
export function summarizeFairnessResourcesV2(inventory) {
  demand(object(inventory), "Resource inventory required");
  for (const name of ["geometries", "textures", "materials", "lights"])
    uniqueIds(inventory[name], name);
  const totals = {
    placedTriangles: 0,
    storedGeometryBytes: 0,
    instanceAttributeBytes: 0,
    materialCount: inventory.materials.length,
    authoredTextureCount: inventory.textures.length,
    textureMaxDimension: 0,
    textureExpandedBytes: 0,
    directionalLights: 0,
    ambientLights: 0,
    otherLights: 0,
  };
  demand(
    inventory.geometries.length > 0,
    "At least one rendered geometry required",
  );
  for (const geometry of inventory.geometries) {
    demand(
      integer(geometry.vertexCount) &&
        geometry.vertexCount > 0 &&
        integer(geometry.placements) &&
        geometry.placements > 0,
      `${geometry.id}: positive actual vertex and placement counts required`,
    );
    const attributes = attributeBytes(
      geometry.attributes,
      geometry.vertexCount,
      geometry.id,
    );
    const position = geometry.attributes.find(
      (item) => item.semantic === "POSITION",
    );
    demand(
      attributes.semantics.has("POSITION") && position.components === 3,
      `${geometry.id}: three-component positions required`,
    );
    let triangleVertices = geometry.vertexCount,
      indexBytes = 0;
    if (geometry.indices !== null) {
      demand(
        object(geometry.indices) &&
          integer(geometry.indices.count) &&
          geometry.indices.count > 0 &&
          [2, 4].includes(geometry.indices.componentBytes),
        `${geometry.id}: actual index layout or explicit null required`,
      );
      triangleVertices = geometry.indices.count;
      indexBytes = checkedMultiply(
        triangleVertices,
        geometry.indices.componentBytes,
      );
    }
    demand(
      triangleVertices % 3 === 0,
      `${geometry.id}: triangle-list geometry required`,
    );
    totals.placedTriangles = checkedAdd(
      totals.placedTriangles,
      checkedMultiply(triangleVertices / 3, geometry.placements),
    );
    totals.storedGeometryBytes = checkedAdd(
      totals.storedGeometryBytes,
      checkedAdd(attributes.bytes, indexBytes),
    );
    demand(
      Array.isArray(geometry.instanceAttributes),
      `${geometry.id}: instance attribute array required (empty for ordinary transforms)`,
    );
    if (geometry.instanceAttributes.length > 0)
      totals.instanceAttributeBytes = checkedAdd(
        totals.instanceAttributeBytes,
        attributeBytes(
          geometry.instanceAttributes,
          geometry.placements,
          geometry.id + " instances",
        ).bytes,
      );
  }
  for (const texture of inventory.textures) {
    demand(
      integer(texture.width) &&
        texture.width > 0 &&
        integer(texture.height) &&
        texture.height > 0 &&
        integer(texture.layers) &&
        texture.layers > 0 &&
        texture.bytesPerTexel === 4 &&
        integer(texture.mipLevels) &&
        texture.mipLevels > 0 &&
        texture.mipLevels <=
          1 + Math.floor(Math.log2(Math.max(texture.width, texture.height))),
      `${texture.id}: bounded rgba8 texture dimensions, layers and mip levels required`,
    );
    totals.textureMaxDimension = Math.max(
      totals.textureMaxDimension,
      texture.width,
      texture.height,
    );
    let width = texture.width,
      height = texture.height;
    for (let level = 0; level < texture.mipLevels; level++) {
      totals.textureExpandedBytes = checkedAdd(
        totals.textureExpandedBytes,
        checkedMultiply(
          checkedMultiply(width, height),
          texture.layers * texture.bytesPerTexel,
        ),
      );
      width = Math.max(1, Math.floor(width / 2));
      height = Math.max(1, Math.floor(height / 2));
    }
  }
  for (const light of inventory.lights) {
    demand(text(light.kind), `${light.id}: light kind required`);
    const key =
      light.kind === "directional"
        ? "directionalLights"
        : light.kind === "ambient"
          ? "ambientLights"
          : "otherLights";
    totals[key]++;
  }
  return totals;
}

function inspectInventory(inventory, contract, reasons, label) {
  let totals;
  try {
    totals = summarizeFairnessResourcesV2(inventory);
  } catch (error) {
    reasons.push(`${label}: ${error.message}`);
    return null;
  }
  for (const [key, total] of Object.entries(totals)) {
    const budget = contract.budgets[key];
    if (!integer(budget))
      reasons.push(`${label}: missing valid ${key} contract budget`);
    else if (total > budget)
      reasons.push(`${label}: ${key} ${total} exceeds ${budget}`);
  }
  for (const key of ["directionalLights", "ambientLights"])
    if (totals[key] !== contract.budgets[key])
      reasons.push(
        `${label}: exactly ${contract.budgets[key]} ${key} required`,
      );
  const textureIds = new Set(inventory.textures.map((item) => item.id));
  for (const material of inventory.materials) {
    if (
      material.model !== contract.materials.model ||
      !contract.materials.alphaModes.includes(material.alphaMode) ||
      !Array.isArray(material.extensions) ||
      material.extensions.length !== 0 ||
      !Number.isFinite(material.emissiveIntensity) ||
      material.emissiveIntensity < 0 ||
      material.emissiveIntensity >
        contract.materials.maximumEmissiveIntensity ||
      !object(material.maps)
    )
      reasons.push(
        `${label}: ${material.id} uses undeclared or prohibited material features`,
      );
    for (const [map, textureId] of Object.entries(material.maps ?? {}))
      if (!contract.materials.maps.includes(map) || !textureIds.has(textureId))
        reasons.push(
          `${label}: ${material.id} ${map} is unsupported or references a missing texture`,
        );
  }
  return totals;
}

function inspectScene(scene, features, contract, reasons, label) {
  if (!object(scene)) {
    reasons.push(`${label}: scene inventory required`);
    return;
  }
  for (const key of [
    "houseCount",
    "carCount",
    "extraBuildings",
    "extraVehicles",
    "distantLandscape",
  ])
    if (scene[key] !== contract.scene[key])
      reasons.push(`${label}: scene ${key} differs from contract`);
  for (const key of ["trees", "shrubs", "extraDecorativeObjects"])
    if (!integer(scene[key]) || scene[key] > contract.budgets[key])
      reasons.push(`${label}: invalid or excessive ${key}`);
  for (const key of ["minX", "minZ"])
    if (!Number.isFinite(scene[key]) || scene[key] < contract.scene[key])
      reasons.push(`${label}: site ${key} outside fixed bounds`);
  for (const key of ["maxX", "maxZ"])
    if (!Number.isFinite(scene[key]) || scene[key] > contract.scene[key])
      reasons.push(`${label}: site ${key} outside fixed bounds`);
  if (scene.minX > scene.maxX || scene.minZ > scene.maxZ)
    reasons.push(`${label}: reversed site bounds`);
  for (const feature of contract.scene.requiredFeatures)
    if (features?.[feature] !== true)
      reasons.push(`${label}: required feature ${feature} missing`);
}

/** Accept only coordinator-verified pin records; this pure function does not read or hash files. */
function pinnedValue(record, label, reasons) {
  if (
    record?.hashParity !== true ||
    record.error != null ||
    !hash(record?.pin?.sha256) ||
    record.actualSha256 !== record.pin.sha256 ||
    !integer(record.pin.bytes) ||
    record.actualBytes !== record.pin.bytes ||
    !object(record.value)
  ) {
    reasons.push(
      `${label}: coordinator-verified exact hash and size pin required`,
    );
    return null;
  }
  return record.value;
}

function inspectIdentity(
  value,
  schema,
  engine,
  contractSha256,
  reasons,
  label,
) {
  if (
    value.schema !== schema ||
    value.engine !== engine ||
    value.contractSha256 !== contractSha256
  )
    reasons.push(`${label}: schema, engine or frozen contract hash differs`);
}

/** Returns an eligibility disposition, never a performance score or evidence authenticity claim. */
export function validateFairnessV2({
  contract = FAIRNESS_V2,
  contractSha256,
  engine,
  declaration,
  sourceAudit,
  observation,
} = {}) {
  const reasons = [];
  if (
    !object(contract) ||
    contract.schema !== FAIRNESS_SCHEMA_V2 ||
    !object(contract.settings) ||
    !object(contract.budgets) ||
    !object(contract.materials) ||
    !Array.isArray(contract.materials.alphaModes) ||
    !Array.isArray(contract.materials.maps) ||
    !Number.isFinite(contract.materials.maximumEmissiveIntensity) ||
    !Array.isArray(contract.scene?.requiredFeatures) ||
    contract.scene.requiredFeatures.length === 0 ||
    !Array.isArray(contract.measurement?.views) ||
    !integer(contract.measurement.warmupFrames) ||
    !integer(contract.measurement.measuredFrames) ||
    contract.measurement.measuredFrames === 0
  )
    return {
      schema: FAIRNESS_SCHEMA_V2,
      eligible: false,
      status: "ineligible",
      reasons: ["Complete versioned fairness contract required"],
    };
  if (!hash(contractSha256))
    reasons.push("Exact pre-author frozen contract SHA-256 required");
  if (!["three", "aperture"].includes(engine))
    reasons.push("Assigned engine must be three or aperture");
  const declared = pinnedValue(declaration, "author declaration", reasons);
  const audit = pinnedValue(sourceAudit, "independent source audit", reasons);
  const observed = pinnedValue(observation, "native observation", reasons);
  let declaredResources = null,
    auditedResources = null;
  if (declared) {
    inspectIdentity(
      declared,
      DECLARATION_SCHEMA_V2,
      engine,
      contractSha256,
      reasons,
      "author declaration",
    );
    if (!equal(declared.settings, contract.settings))
      reasons.push(
        "author declaration: baseline settings differ from frozen contract",
      );
    declaredResources = inspectInventory(
      declared.inventory,
      contract,
      reasons,
      "author declaration",
    );
    inspectScene(
      declared.scene,
      declared.requiredFeatures,
      contract,
      reasons,
      "author declaration",
    );
    if (!text(declared.authorId))
      reasons.push("author declaration: author identity required");
  }
  if (audit) {
    inspectIdentity(
      audit,
      SOURCE_AUDIT_SCHEMA_V2,
      engine,
      contractSha256,
      reasons,
      "independent source audit",
    );
    if (!text(audit.reviewerId) || audit.reviewerId === declared?.authorId)
      reasons.push(
        "independent source audit: a distinct independent reviewer required",
      );
    for (const key of ["sourceSha256", "buildSha256"])
      if (!hash(audit[key]))
        reasons.push(`independent source audit: exact ${key} required`);
    if (audit.declarationSha256 !== declaration?.pin?.sha256)
      reasons.push(
        "independent source audit: reviewed declaration hash differs",
      );
    if (!equal(audit.settings, contract.settings))
      reasons.push(
        "independent source audit: actual baseline settings differ from frozen contract",
      );
    auditedResources = inspectInventory(
      audit.inventory,
      contract,
      reasons,
      "independent source audit",
    );
    inspectScene(
      audit.scene,
      audit.requiredFeatures,
      contract,
      reasons,
      "independent source audit",
    );
    if (
      declared &&
      (!equal(
        inventoryIdentity(audit.inventory),
        inventoryIdentity(declared.inventory),
      ) ||
        !equal(audit.scene, declared.scene))
    )
      reasons.push(
        "independent source audit: reviewed inventory differs from author declaration",
      );
    for (const check of sourceChecks) {
      const record = audit.checks?.[check];
      if (
        record?.passed !== true ||
        !text(record.reason) ||
        !Array.isArray(record.evidence) ||
        record.evidence.length === 0 ||
        !record.evidence.every((pin) => text(pin?.path) && hash(pin.sha256))
      )
        reasons.push(
          `independent source audit: evidenced ${check} review required`,
        );
    }
    if (
      !text(audit.shadowImplementation?.filterDescription) ||
      !text(audit.shadowImplementation?.depthBiasConvention)
    )
      reasons.push(
        "independent source audit: actual shadow filter and depth-bias convention must be disclosed",
      );
  }
  if (observed) {
    inspectIdentity(
      observed,
      OBSERVATION_SCHEMA_V2,
      engine,
      contractSha256,
      reasons,
      "native observation",
    );
    if (observed.provenance !== "independent-native-harness")
      reasons.push(
        "native observation: independently collected harness evidence required",
      );
    if (
      observed.sourceSha256 !== audit?.sourceSha256 ||
      observed.buildSha256 !== audit?.buildSha256
    )
      reasons.push(
        "native observation: rendered source/build differ from independent audit",
      );
    if (observed.nativeWebGpu !== true || observed.webGlAttempts !== 0)
      reasons.push(
        "native observation: exclusive native WebGPU rendering required",
      );
    if (
      observed.displayCanvasCount !== 1 ||
      !equal(observed.viewport, contract.settings.viewport)
    )
      reasons.push(
        "native observation: exactly one fixed-resolution DPR1 display canvas required",
      );
    if (
      !object(observed.capture) ||
      observed.capture.warmupFrames !== contract.measurement.warmupFrames ||
      observed.capture.measuredFrames !== contract.measurement.measuredFrames ||
      observed.capture.complete !== true ||
      !equal(observed.capture.views, contract.measurement.views)
    )
      reasons.push(
        "native observation: complete fixed-frame and three-view capture required",
      );
    const geometry = observed.geometry;
    if (
      geometry?.complete !== true ||
      !hash(geometry?.semanticGeometrySha256) ||
      !integer(geometry?.meshCount) ||
      geometry.meshCount < 1 ||
      geometry.nativePositionMatchedMeshes !== geometry.meshCount ||
      geometry.unknownTriangleDrawCalls !== 0
    )
      reasons.push(
        "native observation: complete retained geometry and native position/triangle proof required",
      );
    if (
      !integer(geometry?.placedTriangles) ||
      geometry.placedTriangles !== auditedResources?.placedTriangles
    )
      reasons.push(
        "native observation: exported placed triangles differ from audited source inventory",
      );
    if (
      !object(observed.geometry?.bounds) ||
      !["min", "max"].every(
        (key) =>
          Array.isArray(observed.geometry.bounds[key]) &&
          observed.geometry.bounds[key].length === 3 &&
          observed.geometry.bounds[key].every(Number.isFinite),
      )
    )
      reasons.push("native observation: retained geometry bounds required");
    else if (
      geometry.bounds.min[0] < contract.scene.minX ||
      geometry.bounds.max[0] > contract.scene.maxX ||
      geometry.bounds.min[2] < contract.scene.minZ ||
      geometry.bounds.max[2] > contract.scene.maxZ
    )
      reasons.push(
        "native observation: exported geometry extends beyond fixed site bounds",
      );
  }
  return {
    schema: FAIRNESS_SCHEMA_V2,
    contractSha256,
    engine,
    eligible: reasons.length === 0,
    status:
      reasons.length === 0
        ? "eligible-with-independent-source-and-native-evidence"
        : "ineligible",
    reasons,
    resources: {
      declared: declaredResources,
      independentlyAudited: auditedResources,
    },
    verification: {
      authorDeclaration:
        "author claims checked against contract; not independent proof",
      sourceReview:
        "coordinator-pinned independent review establishes source settings, materials and complete inventory",
      nativeObservation:
        "coordinator-pinned native observation establishes canvas/backend, captures and position/triangle evidence",
      limitations: contract.limitations,
    },
  };
}

/** A starting declaration is deliberately incomplete; authors must inventory actual resources. */
export function fairnessDeclarationTemplateV2(
  engine,
  contractSha256,
  contract = FAIRNESS_V2,
) {
  return {
    schema: DECLARATION_SCHEMA_V2,
    engine,
    contractSha256,
    authorId: null,
    settings: structuredClone(contract.settings),
    requiredFeatures: Object.fromEntries(
      contract.scene.requiredFeatures.map((feature) => [feature, false]),
    ),
    scene: {
      ...Object.fromEntries(
        Object.entries(structuredClone(contract.scene)).filter(
          ([key]) => key !== "requiredFeatures",
        ),
      ),
      trees: null,
      shrubs: null,
      extraDecorativeObjects: null,
    },
    inventory: { geometries: [], textures: [], materials: [], lights: [] },
  };
}

export const FAIRNESS_SOURCE_CHECKS_V2 = deepFreeze([...sourceChecks]);
