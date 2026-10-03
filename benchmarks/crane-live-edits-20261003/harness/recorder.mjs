import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { SCHEMA, STATES, LIMITS } from './contract.mjs';
import { canonical, geometryComparable, identityComparable, requireValue, validateStateRecord, verifyNativeProof } from './checks.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export async function writeImmutable(path, bytes) {
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
}
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Decode the actual canvas PNG with built-in zlib; no raster proxy or dependency. */
export function inspectCanvasPng(bytes) {
  requireValue(Buffer.isBuffer(bytes) && bytes.length <= LIMITS.pngBytes && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Invalid PNG signature/size');
  const idat = [];
  let offset = 8, ihdr = null, ended = false, chunks = 0;
  while (offset < bytes.length) {
    requireValue(++chunks <= 8192 && offset + 12 <= bytes.length, 'Malformed PNG chunk');
    const size = bytes.readUInt32BE(offset);
    requireValue(size <= LIMITS.pngBytes && offset + size + 12 <= bytes.length, 'Truncated PNG chunk');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    requireValue(crc32(bytes.subarray(offset + 4, offset + 8 + size)) === bytes.readUInt32BE(offset + 8 + size), 'PNG CRC mismatch');
    const data = bytes.subarray(offset + 8, offset + 8 + size);
    if (chunks === 1) requireValue(type === 'IHDR', 'PNG IHDR must be first');
    if (type === 'IHDR') { requireValue(!ihdr && size === 13, 'Duplicate/invalid PNG IHDR'); ihdr = data; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') { requireValue(size === 0, 'Invalid PNG IEND'); ended = true; offset += size + 12; break; }
    offset += size + 12;
  }
  requireValue(ended && offset === bytes.length && ihdr && idat.length > 0, 'Incomplete/trailing PNG data');
  const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4), colorType = ihdr[9];
  requireValue(width === 1024 && height === 1024 && ihdr[8] === 8 && [2, 6].includes(colorType) && ihdr[10] === 0 && ihdr[11] === 0 && ihdr[12] === 0, 'Expected noninterlaced 1024-square 8-bit RGB/RGBA canvas PNG');
  const channels = colorType === 6 ? 4 : 3, stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat), { maxOutputLength: height * (stride + 1) });
  requireValue(raw.length === height * (stride + 1), 'PNG decoded size mismatch');
  let previous = Buffer.alloc(stride), first = null, nonuniformPixels = 0, visiblePixels = 0;
  const low = [255, 255, 255], high = [0, 0, 0];
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (stride + 1), filter = raw[rowOffset], row = Buffer.allocUnsafe(stride);
    requireValue(filter <= 4, 'Invalid PNG row filter');
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? row[x - channels] : 0, up = previous[x], upperLeft = x >= channels ? previous[x - channels] : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upperLeft, a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - upperLeft);
        predicted = a <= b && a <= c ? left : b <= c ? up : upperLeft;
      }
      row[x] = (raw[rowOffset + 1 + x] + predicted) & 255;
    }
    for (let x = 0; x < stride; x += channels) {
      if (channels === 4 && row[x + 3] === 0) continue;
      visiblePixels++;
      first ??= [row[x], row[x + 1], row[x + 2]];
      if (row[x] !== first[0] || row[x + 1] !== first[1] || row[x + 2] !== first[2]) nonuniformPixels++;
      for (let c = 0; c < 3; c++) { low[c] = Math.min(low[c], row[x + c]); high[c] = Math.max(high[c], row[x + c]); }
    }
    previous = row;
  }
  requireValue(visiblePixels > width * height / 2 && nonuniformPixels >= 1024 && high.some((n, i) => n - low[i] >= 8), 'Blank, transparent, or effectively uniform canvas capture');
  return { width, height, channels, visiblePixels, nonuniformPixels, channelMinimum: low, channelMaximum: high, blankCheck: 'passed' };
}

export async function createRecorder(outputDirectory, { engine }) {
  requireValue(['aperture', 'threejs'].includes(engine), 'Unknown recorder engine');
  const root = resolve(outputDirectory);
  for (const child of ['states', 'receipts', 'rejected']) await mkdir(resolve(root, child), { recursive: false });
  const acknowledged = new Map(), records = [];
  let baseline = null, terminal = false, queue = Promise.resolve();
  async function preserveRejection(path, body, error) {
    const id = randomUUID();
    await writeImmutable(resolve(root, 'rejected', `${id}.bin`), body);
    await writeImmutable(resolve(root, 'rejected', `${id}.json`), JSON.stringify({ schema: SCHEMA, path, bytes: body.length, sha256: sha256(body), error: String(error.message ?? error), capturedAt: new Date().toISOString() }, null, 2) + '\n');
  }
  async function recordOnce(path, bytes, contentType) {
    requireValue(Buffer.isBuffer(bytes), 'Artifact bytes must be a Buffer');
    let originalWritten = false;
    try {
      const stateMatch = path.match(/^states\/(s[0-9]{2}-[a-z0-9-]+)\.(json|png)$/);
      const state = stateMatch ? STATES.find(value => value.id === stateMatch[1]) : null;
      requireValue(state || ['complete.json', 'failure.json'].includes(path), 'Unknown artifact path');
      const png = stateMatch?.[2] === 'png', limit = png ? LIMITS.pngBytes : LIMITS.jsonBytes;
      requireValue(bytes.length > 0 && bytes.length <= limit, 'Artifact payload exceeds bounded size');
      requireValue(contentType.split(';', 1)[0].trim() === (png ? 'image/png' : 'application/json'), 'Artifact content type mismatch');
      requireValue(!acknowledged.has(path), 'Immutable artifact already acknowledged');
      requireValue(!terminal || path === 'failure.json', 'Attempt already terminal');
      // Invalid input to a recognized path is retained, never silently replaced.
      await writeImmutable(resolve(root, path), bytes);
      originalWritten = true;
      let inspection = null;
      if (state) {
        requireValue(state.index === records.length - (png ? 1 : 0), 'State artifacts arrived out of sequence');
        if (png) {
          requireValue(acknowledged.has(`states/${state.id}.json`), 'JSON state evidence must be acknowledged before PNG');
          inspection = inspectCanvasPng(bytes);
        } else {
          if (state.index > 0) requireValue(acknowledged.has(`states/${STATES[state.index - 1].id}.png`), 'Previous state PNG is incomplete');
          const record = JSON.parse(bytes.toString('utf8'));
          validateStateRecord(record, state.index);
          requireValue(record.engine === engine, 'Recorder/adapter engine mismatch');
          const comparable = { identity: canonical(identityComparable(record.evidence)), camera: canonical(record.evidence.camera), appearance: canonical(record.evidence.appearance), geometry: canonical(geometryComparable(record.evidence)) };
          baseline ??= comparable;
          requireValue(comparable.identity === baseline.identity && comparable.camera === baseline.camera && comparable.appearance === baseline.appearance, 'Independent recorder identity/camera/appearance check failed');
          if (state.edit === 'baseline') requireValue(comparable.geometry === baseline.geometry, 'Independent recorder baseline reset check failed');
          if (state.index > 0) requireValue(record.proof.submissions > records[state.index - 1].proof.submissions, 'No per-state native submission increase');
          records.push(record);
        }
      } else if (path === 'complete.json') {
        const value = JSON.parse(bytes.toString('utf8'));
        requireValue(value.schema === SCHEMA && value.engine === engine && value.states === STATES.length && records.length === STATES.length, 'Incomplete completion manifest');
        verifyNativeProof(value.proof);
        requireValue(value.proof.submissions >= records.at(-1).proof.submissions && value.proof.draws >= records.at(-1).proof.draws, 'Completion proof regressed');
        requireValue(Array.isArray(value.artifacts) && value.artifacts.length === STATES.length * 2, 'Completion artifact inventory mismatch');
        const expected = STATES.flatMap(state => [`states/${state.id}.json`, `states/${state.id}.png`]);
        for (let index = 0; index < expected.length; index++) {
          const receipt = value.artifacts[index], saved = acknowledged.get(expected[index]);
          requireValue(saved && receipt.path === expected[index] && receipt.sha256 === saved.sha256 && receipt.bytes === saved.bytes, 'Completion artifact receipt mismatch');
          const surviving = await readFile(resolve(root, expected[index]));
          requireValue(surviving.length === saved.bytes && sha256(surviving) === saved.sha256, 'Surviving state bytes differ from acknowledgment');
        }
        terminal = true;
      } else {
        const value = JSON.parse(bytes.toString('utf8'));
        requireValue(value.schema === SCHEMA && value.error && typeof value.error.message === 'string', 'Invalid failure evidence');
        terminal = true;
      }
      const receipt = { ok: true, path, bytes: bytes.length, sha256: sha256(bytes), ...(inspection ? { inspection } : {}) };
      await writeImmutable(resolve(root, 'receipts', `${String(acknowledged.size).padStart(3, '0')}.json`), JSON.stringify(receipt, null, 2) + '\n');
      acknowledged.set(path, receipt);
      return receipt;
    } catch (error) {
      await preserveRejection(path, originalWritten ? Buffer.alloc(0) : bytes.subarray(0, LIMITS.jsonBytes), Error(`${error.message}; recognized original preserved=${originalWritten}`));
      throw error;
    }
  }
  return {
    record(path, bytes, contentType) {
      const result = queue.then(() => recordOnce(path, bytes, contentType));
      queue = result.catch(() => {});
      return result;
    },
    preserveRejection,
    summary() { return { schema: SCHEMA, engine, acknowledged: [...acknowledged.values()], states: records.length, complete: acknowledged.has('complete.json'), failed: acknowledged.has('failure.json') }; },
    async flush() { await queue; },
  };
}

export async function readBoundedBody(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      const error = Error('Request body exceeds bounded limit');
      error.partialBody = Buffer.concat([...chunks, chunk.subarray(0, Math.max(0, limit - (size - chunk.length)))]);
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
