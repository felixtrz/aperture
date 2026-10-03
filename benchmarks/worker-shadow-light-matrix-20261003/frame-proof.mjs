import { SIZE } from "./contract.mjs";
export { inspectConsumedSnapshot } from "../crane-live-edits-20261003/author-a/post-author-byte-diagnostic/frame-proof.mjs";

// Same crane production-completion gate, adapted to the frozen 512-square
// viewport and strengthened with the actual main-thread reception and ack.
export function inspectFrameCorrespondence(
  state,
  revision,
  published,
  received,
  completed,
  ack,
) {
  if (!completed)
    return { ok: false, reason: "No observed native render completion" };
  const { frame, snapshot } = completed,
    evidence = published.get(frame.frame),
    reception = received.get(frame.frame);
  const gates = {
    evidencePresent: !!evidence,
    stateMatches: evidence?.stateId === state.id,
    revisionMatches: evidence?.revision === revision,
    nativeFrameMatchesWorkerPublication:
      evidence?.snapshotFrame === frame.frame,
    originalWorkerSnapshotFrameMatches:
      evidence?.snapshotFrameField === frame.frame,
    nativeFrameMatchesReceived:
      reception?.frame === frame.frame &&
      reception?.snapshotFrame === frame.frame,
    nativeFrameMatchesRenderedSnapshot: snapshot.frame === frame.frame,
    receivedStateMatches:
      reception?.stateId === state.id && reception?.revision === revision,
    sourceVersionMatches:
      evidence?.assetVersion === state.version &&
      reception?.assetVersion === state.version,
    deterministicStepAcknowledged:
      ack?.ok === true &&
      ack.requestId === `matrix-${revision}` &&
      ack.result?.frame === frame.frame + 1,
    nativeReportOk: frame.ok === true,
    nativeDrawsPositive: frame.counts?.drawCalls > 0,
    nativeSwapchainSubmitted:
      frame.renderTargets?.some(
        (target) =>
          target.source === "swapchain" &&
          target.ok &&
          target.drawCalls > 0 &&
          target.width === SIZE &&
          target.height === SIZE,
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
