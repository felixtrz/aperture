import { EcsType, type AnyEcsComponent, type Entity } from "../ecs/index.js";
import type { DataType } from "../ecs/index.js";
import { WorldTransform } from "../transform/components.js";
import type { ComponentRegistry } from "./component-registry.js";

// M7-T3: generic, headless-safe (de)serialization for a single entity's
// registered components, driven entirely by `component.schema` field types so it
// works for any component without per-component code. Mirrors the schema-driven
// read pattern in app/src/entities/lookup/summary.ts. Entity-typed fields are
// emitted as stable `index:generation` tokens (remapped at instantiation time by
// the scene/prefab layers — M7-T4/T5), NEVER as raw numeric indices, and derived
// components (WorldTransform) are excluded since the resolver recomputes them.
//
// Kept free of any app/render imports so the codec stays in the simulation
// package and worker-safe.

/** Components excluded from serialization by default because they are derived. */
export const DERIVED_COMPONENT_IDS: readonly string[] = [WorldTransform.id];

export interface SerializedComponent {
  readonly id: string;
  readonly fields: Readonly<Record<string, unknown>>;
}

export interface SerializeEntityComponentsOptions {
  /** Component ids to skip. Defaults to {@link DERIVED_COMPONENT_IDS}. */
  readonly exclude?: readonly string[];
}

export interface ComponentCodecDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface DeserializeEntityComponentsOptions {
  readonly registry: ComponentRegistry;
  /**
   * Turn a serialized `index:generation` token back into a live entity. Supplied
   * by the scene/prefab layer (which builds an old-id -> new-entity map). When
   * absent (or when it returns null) an Entity-typed field deserializes to null
   * and a diagnostic is recorded.
   */
  readonly resolveEntity?: (token: string) => Entity | null;
}

export interface DeserializeEntityComponentsResult {
  readonly ok: boolean;
  readonly applied: readonly string[];
  readonly diagnostics: readonly ComponentCodecDiagnostic[];
}

/** Serialize every registered component on `entity` to a JSON-safe record. */
export function serializeEntityComponents(
  entity: Entity,
  options: SerializeEntityComponentsOptions = {},
): SerializedComponent[] {
  const excluded = new Set(options.exclude ?? DERIVED_COMPONENT_IDS);
  const serialized: SerializedComponent[] = [];

  for (const component of entity.getComponents()) {
    if (excluded.has(component.id)) {
      continue;
    }
    serialized.push({
      id: component.id,
      fields: serializeFields(entity, component),
    });
  }

  // Stable order so whole-scene documents (M7-T4) are deterministic.
  serialized.sort((a, b) => a.id.localeCompare(b.id));
  return serialized;
}

/** Reconstruct `serialized` components onto a (typically fresh) `entity`. */
export function deserializeEntityComponents(
  entity: Entity,
  serialized: readonly SerializedComponent[],
  options: DeserializeEntityComponentsOptions,
): DeserializeEntityComponentsResult {
  const diagnostics: ComponentCodecDiagnostic[] = [];
  const applied: string[] = [];

  for (const record of serialized) {
    const component = options.registry.get(record.id);
    if (component === undefined) {
      diagnostics.push({
        code: "aperture.serialization.unregisteredComponent",
        message: `No registered component for id '${record.id}'; component skipped.`,
        data: { id: record.id },
      });
      continue;
    }

    const initialData = buildInitialData(
      component,
      record,
      options,
      diagnostics,
    );
    addComponent(entity, component, initialData);
    applied.push(record.id);
  }

  return { ok: diagnostics.length === 0, applied, diagnostics };
}

/** The stable serialized token for an entity reference (`index:generation`). */
export function serializeEntityRef(entity: Entity): string {
  return `${entity.index}:${entity.generation}`;
}

function serializeFields(
  entity: Entity,
  component: AnyEcsComponent,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, type] of schemaFields(component)) {
    fields[key] = serializeField(entity, component, key, type);
  }
  return fields;
}

function serializeField(
  entity: Entity,
  component: AnyEcsComponent,
  key: string,
  type: DataType,
): unknown {
  switch (type) {
    case EcsType.Vec2:
    case EcsType.Vec3:
    case EcsType.Vec4:
    case EcsType.Color:
      return Array.from(readVector(entity, component, key));
    case EcsType.Entity: {
      const ref = readValue(entity, component, key) as Entity | null;
      return ref === null ? null : serializeEntityRef(ref);
    }
    default:
      // Int*/Float* -> number, Boolean -> boolean, String/FilePath -> string,
      // Enum -> its stable string value (elics stores the value, not an index),
      // Object -> the stored value (author's responsibility to keep JSON-safe).
      return readValue(entity, component, key);
  }
}

function buildInitialData(
  component: AnyEcsComponent,
  record: SerializedComponent,
  options: DeserializeEntityComponentsOptions,
  diagnostics: ComponentCodecDiagnostic[],
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const [key, type] of schemaFields(component)) {
    if (!Object.prototype.hasOwnProperty.call(record.fields, key)) {
      // Missing field -> elics applies the schema default.
      continue;
    }

    const value = record.fields[key];
    if (type === EcsType.Entity) {
      data[key] = resolveEntityField(
        component,
        key,
        value,
        options,
        diagnostics,
      );
      continue;
    }

    data[key] = value;
  }

  return data;
}

function resolveEntityField(
  component: AnyEcsComponent,
  key: string,
  value: unknown,
  options: DeserializeEntityComponentsOptions,
  diagnostics: ComponentCodecDiagnostic[],
): Entity | null {
  if (value === null || value === undefined) {
    return null;
  }

  const token = String(value);
  const resolved = options.resolveEntity?.(token) ?? null;
  if (resolved === null) {
    diagnostics.push({
      code: "aperture.serialization.unresolvedEntityRef",
      message: `Could not resolve entity ref '${token}' for ${component.id}.${key}; set to null.`,
      data: { id: component.id, field: key, token },
    });
  }
  return resolved;
}

function schemaFields(
  component: AnyEcsComponent,
): readonly (readonly [string, DataType])[] {
  const schema = component.schema as Record<
    string,
    { readonly type: DataType }
  >;
  return Object.keys(schema).map((key) => [key, schema[key]!.type] as const);
}

// elics' getValue/getVectorView/addComponent are typed against a concrete
// component's schema; the codec is schema-generic, so access them through a
// narrow loose view rather than threading per-component generics.

function readValue(
  entity: Entity,
  component: AnyEcsComponent,
  key: string,
): unknown {
  return (
    entity as unknown as {
      getValue(component: AnyEcsComponent, key: string): unknown;
    }
  ).getValue(component, key);
}

function readVector(
  entity: Entity,
  component: AnyEcsComponent,
  key: string,
): ArrayLike<number> {
  return (
    entity as unknown as {
      getVectorView(component: AnyEcsComponent, key: string): ArrayLike<number>;
    }
  ).getVectorView(component, key);
}

function addComponent(
  entity: Entity,
  component: AnyEcsComponent,
  initialData: Record<string, unknown>,
): void {
  (
    entity as unknown as {
      addComponent(
        component: AnyEcsComponent,
        initialData: Record<string, unknown>,
      ): unknown;
    }
  ).addComponent(component, initialData);
}
