// Decode `aperture tool browser_screenshot` base64 stdin to a PNG file.
import fs from "fs";
let s = "";
process.stdin
  .on("data", (d) => (s += d))
  .on("end", () => {
    const j = JSON.parse(s);
    if (!j.ok) {
      console.error("screenshot failed", j);
      process.exit(1);
    }
    fs.writeFileSync(process.argv[2], Buffer.from(j.data, "base64"));
    console.log("wrote", process.argv[2]);
  });
