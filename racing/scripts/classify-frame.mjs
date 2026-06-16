// Decode an 8-bit PNG (RGB/RGBA) via zlib and report color stats + magenta fraction.
import { readFileSync } from "node:fs";
import zlib from "node:zlib";
const file = process.argv[2];
const buf = readFileSync(file);
if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not png");
let pos = 8, w=0,h=0,bitDepth=0,colorType=0; const idat=[];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos); const type = buf.toString("ascii", pos+4, pos+8);
  const data = buf.subarray(pos+8, pos+8+len);
  if (type === "IHDR") { w=data.readUInt32BE(0); h=data.readUInt32BE(4); bitDepth=data[8]; colorType=data[9]; }
  else if (type === "IDAT") idat.push(data);
  else if (type === "IEND") break;
  pos += 12 + len;
}
const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
if (!ch || bitDepth !== 8) throw new Error(`unsupported colorType=${colorType} bitDepth=${bitDepth}`);
const raw = zlib.inflateSync(Buffer.concat(idat));
const stride = w*ch; const out = Buffer.alloc(h*stride);
const pa=(x)=>x; // paeth helper below
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
let rp=0;
for (let y=0;y<h;y++){
  const f=raw[rp++]; const row=out.subarray(y*stride,(y+1)*stride); const prev=y>0?out.subarray((y-1)*stride,y*stride):null;
  for(let i=0;i<stride;i++){
    const x=raw[rp++]; const a=i>=ch?row[i-ch]:0; const b=prev?prev[i]:0; const c=(prev&&i>=ch)?prev[i-ch]:0;
    let v; switch(f){case 0:v=x;break;case 1:v=x+a;break;case 2:v=x+b;break;case 3:v=x+((a+b)>>1);break;case 4:v=x+paeth(a,b,c);break;default:throw new Error("filter "+f);}
    row[i]=v&255;
  }
}
let magenta=0, near=0, total=w*h; const hist={};
for(let p=0;p<total;p++){
  const o=p*ch, r=out[o],g=out[o+1],b=out[o+2];
  // magenta/purple: high R, high B, low G
  if (r>160 && b>160 && g<110) magenta++;
  const key = `${r>>5},${g>>5},${b>>5}`; hist[key]=(hist[key]||0)+1;
}
const top = Object.entries(hist).sort((a,b)=>b[1]-a[1]).slice(0,4)
  .map(([k,n])=>`(${k.split(",").map(v=>v*32).join(",")}):${(100*n/total).toFixed(0)}%`);
console.log(`${file.split("/").pop()} ${w}x${h} magenta=${(100*magenta/total).toFixed(2)}% top=${top.join(" ")}`);
