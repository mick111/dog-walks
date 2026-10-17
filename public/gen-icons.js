const fs = require('fs')
const path = require('path')
const { createCanvas } = await import('canvas')

async function main () {
  const outDir = path.join(__dirname, 'public')
  const sizes = [180, 512]
  const palette = { cream: '#F5F0EB', brown: '#4A3F35' }

  for (const size of sizes) {
    const c = createCanvas(size, size)
    const ctx = c.getContext('2d')

    // Fond carré arrondi
    const r = size * 0.16
    roundRect(ctx, 0, 0, size, size, r)
    ctx.fillStyle = palette.cream
    ctx.fill()

    // Contour
    ctx.strokeStyle = palette.brown
    ctx.lineWidth = size * 0.025
    ctx.stroke()

    // Patte 🐾
    drawPaw(ctx, size)

    fs.writeFileSync(path.join(outDir, `icon-${size}.png`), c.toBuffer('image/png'))
    console.log(`✓ icon-${size}.png (${c.width}×${c.height})`)
  }
}

function roundRect (ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawPaw (ctx, size) {
  const s = size * 0.015 // pixel unit
  ctx.fillStyle = '#4A3F35'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Dessiner une patte avec 4 cercles + 1 ellipse
  const padCx = size / 2, padCy = size * 0.52
  const padR = size * 0.17
  const toeR = size * 0.09
  const toes = [
    { x: padCx - size * 0.15, y: padCy - size * 0.2 },
    { x: padCx + size * 0.15, y: padCy - size * 0.2 },
    { x: padCx - size * 0.20, y: padCy + size * 0.05 },
    { x: padCx + size * 0.20, y: padCy + size * 0.05 },
  ]

  // Main pad (ellipse-like circle)
  ctx.beginPath()
  ctx.arc(padCx, padCy, padR, 0, Math.PI * 2)
  ctx.fill()

  // Toe pads
  for (const t of toes) {
    ctx.beginPath()
    ctx.arc(t.x, t.y, toeR, 0, Math.PI * 2)
    ctx.fill()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
