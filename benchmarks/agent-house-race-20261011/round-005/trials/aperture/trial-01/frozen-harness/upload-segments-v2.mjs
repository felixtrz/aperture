/** Self-contained so the observer's pre-boot classic script can inject it. */
export function rewriteRetainedSegmentsV2(
  segments,
  offset,
  bytes,
  retainedBytes,
  limit,
  segmentBudget = {
    retainedSegments: segments.length,
    total: 10000,
    perBuffer: 1000,
  },
) {
  if (
    !(bytes instanceof Uint8Array) ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(offset + bytes.length) ||
    !Number.isSafeInteger(retainedBytes) ||
    retainedBytes < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 0
  )
    throw new Error("Invalid capture byte accounting");
  const end = offset + bytes.length;
  let overlap = 0;
  for (const segment of segments) {
    const start = segment.offset,
      finish = start + segment.bytes.length;
    overlap += Math.max(0, Math.min(end, finish) - Math.max(offset, start));
  }
  const desired = retainedBytes - overlap + bytes.length;
  if (overlap > retainedBytes || !Number.isSafeInteger(desired))
    throw new Error("Capture retained-byte accounting drift");
  const next = [];
  let resultingSegments = 0;
  for (const segment of segments) {
    const start = segment.offset,
      finish = start + segment.bytes.length;
    resultingSegments +=
      finish <= offset || start >= end
        ? 1
        : (start < offset ? 1 : 0) + (finish > end ? 1 : 0);
  }
  if (bytes.length) resultingSegments++;
  const segmentsFit =
    resultingSegments <= segmentBudget.perBuffer &&
    segmentBudget.retainedSegments - segments.length + resultingSegments <=
      segmentBudget.total;
  const ok = desired <= limit && segmentsFit;
  let droppedBytes = 0;
  for (const segment of segments) {
    const start = segment.offset,
      finish = start + segment.bytes.length;
    if (finish <= offset || start >= end) {
      next.push(segment);
      continue;
    }
    if (!segmentsFit) {
      droppedBytes += segment.bytes.length;
      continue;
    }
    droppedBytes += Math.max(
      0,
      Math.min(end, finish) - Math.max(offset, start),
    );
    if (start < offset)
      next.push({
        offset: start,
        bytes: segment.bytes.slice(0, offset - start),
      });
    if (finish > end)
      next.push({ offset: end, bytes: segment.bytes.slice(end - start) });
  }
  // On failure discard any now-stale overlapped bytes. The observer permanently
  // records incomplete capture; a later exact-looking old span cannot prove it.
  if (ok && bytes.length) next.push({ offset, bytes: bytes.slice() });
  next.sort((a, b) => a.offset - b.offset);
  return {
    ok,
    segments: next,
    retainedBytes: ok ? desired : retainedBytes - droppedBytes,
    missing: ok
      ? null
      : {
          offset,
          bytes: bytes.length,
          discardedCaptureBytes: droppedBytes,
          reason: segmentsFit
            ? "native-capture-byte-budget-exceeded"
            : "native-capture-segment-budget-exceeded",
        },
  };
}
