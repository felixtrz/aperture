import { assetHandleKey, createAssetHandle, } from "@aperture-engine/simulation";
export function createSnapshotPacketRegistry(options = {}) {
    const strings = Array.from(options.strings ?? []);
    const stringIds = new Map();
    strings.forEach((value, index) => {
        stringIds.set(value, index + 1);
    });
    const handles = Array.from(options.handles ?? []);
    const handleIds = new Map();
    handles.forEach((handle, index) => {
        handleIds.set(serializedHandleKey(handle), index + 1);
    });
    return {
        strings,
        handles,
        stringId(value) {
            const existing = stringIds.get(value);
            if (existing !== undefined) {
                return existing;
            }
            const id = strings.length + 1;
            strings.push(value);
            stringIds.set(value, id);
            return id;
        },
        stringValue(id) {
            if (id <= 0 || id > strings.length) {
                throw new RangeError(`Unknown snapshot packet string id '${id}'.`);
            }
            return strings[id - 1] ?? "";
        },
        handleId(handle) {
            if (handle === null) {
                return 0;
            }
            const key = assetHandleKey(handle);
            const existing = handleIds.get(key);
            if (existing !== undefined) {
                return existing;
            }
            const id = handles.length + 1;
            handles.push({ kind: handle.kind, id: handle.id });
            handleIds.set(key, id);
            return id;
        },
        handleValue(id) {
            if (id === 0) {
                return null;
            }
            if (id < 0 || id > handles.length) {
                throw new RangeError(`Unknown snapshot packet handle id '${id}'.`);
            }
            const handle = handles[id - 1];
            if (handle === undefined) {
                throw new RangeError(`Unknown snapshot packet handle id '${id}'.`);
            }
            return createAssetHandle(handle.kind, handle.id);
        },
        snapshot() {
            return {
                strings: Array.from(strings),
                handles: handles.map((handle) => ({
                    kind: handle.kind,
                    id: handle.id,
                })),
            };
        },
    };
}
function serializedHandleKey(handle) {
    return `${handle.kind}:${handle.id}`;
}
//# sourceMappingURL=snapshot-packed-registry.js.map