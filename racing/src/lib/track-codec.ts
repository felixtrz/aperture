import { TYPE_NAMES, type GridCell } from "./track-data.js";

const TYPE_INDEX: Record<string, number> = {};
for (let i = 0; i < TYPE_NAMES.length; i++) TYPE_INDEX[TYPE_NAMES[i]!] = i;

const ORIENT_TO_GODOT = [0, 16, 10, 22];
const GODOT_TO_ORIENT: Record<number, number> = { 0: 0, 16: 1, 10: 2, 22: 3 };

export function encodeCells(cells: readonly GridCell[]): string {
  const bytes = new Uint8Array(cells.length * 3);
  for (let i = 0; i < cells.length; i++) {
    const [gx, gz, name, godotOrient] = cells[i]!;
    const ti = TYPE_INDEX[name] ?? 0;
    const oi = GODOT_TO_ORIENT[godotOrient] ?? 0;
    bytes[i * 3] = gx + 128;
    bytes[i * 3 + 1] = gz + 128;
    bytes[i * 3 + 2] = (ti << 2) | oi;
  }
  return bytesToBase64url(bytes);
}

export function decodeCells(str: string): GridCell[] {
  const bytes = base64urlToBytes(str);
  const cells: GridCell[] = [];
  for (let i = 0; i + 2 < bytes.length; i += 3) {
    const gx = bytes[i]! - 128;
    const gz = bytes[i + 1]! - 128;
    const packed = bytes[i + 2]!;
    const ti = (packed >> 2) & 0x03;
    const oi = packed & 0x03;
    cells.push([gx, gz, TYPE_NAMES[ti]!, ORIENT_TO_GODOT[oi]!]);
  }
  return cells;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
