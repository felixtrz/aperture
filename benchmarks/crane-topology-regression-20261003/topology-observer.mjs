/** Observe actual native WebGPU pass/bundle draws; every original API is called unchanged. */
export function installTopologyDrawObserver() {
  const ids = new WeakMap(),
    bindings = new WeakMap(),
    bundles = new WeakMap(),
    passOwners = new WeakMap(),
    encoderDraws = new WeakMap(),
    commandDraws = new WeakMap();
  let nextId = 1,
    active = null;
  const idFor = (buffer) => {
    if (!ids.has(buffer)) ids.set(buffer, nextId++);
    return ids.get(buffer);
  };
  const describe = (buffer, offset = 0, size) => ({
    id: idFor(buffer),
    label: buffer.label ?? "",
    allocationBytes: buffer.size,
    offset,
    size: size ?? buffer.size - offset,
  });
  function state(encoder) {
    if (!bindings.has(encoder))
      bindings.set(encoder, { vertices: new Map(), index: null, draws: [] });
    return bindings.get(encoder);
  }
  const commandPrototype = GPUCommandEncoder.prototype,
    beginPass = commandPrototype.beginRenderPass,
    finish = commandPrototype.finish;
  commandPrototype.beginRenderPass = function (...args) {
    const pass = beginPass.apply(this, args);
    passOwners.set(pass, this);
    if (!encoderDraws.has(this)) encoderDraws.set(this, []);
    return pass;
  };
  commandPrototype.finish = function (...args) {
    const command = finish.apply(this, args);
    commandDraws.set(command, encoderDraws.get(this) ?? []);
    return command;
  };
  for (const [kind, proto] of [
    ["pass", globalThis.GPURenderPassEncoder?.prototype],
    ["bundle", globalThis.GPURenderBundleEncoder?.prototype],
  ]) {
    if (!proto) continue;
    for (const method of ["setVertexBuffer", "setIndexBuffer"]) {
      const original = proto[method];
      proto[method] = function (...args) {
        const value = original.apply(this, args),
          s = state(this);
        if (method === "setVertexBuffer") {
          if (args[1])
            s.vertices.set(args[0], describe(args[1], args[2], args[3]));
          else s.vertices.delete(args[0]);
        } else
          s.index = { ...describe(args[0], args[2], args[3]), format: args[1] };
        return value;
      };
    }
    for (const method of [
      "draw",
      "drawIndexed",
      "drawIndirect",
      "drawIndexedIndirect",
    ]) {
      const original = proto[method];
      if (!original) continue;
      proto[method] = function (...args) {
        const value = original.apply(this, args),
          s = state(this);
        const draw = {
          method,
          vertices: [...s.vertices].map(([slot, v]) => ({ slot, ...v })),
          index: s.index ? { ...s.index } : null,
        };
        if (method === "draw")
          Object.assign(draw, {
            count: args[0],
            instances: args[1] ?? 1,
            start: args[2] ?? 0,
            firstInstance: args[3] ?? 0,
          });
        else if (method === "drawIndexed")
          Object.assign(draw, {
            count: args[0],
            instances: args[1] ?? 1,
            start: args[2] ?? 0,
            baseVertex: args[3] ?? 0,
            firstInstance: args[4] ?? 0,
          });
        else Object.assign(draw, { unsupportedIndirect: true });
        s.draws.push(draw);
        return value;
      };
    }
    if (kind === "bundle") {
      const original = proto.finish;
      proto.finish = function (...args) {
        const bundle = original.apply(this, args);
        bundles.set(
          bundle,
          state(this).draws.map((d) => ({ ...d })),
        );
        return bundle;
      };
    } else {
      const execute = proto.executeBundles;
      proto.executeBundles = function (...args) {
        const value = execute.apply(this, args);
        for (const bundle of args[0]) {
          const draws = bundles.get(bundle);
          if (!draws) throw Error("Unobserved native render bundle");
          state(this).draws.push(
            ...draws.map((d) => ({ ...d, viaBundle: true })),
          );
        }
        state(this).vertices.clear();
        state(this).index = null;
        return value;
      };
      const end = proto.end;
      proto.end = function (...args) {
        const value = end.apply(this, args);
        const owner = passOwners.get(this);
        if (!owner) throw Error("Unobserved native command encoder");
        encoderDraws.get(owner).push(...state(this).draws);
        return value;
      };
    }
  }
  const submit = GPUQueue.prototype.submit;
  GPUQueue.prototype.submit = function (...args) {
    const result = submit.apply(this, args);
    if (active) {
      active.submissions++;
      for (const command of args[0]) {
        const draws = commandDraws.get(command);
        if (!draws) throw Error("Unobserved submitted native command buffer");
        active.draws.push(...draws);
      }
    }
    return result;
  };
  return {
    idFor,
    begin(frame) {
      if (active) throw Error("Overlapping native draw scopes");
      active = { frame, draws: [], submissions: 0 };
      return active;
    },
    end(scope) {
      if (scope !== active) throw Error("Wrong native draw scope");
      active = null;
      return {
        ...scope,
        definition:
          "Successful actual native draw/drawIndexed calls, including executed render bundles, joined through the actual owning command encoder and successful queue.submit inside the correlated renderer call; binding ranges retain allocation capacity separately.",
      };
    },
  };
}
