/** CPU observation only: no native GPU, browser, shader execution or pixels. */
import { webGpuHarness } from "./base-harness.mjs";
export function createCpuHarness() {
  const events = [];
  const base = webGpuHarness(events);
  const { device } = base;
  const submissions = [];
  let context = null;
  let nextBufferId = 1;
  const createBuffer = device.createBuffer;
  device.createBuffer = (descriptor) => {
    const buffer = createBuffer(descriptor);
    buffer.id = nextBufferId++;
    buffer.getMappedRange = (offset = 0, size = buffer.bytes.byteLength) => {
      if (offset !== 0 || size !== buffer.bytes.byteLength)
        throw Error("Unsupported partial mapped range in bounded CPU fixture");
      return buffer.bytes;
    };
    return buffer;
  };
  const writeBuffer = device.queue.writeBuffer;
  device.queue.writeBuffer = (buffer, offset, data, dataOffset = 0, size) => {
    const view = ArrayBuffer.isView(data);
    const unit =
      view && "BYTES_PER_ELEMENT" in data ? data.BYTES_PER_ELEMENT : 1;
    const all = view
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);
    const start = dataOffset * unit;
    const end = size === undefined ? all.byteLength : start + size * unit;
    new Uint8Array(buffer.bytes).set(all.subarray(start, end), offset);
    writeBuffer(buffer);
  };
  const createEncoder = device.createCommandEncoder;
  device.createCommandEncoder = (...args) => {
    const encoder = createEncoder(...args);
    const draws = [];
    const begin = encoder.beginRenderPass;
    encoder.beginRenderPass = (...passArgs) => {
      const pass = begin(...passArgs);
      const vertices = new Map();
      let index = null;
      const setVertex = pass.setVertexBuffer;
      pass.setVertexBuffer = (slot, buffer, offset = 0, size) => {
        vertices.set(slot, {
          buffer,
          offset,
          size: size ?? buffer.bytes.byteLength - offset,
        });
        setVertex(slot);
      };
      const setIndex = pass.setIndexBuffer;
      pass.setIndexBuffer = (buffer, format, offset = 0, size) => {
        index = {
          buffer,
          format,
          offset,
          size: size ?? buffer.bytes.byteLength - offset,
        };
        setIndex();
      };
      for (const method of [
        "draw",
        "drawIndexed",
        "drawIndirect",
        "drawIndexedIndirect",
      ]) {
        const original = pass[method];
        pass[method] = (...drawArgs) => {
          draws.push({
            method,
            args: drawArgs,
            vertices: [...vertices.entries()],
            index,
          });
          original(...drawArgs);
        };
      }
      return pass;
    };
    const finish = encoder.finish;
    encoder.finish = () => ({ ...finish(), draws });
    return encoder;
  };
  const submit = device.queue.submit;
  const capture = ({ buffer, offset, size, ...rest }) => ({
    ...rest,
    bufferId: buffer.id,
    label: buffer.descriptor.label,
    offset,
    size,
    bytes: [...new Uint8Array(buffer.bytes, offset, size)],
  });
  device.queue.submit = (buffers) => {
    const draws = buffers
      .flatMap((buffer) => buffer.draws)
      .map((draw) => ({
        method: draw.method,
        args: draw.args.map((arg) =>
          typeof arg === "object" ? { bufferId: arg.id } : arg,
        ),
        vertices: draw.vertices.map(([slot, binding]) => ({
          slot,
          ...capture(binding),
        })),
        index: draw.index ? capture(draw.index) : null,
      }));
    submissions.push({ ...context, submission: submissions.length + 1, draws });
    submit(buffers);
  };
  return {
    ...base,
    events,
    submissions,
    setContext(value) {
      context = value;
    },
  };
}
