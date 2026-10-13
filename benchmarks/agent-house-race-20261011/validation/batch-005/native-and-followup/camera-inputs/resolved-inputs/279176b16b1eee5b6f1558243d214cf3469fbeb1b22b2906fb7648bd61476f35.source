import { fetchBytes } from "./gltf-uri-fetch-bytes.js";
export async function fetchDeduplicatedExternalBytes(input) {
    const candidatesByUrl = new Map();
    for (const candidate of input.candidates) {
        const existing = candidatesByUrl.get(candidate.url);
        if (existing === undefined) {
            candidatesByUrl.set(candidate.url, [candidate]);
        }
        else {
            existing.push(candidate);
        }
    }
    const resultGroups = await Promise.all([...candidatesByUrl.entries()].map(async ([url, candidates]) => {
        const first = candidates[0];
        if (first === undefined) {
            return [];
        }
        const fetched = await fetchBytes({
            url,
            fetcher: input.fetcher,
            context: input.context,
            ...(input.cache === undefined ? {} : { cache: input.cache }),
            ...fetchIndexField(input.context, first.index),
        });
        if (!fetched.ok) {
            return candidates.map((candidate) => ({
                index: candidate.index,
                diagnostic: diagnosticForExternalFetchIndex(fetched.diagnostic, input.context, candidate.index),
            }));
        }
        return candidates.map((candidate) => ({
            index: candidate.index,
            bytes: fetched.bytes,
        }));
    }));
    return resultGroups.flat();
}
function fetchIndexField(context, index) {
    return context === "buffer" ? { bufferIndex: index } : { imageIndex: index };
}
function diagnosticForExternalFetchIndex(diagnostic, context, index) {
    return {
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
        ...(diagnostic.status === undefined ? {} : { status: diagnostic.status }),
        ...(diagnostic.statusText === undefined
            ? {}
            : { statusText: diagnostic.statusText }),
        ...(diagnostic.uri === undefined ? {} : { uri: diagnostic.uri }),
        ...(diagnostic.loaderCode === undefined
            ? {}
            : { loaderCode: diagnostic.loaderCode }),
        ...fetchIndexField(context, index),
    };
}
//# sourceMappingURL=gltf-uri-external-fetch-dedupe.js.map