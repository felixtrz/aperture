import { EcsType } from "../ecs/index.js";
import { WorldTransform } from "../transform/components.js";
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
export const DERIVED_COMPONENT_IDS = [
    WorldTransform.id,
    "aperture.physics.bodyState",
];
/** Serialize every registered component on `entity` to a JSON-safe record. */
export function serializeEntityComponents(entity, options = {}) {
    const excluded = new Set(options.exclude ?? DERIVED_COMPONENT_IDS);
    const serialized = [];
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
export function deserializeEntityComponents(entity, serialized, options) {
    const diagnostics = [];
    const applied = [];
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
        const initialData = buildInitialData(component, record, options, diagnostics);
        addComponent(entity, component, initialData);
        applied.push(record.id);
    }
    return { ok: diagnostics.length === 0, applied, diagnostics };
}
/** The stable serialized token for an entity reference (`index:generation`). */
export function serializeEntityRef(entity) {
    return `${entity.index}:${entity.generation}`;
}
function serializeFields(entity, component) {
    const fields = {};
    for (const [key, type] of schemaFields(component)) {
        fields[key] = serializeField(entity, component, key, type);
    }
    return fields;
}
function serializeField(entity, component, key, type) {
    switch (type) {
        case EcsType.Vec2:
        case EcsType.Vec3:
        case EcsType.Vec4:
        case EcsType.Color:
            return Array.from(readVector(entity, component, key));
        case EcsType.Entity: {
            const ref = readValue(entity, component, key);
            return ref === null ? null : serializeEntityRef(ref);
        }
        default:
            // Int*/Float* -> number, Boolean -> boolean, String/FilePath -> string,
            // Enum -> its stable string value (elics stores the value, not an index),
            // Object -> the stored value (author's responsibility to keep JSON-safe).
            return readValue(entity, component, key);
    }
}
function buildInitialData(component, record, options, diagnostics) {
    const data = {};
    for (const [key, type] of schemaFields(component)) {
        if (!Object.prototype.hasOwnProperty.call(record.fields, key)) {
            // Missing field -> elics applies the schema default.
            continue;
        }
        const value = record.fields[key];
        if (type === EcsType.Entity) {
            data[key] = resolveEntityField(component, key, value, options, diagnostics);
            continue;
        }
        if (type === EcsType.String &&
            isEntityRefStringField(options, component, key)) {
            data[key] = resolveEntityRefStringField(component, key, value, options, diagnostics);
            continue;
        }
        data[key] = value;
    }
    return data;
}
function resolveEntityField(component, key, value, options, diagnostics) {
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
function isEntityRefStringField(options, component, key) {
    return options.registry.entityRefStringFields(component.id).includes(key);
}
function resolveEntityRefStringField(component, key, value, options, diagnostics) {
    if (value === null || value === undefined || value === "") {
        return "";
    }
    if (typeof value !== "string") {
        diagnostics.push({
            code: "aperture.serialization.invalidEntityRefString",
            message: `Expected serialized entity ref string for ${component.id}.${key}; field cleared.`,
            data: { id: component.id, field: key, value },
        });
        return "";
    }
    const resolved = options.resolveEntity?.(value) ?? null;
    if (resolved === null) {
        diagnostics.push({
            code: "aperture.serialization.unresolvedEntityRefString",
            message: `Could not resolve entity ref '${value}' for ${component.id}.${key}; field cleared.`,
            data: { id: component.id, field: key, token: value },
        });
        return "";
    }
    return serializeEntityRef(resolved);
}
function schemaFields(component) {
    const schema = component.schema;
    return Object.keys(schema).map((key) => [key, schema[key].type]);
}
// elics' getValue/getVectorView/addComponent are typed against a concrete
// component's schema; the codec is schema-generic, so access them through a
// narrow loose view rather than threading per-component generics.
function readValue(entity, component, key) {
    return entity.getValue(component, key);
}
function readVector(entity, component, key) {
    return entity.getVectorView(component, key);
}
function addComponent(entity, component, initialData) {
    entity.addComponent(component, initialData);
}
//# sourceMappingURL=component-codec.js.map