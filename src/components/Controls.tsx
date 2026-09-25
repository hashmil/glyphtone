import { useState } from 'react'
import { ChevronDown, SquareDashed, X } from 'lucide-react'

import { BackgroundControl } from '@/components/BackgroundControl'
import { Btn, Fader, Section, Segmented, SwitchRow } from '@/components/kit'
import { GlyphStrip, RampSwatch } from '@/components/specimen'
import type { Background } from '@/engine/background'
import { PACKS } from '@/engine/packs'
import { PALETTES } from '@/engine/palettes'
import { PRESETS } from '@/engine/presets'
import type { PrepOptions } from '@/engine/prep'
import type { Method, MosaicOptions } from '@/engine/types'
import { cn } from '@/lib/utils'

export interface ControlsProps {
  options: MosaicOptions
  onChange: (patch: Partial<MosaicOptions>) => void
  packId: string
  onPack: (id: string) => void
  paletteId: string
  onPalette: (id: string) => void
  presetId: string
  onPreset: (id: string) => void
  prep: PrepOptions
  onPrep: (patch: Partial<PrepOptions>) => void
  prepEnabled: boolean
  onPrepEnabled: (on: boolean) => void
  suggestPrep: boolean
  lift: number
  onLift: (v: number) => void
  drawingFocus: boolean
  onDrawingFocus: (on: boolean) => void
  hasFocus: boolean
  background: Background
  onBackground: (bg: Background) => void
  /** `sheet` shows one group at a time, chosen by `tab`. Stacked, the docket
   *  is far taller than a phone sheet. */
  layout?: 'sidebar' | 'sheet'
  tab?: SheetTab
}

export type SheetTab = 'style' | 'tone' | 'paper' | 'more'

export const SHEET_TABS: Array<{ id: SheetTab; label: string }> = [
  { id: 'style', label: 'Style' },
  { id: 'tone', label: 'Tone' },
  { id: 'paper', label: 'Paper' },
  { id: 'more', label: 'More' },
]

function LookSection(p: ControlsProps) {
  const current = PRESETS.find((x) => x.id === p.presetId)
  return (
    <Section label="Look" value={current?.label ?? 'Custom'}>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const on = preset.id === p.presetId
          return (
            <button
              key={preset.id}
              type="button"
              title={preset.hint}
              aria-pressed={on}
              onClick={() => p.onPreset(preset.id)}
              className={cn(
                'h-7 cursor-pointer rounded-sm border px-2.5 text-xs transition-colors',
                on
                  ? 'border-paper bg-paper text-ink'
                  : 'border-rule-2 text-fg-2 hover:border-fg-2 hover:text-fg',
              )}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
      {current && <p className="text-fg-2 mt-3 text-xs">{current.hint}.</p>}
    </Section>
  )
}

function GlyphSection(p: ControlsProps) {
  const pack = PACKS.find((x) => x.id === p.packId)
  return (
    <Section label="Glyphs" value={pack?.label}>
      <div className="grid grid-cols-3 gap-1.5">
        {PACKS.map((k) => {
          const on = k.id === p.packId
          return (
            <button
              key={k.id}
              type="button"
              aria-pressed={on}
              title={k.hint}
              onClick={() => p.onPack(k.id)}
              className={cn(
                'group relative flex cursor-pointer flex-col items-start gap-2.5 overflow-hidden rounded-sm border px-2 pt-2.5 pb-2 text-left transition-colors',
                on ? 'border-fg bg-raise' : 'border-rule hover:border-rule-2 hover:bg-raise/60',
              )}
            >
              <GlyphStrip
                pack={k}
                count={5}
                size={12}
                color={on ? '#ededeb' : '#9b9b98'}
                className="transition-opacity"
              />
              <span className={cn('text-xs', on ? 'text-fg' : 'text-fg-2 group-hover:text-fg')}>
                {k.label}
              </span>
              {on && <span className="bg-magenta absolute top-1.5 right-1.5 size-1" aria-hidden />}
            </button>
          )
        })}
      </div>
      {pack && <p className="text-fg-2 mt-3 text-xs">{pack.hint}</p>}
      {pack?.note && <p className="text-fg-3 mt-1.5 text-xs">{pack.note}</p>}
    </Section>
  )
}

function PlacementSection(p: ControlsProps) {
  const organic = p.options.method === 'organic'
  return (
    <Section label="Placement">
      <Segmented<Method>
        value={p.options.method}
        onChange={(method) => p.onChange({ method })}
        options={[
          { id: 'grid', label: 'Ordered' },
          { id: 'organic', label: 'Organic' },
        ]}
      />
      <p className="text-fg-2 mt-3 text-xs">
        {organic
          ? 'Scattered and overlapping. Messier, far more marks, and it goes darker than a grid can.'
          : 'One glyph per cell of a fixed lattice. Nothing overlaps.'}
      </p>
    </Section>
  )
}

function ColourSection(p: ControlsProps) {
  const palette = PALETTES.find((x) => x.id === p.paletteId)
  const pack = PACKS.find((x) => x.id === p.packId)
  const ignored = pack?.mode === 'text'
  return (
    <Section label="Colour" value={palette?.label}>
      <div className={cn('grid grid-cols-3 gap-1.5', ignored && 'opacity-40')}>
        {PALETTES.map((pal) => {
          const on = pal.id === p.paletteId
          return (
            <button
              key={pal.id}
              type="button"
              aria-pressed={on}
              onClick={() => p.onPalette(pal.id)}
              className={cn(
                'group flex cursor-pointer flex-col gap-2 rounded-sm border p-2 text-left transition-colors',
                on ? 'border-fg bg-raise' : 'border-rule hover:border-rule-2 hover:bg-raise/60',
              )}
            >
              <RampSwatch palette={pal} className="w-full" />
              <span className={cn('text-xs', on ? 'text-fg' : 'text-fg-2 group-hover:text-fg')}>
                {pal.label}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-fg-2 mt-3 text-xs">
        {ignored
          ? 'Emoji draw in their own colour, so the palette has no effect on this set.'
          : 'Top to bottom: cool areas, warm areas, focal region. Each runs from pale to deep.'}
      </p>
    </Section>
  )
}

function ToneFields(p: ControlsProps) {
  const organic = p.options.method === 'organic'
  return (
    <div className="space-y-6">
      {organic ? (
        <>
          <Fader
            label="Density"
            hint="The mark count rises with the square of this. 0.55 is around 19,000 marks, 1.5 around 140,000."
            value={p.options.density} min={0.15} max={3} step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(density) => p.onChange({ density })}
          />
          <Fader
            label="Mark size"
            hint="Independent of the count, so sparse and large is reachable."
            value={p.options.glyphScale} min={0.4} max={4} step={0.05}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(glyphScale) => p.onChange({ glyphScale })}
          />
          <Fader
            label="Size spread"
            hint="Zero makes every mark in a pass identical, which reads as a stamp."
            value={p.options.sizeJitter} min={0} max={0.6} step={0.01}
            format={(v) => `±${Math.round(v * 100)}%`}
            onChange={(sizeJitter) => p.onChange({ sizeJitter })}
          />
        </>
      ) : (
        <Fader
          label="Columns"
          hint="Cells across the long edge. The strongest control over how the piece reads, and what decides whether each glyph is legible."
          value={p.options.cols} min={40} max={700} step={5}
          onChange={(cols) => p.onChange({ cols })}
        />
      )}
      <Fader
        label="Contrast"
        value={p.options.contrast} min={0.5} max={1.8} step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(contrast) => p.onChange({ contrast })}
      />
      {organic ? (
        <Fader
          label="Weighting"
          hint="How strongly darkness picks a heavier glyph rather than chance."
          value={p.options.weightBias} min={0} max={1} step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(weightBias) => p.onChange({ weightBias })}
        />
      ) : (
        <Fader
          label="Sparkle"
          hint="Per-cell lightness jitter. A little stops a flat area reading as a wash."
          value={p.options.valnoise} min={0} max={0.6} step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(valnoise) => p.onChange({ valnoise })}
        />
      )}
    </div>
  )
}

function FocusSection(p: ControlsProps) {
  return (
    <Section label="Focal region" value={p.hasFocus ? 'set' : 'none'}>
      <div className="flex gap-1.5">
        <Btn
          tone={p.drawingFocus ? 'paper' : 'line'}
          className="flex-1 justify-start"
          onClick={() => p.onDrawingFocus(!p.drawingFocus)}
        >
          <SquareDashed />
          {p.drawingFocus ? 'Drag on the image' : p.hasFocus ? 'Redraw region' : 'Draw a region'}
        </Btn>
        {p.hasFocus && (
          <Btn tone="line" aria-label="Clear focal region" onClick={() => p.onChange({ figureBox: null })}>
            <X />
          </Btn>
        )}
      </div>
      <p className="text-fg-2 mt-3 text-xs">
        Marks a subject so it keeps its own glyphs and colour ramp instead of
        blending into the background.
      </p>
    </Section>
  )
}

function PrepSection(p: ControlsProps) {
  return (
    <Section label="Photograph">
      <Fader
        label="Lift"
        hint="Brightens the mid-tones before anything else. A dark photo needs this, or all its shadows read as the same solid ink. Set from the image when it loads."
        value={p.lift} min={1} max={3} step={0.05}
        format={(v) => v.toFixed(2)}
        onChange={p.onLift}
      />
      <div className="mt-6" />
      <SwitchRow
        label="Prepare as a photo"
        checked={p.prepEnabled}
        onChange={p.onPrepEnabled}
        badge={p.suggestPrep && !p.prepEnabled && (
          <span className="text-yellow font-mono text-xs">suggested</span>
        )}
        hint="A photo has tone everywhere, so fed in raw it fills every cell and reads as a slab. This removes the broad lighting and keeps real darkness."
      />
      {p.prepEnabled && (
        <div className="mt-6 space-y-6">
          <Fader
            label="Detail" hint="Lower keeps more local texture."
            value={p.prep.detail} min={0.2} max={1.2} step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(detail) => p.onPrep({ detail })}
          />
          <Fader
            label="Darkness threshold"
            value={p.prep.dark} min={0.3} max={0.9} step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(dark) => p.onPrep({ dark })}
          />
          <Fader
            label="Flat-field radius"
            hint="As a fraction of the long edge. Large enough to be the lighting, not the subject."
            value={p.prep.radius} min={0.005} max={0.12} step={0.001}
            format={(v) => v.toFixed(3)}
            onChange={(radius) => p.onPrep({ radius })}
          />
        </div>
      )}
    </Section>
  )
}

function AdvancedFields(p: ControlsProps) {
  const organic = p.options.method === 'organic'
  return (
    <div className="space-y-6">
      <Fader
        label="Gamma"
        hint="Tone curve applied before the ladder. Below 1 lifts the mid tones."
        value={p.options.gamma} min={0.4} max={1.6} step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(gamma) => p.onChange({ gamma })}
      />
      <Fader
        label="Floor"
        hint="Cells below this ink level stay empty, which keeps the page open."
        value={p.options.floor} min={0} max={0.3} step={0.005}
        format={(v) => v.toFixed(3)}
        onChange={(floor) => p.onChange({ floor })}
      />
      {!organic && (
        <>
          <Fader
            label="Variety"
            hint="Coverage tolerance within which glyphs count as interchangeable. Zero repeats one glyph per tone."
            value={p.options.vary} min={0} max={0.2} step={0.005}
            format={(v) => v.toFixed(3)}
            onChange={(vary) => p.onChange({ vary })}
          />
          <Fader
            label="Glyph size"
            hint="Fraction of the cell. Below 1 opens space between neighbours."
            value={p.options.gutter} min={0.5} max={1} step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(gutter) => p.onChange({ gutter })}
          />
        </>
      )}
      <Fader
        label="Seed"
        value={p.options.seed} min={1} max={99} step={1}
        onChange={(seed) => p.onChange({ seed })}
      />
      {!organic && (
        <SwitchRow
          label="Knockout tiles"
          checked={p.options.knockout}
          onChange={(knockout) => p.onChange({ knockout })}
          hint="Solid cells with the glyph punched out. The only way an ordered grid reaches near-black, but they read as stickers rather than marks."
        />
      )}
    </div>
  )
}

function AdvancedSection(p: ControlsProps) {
  const [open, setOpen] = useState(false)
  return (
    <section className="border-rule border-b">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="hover:bg-raise/60 flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-fg-2 font-mono text-xs">Advanced</span>
        <ChevronDown className={cn('text-fg-2 size-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="px-5 pt-1 pb-6"><AdvancedFields {...p} /></div>}
    </section>
  )
}

export function Controls(p: ControlsProps) {
  if (p.layout === 'sheet') {
    switch (p.tab ?? 'style') {
      case 'style':
        return (
          <>
            <LookSection {...p} />
            <GlyphSection {...p} />
            <PlacementSection {...p} />
            <ColourSection {...p} />
          </>
        )
      case 'tone':
        return <Section label="Tone"><ToneFields {...p} /></Section>
      case 'paper':
        return (
          <>
            <Section label="Paper">
              <BackgroundControl value={p.background} onChange={p.onBackground} />
            </Section>
            <FocusSection {...p} />
            <PrepSection {...p} />
          </>
        )
      case 'more':
        return <Section label="Advanced"><AdvancedFields {...p} /></Section>
    }
  }

  return (
    <>
      <LookSection {...p} />
      <GlyphSection {...p} />
      <PlacementSection {...p} />
      <ColourSection {...p} />
      <Section label="Tone"><ToneFields {...p} /></Section>
      <Section label="Paper">
        <BackgroundControl value={p.background} onChange={p.onBackground} />
      </Section>
      <FocusSection {...p} />
      <PrepSection {...p} />
      <AdvancedSection {...p} />
    </>
  )
}
