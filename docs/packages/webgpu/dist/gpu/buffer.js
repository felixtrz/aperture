export function createWebGpuBuffer(options) {
    const { descriptor, device } = options;
    if (!Number.isFinite(descriptor.size) || descriptor.size <= 0) {
        return failure("invalid-size", "WebGPU buffer size must be a positive finite number.");
    }
    if (descriptor.initialData !== undefined) {
        if (descriptor.initialData.byteLength === 0) {
            return failure("empty-initial-data", "WebGPU buffer initial data must not be zero length.");
        }
        if (descriptor.initialData.byteLength > descriptor.size) {
            return failure("invalid-size", "WebGPU buffer initial data cannot exceed buffer size.");
        }
        if (device.queue?.writeBuffer === undefined) {
            return failure("queue-write-buffer-unavailable", "WebGPU buffer initial data requires queue.writeBuffer.");
        }
    }
    if (device.createBuffer === undefined) {
        return failure("create-buffer-unavailable", "WebGPU device cannot create buffers.");
    }
    const buffer = device.createBuffer(createDescriptor(descriptor));
    if (descriptor.initialData !== undefined) {
        const upload = createInitialDataUpload(descriptor.initialData);
        device.queue?.writeBuffer?.(buffer, 0, upload.data, upload.dataOffset, upload.size);
    }
    return { ok: true, buffer };
}
export function writeWebGpuBufferData(device, buffer, data) {
    if (data.byteLength === 0) {
        return true;
    }
    if (device.queue?.writeBuffer === undefined) {
        return false;
    }
    const upload = createInitialDataUpload(data);
    device.queue.writeBuffer(buffer, 0, upload.data, upload.dataOffset, upload.size);
    return true;
}
export function writeWebGpuBufferSubData(device, buffer, data, range) {
    if (range.byteLength === 0) {
        return true;
    }
    if (range.bufferOffset < 0 ||
        range.dataByteOffset < 0 ||
        range.byteLength < 0 ||
        range.dataByteOffset + range.byteLength > data.byteLength ||
        range.bufferOffset % 4 !== 0) {
        return false;
    }
    if (device.queue?.writeBuffer === undefined) {
        return false;
    }
    const sourceByteOffset = data.byteOffset + range.dataByteOffset;
    const size = alignTo4(range.byteLength);
    if (size === range.byteLength && sourceByteOffset % 4 === 0) {
        device.queue.writeBuffer(buffer, range.bufferOffset, data.buffer, sourceByteOffset, size);
        return true;
    }
    const padded = new Uint8Array(size);
    padded.set(new Uint8Array(data.buffer, sourceByteOffset, range.byteLength), 0);
    device.queue.writeBuffer(buffer, range.bufferOffset, padded.buffer, 0, size);
    return true;
}
export function destroyWebGpuBuffer(buffer) {
    if (typeof buffer !== "object" || buffer === null) {
        return;
    }
    const destroy = buffer.destroy;
    if (typeof destroy === "function") {
        destroy.call(buffer);
    }
}
export function retireWebGpuBuffer(device, buffer) {
    const onSubmittedWorkDone = typeof device === "object" && device !== null
        ? device.queue?.onSubmittedWorkDone
        : undefined;
    if (typeof onSubmittedWorkDone !== "function") {
        destroyWebGpuBuffer(buffer);
        return;
    }
    try {
        onSubmittedWorkDone
            .call(device.queue)
            .then(() => destroyWebGpuBuffer(buffer), () => destroyWebGpuBuffer(buffer));
    }
    catch {
        destroyWebGpuBuffer(buffer);
    }
}
function createDescriptor(descriptor) {
    const result = {
        size: alignTo4(descriptor.size),
        usage: descriptor.usage,
        mappedAtCreation: descriptor.mappedAtCreation ?? false,
    };
    if (descriptor.label !== undefined) {
        return { ...result, label: descriptor.label };
    }
    return result;
}
function createInitialDataUpload(data) {
    const size = alignTo4(data.byteLength);
    if (size === data.byteLength) {
        return {
            data: data.buffer,
            dataOffset: data.byteOffset,
            size,
        };
    }
    const padded = new Uint8Array(size);
    padded.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    return {
        data: padded.buffer,
        dataOffset: 0,
        size,
    };
}
function alignTo4(value) {
    return Math.ceil(value / 4) * 4;
}
function failure(reason, message) {
    return { ok: false, reason, message };
}
//# sourceMappingURL=buffer.js.map