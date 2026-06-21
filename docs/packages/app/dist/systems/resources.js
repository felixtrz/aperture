import { jsonSafeValue } from "../internal/json-safe.js";
import { ApertureSystemError } from "./errors.js";
export function defineResource(id, schema) {
    validateResourceId(id);
    validateResourceSchema(id, schema);
    return Object.freeze({
        id,
        schema,
    });
}
export const resource = Object.freeze({
    boolean(defaultValue = false) {
        return createResourceField("boolean", defaultValue);
    },
    number(defaultValue = 0) {
        return createResourceField("number", defaultValue);
    },
    string(defaultValue = "") {
        return createResourceField("string", defaultValue);
    },
    vec2(defaultValue = [0, 0]) {
        return createTupleResourceField("vec2", defaultValue, 2);
    },
    vec3(defaultValue = [0, 0, 0]) {
        return createTupleResourceField("vec3", defaultValue, 3);
    },
    nullableVec3(defaultValue = null) {
        if (defaultValue !== null) {
            validateTupleDefault("nullableVec3", defaultValue, 3);
        }
        return createResourceField("nullableVec3", defaultValue);
    },
    vec4(defaultValue = [0, 0, 0, 0]) {
        return createTupleResourceField("vec4", defaultValue, 4);
    },
    quat(defaultValue = [0, 0, 0, 1]) {
        return createTupleResourceField("quat", defaultValue, 4);
    },
    value(defaultValue, options = {}) {
        return createResourceField(options.kind ?? "value", defaultValue, options.summarize);
    },
});
export function createResourceStore() {
    return new DefaultResourceStore();
}
class DefaultResourceStore {
    #entries = new Map();
    has(descriptor) {
        return this.#entries.has(descriptor.id);
    }
    read(descriptor) {
        return this.#entry(descriptor).state;
    }
    write(descriptor, mutator) {
        const entry = this.#entry(descriptor);
        mutator(entry.state);
        entry.version += 1;
        return entry.state;
    }
    set(descriptor, value) {
        const entry = this.#entry(descriptor);
        entry.state = cloneResourceValue(value);
        entry.version += 1;
        return entry.state;
    }
    reset(descriptor) {
        const entry = this.#entry(descriptor);
        entry.state = createResourceState(descriptor);
        entry.version += 1;
        return entry.state;
    }
    patchById(id, values) {
        const entry = this.#entries.get(id);
        if (entry === undefined)
            return null;
        const updates = [];
        for (const [name, value] of Object.entries(values)) {
            const field = entry.descriptor.schema[name];
            if (field === undefined) {
                throw new ApertureSystemError("aperture.resource.fieldNotFound", `Resource '${id}' has no field '${name}'.`, "Pass a field name from resource_get for the target resource.", {
                    id,
                    field: name,
                    availableFields: Object.keys(entry.descriptor.schema).sort(),
                });
            }
            updates.push([name, resourceValueFromUnknown(id, name, field, value)]);
        }
        for (const [name, value] of updates) {
            entry.state[name] = value;
        }
        entry.version += 1;
        return createResourceSummaryEntry(entry);
    }
    summary() {
        const entries = [...this.#entries.values()]
            .sort((a, b) => a.descriptor.id.localeCompare(b.descriptor.id))
            .map((entry) => createResourceSummaryEntry(entry));
        return {
            count: entries.length,
            entries,
        };
    }
    #entry(descriptor) {
        const existing = this.#entries.get(descriptor.id);
        if (existing !== undefined) {
            ensureCompatibleResourceDescriptor(existing.descriptor, descriptor);
            return existing;
        }
        const entry = {
            descriptor,
            state: createResourceState(descriptor),
            version: 0,
        };
        this.#entries.set(descriptor.id, entry);
        return entry;
    }
}
function createResourceField(kind, defaultValue, summarize = jsonSafeValue) {
    const defaultFactory = createDefaultFactory(defaultValue);
    return Object.freeze({
        kind,
        createDefault() {
            return cloneResourceValue(defaultFactory());
        },
        summarize(value) {
            return summarize(value);
        },
    });
}
function createTupleResourceField(kind, defaultValue, expectedLength) {
    validateTupleDefault(kind, defaultValue, expectedLength);
    return createResourceField(kind, defaultValue);
}
function createDefaultFactory(defaultValue) {
    if (typeof defaultValue === "function") {
        return defaultValue;
    }
    return () => defaultValue;
}
function createResourceState(descriptor) {
    const state = {};
    for (const key of Object.keys(descriptor.schema)) {
        state[key] = descriptor.schema[key].createDefault();
    }
    return state;
}
function createResourceSummaryEntry(entry) {
    const fields = [];
    const values = {};
    for (const key of Object.keys(entry.descriptor.schema)) {
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
function validateResourceId(id) {
    if (id.trim().length === 0) {
        throw new ApertureSystemError("aperture.resource.invalidId", "Resource ids must be non-empty strings.", "Pass a stable, namespaced id such as defineResource('game.player', ...).", { id });
    }
}
function validateResourceSchema(id, schema) {
    const keys = Object.keys(schema);
    if (keys.length === 0) {
        throw new ApertureSystemError("aperture.resource.emptySchema", "Resources need at least one field.", "Add typed fields with the resource helpers, for example { ready: resource.boolean(false) }.", { id });
    }
}
function validateTupleDefault(kind, value, expectedLength) {
    if (value.length !== expectedLength ||
        value.some((item) => !Number.isFinite(item))) {
        throw new ApertureSystemError("aperture.resource.invalidTupleDefault", `Resource ${kind} defaults must contain ${expectedLength} finite numbers.`, "Pass a tuple literal with the expected length.", { kind, value, expectedLength });
    }
}
function ensureCompatibleResourceDescriptor(existing, next) {
    if (existing === next) {
        return;
    }
    const existingFields = resourceSchemaFingerprint(existing.schema);
    const nextFields = resourceSchemaFingerprint(next.schema);
    if (existingFields !== nextFields) {
        throw new ApertureSystemError("aperture.resource.schemaConflict", `Resource '${next.id}' was registered with a different schema.`, "Use a unique resource id for different state shapes.", {
            id: next.id,
            existingFields,
            nextFields,
        });
    }
}
function resourceSchemaFingerprint(schema) {
    return Object.keys(schema)
        .sort()
        .map((key) => `${key}:${schema[key]?.kind ?? "unknown"}`)
        .join("|");
}
function cloneResourceValue(value) {
    if (value === null || typeof value !== "object") {
        return value;
    }
    if (typeof globalThis.structuredClone === "function") {
        return globalThis.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}
function resourceValueFromUnknown(id, name, field, value) {
    switch (field.kind) {
        case "boolean":
            if (typeof value === "boolean")
                return value;
            break;
        case "number":
            if (typeof value === "number" && Number.isFinite(value))
                return value;
            break;
        case "string":
            if (typeof value === "string")
                return value;
            break;
        case "vec2":
            return tupleResourceValue(id, name, field.kind, value, 2);
        case "vec3":
            return tupleResourceValue(id, name, field.kind, value, 3);
        case "vec4":
            return tupleResourceValue(id, name, field.kind, value, 4);
        case "quat":
            return quatResourceValue(id, name, value);
        case "nullableVec3":
            return value === null
                ? null
                : tupleResourceValue(id, name, field.kind, value, 3);
        default:
            return cloneResourceValue(value);
    }
    throw invalidResourceFieldValueError(id, name, field.kind, value);
}
function tupleResourceValue(id, name, kind, value, length) {
    if (Array.isArray(value) &&
        value.length === length &&
        value.every((item) => typeof item === "number" && Number.isFinite(item))) {
        return [...value];
    }
    throw invalidResourceFieldValueError(id, name, kind, value, {
        expectedLength: length,
    });
}
function quatResourceValue(id, name, value) {
    const tuple = tupleResourceValue(id, name, "quat", value, 4);
    if (Math.hypot(...tuple) > Number.EPSILON)
        return tuple;
    throw invalidResourceFieldValueError(id, name, "quat", value, {
        expectedLength: 4,
        expectedNonZero: true,
    });
}
function invalidResourceFieldValueError(id, name, kind, value, extra = {}) {
    return new ApertureSystemError("aperture.resource.invalidFieldValue", `Resource '${id}' field '${name}' expects a ${kind} value.`, "Pass a JSON value matching the field kind reported by resource_get.", {
        id,
        field: name,
        kind,
        value: jsonSafeValue(value),
        ...extra,
    });
}
//# sourceMappingURL=resources.js.map