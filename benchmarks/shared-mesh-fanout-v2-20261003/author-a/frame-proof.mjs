/** Pure checks joining actual worker publication to actual renderer completion. */
export function inspectFrameCorrespondence(state, published, completed) {
  if (!completed)
    return {
      ok: false,
      reason: "No observed native renderSnapshot completion",
    };
  const { frame, snapshot } = completed,
    evidence = published.get(frame.frame);
  const gates = {
    evidencePresent: !!evidence,
    stateMatches: evidence?.stateId === state.id,
    revisionMatches: evidence?.revision === state.index + 1,
    nativeFrameMatchesWorkerPublication:
      evidence?.snapshotFrame === frame.frame,
    nativeFrameMatchesRenderedSnapshot: snapshot.frame === frame.frame,
    originalWorkerSnapshotFrameMatches:
      evidence?.snapshotFrameField === frame.frame,
    nativeReportOk: frame.ok === true,
    nativeDrawsPositive: frame.counts?.drawCalls > 0,
    nativeSwapchainSubmitted:
      frame.renderTargets?.some(
        (target) =>
          target.source === "swapchain" &&
          target.ok &&
          target.drawCalls > 0 &&
          target.width === 1024 &&
          target.height === 1024,
      ) ?? false,
  };
  return {
    ok: Object.values(gates).every(Boolean),
    gates,
    nativeFrame: frame.frame,
    stateId: evidence?.stateId ?? null,
    revision: evidence?.revision ?? null,
  };
}
export function inspectConsumedSnapshot(meshes, snapshot) {
  const checks = [];
  for (const mesh of meshes) {
    const packets = snapshot.meshDraws.filter(
      (packet) =>
        `${packet.entity.index}:${packet.entity.generation}` ===
          mesh.entityId && packet.mesh.id === mesh.meshId,
    );
    checks.push({
      name: `${mesh.name}:actual-renderer-snapshot-entity-and-mesh`,
      ok: packets.length === 1,
    });
    for (const packet of packets) {
      checks.push({
        name: `${mesh.name}:actual-material-handle`,
        ok: packet.material.id === mesh.materialId,
      });
      const actual = snapshot.transforms.slice(
        packet.worldTransformOffset,
        packet.worldTransformOffset + 16,
      );
      checks.push({
        name: `${mesh.name}:actual-renderer-world-matrix`,
        ok: JSON.stringify(actual) === JSON.stringify(mesh.worldMatrix),
        renderId: packet.renderId,
        actual,
      });
    }
  }
  return checks;
}
