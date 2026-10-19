/** Serializable schema for the app-layer camera_inspect_local operation. */
export function cameraLocalInspectionProperties(): Record<string, unknown> {
  const entity = {
    anyOf: [
      {
        type: "object",
        properties: { key: { type: "string", minLength: 1 } },
        required: ["key"],
        additionalProperties: false,
      },
      {
        type: "object",
        properties: {
          index: { type: "integer", minimum: 0 },
          generation: { type: "integer", minimum: 0 },
        },
        required: ["index", "generation"],
        additionalProperties: false,
      },
    ],
  };
  const tuple = (size: number) => ({
    type: "array",
    items: { type: "number", minimum: -1e12, maximum: 1e12 },
    minItems: size,
    maxItems: size,
  });
  const name = { type: "string", minLength: 1, maxLength: 256 };
  return {
    camera: entity,
    viewport: {
      type: "object",
      properties: {
        width: { type: "integer", minimum: 1, maximum: 1e6 },
        height: { type: "integer", minimum: 1, maximum: 1e6 },
      },
      required: ["width", "height"],
      additionalProperties: false,
    },
    subjects: {
      type: "array",
      minItems: 1,
      maxItems: 256,
      items: {
        type: "object",
        required: ["name", "entity"],
        additionalProperties: false,
        properties: {
          name,
          entity,
          points: {
            type: "array",
            maxItems: 4096,
            items: {
              type: "object",
              required: ["name", "local"],
              additionalProperties: false,
              properties: {
                name,
                local: tuple(3),
                target: tuple(2),
                weight: { type: "number", exclusiveMinimum: 0, maximum: 1e12 },
              },
            },
          },
          faces: {
            type: "array",
            maxItems: 4096,
            items: {
              type: "object",
              required: ["name", "localTriangle"],
              additionalProperties: false,
              properties: {
                name,
                localTriangle: {
                  type: "array",
                  items: tuple(3),
                  minItems: 3,
                  maxItems: 3,
                },
              },
            },
          },
          bounds: {
            type: "object",
            required: ["source", "includeDescendants"],
            additionalProperties: false,
            properties: {
              source: { const: "mesh-local-aabb" },
              includeDescendants: { type: "boolean" },
            },
          },
        },
      },
    },
    cameraJob: {
      type: "object",
      required: ["referenceDistance"],
      additionalProperties: false,
      properties: {
        referenceDistance: {
          type: "number",
          exclusiveMinimum: 1e-6,
          maximum: 1e12,
          description:
            "Explicit distance from camera eye along its forward axis, defining the existing fit job's orbit gauge; no lookAt target is inferred.",
        },
      },
    },
  };
}
