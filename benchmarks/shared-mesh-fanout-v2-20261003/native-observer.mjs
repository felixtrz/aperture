/** Transparent native calls. Object identity, successful submission and upload-time bytes are joined here. */
import { SHADOW_CASTER_DEPTH_ONLY_WGSL } from "./shader-contract.mjs";
const clone = (value) => JSON.parse(JSON.stringify(value));
export function installNativeObserver() {
  const ids = new WeakMap(),
    buffers = new WeakMap(),
    bufferList = [],
    groups = new WeakMap(),
    shaders = new WeakMap(),
    pipelines = new WeakMap(),
    views = new WeakMap(),
    states = new WeakMap(),
    owners = new WeakMap(),
    commands = new WeakMap(),
    bundles = new WeakMap();
  let next = 1,
    active = null,
    submissionSerial = 0;
  const shadowHistory = new Map(),
    textureVersions = new Map(),
    textureInvalidations = [],
    counts = {
      devices: 0,
      bufferCreates: 0,
      bufferDestroys: 0,
      writeBufferCalls: 0,
    };
  const id = (o) => {
    if (!ids.has(o)) ids.set(o, next++);
    return ids.get(o);
  };
  const invalidate = (textureId, reason) => {
    shadowHistory.delete(textureId);
    textureVersions.set(textureId, (textureVersions.get(textureId) ?? 0) + 1);
    textureInvalidations.push({
      textureId,
      contentRevision: textureVersions.get(textureId),
      reason,
      submissionSerial,
      frame: active?.frame ?? null,
    });
  };
  const view = (v) => {
    if (!v) return null;
    return views.get(v) ?? { id: id(v), textureId: null, unobserved: true };
  };
  const binding = (b, offset = 0, size) => ({
    id: id(b),
    label: b.label ?? "",
    allocationBytes: b.size,
    offset,
    size: size ?? b.size - offset,
  });
  const state = (o) => {
    if (!states.has(o))
      states.set(o, {
        vertices: new Map(),
        index: null,
        groups: new Map(),
        pipeline: null,
        draws: [],
        pass: null,
      });
    return states.get(o);
  };
  function wrap(proto, key, fn) {
    const original = proto?.[key];
    if (!original) return;
    proto[key] = function (...args) {
      const result = original.apply(this, args);
      return fn.call(this, result, args);
    };
  }
  wrap(GPUTexture.prototype, "destroy", function (result) {
    invalidate(id(this), "texture.destroy");
    return result;
  });
  wrap(GPUTexture.prototype, "createView", function (result, args) {
    views.set(result, {
      id: id(result),
      textureId: id(this),
      textureLabel: this.label ?? "",
      format: args[0]?.format ?? this.format,
      descriptor: clone(args[0] ?? {}),
    });
    return result;
  });
  const request = GPUAdapter.prototype.requestDevice;
  GPUAdapter.prototype.requestDevice = async function (...args) {
    const device = await request.apply(this, args);
    counts.devices++;
    wrap(device, "createBuffer", function (buffer, [descriptor]) {
      const record = {
        ...binding(buffer),
        usage: descriptor.usage,
        bytes: new Uint8Array(descriptor.size),
        written: new Uint8Array(descriptor.size),
        uncertain: new Uint8Array(descriptor.size),
        writes: 0,
        contentVersion: 0,
        indirectFirstInstanceSupported:
          device.features?.has?.("indirect-first-instance") === true,
        destroyed: false,
        mapped: [],
      };
      buffers.set(buffer, record);
      bufferList.push(record);
      counts.bufferCreates++;
      wrap(buffer, "getMappedRange", function (result, [offset = 0, size]) {
        record.mapped.push({ result, offset, size: size ?? result.byteLength });
        return result;
      });
      const unmap = buffer.unmap;
      buffer.unmap = function (...xs) {
        const pending = record.mapped.map((m) => ({
          ...m,
          bytes: new Uint8Array(m.result).slice(),
        }));
        const result = unmap.apply(this, xs);
        for (const m of pending) {
          record.bytes.set(m.bytes, m.offset);
          record.written.fill(1, m.offset, m.offset + m.bytes.length);
          record.uncertain.fill(0, m.offset, m.offset + m.bytes.length);
          record.writes++;
          record.contentVersion++;
        }
        record.mapped = [];
        return result;
      };
      wrap(buffer, "destroy", function (result) {
        record.destroyed = true;
        counts.bufferDestroys++;
        return result;
      });
      return buffer;
    });
    for (const method of ["writeTexture", "copyExternalImageToTexture"])
      wrap(device.queue, method, function (result, args) {
        const target = method === "writeTexture" ? args[0] : args[1];
        if (target?.texture)
          invalidate(id(target.texture), "unsupported queue " + method);
        return result;
      });
    wrap(
      device.queue,
      "writeBuffer",
      function (result, [buffer, offset, data, start = 0, size]) {
        const r = buffers.get(buffer);
        if (!r) throw Error("Unobserved buffer upload");
        const unit = ArrayBuffer.isView(data)
            ? (data.BYTES_PER_ELEMENT ?? 1)
            : 1,
          source = ArrayBuffer.isView(data) ? data.buffer : data,
          at = (ArrayBuffer.isView(data) ? data.byteOffset : 0) + start * unit,
          length =
            size === undefined ? data.byteLength - start * unit : size * unit;
        r.bytes.set(new Uint8Array(source, at, length), offset);
        r.written.fill(1, offset, offset + length);
        r.uncertain.fill(0, offset, offset + length);
        r.writes++;
        r.contentVersion++;
        counts.writeBufferCalls++;
        return result;
      },
    );
    wrap(device, "createShaderModule", function (result, [d]) {
      shaders.set(result, {
        id: id(result),
        label: d.label ?? "",
        code: d.code,
      });
      return result;
    });
    function pipeline(result, [d]) {
      pipelines.set(result, {
        id: id(result),
        label: d.label ?? "",
        vertex: shaders.get(d.vertex.module),
        targets: clone(d.fragment?.targets ?? []),
        depthStencil: clone(d.depthStencil ?? null),
        primitive: clone(d.primitive ?? {}),
        vertexBuffers: clone(d.vertex.buffers ?? []),
      });
      return result;
    }
    wrap(device, "createRenderPipeline", pipeline);
    if (device.createRenderPipelineAsync) {
      const original = device.createRenderPipelineAsync;
      device.createRenderPipelineAsync = async function (...xs) {
        return pipeline(await original.apply(this, xs), xs);
      };
    }
    wrap(device, "createBindGroup", function (result, [d]) {
      groups.set(result, {
        id: id(result),
        label: d.label ?? "",
        entries: d.entries.map((e) => ({
          binding: e.binding,
          ...(e.resource?.buffer
            ? {
                buffer: binding(
                  e.resource.buffer,
                  e.resource.offset,
                  e.resource.size,
                ),
              }
            : views.has(e.resource)
              ? { texture: view(e.resource) }
              : { other: true }),
        })),
      });
      return result;
    });
    return device;
  };
  // Preserve uncertainty rather than pretending an encoded GPU mutation was a CPU upload.
  // All mutations in one submitted batch conservatively invalidate their destination
  // before any argument snapshot from that batch. A prior draw is never made valid
  // by guessing at intra-command GPU ordering or reconstructing copy/clear results.
  for (const method of [
    "copyBufferToBuffer",
    "clearBuffer",
    "copyTextureToBuffer",
    "resolveQuerySet",
  ])
    wrap(GPUCommandEncoder.prototype, method, function (result, args) {
      let buffer, offset, size;
      if (method === "copyBufferToBuffer")
        [buffer, offset, size] = [args[2], args[3], args[4]];
      else if (method === "clearBuffer")
        [buffer, offset, size] = [args[0], args[1] ?? 0, args[2]];
      else if (method === "copyTextureToBuffer")
        [buffer, offset] = [args[1].buffer, 0];
      else [buffer, offset, size] = [args[3], args[4], args[2] * 8];
      if (!commands.has(this)) commands.set(this, []);
      commands.get(this).push({
        bufferMutation: {
          bufferId: id(buffer),
          offset,
          size: size ?? buffer.size - offset,
          reason: "unobserved encoder " + method,
        },
      });
      return result;
    });
  for (const method of ["copyBufferToTexture", "copyTextureToTexture"])
    wrap(GPUCommandEncoder.prototype, method, function (result, args) {
      if (!commands.has(this)) commands.set(this, []);
      commands.get(this).push({
        textureMutation: {
          textureId: id(args[1].texture),
          reason: "unsupported encoder " + method,
        },
      });
      return result;
    });
  wrap(GPUCommandEncoder.prototype, "beginRenderPass", function (pass, [d]) {
    owners.set(pass, this);
    if (!commands.has(this)) commands.set(this, []);
    state(pass).pass = {
      id: id(pass),
      label: d.label ?? "",
      colors: Array.from(d.colorAttachments ?? [])
        .filter(Boolean)
        .map((a) => ({
          view: view(a.view),
          resolveTarget: view(a.resolveTarget),
          loadOp: a.loadOp,
          storeOp: a.storeOp,
        })),
      depth: d.depthStencilAttachment
        ? {
            view: view(d.depthStencilAttachment.view),
            depthLoadOp: d.depthStencilAttachment.depthLoadOp,
            depthStoreOp: d.depthStencilAttachment.depthStoreOp,
          }
        : null,
    };
    return pass;
  });
  wrap(GPUCommandEncoder.prototype, "finish", function (command) {
    commands.set(command, {
      id: id(command),
      encoderId: id(this),
      effects: commands.get(this) ?? [],
    });
    return command;
  });
  for (const [kind, proto] of [
    ["pass", GPURenderPassEncoder.prototype],
    ["bundle", GPURenderBundleEncoder.prototype],
  ]) {
    wrap(proto, "setVertexBuffer", function (r, [slot, b, offset, size]) {
      if (b) state(this).vertices.set(slot, binding(b, offset, size));
      else state(this).vertices.delete(slot);
      return r;
    });
    wrap(proto, "setIndexBuffer", function (r, [b, format, offset, size]) {
      state(this).index = { ...binding(b, offset, size), format };
      return r;
    });
    wrap(proto, "setPipeline", function (r, [p]) {
      state(this).pipeline = pipelines.get(p) ?? {
        id: id(p),
        unobserved: true,
      };
      return r;
    });
    wrap(
      proto,
      "setBindGroup",
      function (r, [index, g, dynamic, start, length]) {
        if (g) {
          const metadata = groups.get(g);
          if (!metadata) throw Error("Unobserved bind group");
          let offsets = Array.from(dynamic ?? []);
          if (start !== undefined)
            offsets = offsets.slice(start, start + (length ?? offsets.length));
          state(this).groups.set(index, {
            index,
            ...metadata,
            dynamicOffsets: offsets,
          });
        } else state(this).groups.delete(index);
        return r;
      },
    );
    for (const method of [
      "draw",
      "drawIndexed",
      "drawIndirect",
      "drawIndexedIndirect",
    ])
      wrap(proto, method, function (r, args) {
        const s = state(this),
          d = {
            method,
            vertices: [...s.vertices].map(([slot, b]) => ({ slot, ...b })),
            index: s.index ? { ...s.index } : null,
            groups: clone([...s.groups.values()]),
            pipeline: s.pipeline,
            pass: s.pass,
          };
        if (method === "draw")
          Object.assign(d, {
            count: args[0],
            instances: args[1] ?? 1,
            start: args[2] ?? 0,
            firstInstance: args[3] ?? 0,
          });
        else if (method === "drawIndexed")
          Object.assign(d, {
            count: args[0],
            instances: args[1] ?? 1,
            start: args[2] ?? 0,
            baseVertex: args[3] ?? 0,
            firstInstance: args[4] ?? 0,
          });
        else d.indirect = { buffer: binding(args[0]), offset: args[1] };
        s.draws.push(d);
        return r;
      });
    if (kind === "bundle")
      wrap(proto, "finish", function (b) {
        bundles.set(
          b,
          state(this).draws.map((d) => ({ ...d, bundleId: id(b) })),
        );
        return b;
      });
    else {
      wrap(proto, "executeBundles", function (r, [bs]) {
        const s = state(this);
        for (const b of bs) {
          const ds = bundles.get(b);
          if (!ds) throw Error("Unobserved render bundle");
          s.draws.push(
            ...ds.map((d) => ({ ...d, pass: s.pass, viaBundle: true })),
          );
        }
        s.vertices.clear();
        s.index = null;
        s.groups.clear();
        s.pipeline = null;
        return r;
      });
      wrap(proto, "end", function (r) {
        const owner = owners.get(this);
        if (!owner) throw Error("Orphan render pass");
        commands
          .get(owner)
          .push({ pass: state(this).pass, draws: state(this).draws });
        return r;
      });
    }
  }
  function captureBuffer(b, serial) {
    const r = bufferList.find((r) => r.id === b.id);
    if (!r) throw Error("Exact native buffer has no observed upload object");
    return {
      id: r.id,
      label: r.label,
      allocationBytes: r.allocationBytes,
      usage: r.usage,
      writeCalls: r.writes,
      contentVersion: r.contentVersion,
      submissionSerial: serial,
      indirectFirstInstanceSupported: r.indirectFirstInstanceSupported,
      destroyed: r.destroyed,
      fullUploadBytes: Array.from(r.bytes),
      writtenRanges: writtenRanges(r.written),
      uncertainRanges: writtenRanges(r.uncertain),
    };
  }
  function retainDraw(draw, command, serial) {
    const bindings = [
      ...draw.vertices,
      ...(draw.index ? [draw.index] : []),
      ...(draw.indirect ? [draw.indirect.buffer] : []),
      ...draw.groups.flatMap((g) =>
        g.entries.flatMap((e) => (e.buffer ? [e.buffer] : [])),
      ),
    ];
    return {
      ...clone(draw),
      sampledTextureVersions: draw.groups.flatMap((g) =>
        g.entries.flatMap((e) =>
          e.texture
            ? [
                {
                  textureId: e.texture.textureId,
                  contentRevision:
                    textureVersions.get(e.texture.textureId) ?? 0,
                },
              ]
            : [],
        ),
      ),
      commandBufferId: command.id,
      commandEncoderId: command.encoderId,
      submissionSerial: serial,
      submittedFrame: active?.frame ?? null,
      uploads: [
        ...new Map(
          bindings.map((b) => [b.id, captureBuffer(b, serial)]),
        ).values(),
      ],
    };
  }
  const nativeSubmit = GPUQueue.prototype.submit;
  GPUQueue.prototype.submit = function (...args) {
    const result = nativeSubmit.apply(this, args),
      serial = ++submissionSerial;
    for (const c of args[0]) {
      const command = commands.get(c);
      if (!command?.id) throw Error("Unobserved submitted command buffer");
      for (const effect of command.effects) {
        if (!effect.bufferMutation) continue;
        const m = effect.bufferMutation,
          r = bufferList.find((r) => r.id === m.bufferId);
        if (!r) throw Error("Unobserved mutated buffer object");
        if (
          ![m.offset, m.size].every((n) => Number.isSafeInteger(n) && n >= 0) ||
          m.offset + m.size > r.allocationBytes
        )
          throw Error("Unproven encoded buffer mutation range");
        r.written.fill(0, m.offset, m.offset + m.size);
        r.uncertain.fill(1, m.offset, m.offset + m.size);
        r.contentVersion++;
        if (active)
          active.bufferMutations.push({
            ...m,
            commandBufferId: command.id,
            commandEncoderId: command.encoderId,
            submissionSerial: serial,
            contentVersion: r.contentVersion,
          });
      }
    }
    for (const c of args[0]) {
      const command = commands.get(c);
      if (!command?.id) throw Error("Unobserved submitted command buffer");
      const commandRecord = {
        id: command.id,
        encoderId: command.encoderId,
        submissionSerial: serial,
      };
      if (active) active.commands.push(commandRecord);
      for (const effect of command.effects) {
        if (effect.bufferMutation) continue;
        if (effect.textureMutation) {
          invalidate(
            effect.textureMutation.textureId,
            effect.textureMutation.reason,
          );
          continue;
        }
        const draws = effect.draws.map((d) => retainDraw(d, command, serial));
        if (active) active.draws.push(...draws);
        const depth = effect.pass.depth;
        if (!depth) continue;
        const textureId = depth.view.textureId;
        if (!textureId) throw Error("Unobserved depth attachment texture");
        const previous = shadowHistory.get(textureId),
          changed =
            depth.depthLoadOp === "clear" ||
            draws.length > 0 ||
            depth.depthStoreOp === "discard";
        if (changed)
          invalidate(
            textureId,
            depth.depthStoreOp === "discard"
              ? "depth attachment discarded"
              : draws.length
                ? "depth attachment overwritten"
                : "clear-only depth pass",
          );
        if (
          depth.depthLoadOp === "clear" &&
          depth.depthStoreOp === "store" &&
          draws.length > 0 &&
          draws.every((d) => classifyPass(d) === "shadow-depth")
        )
          shadowHistory.set(textureId, {
            textureId,
            contentRevision: textureVersions.get(textureId),
            submissionSerial: serial,
            frame: active?.frame ?? null,
            commands: [commandRecord],
            draws,
          });
        else if (!changed && previous) shadowHistory.set(textureId, previous);
        if (active)
          active.depthEffects.push({
            textureId,
            loadOp: depth.depthLoadOp,
            storeOp: depth.depthStoreOp,
            drawCount: draws.length,
            submissionSerial: serial,
            commandBufferId: command.id,
          });
      }
    }
    if (active) active.submissions++;
    return result;
  };
  return {
    begin(frame) {
      if (active) throw Error("Overlapping scope");
      active = {
        frame,
        draws: [],
        commands: [],
        depthEffects: [],
        bufferMutations: [],
        submissions: 0,
      };
      return active;
    },
    end(scope) {
      if (scope !== active) throw Error("Wrong scope");
      active = null;
      return compactNativeScope({
        ...scope,
        shadowHistory: clone([...shadowHistory.values()]),
        textureInvalidations: clone(textureInvalidations),
        counters: { ...counts },
        definition:
          "Exact object identities from successful native calls; bytes preserved at queue.submit, not GPU readback. Prior depth submissions remain prior submissions and are only applicable when the current color pass samples that exact texture and matching bytes/transforms.",
      });
    },
  };
}
export function writtenRanges(mask) {
  const out = [];
  let start = null;
  for (let i = 0; i <= mask.length; i++) {
    if (mask[i] && start === null) start = i;
    if (!mask[i] && start !== null) {
      out.push([start, i]);
      start = null;
    }
  }
  return out;
}
export function classifyPass(draw) {
  const p = draw.pass,
    s = draw.pipeline;
  if (!p || !s || s.unobserved) return "unproven";
  if (
    p.colors.length === 0 &&
    p.depth &&
    s.targets.length === 0 &&
    s.vertex?.code === SHADOW_CASTER_DEPTH_ONLY_WGSL
  )
    return "shadow-depth";
  if (
    p.colors.length > 0 &&
    p.depth &&
    s.targets.length > 0 &&
    /@group\(1\)\s*@binding\(0\).*worldTransforms/.test(s.vertex?.code ?? "")
  )
    return "main-color";
  return "other";
}

/** Deduplicate only the same object at the same successful submission, preserving changed versions. */
export function compactNativeScope(scope) {
  const bufferSnapshots = {},
    pipelineSnapshots = {};
  const compact = (draw) => {
    const d = { ...draw };
    d.uploadSnapshotIds = d.uploads.map((upload) => {
      const key = `${d.submissionSerial}:${upload.id}`,
        prior = bufferSnapshots[key];
      if (prior && JSON.stringify(prior) !== JSON.stringify(upload))
        throw Error("Divergent same-object submission byte snapshot");
      bufferSnapshots[key] = upload;
      return key;
    });
    delete d.uploads;
    d.pipelineId = String(d.pipeline.id);
    const prior = pipelineSnapshots[d.pipelineId];
    if (prior && JSON.stringify(prior) !== JSON.stringify(d.pipeline))
      throw Error("Pipeline identity changed");
    pipelineSnapshots[d.pipelineId] = d.pipeline;
    delete d.pipeline;
    return d;
  };
  return {
    ...scope,
    draws: scope.draws.map(compact),
    shadowHistory: scope.shadowHistory.map((h) => ({
      ...h,
      draws: h.draws.map(compact),
    })),
    bufferSnapshots,
    pipelineSnapshots,
  };
}
export function expandNativeScope(scope) {
  if (!scope?.bufferSnapshots || !scope.pipelineSnapshots)
    throw Error("Missing deduplicated native object snapshots");
  const expand = (d) => {
    if (
      !Array.isArray(d.uploadSnapshotIds) ||
      d.uploadSnapshotIds.some(
        (key) =>
          !Object.hasOwn(scope.bufferSnapshots, key) ||
          key !== `${d.submissionSerial}:${scope.bufferSnapshots[key].id}`,
      )
    )
      throw Error("Wrong exact buffer/submission snapshot join");
    if (!Object.hasOwn(scope.pipelineSnapshots, d.pipelineId))
      throw Error("Missing exact pipeline snapshot");
    return {
      ...d,
      uploads: d.uploadSnapshotIds.map((key) => scope.bufferSnapshots[key]),
      pipeline: scope.pipelineSnapshots[d.pipelineId],
    };
  };
  return {
    ...scope,
    draws: scope.draws.map(expand),
    shadowHistory: scope.shadowHistory.map((h) => ({
      ...h,
      draws: h.draws.map(expand),
    })),
  };
}
