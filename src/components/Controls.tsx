import { useState } from 'react'
import { ChevronDown, SquareDashed } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Field } from '@/components/Field'
import { PALETTES } from '@/engine/palettes'
import { PRESETS } from '@/engine/presets'
import type { PrepOptions } from '@/engine/prep'
import type { MosaicOptions } from '@/engine/types'
import { cn } from '@/lib/utils'

interface Props {
  options: MosaicOptions
  onChange: (patch: Partial<MosaicOptions>) => void
  paletteId: string
  onPalette: (id: string) => void
  presetId: string
  onPreset: (id: string) => void
  prep: PrepOptions
  onPrep: (patch: Partial<PrepOptions>) => void
  prepEnabled: boolean
  onPrepEnabled: (on: boolean) => void
  suggestPrep: boolean
  drawingFocus: boolean
  onDrawingFocus: (on: boolean) => void
  hasFocus: boolean
}

export function Controls(p: Props) {
  const [advanced, setAdvanced] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-[13px] font-medium">Look</Label>
        <Select value={p.presetId} onValueChange={p.onPreset}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                <span className="flex flex-col items-start">
                  <span>{preset.label}</span>
                  <span className="text-muted-foreground text-[11px]">{preset.hint}</span>
                </span>
              </SelectItem>
            ))}
            {p.presetId === 'custom' && (
              <SelectItem value="custom">Custom</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-[13px] font-medium">Colour</Label>
        <Select value={p.paletteId} onValueChange={p.onPalette}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PALETTES.map((pal) => (
              <SelectItem key={pal.id} value={pal.id}>
                <span className="flex items-center gap-2">
                  <span className="flex">
                    {(['cool', 'warm', 'focus'] as const).map((z) => (
                      <span
                        key={z}
                        className="size-3 rounded-[2px] ring-1 ring-black/10"
                        style={{ background: `rgb(${pal.zones[z].ramp[1].join(',')})` }}
                      />
                    ))}
                  </span>
                  {pal.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Field
        label="Density"
        hint="Cells across. The single strongest control over how the piece reads."
        value={p.options.cols}
        min={60}
        max={700}
        step={10}
        onChange={(cols) => p.onChange({ cols })}
      />

      <Field
        label="Contrast"
        value={p.options.contrast}
        min={0.5}
        max={1.8}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(contrast) => p.onChange({ contrast })}
      />

      <Field
        label="Sparkle"
        hint="Per-cell lightness jitter. A little is what stops a flat area reading as a wash."
        value={p.options.valnoise}
        min={0}
        max={0.6}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(valnoise) => p.onChange({ valnoise })}
      />

      <Separator />

      <div className="space-y-2">
        <Button
          variant={p.drawingFocus ? 'default' : 'outline'}
          size="sm"
          className="w-full justify-start"
          onClick={() => p.onDrawingFocus(!p.drawingFocus)}
        >
          <SquareDashed className="size-3.5" />
          {p.drawingFocus ? 'Drag on the image' : 'Set focal region'}
        </Button>
        <p className="text-muted-foreground text-[11px] leading-snug">
          {p.hasFocus
            ? 'This region gets its own icons and colour ramp. Click once on the image to clear it.'
            : 'Optional. Marks a subject so it keeps its own icons and colour instead of blending into the background.'}
        </p>
      </div>

      <Separator />

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setPhotoOpen((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="flex items-center gap-2">
            <Label className="cursor-pointer text-[13px] font-medium">Photograph prep</Label>
            {p.suggestPrep && !p.prepEnabled && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                suggested
              </span>
            )}
          </span>
          <ChevronDown
            className={cn('text-muted-foreground size-4 transition-transform',
              photoOpen && 'rotate-180')}
          />
        </button>

        <div className="flex items-center justify-between">
          <p className="text-muted-foreground max-w-[15rem] text-[11px] leading-snug">
            A photo has tone everywhere, so fed in raw it fills every cell and reads
            as a slab. This removes the broad lighting and keeps real darkness.
          </p>
          <Switch checked={p.prepEnabled} onCheckedChange={p.onPrepEnabled} />
        </div>

        {photoOpen && p.prepEnabled && (
          <div className="space-y-4 pt-1">
            <Field
              label="Detail"
              hint="Lower keeps more local texture."
              value={p.prep.detail} min={0.2} max={1.2} step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(detail) => p.onPrep({ detail })}
            />
            <Field
              label="Darkness threshold"
              value={p.prep.dark} min={0.3} max={0.9} step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(dark) => p.onPrep({ dark })}
            />
            <Field
              label="Flat-field radius"
              hint="As a fraction of the long edge. Large enough to be the lighting, not the subject."
              value={p.prep.radius} min={0.005} max={0.12} step={0.001}
              format={(v) => v.toFixed(3)}
              onChange={(radius) => p.onPrep({ radius })}
            />
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-4">
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <Label className="cursor-pointer text-[13px] font-medium">Advanced</Label>
          <ChevronDown
            className={cn('text-muted-foreground size-4 transition-transform',
              advanced && 'rotate-180')}
          />
        </button>

        {advanced && (
          <div className="space-y-4">
            <Field
              label="Gamma"
              hint="Tone curve applied before the ladder. Below 1 lifts the mid tones."
              value={p.options.gamma} min={0.4} max={1.6} step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(gamma) => p.onChange({ gamma })}
            />
            <Field
              label="Floor"
              hint="Cells below this ink level stay empty, which is what keeps the page open."
              value={p.options.floor} min={0} max={0.3} step={0.005}
              format={(v) => v.toFixed(3)}
              onChange={(floor) => p.onChange({ floor })}
            />
            <Field
              label="Variety"
              hint="Coverage tolerance within which glyphs count as interchangeable. Zero repeats one icon per tone."
              value={p.options.vary} min={0} max={0.2} step={0.005}
              format={(v) => v.toFixed(3)}
              onChange={(vary) => p.onChange({ vary })}
            />
            <Field
              label="Icon size"
              hint="Fraction of the cell. Below 1 opens white space between neighbours."
              value={p.options.gutter} min={0.5} max={1} step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(gutter) => p.onChange({ gutter })}
            />
            <Field
              label="Seed"
              value={p.options.seed} min={1} max={99} step={1}
              onChange={(seed) => p.onChange({ seed })}
            />
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label className="text-[13px] font-medium">Knockout tiles</Label>
                <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
                  Solid cells with the icon punched out. The only way a
                  non-overlapping grid reaches near-black, but they read as
                  stickers rather than as marks.
                </p>
              </div>
              <Switch
                checked={p.options.knockout}
                onCheckedChange={(knockout) => p.onChange({ knockout })}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
