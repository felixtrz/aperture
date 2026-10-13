import { collectSubmittedStaticGeometry, } from "./rendered-geometry-submission.js";
/** Own packet/slot metadata before the frame-plan scratch is reused or awaited. */
export function createRenderedGeometrySubmissionRecipe(inspector, snapshot, framePlan) {
    const ids = new Set(snapshot.meshDraws.map((packet) => packet.renderId));
    if (framePlan === undefined)
        return {
            capture(commands, viewId, targetKey) {
                return collectSubmittedStaticGeometry({
                    commands,
                    viewId,
                    targetKey,
                    meshRenderIds: ids,
                    draws: new Map(),
                    transforms: new Map(),
                });
            },
        };
    const descriptors = new Map(framePlan.drawCommands.descriptors.map((entry) => [
        entry.renderId,
        { ...entry },
    ]));
    const packageBindings = new Map();
    const pools = new Map();
    for (const pkg of framePlan.packages.packages) {
        const descriptor = descriptors.get(pkg.renderId);
        if (descriptor === undefined)
            continue;
        const binding = {
            renderId: pkg.renderId,
            entity: { ...pkg.packet.entity },
            meshKey: descriptor.meshResourceKey,
            positionBufferKey: "",
            worldTransformBindGroupKey: "",
            sourceVertexCount: descriptor.vertexCount,
            submesh: pkg.packet.submesh,
            materialSlot: pkg.packet.materialSlot,
            topology: descriptor.topology,
            skinned: pkg.batchKey.skinned ||
                pkg.packet.boneMatrixOffset !== undefined ||
                descriptor.pipelineKey.split("|").includes("skinned"),
            morphed: pkg.batchKey.morphed ||
                pkg.packet.morphDeltaOffset !== undefined ||
                descriptor.pipelineKey.split("|").includes("morphed"),
        };
        packageBindings.set(pkg.renderId, { descriptor, binding });
        const key = batchKey(descriptor, pkg);
        let slots = pools.get(key);
        if (slots === undefined) {
            slots = new Map();
            pools.set(key, slots);
        }
        slots.set(descriptor.transformPackedOffset / 16, binding);
    }
    const packages = new Map(framePlan.packages.packages.map((entry) => [entry.renderId, entry]));
    const recipes = framePlan.resources.draws.flatMap((draw) => {
        const entry = packageBindings.get(draw.renderId);
        const pkg = packages.get(draw.renderId);
        const group = draw.bindGroups.find((candidate) => candidate.group === 1);
        if (entry === undefined || pkg === undefined || group === undefined)
            return [];
        return [
            {
                entry,
                slots: pools.get(batchKey(entry.descriptor, pkg)),
                group: { ...group },
                // Command generation binds this exact resource order by slot index.
                vertexBuffers: draw.vertexBuffers.map((buffer, slot) => ({
                    ...buffer,
                    slot,
                })),
            },
        ];
    });
    return {
        capture(commands, viewId, targetKey) {
            const draws = new Map();
            const transforms = new Map();
            const poolsByGroup = new Map();
            for (const recipe of recipes) {
                const mesh = inspector.meshBinding(recipe.entry.binding.meshKey);
                const world = inspector.worldBinding(recipe.group.bindGroup);
                const position = recipe.vertexBuffers.find((buffer) => buffer.resourceKey === mesh?.positionBufferKey &&
                    buffer.buffer === mesh.positionBuffer);
                if (mesh === null ||
                    world === null ||
                    position === undefined ||
                    (recipe.entry.descriptor.worldTransformResourceKey !== undefined &&
                        recipe.entry.descriptor.worldTransformResourceKey !==
                            world.resourceKey))
                    continue;
                const binding = {
                    ...recipe.entry.binding,
                    positionBufferKey: mesh.positionBufferKey,
                    positionBufferSlot: position.slot,
                    positionBuffer: mesh.positionBuffer,
                    indexBuffer: mesh.indexBuffer,
                    worldTransformBindGroupKey: recipe.group.resourceKey,
                    worldTransformBindGroup: recipe.group.bindGroup,
                };
                draws.set(binding.renderId, binding);
                // Different geometry pools can use the same world bind group. Merge
                // their slot identities; the command collector also checks mesh/range
                // compatibility before retaining a complete instance window.
                let slotsByRenderId = poolsByGroup.get(recipe.group.resourceKey);
                if (slotsByRenderId === undefined) {
                    slotsByRenderId = new Map();
                    poolsByGroup.set(recipe.group.resourceKey, slotsByRenderId);
                }
                slotsByRenderId.set(binding.renderId, recipe.slots);
                transforms.set(recipe.group.resourceKey, {
                    matrices: world.matrices,
                    slots: new Map(),
                    slotsByRenderId,
                });
            }
            return collectSubmittedStaticGeometry({
                commands: commands.map((command) => inspector.indirectCommand(command)),
                viewId,
                targetKey,
                meshRenderIds: ids,
                draws,
                transforms,
            });
        },
    };
}
function batchKey(descriptor, pkg) {
    return JSON.stringify([
        descriptor.meshResourceKey,
        descriptor.materialResourceKey,
        descriptor.worldTransformResourceKey ?? null,
        pkg.packet.submesh,
        pkg.packet.materialSlot,
        descriptor.vertexStart ?? 0,
        descriptor.vertexCount,
        descriptor.indexStart ?? 0,
        descriptor.indexCount,
    ]);
}
/** Record immediately after the exact scene queue submit, before any readback. */
export function recordRenderedGeometrySceneSubmission(input) {
    if (input.frame === undefined)
        return;
    if (!input.submitted) {
        input.frame.failedTarget(`Scene view ${input.viewId} on ${input.targetKey} did not complete a successful submission.`);
        return;
    }
    if (!input.encoded) {
        input.frame.submitted({
            draws: [],
            omissions: [
                {
                    reason: "submission-failed",
                    message: `Submitted scene view ${input.viewId} on ${input.targetKey} could not verify all encoded geometry.`,
                },
            ],
        });
        return;
    }
    const data = input.unsupportedRoute === undefined
        ? input.recipe?.capture(input.commands, input.viewId, input.targetKey)
        : undefined;
    input.frame.submitted({
        draws: data?.draws ?? [],
        omissions: data?.omissions ?? [],
        ...(input.unsupportedRoute === undefined
            ? {}
            : { unsupportedRoute: input.unsupportedRoute }),
        ...(data === undefined && input.unsupportedRoute === undefined
            ? { unsupportedRoute: "unsupported-route" }
            : {}),
    });
}
/** All scene views encoded into one accepted FrameGraph command buffer. */
export function recordRenderedGeometrySceneSubmissionBatch(input) {
    if (input.frame === undefined)
        return;
    if (!input.submitted) {
        input.frame.failedTarget("The scene FrameGraph command buffer was not submitted successfully.");
        return;
    }
    const draws = [];
    const omissions = [];
    for (const view of input.views) {
        if (!view.encoded) {
            omissions.push({
                reason: "submission-failed",
                message: `Submitted view ${view.viewId} on ${view.targetKey} has unverified encoded geometry.`,
            });
            continue;
        }
        const captured = input.unsupportedRoute === undefined
            ? input.recipe?.capture(view.commands, view.viewId, view.targetKey)
            : undefined;
        draws.push(...(captured?.draws ?? []));
        omissions.push(...(captured?.omissions ?? []));
    }
    input.frame.submitted({
        draws,
        omissions,
        ...(input.unsupportedRoute === undefined
            ? {}
            : { unsupportedRoute: input.unsupportedRoute }),
        ...(input.recipe === undefined && input.unsupportedRoute === undefined
            ? { unsupportedRoute: "unsupported-route" }
            : {}),
    });
}
//# sourceMappingURL=rendered-geometry-frame.js.map