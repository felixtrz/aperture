import { EcsType } from "../ecs/index.js";
import { LocalTransform, Parent, registerTransformComponents, } from "../transform/components.js";
import { resolveWorldTransforms } from "../transform/resolution.js";
import { loadScene } from "./scene-document.js";
export function instantiatePrefab(world, document, options) {
    // Deep-clone so two instances of the same prefab never share document arrays.
    const cloned = JSON.parse(JSON.stringify(document));
    const loaded = loadScene(world, cloned, { registry: options.registry });
    if (loaded.entities.length === 0) {
        return {
            ok: loaded.ok,
            root: null,
            entities: [],
            diagnostics: loaded.diagnostics,
        };
    }
    const diagnostics = [...loaded.diagnostics];
    const idToEntity = new Map();
    cloned.entities.forEach((record, index) => {
        const entity = loaded.entities[index];
        if (entity !== undefined) {
            idToEntity.set(record.id, entity);
        }
    });
    const rootRecord = findRootRecord(cloned);
    const root = rootRecord === null ? null : (idToEntity.get(rootRecord.id) ?? null);
    if (options.transform !== undefined && root !== null) {
        applyTransformOverride(root, options.transform);
    }
    for (const override of options.overrides ?? []) {
        applyFieldOverride(idToEntity, options.registry, override, diagnostics);
    }
    // Re-resolve so overrides (root placement, etc.) reach the world matrices.
    registerTransformComponents(world);
    resolveWorldTransforms(world);
    return {
        ok: diagnostics.length === 0,
        root,
        entities: loaded.entities,
        diagnostics,
    };
}
function findRootRecord(document) {
    for (const record of document.entities) {
        const parent = record.components.find((component) => component.id === Parent.id);
        if (parent === undefined || parent.fields.entity == null) {
            return record;
        }
    }
    return document.entities[0] ?? null;
}
function applyTransformOverride(root, transform) {
    if (!root.hasComponent(LocalTransform)) {
        return;
    }
    if (transform.translation !== undefined) {
        root
            .getVectorView(LocalTransform, "translation")
            .set(transform.translation);
    }
    if (transform.rotation !== undefined) {
        root.getVectorView(LocalTransform, "rotation").set(transform.rotation);
    }
    if (transform.scale !== undefined) {
        root.getVectorView(LocalTransform, "scale").set(transform.scale);
    }
}
function applyFieldOverride(idToEntity, registry, override, diagnostics) {
    const entity = idToEntity.get(override.id);
    if (entity === undefined) {
        diagnostics.push({
            code: "aperture.prefab.unknownOverrideId",
            message: `Prefab override targets unknown prefab-local id '${override.id}'.`,
            data: { id: override.id },
        });
        return;
    }
    const component = registry.get(override.component);
    if (component === undefined) {
        diagnostics.push({
            code: "aperture.prefab.unknownOverrideComponent",
            message: `Prefab override targets unregistered component '${override.component}'.`,
            data: { id: override.id, component: override.component },
        });
        return;
    }
    if (!entity.hasComponent(component)) {
        diagnostics.push({
            code: "aperture.prefab.overrideComponentMissing",
            message: `Prefab instance '${override.id}' has no component '${override.component}' to override.`,
            data: { id: override.id, component: override.component },
        });
        return;
    }
    const type = fieldType(component, override.field);
    if (type === undefined) {
        diagnostics.push({
            code: "aperture.prefab.unknownOverrideField",
            message: `Component '${override.component}' has no field '${override.field}'.`,
            data: {
                id: override.id,
                component: override.component,
                field: override.field,
            },
        });
        return;
    }
    writeOverride(entity, component, override.field, type, override.value);
}
function fieldType(component, field) {
    const schema = component.schema;
    return schema[field]?.type;
}
function writeOverride(entity, component, field, type, value) {
    const loose = entity;
    switch (type) {
        case EcsType.Vec2:
        case EcsType.Vec3:
        case EcsType.Vec4:
        case EcsType.Color:
            loose.getVectorView(component, field).set(value);
            return;
        default:
            loose.setValue(component, field, value);
    }
}
//# sourceMappingURL=prefab.js.map