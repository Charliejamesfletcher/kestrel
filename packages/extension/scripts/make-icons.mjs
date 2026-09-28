// npm run icons -w @kestrel/extension
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const GREEN = [0x63, 0x9a, 0x35];
const SEGMENTS = [[[4, 15], [12, 5]], [[12, 5], [20, 15]], [[8, 20], [12, 15]], [[12, 15], [16, 20]]];

function distToSegment(px, py, [[ax, ay], [bx, by]]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function pixel(x, y, size) {
  const r = size * 0.22;
  const cx = Math.min(Math.max(x, r), size - r), cy = Math.min(Math.max(y, r), size - r);
  if (Math.hypot(x - cx, y - cy) > r) return null;
  const g = ((x - size * 0.15) / (size * 0.7)) * 24, h = ((y - size * 0.13) / (size * 0.7)) * 24;
  const white = SEGMENTS.some((s) => distToSegment(g, h, s) <= 1.5);
  return white ? [255, 255, 255] : GREEN;
}

function png(size) {
  const S = 4; // 4x4 samples per pixel for smooth edges
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const c = pixel(x + (sx + 0.5) / S, y + (sy + 0.5) / S, size);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? r / a : 0; raw[o + 1] = a ? g / a : 0; raw[o + 2] = a ? b / a : 0; raw[o + 3] = (a / (S * S)) * 255;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(import.meta.dirname, '..', 'icons', `icon-${size}.png`), png(size));
}
console.log('Icons written to packages/extension/icons');
