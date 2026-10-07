// 读取 JPEG/PNG 实际像素尺寸（零依赖）：node tools/imgsize.mjs <file...>
import fs from 'node:fs';

function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    }
    i += 2 + len;
  }
  return null;
}

function pngSize(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

for (const f of process.argv.slice(2)) {
  const buf = fs.readFileSync(f);
  const s = jpegSize(buf) || pngSize(buf);
  if (!s) { console.log(JSON.stringify({ file: f, error: 'not jpeg/png' })); process.exitCode = 1; continue; }
  console.log(JSON.stringify({ file: f, ...s }));
}
