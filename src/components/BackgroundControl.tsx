import { useRef } from 'react'
import { Upload, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Field } from '@/components/Field'
import type { Background } from '@/engine/background'
import { cn } from '@/lib/utils'

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

  const setKind = (kind: Background['kind']) => {
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
      // draw a decoded image, so handing it the URL alone means the preview
      // shows nothing while the export is correct, which is the worst of the
      // two: the thing you are looking at is the thing you are deciding from.
      const img = new Image()
      img.onload = () => onChange({ kind: 'image', src, image: img, fit: 'cover' })
      img.onerror = () => onChange({ kind: 'image', src, fit: 'cover' })
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-[13px] font-medium">Background</Label>
        <Select value={value.kind} onValueChange={(v) => setKind(v as Background['kind'])}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="transparent">
              <span className="flex flex-col items-start">
                <span>Transparent</span>
                <span className="text-muted-foreground text-[11px]">
                  Nothing behind the glyphs. SVG and PNG both keep the alpha.
                </span>
              </span>
            </SelectItem>
            <SelectItem value="solid">Solid colour</SelectItem>
            <SelectItem value="gradient">Two-stop gradient</SelectItem>
            <SelectItem value="image">Image</SelectItem>
          </SelectContent>
        </Select>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </div>

      {value.kind === 'solid' && (
        <Swatch
          label="Colour"
          value={value.color}
          onChange={(color) => onChange({ ...value, color })}
        />
      )}

      {value.kind === 'gradient' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Swatch
              label="From"
              value={value.from}
              onChange={(from) => onChange({ ...value, from })}
            />
            <Swatch
              label="To"
              value={value.to}
              onChange={(to) => onChange({ ...value, to })}
            />
          </div>
          <Field
            label="Angle"
            hint="0 runs left to right, 90 top to bottom. Measured across the whole piece, so tiles line up."
            value={value.angle} min={0} max={360} step={5}
            format={(v) => `${v}°`}
            onChange={(angle) => onChange({ ...value, angle })}
          />
          <div
            className="h-8 rounded-md ring-1 ring-black/10"
            style={{
              backgroundImage:
                `linear-gradient(${value.angle + 90}deg, ${value.from}, ${value.to})`,
            }}
          />
        </div>
      )}

      {value.kind === 'image' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <img
              src={value.src}
              alt=""
              className="h-12 w-20 shrink-0 rounded-md object-cover ring-1 ring-black/10"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="size-3.5" />
                Replace
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange({ kind: 'transparent' })}
              >
                <X className="size-3.5" />
                Remove
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['cover', 'contain'] as const).map((fit) => (
              <Button
                key={fit}
                size="sm"
                variant={(value.fit ?? 'cover') === fit ? 'default' : 'outline'}
                onClick={() => onChange({ ...value, fit })}
              >
                {fit === 'cover' ? 'Fill' : 'Fit'}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-[11px] leading-snug">
            Embedded in an exported SVG as a data URL, so the file travels on
            its own. That makes it large; SVGZ or PNG will be much smaller.
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
    <label className="flex items-center gap-2">
      <span
        className={cn(
          'relative size-8 shrink-0 overflow-hidden rounded-md ring-1 ring-black/15',
        )}
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
        <span className="block text-[13px] font-medium">{label}</span>
        <span className="text-muted-foreground block font-mono text-[11px]">{value}</span>
      </span>
    </label>
  )
}
