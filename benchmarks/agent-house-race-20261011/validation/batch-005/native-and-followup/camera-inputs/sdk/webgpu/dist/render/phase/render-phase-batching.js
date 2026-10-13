export function createRenderPhaseBatchRunScratch() {
    return {
        runs: [],
        misses: [],
    };
}
export function writeRenderPhaseBatchRuns(records, scratch, options) {
    scratch.runs.length = 0;
    scratch.misses.length = 0;
    const minRunLength = options.minRunLength ?? 2;
    const includeRecords = options.includeRecords !== false;
    let runStart = 0;
    while (runStart < records.length) {
        const first = records[runStart];
        if (first === undefined ||
            options.eligibleForRecord?.(first, runStart) === false) {
            pushMiss(records, scratch, "ineligible", runStart, runStart + 1);
            runStart += 1;
            continue;
        }
        const key = options.keyForRecord(first, runStart);
        let runEnd = runStart + 1;
        while (runEnd < records.length) {
            const next = records[runEnd];
            if (next === undefined ||
                options.eligibleForRecord?.(next, runEnd) === false ||
                options.keyForRecord(next, runEnd) !== key) {
                break;
            }
            runEnd += 1;
        }
        if (runEnd - runStart >= minRunLength) {
            scratch.runs.push({
                key,
                start: runStart,
                end: runEnd,
                count: runEnd - runStart,
                records: includeRecords ? records.slice(runStart, runEnd) : [],
            });
        }
        else {
            pushMiss(records, scratch, "singleton", runStart, runEnd, includeRecords);
        }
        runStart = runEnd;
    }
    return scratch;
}
export function createRenderPhaseBatchKey(input) {
    let key = "";
    key = appendBatchKeyPart(key, "phase", input.phase);
    key = appendBatchKeyPart(key, "pass", input.passKey);
    key = appendBatchKeyPart(key, "pipeline", input.pipelineKey);
    key = appendBatchKeyPart(key, "mesh", input.meshResourceKey);
    key = appendBatchKeyPart(key, "material", input.materialResourceKey);
    key = appendBatchKeyPart(key, "material-params", input.materialParameterKey);
    key = appendBatchKeyPart(key, "layout", input.meshLayoutKey);
    key = appendBatchKeyPart(key, "topology", input.topology);
    key = appendBatchKeyPart(key, "vertex-buffers", input.vertexBufferKeys);
    key = appendBatchKeyPart(key, "index-buffer", input.indexBufferKey);
    key = appendBatchKeyPart(key, "index-format", input.indexFormat);
    key = appendBatchKeyPart(key, "bind-groups", input.bindGroupKeys);
    key = appendBatchKeyPart(key, "submesh", input.submesh);
    key = appendBatchKeyPart(key, "vertex-start", input.vertexStart);
    key = appendBatchKeyPart(key, "vertex-count", input.vertexCount);
    key = appendBatchKeyPart(key, "index-start", input.indexStart);
    key = appendBatchKeyPart(key, "index-count", input.indexCount);
    key = appendBatchKeyPart(key, "cull", input.cullMode);
    key = appendBatchKeyPart(key, "layer", input.layerMask);
    key = appendBatchKeyPart(key, "light-mask", input.lightMask);
    key = appendBatchKeyPart(key, "alpha", input.materialAlphaMode);
    key = appendBatchKeyPart(key, "receives-shadow", input.receivesShadow);
    key = appendBatchKeyPart(key, "negative-scale", input.negativeScale);
    key = appendBatchKeyPart(key, "culling-group", input.cullingGroupKey);
    if (input.extra !== undefined) {
        for (let index = 0; index < input.extra.length; index += 1) {
            key = appendBatchKeyPart(key, `extra-${index}`, input.extra[index]);
        }
    }
    return key;
}
function pushMiss(records, scratch, reason, start, end, includeRecords = true) {
    scratch.misses.push({
        reason,
        start,
        end,
        count: end - start,
        records: includeRecords ? records.slice(start, end) : [],
    });
}
function appendBatchKeyPart(key, name, value) {
    return `${key}${name}=${encodeBatchValue(value)};`;
}
function encodeBatchValue(value) {
    if (isStringArray(value)) {
        let encoded = `a${value.length}[`;
        for (let index = 0; index < value.length; index += 1) {
            encoded += encodeScalarBatchValue(value[index]);
        }
        return `${encoded}]`;
    }
    return encodeScalarBatchValue(value);
}
function isStringArray(value) {
    return Array.isArray(value);
}
function encodeScalarBatchValue(value) {
    if (value === undefined)
        return "u";
    if (value === null)
        return "n";
    switch (typeof value) {
        case "boolean":
            return value ? "b1" : "b0";
        case "number": {
            const numberValue = String(value);
            return `d${numberValue.length}:${numberValue}`;
        }
        case "string":
        default:
            return `s${String(value).length}:${String(value)}`;
    }
}
//# sourceMappingURL=render-phase-batching.js.map