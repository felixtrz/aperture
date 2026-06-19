// Decode the newest browser_screenshot tool-result base64 into parity/<name>.png
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const dir = process.argv[2];
const out = process.argv[3] || "parity/latest.png";
const files = readdirSync(dir).filter(f => f.includes("browser_screenshot")).map(f => `${dir}/${f}`);
files.sort();
const f = files[files.length-1];
const j = JSON.parse(readFileSync(f, "utf8"));
writeFileSync(out, Buffer.from(j.data, "base64"));
console.log("decoded", f.split("/").pop(), "->", out, j.mimeType);
