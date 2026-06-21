import { parseFailure } from "./hdr-rgbe-diagnostics.js";
export function readHdrPixels(bytes, dimensions) {
    const { width, height } = dimensions;
    if (width < 8 || width > 0x7fff || bytes.length < 4) {
        return readFlatPixels(bytes, dimensions);
    }
    if (bytes[0] !== 2 || bytes[1] !== 2 || (bytes[2] & 0x80) !== 0) {
        return readFlatPixels(bytes, dimensions);
    }
    const pixels = new Uint8Array(width * height * 4);
    const scanline = new Uint8Array(width * 4);
    let sourceOffset = 0;
    for (let y = 0; y < height; y += 1) {
        if (sourceOffset + 4 > bytes.length) {
            return parseFailure("hdrRgbe.truncatedPixels", "Radiance HDR data ended before a scanline header.");
        }
        if (bytes[sourceOffset] !== 2 ||
            bytes[sourceOffset + 1] !== 2 ||
            ((bytes[sourceOffset + 2] << 8) | bytes[sourceOffset + 3]) !== width) {
            return parseFailure("hdrRgbe.invalidScanline", "Radiance HDR RLE scanline header does not match image width.");
        }
        sourceOffset += 4;
        for (let channel = 0; channel < 4; channel += 1) {
            let x = 0;
            while (x < width) {
                if (sourceOffset >= bytes.length) {
                    return parseFailure("hdrRgbe.truncatedPixels", "Radiance HDR data ended during RLE scanline decoding.");
                }
                let count = bytes[sourceOffset];
                sourceOffset += 1;
                if (count > 128) {
                    count -= 128;
                    if (count === 0 ||
                        x + count > width ||
                        sourceOffset >= bytes.length) {
                        return parseFailure("hdrRgbe.invalidScanline", "Radiance HDR RLE run length is invalid.");
                    }
                    const value = bytes[sourceOffset];
                    sourceOffset += 1;
                    scanline.fill(value, channel * width + x, channel * width + x + count);
                    x += count;
                }
                else {
                    if (count === 0 ||
                        x + count > width ||
                        sourceOffset + count > bytes.length) {
                        return parseFailure("hdrRgbe.invalidScanline", "Radiance HDR RLE literal length is invalid.");
                    }
                    scanline.set(bytes.subarray(sourceOffset, sourceOffset + count), channel * width + x);
                    sourceOffset += count;
                    x += count;
                }
            }
        }
        for (let x = 0; x < width; x += 1) {
            const destination = (y * width + x) * 4;
            pixels[destination] = scanline[x];
            pixels[destination + 1] = scanline[width + x];
            pixels[destination + 2] = scanline[width * 2 + x];
            pixels[destination + 3] = scanline[width * 3 + x];
        }
    }
    return { ok: true, pixels };
}
function readFlatPixels(bytes, dimensions) {
    const byteLength = dimensions.width * dimensions.height * 4;
    if (bytes.length < byteLength) {
        return parseFailure("hdrRgbe.truncatedPixels", `Radiance HDR data ended before ${byteLength} flat RGBE pixel byte(s).`);
    }
    return { ok: true, pixels: bytes.slice(0, byteLength) };
}
//# sourceMappingURL=hdr-rgbe-pixels.js.map