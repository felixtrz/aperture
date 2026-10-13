import { DebugMetadata, Enabled, Name, } from "@aperture-engine/simulation";
import { AppEntityKey, AppEntityTags, registerApertureAppComponents, } from "../components.js";
import { ApertureSystemError } from "../errors.js";
export function createEntityWithMetadata(world, metadata, fallbackName, initialize) {
    const entity = world.createEntity();
    try {
        applySpawnMetadata(world, entity, metadata, fallbackName);
        initialize?.(entity);
        return entity;
    }
    catch (error) {
        entity.destroy();
        throw error;
    }
}
export function applySpawnMetadata(world, entity, metadata, fallbackName) {
    registerApertureAppComponents(world);
    // Validate before changing an existing imported/prefab entity's metadata.
    if (metadata.key !== undefined)
        assertUniqueKey(world, metadata.key, entity);
    const valuesJson = metadata.tags === undefined
        ? undefined
        : JSON.stringify([...metadata.tags]);
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
        if (entity.hasComponent(AppEntityKey)) {
            entity.setValue(AppEntityKey, "value", metadata.key);
        }
        else {
            entity.addComponent(AppEntityKey, { value: metadata.key });
        }
    }
    if (valuesJson !== undefined) {
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
function assertUniqueKey(world, key, current) {
    const query = world.queryManager.registerQuery({
        required: [AppEntityKey],
    });
    for (const entity of query.entities) {
        // Reuse one component query. A value query per key stays registered for
        // the world's lifetime and makes every future key write fan out to all
        // previously authored keys. Read current ECS values so renames stay valid.
        if (entity === current ||
            !entity.active ||
            entity.getValue(AppEntityKey, "value") !== key) {
            continue;
        }
        throw new ApertureSystemError("aperture.entityKey.duplicate", `Entity key '${key}' is already in use.`, "Use globally unique app keys or omit key and rely on { index, generation } identity.");
    }
}
//# sourceMappingURL=metadata.js.map