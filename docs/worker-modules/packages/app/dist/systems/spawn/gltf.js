import { Material, patchMatcapMaterial, patchStandardMaterial, patchUnlitMaterial, replayGltfEcsAuthoringCommands, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { assetHandleKey, createMaterialHandle, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { AppEntitySource, registerApertureAppComponents, } from "../components.js";
import { formatReportDiagnostics } from "../diagnostics.js";
import { ApertureSystemError } from "../errors.js";
export function applyGltfSourceMetadata(world, scene, replay) {
    registerApertureAppComponents(world);
    for (const [entityKey, entity] of replay.entitiesByKey) {
        upsertAppEntitySource(entity, sourceFromGltfEntityKey(scene, entityKey));
    }
}
export function replayGltfLoadedScene(world, scene) {
    const replay = replayGltfEcsAuthoringCommands({
        world,
        plan: scene.commandPlan,
    });
    if (!replay.valid) {
        throw new ApertureSystemError("aperture.spawn.gltfReplayFailed", `GLTF ECS commands could not be replayed. ${formatReportDiagnostics(replay.diagnostics)}`, "Check the loaded glTF scene command plan diagnostics.");
    }
    return replay;
}
export function firstReplayRootEntity(scene, replay) {
    const rootKey = scene.commandPlan.rootEntityKeys[0];
    const root = rootKey === undefined
        ? undefined
        : (replay.entitiesByKey.get(rootKey) ??
            replay.entitiesByKey.values().next().value);
    if (root === undefined) {
        throw new ApertureSystemError("aperture.spawn.gltfRootMissing", "GLTF scene replay did not create a root entity.", "Check the loaded glTF scene traversal report.");
    }
    return root;
}
export function applyGltfMaterialOverrides(input) {
    if (!hasMaterialOverrides(input.overrides)) {
        return;
    }
    const replacements = new Map();
    for (const entity of input.replay.entitiesByKey.values()) {
        if (!entity.active || !entity.hasComponent(Material)) {
            continue;
        }
        const sourceMaterialKey = entity.getValue(Material, "materialId");
        if (typeof sourceMaterialKey !== "string" || sourceMaterialKey === "") {
            continue;
        }
        let replacementKey = replacements.get(sourceMaterialKey);
        if (replacementKey === undefined) {
            const replacement = cloneGltfMaterialForSpawn({
                registry: input.registry,
                diagnostics: input.diagnostics,
                scene: input.scene,
                sourceMaterialKey,
                overrides: input.overrides,
            });
            if (replacement === null) {
                continue;
            }
            replacementKey = replacement;
            replacements.set(sourceMaterialKey, replacementKey);
        }
        entity.setValue(Material, "materialId", replacementKey);
    }
}
function sourceFromGltfEntityKey(scene, entityKey) {
    const prefix = `${scene.assetId}:`;
    const localKey = entityKey.startsWith(prefix)
        ? entityKey.slice(prefix.length)
        : entityKey;
    if (localKey.startsWith("scene:")) {
        return {
            kind: "gltf",
            assetId: scene.assetId,
            gltfNodeIndex: -1,
            gltfNodePath: localKey,
        };
    }
    const match = /^node:(\d+)(?::mesh:(\d+):primitive:(\d+))?$/u.exec(localKey);
    if (match !== null) {
        const nodeIndex = Number(match[1]);
        const meshIndex = match[2] === undefined ? null : Number(match[2]);
        const primitiveIndex = match[3] === undefined ? null : Number(match[3]);
        return {
            kind: "gltf",
            assetId: scene.assetId,
            gltfNodeIndex: nodeIndex,
            gltfNodePath: meshIndex === null || primitiveIndex === null
                ? `nodes[${nodeIndex}]`
                : `nodes[${nodeIndex}].mesh[${meshIndex}].primitives[${primitiveIndex}]`,
        };
    }
    return {
        kind: "gltf",
        assetId: scene.assetId,
        gltfNodeIndex: -1,
        gltfNodePath: localKey,
    };
}
function hasMaterialOverrides(overrides) {
    return (overrides !== undefined &&
        Object.values(overrides).some((value) => value !== undefined));
}
function cloneGltfMaterialForSpawn(input) {
    const sourceHandle = materialHandleFromKey(input.sourceMaterialKey);
    const sourceEntry = input.registry.get(sourceHandle);
    if (sourceEntry?.status !== "ready" || sourceEntry.asset === null) {
        input.diagnostics.warn("aperture.spawn.gltfMaterialOverrideSkipped", {
            assetId: input.scene.assetId,
            sourceMaterialKey: input.sourceMaterialKey,
            reason: "source-material-not-ready",
        });
        return null;
    }
    const patched = patchMaterialAsset(sourceEntry.asset, input.overrides);
    if (patched === null) {
        input.diagnostics.warn("aperture.spawn.gltfMaterialOverrideSkipped", {
            assetId: input.scene.assetId,
            sourceMaterialKey: input.sourceMaterialKey,
            kind: builtInMaterialKind(sourceEntry.asset) ?? "custom-wgsl",
            reason: "unsupported-material-kind",
        });
        return null;
    }
    const replacementHandle = createMaterialHandle([
        materialIdFromHandleKey(input.sourceMaterialKey),
        "override",
        materialOverrideKey(input.overrides),
    ].join(":"));
    if (!input.registry.has(replacementHandle)) {
        input.registry.register(replacementHandle, {
            label: `${sourceEntry.label} (spawn override)`,
            dependencies: sourceEntry.dependencies,
            diagnostics: sourceEntry.diagnostics,
        });
    }
    input.registry.markReady(replacementHandle, patched, sourceEntry.diagnostics);
    return assetHandleKey(replacementHandle);
}
function patchMaterialAsset(material, overrides) {
    switch (builtInMaterialKind(material)) {
        case "standard":
            return patchStandardMaterial(material, overrides);
        case "unlit":
            return patchUnlitMaterial(material, overrides);
        case "matcap":
            return patchMatcapMaterial(material, overrides);
        default:
            return null;
    }
}
function builtInMaterialKind(material) {
    const kind = material.kind;
    return kind === "standard" ||
        kind === "unlit" ||
        kind === "matcap" ||
        kind === "debug-normal"
        ? kind
        : null;
}
function materialHandleFromKey(handleKey) {
    return createMaterialHandle(materialIdFromHandleKey(handleKey));
}
function materialIdFromHandleKey(handleKey) {
    const prefix = "material:";
    return handleKey.startsWith(prefix)
        ? handleKey.slice(prefix.length)
        : handleKey;
}
function materialOverrideKey(overrides) {
    return hashString(JSON.stringify(overrides));
}
function hashString(value) {
    let hash = 5381;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 33) ^ value.charCodeAt(index);
    }
    return (hash >>> 0).toString(36);
}
function upsertAppEntitySource(entity, value) {
    if (entity.hasComponent(AppEntitySource)) {
        entity.setValue(AppEntitySource, "kind", value.kind);
        entity.setValue(AppEntitySource, "assetId", value.assetId);
        entity.setValue(AppEntitySource, "gltfNodeIndex", value.gltfNodeIndex);
        entity.setValue(AppEntitySource, "gltfNodePath", value.gltfNodePath);
        return;
    }
    entity.addComponent(AppEntitySource, value);
}
//# sourceMappingURL=gltf.js.map