export const SCHEMA = "aperture.sideband-native.v1";
export const SESSIONS = ["before-poll", "late-delivery", "cold-changed"];
export const SIZE = 1024;
export const READY = "__SIDEBAND_NATIVE_READY__";
export const ENGINE_SOURCE = "d0333acdd4443ed9a4a0239d24184755b812b447";
export const STATES = {
  "before-poll": [
    { id: "baseline", frame: 1, mirrorVersion: 1, geometry: "baseline" },
    { id: "changed", frame: 2, mirrorVersion: 2, geometry: "changed" },
  ],
  "late-delivery": [
    { id: "baseline", frame: 1, mirrorVersion: 1, geometry: "baseline" },
    { id: "early", frame: 2, mirrorVersion: 1, geometry: "baseline" },
    { id: "converged", frame: 3, mirrorVersion: 2, geometry: "changed" },
  ],
  "cold-changed": [
    { id: "changed", frame: 2, mirrorVersion: 1, geometry: "changed" },
  ],
};
export function requireValue(value, message) {
  if (!value) throw Error(message);
}
export function statesFor(session) {
  requireValue(SESSIONS.includes(session), "Unknown bounded session");
  return STATES[session];
}
export function jsonValue(value) {
  return JSON.parse(
    JSON.stringify(value, (_, v) =>
      ArrayBuffer.isView(v) ? Array.from(v) : v,
    ),
  );
}
export function meshBytes(mesh) {
  const bytes = (view) =>
    Array.from(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return {
    label: mesh.label,
    vertices: mesh.vertexStreams.map((stream) => ({
      id: stream.id,
      arrayStride: stream.arrayStride,
      vertexCount: stream.vertexCount,
      bytes: bytes(stream.data),
    })),
    index: {
      format: mesh.indexBuffer.format,
      bytes: bytes(mesh.indexBuffer.data),
    },
    submeshes: jsonValue(mesh.submeshes),
  };
}
