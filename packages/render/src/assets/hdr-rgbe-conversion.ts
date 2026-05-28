export function rgbeToFloatRgba(rgbe: Uint8Array): Float32Array {
  const floats = new Float32Array(rgbe.length);

  for (let source = 0; source < rgbe.length; source += 4) {
    const destination = source;
    const exponent = rgbe[source + 3]!;

    if (exponent === 0) {
      floats[destination] = 0;
      floats[destination + 1] = 0;
      floats[destination + 2] = 0;
      floats[destination + 3] = 1;
      continue;
    }

    const scale = Math.pow(2, exponent - 128) / 255;

    floats[destination] = rgbe[source]! * scale;
    floats[destination + 1] = rgbe[source + 1]! * scale;
    floats[destination + 2] = rgbe[source + 2]! * scale;
    floats[destination + 3] = 1;
  }

  return floats;
}
