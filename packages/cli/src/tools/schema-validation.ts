/** Validate the small JSON Schema subset used by Aperture's input contracts. */
export function schemaFailure(
  value: unknown,
  schema: Record<string, unknown>,
  field = "arguments",
): string | null {
  const choices = schema["anyOf"];
  if (Array.isArray(choices)) {
    if (
      choices.some(
        (choice: unknown) =>
          isRecord(choice) && schemaFailure(value, choice, field) === null,
      )
    )
      return null;
    return `${field} does not match a supported input shape.`;
  }
  const type = schema["type"];
  if (
    (type === "object" && !isRecord(value)) ||
    (type === "array" && !Array.isArray(value)) ||
    (type === "number" &&
      (typeof value !== "number" || !Number.isFinite(value))) ||
    (type === "integer" &&
      (typeof value !== "number" || !Number.isSafeInteger(value))) ||
    (type === "string" && typeof value !== "string") ||
    (type === "boolean" && typeof value !== "boolean")
  )
    return `${field} must be a ${String(type)}${type === "number" ? " with a finite value" : ""}.`;
  if (Array.isArray(schema["enum"]) && !schema["enum"].includes(value))
    return `${field} must be one of ${schema["enum"].join(", ")}.`;
  if (typeof value === "number") {
    if (typeof schema["minimum"] === "number" && value < schema["minimum"])
      return `${field} must be at least ${schema["minimum"]}.`;
    if (typeof schema["maximum"] === "number" && value > schema["maximum"])
      return `${field} must be at most ${schema["maximum"]}.`;
  }
  if (
    typeof value === "string" &&
    typeof schema["minLength"] === "number" &&
    value.length < schema["minLength"]
  )
    return `${field} must not be empty.`;
  if (Array.isArray(value)) {
    if (
      typeof schema["minItems"] === "number" &&
      value.length < schema["minItems"]
    )
      return `${field} needs at least ${schema["minItems"]} items.`;
    if (
      typeof schema["maxItems"] === "number" &&
      value.length > schema["maxItems"]
    )
      return `${field} accepts at most ${schema["maxItems"]} items.`;
    if (isRecord(schema["items"])) {
      for (let index = 0; index < value.length; index += 1) {
        const failure = schemaFailure(
          value[index],
          schema["items"],
          `${field}[${index}]`,
        );
        if (failure !== null) return failure;
      }
    }
  }
  if (isRecord(value)) {
    if (
      typeof schema["minProperties"] === "number" &&
      Object.keys(value).length < schema["minProperties"]
    )
      return `${field} must contain an input value.`;
    if (Array.isArray(schema["required"])) {
      for (const key of schema["required"] as string[]) {
        if (!Object.hasOwn(value, key)) return `${field}.${key} is required.`;
      }
    }
    const properties = isRecord(schema["properties"])
      ? schema["properties"]
      : {};
    for (const [key, entry] of Object.entries(value)) {
      const declared = Object.hasOwn(properties, key)
        ? properties[key]
        : undefined;
      const child = isRecord(declared)
        ? declared
        : schema["additionalProperties"];
      if (child === false) return `${field}.${key} is not supported.`;
      if (isRecord(child)) {
        const failure = schemaFailure(entry, child, `${field}.${key}`);
        if (failure !== null) return failure;
      }
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
