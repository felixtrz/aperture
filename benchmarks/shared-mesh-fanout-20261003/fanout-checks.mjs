import {
  PIPE_PARTS,
  INSTANCE_TRANSLATIONS,
  statesFor,
  LIGHT,
} from "./contract.mjs";
import {
  nativeEvidenceBytes,
  compareNativeToSource,
} from "./author-a/native-evidence.mjs";
import { validateTopology } from "./topology.mjs";
import { classifyPass, expandNativeScope } from "./native-observer.mjs";
import { inspectConsumedSnapshot } from "./author-a/frame-proof.mjs";
const requireValue = (c, m) => {
  if (!c) throw Error(m);
};
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const isPipe = (m) => m.instance !== null;
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function validateFanoutGeometry(e, state) {
  const meshes = e.nativeGeometry.meshes,
    pipes = meshes.filter(isPipe),
    source = e.sourceGeometry;
  requireValue(
    meshes.length === 11 &&
      pipes.length === 9 &&
      new Set(meshes.map((m) => m.entityId)).size === 11,
    "Missing or duplicate persistent instances",
  );
  requireValue(
    compareNativeToSource(source, meshes).ok,
    "Authoritative source/native geometry mismatch",
  );
  const version = e.shared ? [1, 1, 2, 2, 3, 4, 5, 6][state.index] : 1;
  for (const suffix of PIPE_PARTS) {
    const partName = `pipe.hollow-elbow.${suffix}`,
      members = pipes.filter((m) => m.partName === partName);
    requireValue(
      members.length === 3 &&
        new Set(members.map((m) => m.materialId)).size === 1,
      "Missing shared corresponding material or instance",
    );
    requireValue(
      new Set(members.map((m) => m.meshId)).size === (e.shared ? 1 : 3),
      "Wrong shared mesh handle fan-out",
    );
    for (let instance = 0; instance < 3; instance++) {
      const m = members.find((m) => m.instance === instance),
        matrix = [...identity];
      matrix.splice(12, 3, ...INSTANCE_TRANSLATIONS[instance]);
      requireValue(
        m &&
          m.name === `${partName}.instance-${instance}` &&
          equal(m.worldMatrix, matrix),
        "Missing or wrong fixed instance transform",
      );
      requireValue(
        m.assetVersion === version && m.publishes === version - 1,
        "Stale second/third instance asset version",
      );
    }
  }
  requireValue(
    new Set(pipes.map((m) => m.meshId)).size === (e.shared ? 3 : 9) &&
      new Set(pipes.map((m) => m.materialId)).size === 3,
    "Wrong total mutable handle inventory",
  );
  for (let instance = 0; instance < 3; instance++) {
    const selected = pipes.filter((m) => m.instance === instance),
      parts = source.parts.filter((p) => p.instance === instance);
    validateTopology(
      "aperture",
      { ...source, parts: parts.map((p) => ({ ...p, name: p.partName })) },
      selected.map((m) => ({ ...m, name: m.partName })),
    );
  }
  for (const name of ["courtyard.slab", "prop.crate.body"]) {
    const m = meshes.find((m) => m.name === name);
    requireValue(
      m &&
        m.instance === null &&
        m.assetVersion === 1 &&
        m.publishes === 0 &&
        !pipes.some((p) => p.meshId === m.meshId),
      "Sentinel/static asset changed or shared mutable handle",
    );
  }
  const worker = e.resources.worker ?? e.resources,
    expected = (version - 1) * 3;
  requireValue(
    worker.meshAssetReplacements === expected &&
      worker.publications.length === expected,
    "Per-entity duplicate or missing publication",
  );
  requireValue(
    worker.currentMeshAssets === (e.shared ? 5 : 11),
    "Wrong unique current mesh inventory",
  );
  const seen = new Set();
  for (const p of worker.publications) {
    const key = `${p.revision}:${p.meshId}`;
    requireValue(!seen.has(key), "Per-entity duplicate publication");
    seen.add(key);
    const m = pipes.find((m) => m.meshId === p.meshId);
    requireValue(
      m && p.version > 1 && p.version <= m.assetVersion,
      "Wrong publication handle/version",
    );
  }
  if (e.shared) {
    const seq = statesFor();
    for (let i = 1; i <= state.index; i++) {
      const ps = worker.publications.filter((p) => p.revision === i + 1),
        changed = seq[i].edit !== seq[i - 1].edit;
      requireValue(
        ps.length === (changed ? 3 : 0) &&
          ps.every((p) => p.version === [1, 1, 2, 2, 3, 4, 5, 6][i]),
        "Wrong per-transition publication cardinality/version",
      );
    }
  }
  return true;
}
export function validateMirrorAndSnapshot(e, receipt) {
  const {
    meshes,
    mirroredAssets,
    actualSubmittedSnapshot: snapshot,
  } = e.nativeGeometry;
  requireValue(
    snapshot?.frame === receipt.nativeFrame &&
      snapshot.meshDraws?.length === 11,
    "Wrong consumed native frame/inventory",
  );
  requireValue(
    inspectConsumedSnapshot(meshes, snapshot).every((c) => c.ok),
    "Missing/stale consumed second/third instance",
  );
  requireValue(
    mirroredAssets?.length === new Set(meshes.map((m) => m.meshId)).size,
    "Missing actual main-thread mirror inventory",
  );
  for (const mesh of meshes) {
    const mirrors = mirroredAssets.filter((m) => m.meshId === mesh.meshId);
    requireValue(mirrors.length === 1, "Ambiguous actual mirror");
    const m = mirrors[0];
    requireValue(
      m.assetVersion === mesh.assetVersion &&
        equal(m.streams, mesh.streams) &&
        equal(m.submeshes, mesh.submeshes) &&
        equal(m.indexBuffer, mesh.indexBuffer),
      "Worker publication/mirrored asset bytes or version differ",
    );
    const packet = snapshot.meshDraws.find(
      (p) => `${p.entity.index}:${p.entity.generation}` === mesh.entityId,
    );
    requireValue(
      packet.vertexStart === 0 &&
        packet.vertexCount === mesh.positions.length / 3 &&
        packet.indexCount === 0 &&
        packet.castsShadow === true &&
        packet.receivesShadow === true,
      "Consumed instance stale active range/shadow flags",
    );
  }
  return true;
}
function actualBytes(upload, offset, length) {
  requireValue(
    upload &&
      !upload.destroyed &&
      upload.writeCalls > 0 &&
      Array.isArray(upload.fullUploadBytes) &&
      upload.fullUploadBytes.length === upload.allocationBytes,
    "Missing exact native buffer upload",
  );
  requireValue(
    upload.fullUploadBytes.every(
      (n) => Number.isInteger(n) && n >= 0 && n < 256,
    ) &&
      Number.isSafeInteger(offset) &&
      offset >= 0 &&
      offset + length <= upload.allocationBytes,
    "Invalid exact buffer range",
  );
  requireValue(
    upload.writtenRanges.some(([a, b]) => a <= offset && b >= offset + length),
    "Active GPU range was not fully observed written",
  );
  return Uint8Array.from(upload.fullUploadBytes.slice(offset, offset + length));
}
function matricesFor(draw, kind) {
  const group = draw.groups.find(
      (g) => g.index === (kind === "main-color" ? 1 : 0),
    ),
    entry = group?.entries.find(
      (e) => e.binding === (kind === "main-color" ? 0 : 1),
    );
  requireValue(
    group && group.dynamicOffsets.length === 0 && entry?.buffer,
    "Unproven actual world-transform binding",
  );
  const b = entry.buffer,
    upload = draw.uploads.find((u) => u.id === b.id);
  requireValue(upload?.id === b.id, "Wrong exact transform buffer object");
  const start = b.offset + draw.firstInstance * 64,
    length = draw.instances * 64;
  requireValue(
    Number.isSafeInteger(draw.firstInstance) &&
      draw.firstInstance >= 0 &&
      Number.isSafeInteger(draw.instances) &&
      draw.instances > 0 &&
      start + length <= b.offset + b.size,
    "Wrong packed transform offset/range",
  );
  const bytes = actualBytes(upload, start, length),
    view = new DataView(bytes.buffer);
  return Array.from({ length: draw.instances }, (_, i) =>
    Array.from({ length: 16 }, (_, j) => view.getFloat32(i * 64 + j * 4, true)),
  );
}
function validateDraw(draw, members, kind, commands) {
  const m = members[0];
  requireValue(
    classifyPass(draw) === kind,
    "Unproven actual descriptor/shader pass classification",
  );
  requireValue(
    commands.some(
      (c) =>
        c.id === draw.commandBufferId &&
        c.encoderId === draw.commandEncoderId &&
        c.submissionSerial === draw.submissionSerial,
    ),
    "Orphan/unsubmitted exact command-buffer draw",
  );
  requireValue(
    draw.method === "draw" &&
      draw.count === m.positions.length / 3 &&
      draw.start === 0 &&
      draw.index === null &&
      !draw.unsupportedIndirect,
    "Stale/wrong active vertex count/range",
  );
  requireValue(
    draw.vertices.length === m.streams.length,
    "Wrong bound native stream inventory",
  );
  for (const stream of m.streams) {
    const label = `${m.assetLabel}/vertex:${stream.id}`,
      binding = draw.vertices.find((v) => v.label === label);
    requireValue(
      binding &&
        binding.offset === 0 &&
        binding.size >= stream.byteLength &&
        binding.offset + binding.size <= binding.allocationBytes,
      "Wrong actual vertex binding offset/range",
    );
    const upload = draw.uploads.find(
      (u) => u.id === binding.id && u.label === label,
    );
    requireValue(upload, "Wrong exact geometry buffer object join");
    const bytes = actualBytes(upload, 0, stream.byteLength);
    requireValue(
      equal(Array.from(bytes), Array.from(nativeEvidenceBytes(stream))),
      "Submitted exact buffer bytes are stale",
    );
  }
  const matrices = matricesFor(draw, kind);
  for (const matrix of matrices)
    requireValue(
      members.some((m) => equal(m.worldMatrix, matrix)),
      "Wrong packed transform offset or stale/missing instance",
    );
  return matrices;
}
function validateCoverage(draws, meshes, kind, commands, requireCoalesced) {
  const groups = new Map();
  for (const m of meshes) {
    if (!groups.has(m.meshId)) groups.set(m.meshId, []);
    groups.get(m.meshId).push(m);
  }
  const used = new Set(),
    coverage = [];
  for (const [meshId, members] of groups) {
    const m = members[0],
      labels = m.streams.map((s) => `${m.assetLabel}/vertex:${s.id}`),
      selected = draws.filter((d) =>
        d.vertices.some((v) => labels.includes(v.label)),
      );
    requireValue(
      selected.length > 0,
      `Missing applicable ${kind} draw for ${meshId}`,
    );
    if (requireCoalesced && isPipe(m))
      requireValue(
        selected.length === 1 && selected[0].instances === 3,
        "Coverage blocker: genuine main-pass three-instance coalescing did not activate",
      );
    const matrices = selected.flatMap((d) => {
      used.add(d);
      return validateDraw(d, members, kind, commands);
    });
    requireValue(
      matrices.length === members.length &&
        members.every(
          (m) => matrices.filter((x) => equal(x, m.worldMatrix)).length === 1,
        ),
      "Missing/duplicate second or third rendered instance",
    );
    coverage.push({
      meshId,
      instances: matrices.length,
      draws: selected.length,
      firstInstances: selected.map((d) => d.firstInstance),
      commands: selected.map((d) => d.commandBufferId),
    });
  }
  requireValue(
    used.size === draws.length,
    "Unexpected unmatched geometry draw",
  );
  return coverage;
}
export function validateSubmittedFanout(e, receipt) {
  const scope = expandNativeScope(e.nativeGeometry.submittedDraws),
    meshes = e.nativeGeometry.meshes;
  requireValue(
    scope?.frame === receipt.nativeFrame &&
      scope.submissions > 0 &&
      scope.commands?.length > 0,
    "Missing correlated native submission",
  );
  const hasGeometry = (d) =>
    d.vertices.some((v) =>
      meshes.some((m) =>
        m.streams.some((s) => v.label === `${m.assetLabel}/vertex:${s.id}`),
      ),
    );
  const relevant = scope.draws.filter(hasGeometry);
  requireValue(
    relevant.every((d) =>
      ["main-color", "shadow-depth"].includes(classifyPass(d)),
    ),
    "Unclassified relevant native pass",
  );
  const main = relevant.filter((d) => classifyPass(d) === "main-color");
  const mainCoverage = validateCoverage(
    main,
    meshes,
    "main-color",
    scope.commands,
    e.shared,
  );
  const sampled = new Set(
    main.flatMap((d) =>
      d.groups.flatMap((g) =>
        g.entries.flatMap((e) => (e.texture ? [e.texture.textureId] : [])),
      ),
    ),
  );
  const histories = scope.shadowHistory.filter((h) => sampled.has(h.textureId));
  requireValue(
    histories.length === 1,
    "Missing exact current sampled directional shadow texture history",
  );
  const history = histories[0],
    shadow = history.draws.filter(hasGeometry);
  requireValue(
    history.submissionSerial <=
      Math.max(...scope.commands.map((c) => c.submissionSerial)),
    "Shadow submission came from the future",
  );
  requireValue(
    Number.isSafeInteger(history.contentRevision) &&
      history.contentRevision > 0 &&
      main.every((d) =>
        d.sampledTextureVersions?.some(
          (v) =>
            v.textureId === history.textureId &&
            v.contentRevision === history.contentRevision,
        ),
      ),
    "Current color pass samples a different shadow content revision",
  );
  requireValue(
    Array.isArray(scope.textureInvalidations) &&
      !scope.textureInvalidations.some(
        (i) =>
          i.textureId === history.textureId &&
          i.contentRevision > history.contentRevision,
      ),
    "Old shadow coverage invalidated by later clear/overwrite/discard/copy/destroy",
  );
  const shadowCoverage = validateCoverage(
    shadow,
    meshes,
    "shadow-depth",
    history.commands,
    false,
  );
  requireValue(
    shadow.every((d) => d.pass.depth.view.textureId === history.textureId),
    "Shadow depth texture identity mismatch",
  );
  const report = e.nativeSubmission?.nativeFrameReport;
  requireValue(
    report?.shadow?.ready === true &&
      report.shadow.shadowKind === "directional" &&
      report.shadow.requestCount === 1 &&
      report.shadow.requestCoverage.omittedCount === 0,
    "Applicable directional shadow report missing",
  );
  return {
    mainCoverage,
    shadowCoverage,
    shadow: {
      textureId: history.textureId,
      originalFrame: history.frame,
      originalSubmission: history.submissionSerial,
      reused: !scope.draws.some((d) => classifyPass(d) === "shadow-depth"),
      definition:
        "Prior native depth draws remain prior draws; current color binds their exact texture and bytes/transforms revalidate against current state.",
    },
  };
}
export function validateFanoutTransition(e, state, previous) {
  if (!previous) {
    requireValue(state.index === 0, "Missing prior state");
    return;
  }
  requireValue(e.revision === previous.revision + 1, "Nonmonotonic revision");
  for (const m of e.nativeGeometry.meshes) {
    const old = previous.nativeGeometry.meshes.find((p) => p.name === m.name);
    requireValue(
      old &&
        m.entityId === old.entityId &&
        m.meshId === old.meshId &&
        m.materialId === old.materialId &&
        equal(m.worldMatrix, old.worldMatrix),
      "Persistent instance/handle/transform changed",
    );
    if (!isPipe(m) || state.noop)
      requireValue(
        equal(m.streams, old.streams) &&
          equal(m.submeshes, old.submeshes) &&
          m.assetVersion === old.assetVersion,
        "No-op/sentinel changed",
      );
  }
  if (state.noop)
    requireValue(
      e.resources.worker.changedMeshes.length === 0,
      "No-op published per-entity geometry",
    );
}
