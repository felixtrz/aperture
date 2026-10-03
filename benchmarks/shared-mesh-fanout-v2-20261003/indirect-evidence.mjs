/** Decode observed submit-time argument bytes. This is upload observation, never GPU readback. */
const requireValue = (value, message) => {
  if (!value) throw Error(message);
};
const uint = (n) => Number.isSafeInteger(n) && n >= 0;
export function requireSubmittedDraw(draw, commands) {
  requireValue(
    uint(draw.submissionSerial) &&
      draw.submissionSerial > 0 &&
      commands.some(
        (c) =>
          c.id === draw.commandBufferId &&
          c.encoderId === draw.commandEncoderId &&
          c.submissionSerial === draw.submissionSerial,
      ),
    "Orphan/unsubmitted exact command-buffer draw",
  );
}
function rangeCovered(ranges, start, end, allocation) {
  requireValue(Array.isArray(ranges), "Missing initialized argument ranges");
  let covered = start,
    prior = 0;
  for (const range of ranges) {
    requireValue(
      Array.isArray(range) &&
        range.length === 2 &&
        range.every(uint) &&
        range[0] >= prior &&
        range[0] < range[1] &&
        range[1] <= allocation,
      "Invalid initialized argument ranges",
    );
    const [a, b] = range;
    if (a <= covered && b > covered) covered = b;
    prior = b;
  }
  return covered >= end;
}
export function decodeSubmittedDraw(draw, commands) {
  requireSubmittedDraw(draw, commands);
  if (draw.method === "draw" || draw.method === "drawIndexed") {
    requireValue(
      !draw.indirect,
      "Direct call has unexpected indirect evidence",
    );
    return { ...draw, argumentSource: "observed-direct-call" };
  }
  requireValue(
    ["drawIndirect", "drawIndexedIndirect"].includes(draw.method),
    "Unproven draw method",
  );
  const indexed = draw.method === "drawIndexedIndirect",
    byteLength = indexed ? 20 : 16,
    indirect = draw.indirect,
    binding = indirect?.buffer,
    offset = indirect?.offset;
  requireValue(
    binding &&
      uint(binding.id) &&
      binding.id > 0 &&
      uint(binding.allocationBytes) &&
      uint(offset) &&
      offset % 4 === 0 &&
      offset + byteLength <= binding.allocationBytes,
    "Missing, misaligned or truncated indirect argument range",
  );
  const matches = draw.uploads.filter((upload) => upload.id === binding.id);
  requireValue(matches.length === 1, "Wrong exact indirect buffer object join");
  const upload = matches[0];
  requireValue(
    upload.submissionSerial === draw.submissionSerial &&
      upload.allocationBytes === binding.allocationBytes &&
      uint(upload.contentVersion) &&
      upload.contentVersion > 0 &&
      uint(upload.writeCalls) &&
      upload.writeCalls > 0 &&
      !upload.destroyed,
    "Missing exact submit-time indirect buffer version",
  );
  // Only CPU-observable INDIRECT, COPY_DST and optional COPY_SRC are supported.
  // In particular STORAGE and QUERY_RESOLVE cannot be proven from CPU intent.
  requireValue(
    uint(upload.usage) &&
      (upload.usage & 256) !== 0 &&
      (upload.usage & ~(256 | 8 | 4)) === 0,
    "Indirect argument usage is missing INDIRECT or permits unproven GPU writes",
  );
  requireValue(
    Array.isArray(upload.fullUploadBytes) &&
      upload.fullUploadBytes.length === upload.allocationBytes,
    "Missing preserved indirect argument bytes",
  );
  for (const byte of upload.fullUploadBytes)
    requireValue(
      Number.isInteger(byte) && byte >= 0 && byte <= 255,
      "Invalid preserved indirect argument byte",
    );
  requireValue(
    rangeCovered(
      upload.writtenRanges,
      offset,
      offset + byteLength,
      upload.allocationBytes,
    ),
    "Indirect argument range was not fully observed written",
  );
  requireValue(
    Array.isArray(upload.uncertainRanges) &&
      upload.uncertainRanges.every(
        (range) =>
          Array.isArray(range) &&
          range.length === 2 &&
          range.every(uint) &&
          range[0] < range[1] &&
          range[1] <= upload.allocationBytes &&
          (range[1] <= offset || range[0] >= offset + byteLength),
      ),
    "Indirect argument bytes have an unproven copy/clear/GPU mutation",
  );
  const bytes = Uint8Array.from(
      upload.fullUploadBytes.slice(offset, offset + byteLength),
    ),
    view = new DataView(bytes.buffer),
    count = view.getUint32(0, true),
    instances = view.getUint32(4, true),
    start = view.getUint32(8, true),
    firstInstance = view.getUint32(indexed ? 16 : 12, true),
    decoded = {
      count,
      instances,
      start,
      firstInstance,
      ...(indexed
        ? { firstIndex: start, baseVertex: view.getInt32(12, true) }
        : { firstVertex: start }),
    };
  requireValue(
    firstInstance === 0 || upload.indirectFirstInstanceSupported === true,
    "Nonzero indirect firstInstance lacks observed device feature",
  );
  // Never accept caller-supplied direct-call fields in place of the retained bytes.
  for (const key of [
    "count",
    "instances",
    "start",
    "firstInstance",
    "baseVertex",
  ])
    requireValue(
      !Object.hasOwn(draw, key),
      "Indirect call carries unobserved direct arguments",
    );
  return {
    ...draw,
    ...decoded,
    argumentSource: "submit-time-upload-observation",
    argumentEvidence: {
      method: draw.method,
      bufferId: binding.id,
      byteOffset: offset,
      byteLength,
      submissionSerial: draw.submissionSerial,
      commandBufferId: draw.commandBufferId,
      commandEncoderId: draw.commandEncoderId,
      contentVersion: upload.contentVersion,
      writeCalls: upload.writeCalls,
      definition:
        "Decoded preserved CPU-upload bytes at this successful submission; not GPU readback",
    },
  };
}
