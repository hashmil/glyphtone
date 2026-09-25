import { useRef } from 'react'
import { Upload, X } from 'lucide-react'

import { Btn, Fader, Segmented } from '@/components/kit'
import type { Background } from '@/engine/background'

interface Props {
  value: Background
  onChange: (bg: Background) => void
}

const INITIAL = {
  solid: '#ffffff',
  from: '#f4efe6',
  to: '#1c2b4a',
  angle: 90,
}

type Kind = Background['kind']

const KINDS: Array<{ id: Kind; label: string; title: string }> = [
  { id: 'transparent', label: 'None', title: 'Nothing behind the glyphs. SVG and PNG both keep the alpha.' },
  { id: 'solid', label: 'Solid', title: 'One flat colour' },
  { id: 'gradient', label: 'Blend', title: 'Two-stop gradient across the whole piece' },
  { id: 'image', label: 'Image', title: 'A picture behind the glyphs' },
]

export function BackgroundControl({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  // What each kind looked like last time it was selected, so switching to
  // Solid to check something and back does not throw away the gradient you
  // just tuned. A ref rather than state: nothing renders from it directly.
  const last = useRef({ ...INITIAL })
  if (value.kind === 'solid') last.current.solid = value.color
  if (value.kind === 'gradient') {
    last.current.from = value.from
    last.current.to = value.to
    last.current.angle = value.angle
  }

  const setKind = (kind: Kind) => {
    if (kind === value.kind) return
    const f = last.current
    if (kind === 'transparent') onChange({ kind: 'transparent' })
    else if (kind === 'solid') onChange({ kind: 'solid', color: f.solid })
    else if (kind === 'gradient') {
      onChange({ kind: 'gradient', from: f.from, to: f.to, angle: f.angle })
    } else fileRef.current?.click()
  }

  const pickFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      // A data URL rather than an object URL: the SVG exporter embeds this
      // string, and a blob: URL would resolve to nothing on another machine.
      const src = String(reader.result)
      // Decoded here as well as at export time. The canvas renderer can only
      // draw a decoded image, so handing it the URL alone would show nothing in
      // the preview while the export came out correct.
      const img = new Image()
      img.onload = () => onChange({ kind: 'image', src, image: img, fit: 'cover' })
      img.onerror = () => onChange({ kind: 'image', src, fit: 'cover' })
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-4">
      <Segmented<Kind> value={value.kind} options={KINDS} onChange={setKind} size="sm" />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0])}
      />

      {value.kind === 'transparent' && (
        <p className="text-fg-2 text-xs">
          Nothing behind the glyphs. SVG and PNG both keep the alpha.
        </p>
      )}

      {value.kind === 'solid' && (
        <Swatch
          label="Colour"
          value={value.color}
          onChange={(color) => onChange({ ...value, color })}
        />
      )}

      {value.kind === 'gradient' && (
        <div className="space-y-4">
          <div
            className="h-6 rounded-[1px]"
            style={{
              backgroundImage:
                `linear-gradient(${value.angle + 90}deg, ${value.from}, ${value.to})`,
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Swatch label="From" value={value.from} onChange={(from) => onChange({ ...value, from })} />
            <Swatch label="To" value={value.to} onChange={(to) => onChange({ ...value, to })} />
          </div>
          <Fader
            label="Angle"
            hint="0 runs left to right, 90 top to bottom. Measured across the whole piece, so tiles line up."
            value={value.angle} min={0} max={360} step={5}
            format={(v) => `${v}°`}
            onChange={(angle) => onChange({ ...value, angle })}
          />
        </div>
      )}

      {value.kind === 'image' && (
        <div className="space-y-3">
          <div className="flex items-stretch gap-2">
            <img
              src={value.src}
              alt=""
              className="h-[60px] w-24 shrink-0 rounded-[1px] object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Btn size="sm" onClick={() => fileRef.current?.click()}>
                <Upload /> Replace
              </Btn>
              <Btn size="sm" tone="bare" onClick={() => onChange({ kind: 'transparent' })}>
                <X /> Remove
              </Btn>
            </div>
          </div>
          <Segmented
            size="sm"
            value={value.fit ?? 'cover'}
            onChange={(fit) => onChange({ ...value, fit })}
            options={[
              { id: 'cover', label: 'Fill' },
              { id: 'contain', label: 'Fit' },
            ]}
          />
          <p className="text-fg-2 text-xs">
            Embedded in an exported SVG, so the file travels on its own. That
            makes it large; SVGZ or PNG will be much smaller.
          </p>
        </div>
      )}
    </div>
  )
}

function Swatch({
  label, value, onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="border-rule-2 hover:border-fg-2 flex cursor-pointer items-center gap-2.5 rounded-sm border p-1.5 pr-3 transition-colors">
      <span
        className="relative size-6 shrink-0 overflow-hidden rounded-[1px] ring-1 ring-white/10"
        style={{ background: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </span>
      <span className="min-w-0">
        <span className="block text-xs">{label}</span>
        <span className="text-fg-2 block font-mono text-xs">{value}</span>
      </span>
    </label>
  )
}
