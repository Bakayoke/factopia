/** Draw a shareable results card and return a PNG blob. */
export async function renderResultsImage(opts: {
  title: string
  subtitle: string
  rows: { rank: string; name: string; score: string }[]
  footer: string
  cta?: string
}): Promise<Blob | null> {
  const w = 1080
  const h = 1350
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#1a5c4a')
  grad.addColorStop(0.55, '#0f2f3a')
  grad.addColorStop(1, '#c9921a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath()
  ctx.arc(900, 160, 220, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 72px Georgia, serif'
  ctx.fillText('Factopia', 72, 140)

  ctx.fillStyle = '#ffe8a3'
  ctx.font = '800 48px Nunito, sans-serif'
  ctx.fillText(opts.title.slice(0, 40), 72, 230)

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '700 32px Nunito, sans-serif'
  ctx.fillText(opts.subtitle.slice(0, 48), 72, 290)

  let y = 380
  for (const row of opts.rows.slice(0, 8)) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    roundRect(ctx, 72, y - 52, w - 144, 88, 18)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = '800 36px Nunito, sans-serif'
    ctx.fillText(row.rank, 100, y)
    ctx.fillText(row.name.slice(0, 22), 200, y)
    ctx.textAlign = 'right'
    ctx.fillText(row.score, w - 100, y)
    ctx.textAlign = 'left'
    y += 110
  }

  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = '700 28px Nunito, sans-serif'
  ctx.fillText(opts.footer.slice(0, 52), 72, h - 120)

  ctx.fillStyle = '#ffe8a3'
  ctx.font = '800 34px Nunito, sans-serif'
  ctx.fillText((opts.cta || 'factopia.net').slice(0, 42), 72, h - 70)

  return await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png')
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
