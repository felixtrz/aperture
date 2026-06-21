import { DebugMetadata, Enabled, Name, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { AppEntityKey, AppEntityTags, registerApertureAppComponents, } from "../components.js";
import { ApertureSystemError } from "../errors.js";
export function createEntityWithMetadata(world, metadata, fallbackName) {
    const entity = world.createEntity();
    applySpawnMetadata(world, entity, metadata, fallbackName);
    return entity;
}
export function applySpawnMetadata(world, entity, metadata, fallbackName) {
    registerApertureAppComponents(world);
    if (!entity.hasComponent(Enabled)) {
        entity.addComponent(Enabled, { value: true });
    }
    if (metadata.name !== undefined) {
        upsertName(entity, metadata.name);
    }
    else if (!entity.hasComponent(Name)) {
        entity.addComponent(Name, { value: fallbackName });
    }
    if (metadata.key !== undefined) {
        assertUniqueKey(world, metadata.key);
        if (entity.hasComponent(AppEntityKey)) {
            entity.setValue(AppEntityKey, "value", metadata.key);
        }
        else {
            entity.addComponent(AppEntityKey, { value: metadata.key });
        }
    }
    if (metadata.tags !== undefined) {
        const valuesJson = JSON.stringify([...metadata.tags]);
        if (entity.hasComponent(AppEntityTags)) {
            entity.setValue(AppEntityTags, "valuesJson", valuesJson);
        }
        else {
            entity.addComponent(AppEntityTags, { valuesJson });
        }
    }
}
export function upsertDebugMetadata(entity, value) {
    if (entity.hasComponent(DebugMetadata)) {
        entity.setValue(DebugMetadata, "tag", value.tag);
        entity.setValue(DebugMetadata, "note", value.note);
        return;
    }
    entity.addComponent(DebugMetadata, value);
}
function upsertName(entity, value) {
    if (entity.hasComponent(Name)) {
        entity.setValue(Name, "value", value);
        return;
    }
    entity.addComponent(Name, { value });
}
function assertUniqueKey(world, key) {
    const query = world.queryManager.registerQuery({
        required: [AppEntityKey],
        where: [{ component: AppEntityKey, key: "value", op: "eq", value: key }],
    });
    if (query.entities.size > 0) {
        throw new ApertureSystemError("aperture.entityKey.duplicate", `Entity key '${key}' is already in use.`, "Use globally unique app keys or omit key and rely on { index, generation } identity.");
    }
}
//# sourceMappingURL=metadata.js.map