export function inspectStructuredCloneSnapshot(snapshot) {
  return {
    transforms: snapshot?.transforms instanceof Float32Array,
    viewMatrices: snapshot?.viewMatrices instanceof Float32Array,
    viewsArray: Array.isArray(snapshot?.views),
    meshDrawsArray: Array.isArray(snapshot?.meshDraws),
    diagnosticsArray: Array.isArray(snapshot?.diagnostics),
  };
}
