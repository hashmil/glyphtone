import { useEffect, useMemo, useRef } from 'react'

import { glyphPath } from '@/engine/glyphs'
import type { GlyphPack } from '@/engine/packs'
import { ZONE_IDS, type Palette } from '@/engine/palettes'
import { cn } from '@/lib/utils'

/** `n` glyphs from a pack, spread evenly across its coverage ladder from the
 *  lightest to the heaviest. This is the pack's real tonal range, not a
 *  hand-picked sample, so two packs side by side can be compared honestly. */
export function ladderSample(pack: GlyphPack, n: number): string[] {
  const names = Object.keys(pack.coverages)
    .filter((k) => pack.coverages[k] > 0)
    .sort((a, b) => pack.coverages[a] - pack.coverages[b])
  if (names.length <= n) return names
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    out.push(names[Math.round((i / (n - 1)) * (names.length - 1))])
  }
  return out
}

/** A row of glyphs drawn by the same Path2D the renderer stamps, so what the
 *  picker shows is exactly what lands in the piece. */
export function GlyphStrip({
  pack, count, size, color = '#ededeb', gap = 0.35, className,
}: {
  pack: GlyphPack
  count: number
  /** glyph size in CSS px */
  size: number
  color?: string
  /** gap between glyphs as a fraction of glyph size */
  gap?: number
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const names = useMemo(() => ladderSample(pack, count), [pack, count])
  // A pack drawn into a narrow cell, like ASCII, is shown in that same cell.
  const aspect = pack.aspect ?? 1
  const gw = size * aspect
  const step = gw + size * gap
  const width = Math.max(gw, step * names.length - size * gap)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(size * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const grid = pack.set.grid
    names.forEach((name, i) => {
      const x = i * step * dpr
      if (pack.mode === 'text') {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.font = `${Math.round(size * dpr * 0.9)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(pack.chars?.[name] ?? '', x + (size * dpr) / 2, (size * dpr) / 2 + dpr)
        return
      }
      const s = (size * dpr) / grid
      ctx.setTransform(s * aspect, 0, 0, s, x, 0)
      ctx.fillStyle = color
      ctx.fill(glyphPath(pack.set, name))
    })
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }, [names, pack, size, step, width, color, aspect])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn('block', className)}
      style={{ width, height: size }}
    />
  )
}

const rgb = (c: readonly number[]) => `rgb(${c.join(',')})`

/** A palette as its three zone ramps, pale to deep. The gradient is the data:
 *  it is the ramp a zone's marks are coloured along. */
export function RampSwatch({ palette, className }: { palette: Palette; className?: string }) {
  return (
    <span className={cn('flex flex-col gap-px overflow-hidden rounded-[1px]', className)}>
      {ZONE_IDS.map((z) => (
        <span
          key={z}
          className="block h-1.5 w-full"
          style={{
            backgroundImage: `linear-gradient(90deg, ${rgb(palette.ramps[z][0])}, ${rgb(palette.ramps[z][1])})`,
          }}
        />
      ))}
    </span>
  )
}
