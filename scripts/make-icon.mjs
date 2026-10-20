import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const size = 192;
const raw = Buffer.alloc(size * size * 4);

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    raw[i] = 11;
    raw[i + 1] = 58;
    raw[i + 2] = 110;
    raw[i + 3] = 255;
  }
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const stride = size * 4 + 1;
const bitmap = Buffer.alloc(stride * size);
for (let y = 0; y < size; y++) {
  bitmap[y * stride] = 0;
  raw.copy(bitmap, y * stride + 1, y * size * 4, (y + 1) * size * 4);
}

const png = Buffer.concat([
  signature,
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(bitmap)),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = path.join(__dirname, "..", "public", "icon-192.png");
fs.writeFileSync(out, png);
console.log("wrote", out);
