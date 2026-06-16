import type {
  QuatTuple,
  Vec2Tuple,
  Vec3Tuple,
  Vec4Tuple,
} from "@aperture-engine/simulation";
import { jsonSafeValue } from "../internal/json-safe.js";
import { ApertureSystemError } from "./errors.js";

export type ApertureResourceState = Record<string, unknown>;

export interface ApertureResourceField<TValue> {
  readonly kind: string;
  createDefault(): TValue;
  summarize(value: TValue): unknown;
}

export type ApertureResourceStateFromSchema<
  TSchema extends Readonly<Record<string, ApertureResourceField<unknown>>>,
> = {
  -readonly [K in keyof TSchema]: TSchema[K] extends ApertureResourceField<
    infer TValue
  >
    ? TValue
    : never;
};

export interface ApertureResourceDescriptor<
  TState extends ApertureResourceState = ApertureResourceState,
> {
  readonly id: string;
  readonly schema: {
    readonly [K in keyof TState]: ApertureResourceField<TState[K]>;
  };
}

export interface ApertureResourceFieldSummary {
  readonly name: string;
  readonly kind: string;
}

export interface ApertureResourceSummaryEntry {
  readonly id: string;
  readonly version: number;
  readonly fields: readonly ApertureResourceFieldSummary[];
  readonly values: Readonly<Record<string, unknown>>;
}

export interface ApertureResourceStoreSummary {
  readonly count: number;
  readonly entries: readonly ApertureResourceSummaryEntry[];
}

export interface ResourceStore {
  has<TState extends ApertureResourceState>(
    descriptor: ApertureResourceDescriptor<TState>,
  ): boolean;
  read<TState extends ApertureResourceState>(
    descriptor: ApertureResourceDescriptor<TState>,
  ): Readonly<TState>;
  write<TState extends ApertureResourceState>(
    descriptor: ApertureResourceDescriptor<TState>,
    mutator: (state: TState) => void,
  ): Readonly<TState>;
  set<TState extends ApertureResourceState>(
    descriptor: ApertureResourceDescriptor<TState>,
    value: TState,
  ): Readonly<TState>;
  reset<TState extends ApertureResourceState>(
    descriptor: ApertureResourceDescriptor<TState>,
  ): Readonly<TState>;
  summary(): ApertureResourceStoreSummary;
}

export function defineResource<
  const TSchema extends Readonly<Record<string, ApertureResourceField<unknown>>>,
>(
  id: string,
  schema: TSchema,
): ApertureResourceDescriptor<ApertureResourceStateFromSchema<TSchema>> {
  validateResourceId(id);
  validateResourceSchema(id, schema);

  return Object.freeze({
    id,
    schema,
  }) as ApertureResourceDescriptor<ApertureResourceStateFromSchema<TSchema>>;
}

export const resource = Object.freeze({
  boolean(defaultValue = false): ApertureResourceField<boolean> {
    return createResourceField("boolean", defaultValue);
  },
  number(defaultValue = 0): ApertureResourceField<number> {
    return createResourceField("number", defaultValue);
  },
  string(defaultValue = ""): ApertureResourceField<string> {
    return createResourceField("string", defaultValue);
  },
  vec2(defaultValue: Vec2Tuple = [0, 0]): ApertureResourceField<Vec2Tuple> {
    return createTupleResourceField("vec2", defaultValue, 2);
  },
  vec3(
    defaultValue: Vec3Tuple = [0, 0, 0],
  ): ApertureResourceField<Vec3Tuple> {
    return createTupleResourceField("vec3", defaultValue, 3);
  },
  nullableVec3(
    defaultValue: Vec3Tuple | null = null,
  ): ApertureResourceField<Vec3Tuple | null> {
    if (defaultValue !== null) {
      validateTupleDefault("nullableVec3", defaultValue, 3);
    }

    return createResourceField("nullableVec3", defaultValue);
  },
  vec4(
    defaultValue: Vec4Tuple = [0, 0, 0, 0],
  ): ApertureResourceField<Vec4Tuple> {
    return createTupleResourceField("vec4", defaultValue, 4);
  },
  quat(
    defaultValue: QuatTuple = [0, 0, 0, 1],
  ): ApertureResourceField<QuatTuple> {
    return createTupleResourceField("quat", defaultValue, 4);
  },
  value<TValue>(
    defaultValue: TValue | (() => TValue),
    options: {
      readonly kind?: string;
      readonly summarize?: (value: TValue) => unknown;
    } = {},
  ): ApertureResourceField<TValue> {
    return createResourceField(
      options.kind ?? "value",
      defaultValue,
      options.summarize,
    );
  },
});

export function createResourceStore(): ResourceStore {
  return new DefaultResourceStore();
}

interface ResourceEntry<TState extends ApertureResourceState> {
  readonly descriptor: ApertureResourceDescriptor<TState>;
  state: TState;
  version: number;
}

class DefaultResourceStore implements ResourceStore {
  readonly #entries = new Map<string, ResourceEntry<ApertureResourceState>>();

  has<TState extends ApertureResourceState>(
    descriptor: ApertureResourceDescriptor<TState>,
  ): boolean {
    return this.#entries.has(descriptor.id);
  }

  read<TState extends ApertureResourceState>(
    descriptor: ApertureResourceDescriptor<TState>,
  ): Readonly<TState> {
    return this.#entry(descriptor).state;
  }

  write<TState extends ApertureResourceState>(
    descriptor: ApertureResourceDescriptor<TState>,
    mutator: (state: TState) => void,
  ): Readonly<TState> {
    const entry = this.#entry(descriptor);

    mutator(entry.state);
    entry.version += 1;

    return entry.state;
  }

  set<TState extends ApertureResourceState>(
    descriptor: ApertureResourceDescriptor<TState>,
    value: TState,
  ): Readonly<TState> {
    const entry = this.#entry(descriptor);

    entry.state = cloneResourceValue(value);
    entry.version += 1;

    return entry.state;
  }

  reset<TState extends ApertureResourceState>(
    descriptor: ApertureResourceDescriptor<TState>,
  ): Readonly<TState> {
    const entry = this.#entry(descriptor);

    entry.state = createResourceState(descriptor);
    entry.version += 1;

    return entry.state;
  }

  summary(): ApertureResourceStoreSummary {
    const entries = [...this.#entries.values()]
      .sort((a, b) => a.descriptor.id.localeCompare(b.descriptor.id))
      .map((entry) => createResourceSummaryEntry(entry));

    return {
      count: entries.length,
      entries,
    };
  }

  #entry<TState extends ApertureResourceState>(
    descriptor: ApertureResourceDescriptor<TState>,
  ): ResourceEntry<TState> {
    const existing = this.#entries.get(descriptor.id);

    if (existing !== undefined) {
      ensureCompatibleResourceDescriptor(existing.descriptor, descriptor);
      return existing as ResourceEntry<TState>;
    }

    const entry: ResourceEntry<TState> = {
      descriptor,
      state: createResourceState(descriptor),
      version: 0,
    };

    this.#entries.set(
      descriptor.id,
      entry as ResourceEntry<ApertureResourceState>,
    );

    return entry;
  }
}

function createResourceField<TValue>(
  kind: string,
  defaultValue: TValue | (() => TValue),
  summarize: (value: TValue) => unknown = jsonSafeValue,
): ApertureResourceField<TValue> {
  const defaultFactory = createDefaultFactory(defaultValue);

  return Object.freeze({
    kind,
    createDefault() {
      return cloneResourceValue(defaultFactory());
    },
    summarize(value: TValue) {
      return summarize(value);
    },
  });
}

function createTupleResourceField<TTuple extends readonly number[]>(
  kind: string,
  defaultValue: TTuple,
  expectedLength: number,
): ApertureResourceField<TTuple> {
  validateTupleDefault(kind, defaultValue, expectedLength);

  return createResourceField(kind, defaultValue);
}

function createDefaultFactory<TValue>(
  defaultValue: TValue | (() => TValue),
): () => TValue {
  if (typeof defaultValue === "function") {
    return defaultValue as () => TValue;
  }

  return () => defaultValue;
}

function createResourceState<TState extends ApertureResourceState>(
  descriptor: ApertureResourceDescriptor<TState>,
): TState {
  const state: Partial<TState> = {};

  for (const key of Object.keys(descriptor.schema) as Array<keyof TState>) {
    state[key] = descriptor.schema[key].createDefault();
  }

  return state as TState;
}

function createResourceSummaryEntry<TState extends ApertureResourceState>(
  entry: ResourceEntry<TState>,
): ApertureResourceSummaryEntry {
  const fields: ApertureResourceFieldSummary[] = [];
  const values: Record<string, unknown> = {};

  for (const key of Object.keys(entry.descriptor.schema) as Array<
    keyof TState
  >) {
    const field = entry.descriptor.schema[key];
    const name = String(key);

    fields.push({ name, kind: field.kind });
    values[name] = field.summarize(entry.state[key]);
  }

  fields.sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: entry.descriptor.id,
    version: entry.version,
    fields,
    values,
  };
}

function validateResourceId(id: string): void {
  if (id.trim().length === 0) {
    throw new ApertureSystemError(
      "aperture.resource.invalidId",
      "Resource ids must be non-empty strings.",
      "Pass a stable, namespaced id such as defineResource('game.player', ...).",
      { id },
    );
  }
}

function validateResourceSchema(
  id: string,
  schema: Readonly<Record<string, ApertureResourceField<unknown>>>,
): void {
  const keys = Object.keys(schema);

  if (keys.length === 0) {
    throw new ApertureSystemError(
      "aperture.resource.emptySchema",
      "Resources need at least one field.",
      "Add typed fields with the resource helpers, for example { ready: resource.boolean(false) }.",
      { id },
    );
  }
}

function validateTupleDefault(
  kind: string,
  value: readonly number[],
  expectedLength: number,
): void {
  if (
    value.length !== expectedLength ||
    value.some((item) => !Number.isFinite(item))
  ) {
    throw new ApertureSystemError(
      "aperture.resource.invalidTupleDefault",
      `Resource ${kind} defaults must contain ${expectedLength} finite numbers.`,
      "Pass a tuple literal with the expected length.",
      { kind, value, expectedLength },
    );
  }
}

function ensureCompatibleResourceDescriptor(
  existing: ApertureResourceDescriptor<ApertureResourceState>,
  next: ApertureResourceDescriptor<ApertureResourceState>,
): void {
  if (existing === next) {
    return;
  }

  const existingFields = resourceSchemaFingerprint(existing.schema);
  const nextFields = resourceSchemaFingerprint(next.schema);

  if (existingFields !== nextFields) {
    throw new ApertureSystemError(
      "aperture.resource.schemaConflict",
      `Resource '${next.id}' was registered with a different schema.`,
      "Use a unique resource id for different state shapes.",
      {
        id: next.id,
        existingFields,
        nextFields,
      },
    );
  }
}

function resourceSchemaFingerprint(
  schema: Readonly<Record<string, ApertureResourceField<unknown>>>,
): string {
  return Object.keys(schema)
    .sort()
    .map((key) => `${key}:${schema[key]?.kind ?? "unknown"}`)
    .join("|");
}

function cloneResourceValue<TValue>(value: TValue): TValue {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value) as TValue;
  }

  return JSON.parse(JSON.stringify(value)) as TValue;
}
