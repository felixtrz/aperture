// CPU-only mock copied verbatim from pinned test/webgpu/webgpu-app.test.ts and transpiled with installed TypeScript.
export function webGpuHarness(events, options = {}) {
    let timestamp = 1000n;
    const supportedFeatures = new Set(options.features ?? []);
    const device = {
        features: {
            has: (feature) => (feature === "timestamp-query" && options.timestampQuery === true) ||
                supportedFeatures.has(feature),
        },
        queue: {
            writeBuffer: (buffer) => {
                events.push(`queue:writeBuffer:${bufferLabel(buffer)}`);
            },
            writeTexture: (destination, data, layout, size) => {
                void destination;
                void layout;
                void size;
                events.push(`queue:writeTexture:${data.byteLength}`);
            },
            submit: (buffers) => {
                events.push(`queue:submit:${buffers.length}`);
            },
            onSubmittedWorkDone: async () => {
                events.push("queue:done");
            },
        },
        lost: new Promise(() => { }),
        createShaderModule: (descriptor) => {
            events.push("device:shader");
            return { descriptor, compilationInfo: async () => ({ messages: [] }) };
        },
        createBindGroupLayout: (descriptor) => {
            events.push("device:bindGroupLayout");
            return { descriptor };
        },
        createPipelineLayout: (descriptor) => {
            events.push("device:pipelineLayout");
            return { descriptor };
        },
        createRenderPipeline: (descriptor) => {
            events.push(`device:pipeline:${descriptor.label ?? "unlabeled"}`);
            return {
                descriptor,
                getBindGroupLayout: (group) => ({ group }),
            };
        },
        createQuerySet: (descriptor) => {
            events.push(`device:querySet:${descriptor.label ?? "unlabeled"}`);
            return {
                descriptor,
                timestamps: Array.from({ length: descriptor.count }, () => 0n),
            };
        },
        createBuffer: (descriptor) => {
            events.push(`device:buffer:${descriptor.label ?? "unlabeled"}`);
            const bytes = new ArrayBuffer(descriptor.size ?? 0);
            return {
                descriptor,
                bytes,
                mapAsync: async () => { },
                getMappedRange: (offset = 0, size = bytes.byteLength) => bytes.slice(offset, offset + size),
                unmap: () => { },
            };
        },
        createTexture: (descriptor) => {
            const label = descriptor.label ?? "unlabeled";
            events.push(`device:texture:${label}`);
            return {
                descriptor,
                createView: () => {
                    events.push(`textureResource:view:${label}`);
                    return { descriptor, label: `view:${label}` };
                },
            };
        },
        createSampler: (descriptor) => {
            events.push(`device:sampler:${descriptor.label ?? "unlabeled"}`);
            return { descriptor };
        },
        createBindGroup: (descriptor) => {
            events.push(`device:bindGroup:${descriptor.label ?? "unlabeled"}`);
            return { descriptor };
        },
        createCommandEncoder: () => {
            events.push("device:encoder");
            return {
                writeTimestamp: (querySet, queryIndex) => {
                    events.push(`encoder:timestamp:${queryIndex}`);
                    querySet.timestamps[queryIndex] = timestamp += 1000n;
                },
                beginRenderPass: () => {
                    events.push("encoder:begin");
                    return {
                        setViewport: () => { },
                        setScissorRect: () => { },
                        setPipeline: () => events.push("pass:pipeline"),
                        setBindGroup: (group) => events.push(`pass:bind:${group}`),
                        setVertexBuffer: (slot) => events.push(`pass:vertex:${slot}`),
                        setIndexBuffer: () => events.push("pass:index"),
                        draw: (vertexCount) => events.push(`pass:draw:${vertexCount}`),
                        drawIndexed: (indexCount) => events.push(`pass:drawIndexed:${indexCount}`),
                        drawIndirect: (_buffer, offset) => events.push(`pass:drawIndirect:${offset}`),
                        drawIndexedIndirect: (_buffer, offset) => events.push(`pass:drawIndexedIndirect:${offset}`),
                        end: () => events.push("pass:end"),
                    };
                },
                finish: () => {
                    events.push("encoder:finish");
                    return { commandBuffer: true };
                },
                resolveQuerySet: (querySet, firstQuery, queryCount, destination) => {
                    events.push(`encoder:resolve:${queryCount}`);
                    const timestamps = querySet
                        .timestamps;
                    const destinationValues = new BigUint64Array(destination.bytes);
                    for (let index = 0; index < queryCount; index += 1) {
                        destinationValues[index] = timestamps[firstQuery + index] ?? 0n;
                    }
                },
                copyBufferToBuffer: (source, sourceOffset, destination, destinationOffset, size) => {
                    events.push(`encoder:copyBuffer:${size}`);
                    const sourceBytes = new Uint8Array(source.bytes, sourceOffset, size);
                    const destinationBytes = new Uint8Array(destination.bytes, destinationOffset, size);
                    destinationBytes.set(sourceBytes);
                },
            };
        },
    };
    const context = {
        configure: (configuration) => events.push(`context:configure:${configuration.format}`),
        getCurrentTexture: () => ({
            createView: () => {
                events.push("texture:view");
                return { view: true };
            },
        }),
    };
    const canvas = {
        getContext: (contextId) => {
            events.push(`canvas:context:${contextId}`);
            return context;
        },
    };
    const environment = {
        navigator: {
            gpu: {
                requestAdapter: async () => ({
                    features: device.features,
                    requestDevice: async () => device,
                }),
                getPreferredCanvasFormat: () => "bgra8unorm",
            },
        },
    };
    return { canvas, environment, device };
}
function bufferLabel(buffer) {
    return (buffer.descriptor
        ?.label ?? "unlabeled");
}
