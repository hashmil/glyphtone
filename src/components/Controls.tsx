import { useState } from 'react'
import { ChevronDown, SquareDashed } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Field } from '@/components/Field'
import { BackgroundControl } from '@/components/BackgroundControl'
import type { Background } from '@/engine/background'
import { PACKS } from '@/engine/packs'
import { PALETTES, ZONE_IDS } from '@/engine/palettes'
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
  drawingFocus: boolean
  onDrawingFocus: (on: boolean) => void
  hasFocus: boolean
  background: Background
  onBackground: (bg: Background) => void
  /** `sheet` splits the same controls into tabs. Stacked, they are 1,145 px
   *  tall, which is a long scroll inside a phone-height sheet. */
  layout?: 'sidebar' | 'sheet'
  /** Sheet layout only. Supplied when the tab is chosen outside the sheet, by
   *  a segmented bar that also opens it, so the two cannot disagree. */
  tab?: SheetTab
  onTab?: (tab: SheetTab) => void
}

export type SheetTab = 'style' | 'tone' | 'image' | 'more'

export const SHEET_TABS: Array<{ id: SheetTab; label: string }> = [
  { id: 'style', label: 'Style' },
  { id: 'tone', label: 'Tone' },
  { id: 'image', label: 'Image' },
  { id: 'more', label: 'More' },
]

function PackSelect(p: ControlsProps) {
  const pack = PACKS.find((x) => x.id === p.packId)
  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-medium">Glyphs</Label>
      <Select value={p.packId} onValueChange={p.onPack}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {PACKS.map((k) => (
            <SelectItem key={k.id} value={k.id}>
              <span className="flex flex-col items-start">
                <span>{k.label}</span>
                <span className="text-muted-foreground text-[11px]">{k.hint}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pack?.note && (
        <p className="text-[11px] leading-snug text-amber-700">{pack.note}</p>
      )}
    </div>
  )
}

function MethodSelect(p: ControlsProps) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-medium">Placement</Label>
      <Select
        value={p.options.method}
        onValueChange={(v) => p.onChange({ method: v as Method })}
      >
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="grid">
            <span className="flex flex-col items-start">
              <span>Ordered</span>
              <span className="text-muted-foreground text-[11px]">
                One icon per cell, nothing overlaps.
              </span>
            </span>
          </SelectItem>
          <SelectItem value="organic">
            <span className="flex flex-col items-start">
              <span>Organic</span>
              <span className="text-muted-foreground text-[11px]">
                Scattered and overlapping. Messier, far more marks, goes darker.
              </span>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

function PaletteSelect(p: ControlsProps) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-medium">Colour</Label>
      <Select value={p.paletteId} onValueChange={p.onPalette}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {PALETTES.map((pal) => (
            <SelectItem key={pal.id} value={pal.id}>
              <span className="flex items-center gap-2">
                <span className="flex">
                  {ZONE_IDS.map((z) => (
                    <span
                      key={z}
                      className="size-3 rounded-[2px] ring-1 ring-black/10"
                      style={{ background: `rgb(${pal.ramps[z][1].join(',')})` }}
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
  )
}

function PresetSelect(p: ControlsProps) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-medium">Look</Label>
      <Select value={p.presetId} onValueChange={p.onPreset}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {PRESETS.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              <span className="flex flex-col items-start">
                <span>{preset.label}</span>
                <span className="text-muted-foreground text-[11px]">{preset.hint}</span>
              </span>
            </SelectItem>
          ))}
          {p.presetId === 'custom' && <SelectItem value="custom">Custom</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  )
}

function ToneFields(p: ControlsProps) {
  const organic = p.options.method === 'organic'
  return (
    <>
      {organic ? (
        <>
          <Field
            label="Density"
            hint="How many marks get placed. The count rises with the square of this, so small steps do a lot: 0.55 is around 19,000 marks, 1.5 is around 140,000."
            value={p.options.density} min={0.15} max={3} step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(density) => p.onChange({ density })}
          />
          <Field
            label="Mark size"
            hint="Independent of the count, so sparse and large is reachable. Overlap is what lets organic go genuinely dark."
            value={p.options.glyphScale} min={0.4} max={4} step={0.05}
            format={(v) => `${v.toFixed(2)}x`}
            onChange={(glyphScale) => p.onChange({ glyphScale })}
          />
          <Field
            label="Size spread"
            hint="How much marks vary in size around that. Zero makes every mark in a pass identical, which reads as a stamp."
            value={p.options.sizeJitter} min={0} max={0.6} step={0.01}
            format={(v) => `±${Math.round(v * 100)}%`}
            onChange={(sizeJitter) => p.onChange({ sizeJitter })}
          />
        </>
      ) : (
        <Field
          label="Columns"
          hint="Cells across the long edge. The single strongest control over how the piece reads, and the one number that decides whether the glyphs are legible."
          value={p.options.cols} min={40} max={700} step={5}
          onChange={(cols) => p.onChange({ cols })}
        />
      )}
      <Field
        label="Contrast"
        value={p.options.contrast} min={0.5} max={1.8} step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(contrast) => p.onChange({ contrast })}
      />
      {organic ? (
        <Field
          label="Weighting"
          hint="How strongly darkness picks a heavier glyph rather than chance."
          value={p.options.weightBias} min={0} max={1} step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(weightBias) => p.onChange({ weightBias })}
        />
      ) : (
        <Field
          label="Sparkle"
          hint="Per-cell lightness jitter. A little is what stops a flat area reading as a wash."
          value={p.options.valnoise} min={0} max={0.6} step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(valnoise) => p.onChange({ valnoise })}
        />
      )}
    </>
  )
}

function FocusControl(p: ControlsProps) {
  return (
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
          ? 'This region gets its own icons and colour ramp. Tap once on the image to clear it.'
          : 'Optional. Marks a subject so it keeps its own icons and colour instead of blending into the background.'}
      </p>
    </div>
  )
}

function PrepControls(p: ControlsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="flex items-center gap-2">
            <Label className="text-[13px] font-medium">Photograph prep</Label>
            {p.suggestPrep && !p.prepEnabled && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                suggested
              </span>
            )}
          </span>
          <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
            A photo has tone everywhere, so fed in raw it fills every cell and
            reads as a slab. This removes the broad lighting and keeps real
            darkness.
          </p>
        </div>
        <Switch
          className="shrink-0"
          checked={p.prepEnabled}
          onCheckedChange={p.onPrepEnabled}
        />
      </div>

      {p.prepEnabled && (
        <div className="space-y-4">
          <Field
            label="Detail" hint="Lower keeps more local texture."
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
    </div>
  )
}

function AdvancedFields(p: ControlsProps) {
  const organic = p.options.method === 'organic'
  return (
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
      {!organic && (
        <>
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
        </>
      )}
      <Field
        label="Seed"
        value={p.options.seed} min={1} max={99} step={1}
        onChange={(seed) => p.onChange({ seed })}
      />
      {!organic && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Label className="text-[13px] font-medium">Knockout tiles</Label>
            <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
              Solid cells with the icon punched out. The only way an ordered
              grid reaches near-black, but they read as stickers rather than
              as marks.
            </p>
          </div>
          <Switch
            className="shrink-0"
            checked={p.options.knockout}
            onCheckedChange={(knockout) => p.onChange({ knockout })}
          />
        </div>
      )}
    </div>
  )
}

/** Collapsible section, used only in the sidebar. The sheet uses tabs. */
function Collapsible({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <Label className="cursor-pointer text-[13px] font-medium">{label}</Label>
        <ChevronDown
          className={cn('text-muted-foreground size-4 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && children}
    </section>
  )
}

export function Controls(p: ControlsProps) {
  if (p.layout === 'sheet') {
    return (
      <Tabs
        value={p.tab}
        defaultValue={p.tab ? undefined : 'style'}
        onValueChange={(v) => p.onTab?.(v as SheetTab)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4">
          {SHEET_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="style" className="space-y-5 pt-4">
          <PackSelect {...p} />
          <MethodSelect {...p} />
          <PaletteSelect {...p} />
        </TabsContent>
        <TabsContent value="tone" className="space-y-5 pt-4">
          <PresetSelect {...p} />
          <ToneFields {...p} />
        </TabsContent>
        <TabsContent value="image" className="space-y-5 pt-4">
          <BackgroundControl value={p.background} onChange={p.onBackground} />
          <Separator />
          <FocusControl {...p} />
          <Separator />
          <PrepControls {...p} />
        </TabsContent>
        <TabsContent value="more" className="pt-4">
          <AdvancedFields {...p} />
        </TabsContent>
      </Tabs>
    )
  }

  return (
    <div className="space-y-5">
      <PresetSelect {...p} />
      <PackSelect {...p} />
      <MethodSelect {...p} />
      <PaletteSelect {...p} />
      <ToneFields {...p} />
      <Separator />
      <BackgroundControl value={p.background} onChange={p.onBackground} />
      <Separator />
      <FocusControl {...p} />
      <Separator />
      <PrepControls {...p} />
      <Separator />
      <Collapsible label="Advanced"><AdvancedFields {...p} /></Collapsible>
    </div>
  )
}
