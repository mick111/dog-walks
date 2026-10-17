// Generateur d'icones PNG sans dependance externe.
// Usage: node public/gen-icons.js
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CREAM = [0xf5, 0xf0, 0xeb]
const BROWN = [0x4a, 0x3f, 0x35]
const SS = 4 // supersampling

function crcTable() {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
}
const CRC = crcTable()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0 // filter none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// --- geometry helpers in unit coordinates (0..1) ---
function inRoundRect(x, y, r, inset) {
  const lo = inset
  const hi = 1 - inset
  if (x < lo || x > hi || y < lo || y > hi) return false
  const rad = r - inset
  if (rad <= 0) return true
  const cx = Math.min(Math.max(x, lo + rad), hi - rad)
  const cy = Math.min(Math.max(y, lo + rad), hi - rad)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= rad * rad
}

function inEllipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx
  const dy = (y - cy) / ry
  return dx * dx + dy * dy <= 1
}

function pawAt(x, y) {
  // pad
  if (inEllipse(x, y, 0.5, 0.645, 0.215, 0.175)) return true
  // toes
  const toes = [
    [0.325, 0.395, 0.082],
    [0.675, 0.395, 0.082],
    [0.185, 0.525, 0.072],
    [0.815, 0.525, 0.072]
  ]
  for (const [cx, cy, r] of toes) {
    const dx = x - cx
    const dy = y - cy
    if (dx * dx + dy * dy <= r * r) return true
  }
  return false
}

function render(size) {
  const out = Buffer.alloc(size * size * 4)
  const n = size * SS
  const acc = new Float64Array(size * size * 3)

  const radius = 0.22
  const border = 0.028

  for (let py = 0; py < n; py++) {
    const y = (py + 0.5) / n
    for (let px = 0; px < n; px++) {
      const x = (px + 0.5) / n
      let color = null

      if (inRoundRect(x, y, radius, 0)) {
        if (inRoundRect(x, y, radius, border)) {
          color = pawAt(x, y) ? BROWN : CREAM
        } else {
          color = BROWN
        }
      }

      const di = ((py / SS) | 0) * size + ((px / SS) | 0)
      if (color) {
        acc[di * 3] += color[0]
        acc[di * 3 + 1] += color[1]
        acc[di * 3 + 2] += color[2]
      }
      acc[di * 3 + 3] += color ? 1 : 0
    }
  }

  const samples = SS * SS
  for (let i = 0; i < size * size; i++) {
    const a = acc[i * 3 + 3] / samples
    out[i * 4] = Math.round(acc[i * 3] / samples)
    out[i * 4 + 1] = Math.round(acc[i * 3 + 1] / samples)
    out[i * 4 + 2] = Math.round(acc[i * 3 + 2] / samples)
    out[i * 4 + 3] = Math.round(a * 255)
  }
  return out
}

function main() {
  const sizes = [180, 192, 512]
  for (const size of sizes) {
    const png = encodePng(size, size, render(size))
    const file = path.join(__dirname, `icon-${size}.png`)
    fs.writeFileSync(file, png)
    console.log(`icon-${size}.png ${png.length} bytes`)
  }
}

main()
