/**
 * Consume the FINAL per-view command span after layer/occlusion filtering.
 * Borrowed matrix windows are copied at the accepted submission, before any await.
 * A command's representative renderId cannot stand in for its other instances.
 */
export function collectSubmittedStaticGeometry(input) {
    const draws = [];
    const omissions = [];
    const bindGroups = new Map();
    const vertexBuffers = new Map();
    const bindGroupObjects = new Map();
    const vertexBufferObjects = new Map();
    let indexBuffer = null;
    const omit = (reason, renderId, message) => {
        omissions.push({ reason, renderId, message });
    };
    for (const command of input.commands) {
        if (command.kind === "setBindGroup") {
            bindGroups.set(command.index, command.resourceKey);
            bindGroupObjects.set(command.index, command.bindGroup);
            continue;
        }
        if (command.kind === "setVertexBuffer") {
            vertexBuffers.set(command.slot, command.resourceKey);
            vertexBufferObjects.set(command.slot, command.buffer);
            continue;
        }
        if (command.kind === "setIndexBuffer") {
            indexBuffer = command.buffer;
            continue;
        }
        if (command.kind !== "draw" &&
            command.kind !== "drawIndexed" &&
            command.kind !== "drawIndirect" &&
            command.kind !== "drawIndexedIndirect")
            continue;
        const binding = input.draws.get(command.renderId);
        if (binding === undefined) {
            if (input.meshRenderIds.has(command.renderId))
                omit("missing-upload-receipt", command.renderId, "An actual submitted mesh command has no verifiable prepared geometry binding.");
            // Sky/fullscreen and non-mesh features are outside the declared scope.
            continue;
        }
        if (command.kind === "drawIndirect" ||
            command.kind === "drawIndexedIndirect") {
            omit("unsupported-route", command.renderId, "Indirect GPU arguments are outside this static CPU receipt route.");
            continue;
        }
        if (binding.topology !== "triangle-list") {
            omit("unsupported-topology", command.renderId, "This submitted mesh is not a triangle list.");
            continue;
        }
        if (binding.skinned || binding.morphed) {
            omit(binding.skinned ? "skinned" : "morphed", command.renderId, "This submitted mesh uses GPU deformation rather than static source positions.");
            continue;
        }
        const transform = input.transforms.get(binding.worldTransformBindGroupKey);
        if (bindGroups.get(1) !== binding.worldTransformBindGroupKey ||
            vertexBuffers.get(binding.positionBufferSlot ?? 0) !==
                binding.positionBufferKey ||
            (binding.worldTransformBindGroup !== undefined &&
                bindGroupObjects.get(1) !== binding.worldTransformBindGroup) ||
            (binding.positionBuffer !== undefined &&
                vertexBufferObjects.get(binding.positionBufferSlot ?? 0) !==
                    binding.positionBuffer) ||
            (command.kind === "drawIndexed" &&
                binding.indexBuffer !== undefined &&
                indexBuffer !== binding.indexBuffer) ||
            transform === undefined ||
            !Number.isSafeInteger(command.firstInstance) ||
            command.firstInstance < 0 ||
            !Number.isSafeInteger(command.instanceCount) ||
            command.instanceCount < 0 ||
            command.instanceCount > 100_000 ||
            (command.firstInstance + command.instanceCount) * 16 >
                transform.matrices.length) {
            omit("missing-instance-binding", command.renderId, "The submitted mesh or world-transform binding is unavailable.");
            continue;
        }
        const pool = transform.slotsByRenderId?.get(command.renderId) ?? transform.slots;
        const slots = Array.from({ length: command.instanceCount }, (_, index) => pool.get(command.firstInstance + index));
        if (slots.some((slot) => slot === undefined ||
            slot.meshKey !== binding.meshKey ||
            slot.submesh !== binding.submesh ||
            slot.materialSlot !== binding.materialSlot ||
            slot.skinned ||
            slot.morphed)) {
            omit("missing-instance-binding", command.renderId, "The complete instance window could not be matched to static mesh packets.");
            continue;
        }
        const indexed = command.kind === "drawIndexed";
        draws.push({
            renderId: command.renderId,
            viewId: input.viewId,
            targetKey: input.targetKey,
            meshKey: binding.meshKey,
            submesh: binding.submesh,
            materialSlot: binding.materialSlot,
            indexed,
            firstIndex: indexed ? command.firstIndex : 0,
            indexCount: indexed ? command.indexCount : 0,
            baseVertex: indexed ? command.baseVertex : 0,
            firstVertex: indexed ? 0 : command.firstVertex,
            vertexCount: indexed ? binding.sourceVertexCount : command.vertexCount,
            firstInstance: command.firstInstance,
            instances: slots.map((slot) => ({
                renderId: slot.renderId,
                entity: slot.entity,
            })),
            worldMatrices: transform.matrices.subarray(command.firstInstance * 16, (command.firstInstance + command.instanceCount) * 16),
        });
    }
    return { draws, omissions };
}
//# sourceMappingURL=rendered-geometry-submission.js.map