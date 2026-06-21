import { Enabled, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { RuntimeUniform, validateRuntimeUniformInput, } from "./index.js";
import { createStableRenderId, } from "./snapshot.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
export function extractRuntimeUniforms(world, diagnostics) {
    const query = world.queryManager.registerQuery({
        required: [RuntimeUniform],
    });
    const packets = [];
    const seenKeys = new Set();
    for (const entity of sortedEntities(query.entities)) {
        if (entity.hasComponent(Enabled) &&
            entity.getValue(Enabled, "value") === false) {
            diagnostics.push(diagnostic("render.disabled", entity));
            continue;
        }
        const input = runtimeUniformInput(entity);
        const validation = validateRuntimeUniformInput(input);
        if (!validation.valid) {
            for (const uniformDiagnostic of validation.diagnostics) {
                diagnostics.push(diagnostic(`render.${uniformDiagnostic.code}`, entity));
            }
            continue;
        }
        if (seenKeys.has(input.key)) {
            diagnostics.push({
                ...diagnostic("render.runtimeUniform.duplicateKey", entity),
                runtimeUniformKey: input.key,
            });
            continue;
        }
        seenKeys.add(input.key);
        packets.push({
            uniformId: createStableRenderId(entityRef(entity)),
            entity: entityRef(entity),
            key: input.key,
            values: cloneRuntimeUniformValues(input.values),
            version: input.version ?? 0,
        });
    }
    return packets.sort((a, b) => a.key.localeCompare(b.key));
}
function runtimeUniformInput(entity) {
    return {
        key: typeof entity.getValue(RuntimeUniform, "key") === "string"
            ? entity.getValue(RuntimeUniform, "key")
            : "",
        values: runtimeUniformValues(entity.getValue(RuntimeUniform, "values")),
        version: typeof entity.getValue(RuntimeUniform, "version") === "number"
            ? entity.getValue(RuntimeUniform, "version")
            : 0,
    };
}
function runtimeUniformValues(value) {
    return isPlainObject(value) ? value : {};
}
function cloneRuntimeUniformValues(values) {
    const cloned = {};
    for (const [key, value] of Object.entries(values)) {
        cloned[key] = Array.isArray(value) ? [...value] : value;
    }
    return cloned;
}
function isPlainObject(value) {
    return (typeof value === "object" &&
        value !== null &&
        Object.getPrototypeOf(value) === Object.prototype);
}
//# sourceMappingURL=extraction-runtime-uniforms.js.map