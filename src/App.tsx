import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { toast, Toaster } from 'sonner'

import { Button } from '@/components/ui/button'
import { type ControlsProps } from '@/components/Controls'
import { ControlRail } from '@/components/ControlRail'
import { ExportDialog } from '@/components/ExportDialog'
import { Landing } from '@/components/Landing'
import { MobileControls } from '@/components/MobileControls'
import { MosaicCanvas } from '@/components/MosaicCanvas'
import { DEFAULT_BACKGROUND, type Background } from '@/engine/background'
import { useMosaic } from '@/lib/useMosaic'


export default function App() {
  const m = useMosaic()
  const [drawingFocus, setDrawingFocus] = useState(false)
  // Deliberately outlives "New image", like the pack, the palette and the
  // preset: those are the look you have settled on, and a new source image is
  // usually the same job. Only the focal box is cleared, because it is stored
  // in the old image's pixels.
  const [background, setBackground] = useState<Background>(DEFAULT_BACKGROUND)

  const controlProps: ControlsProps = {
    options: m.options,
    onChange: m.update,
    packId: m.packId,
    onPack: m.setPackId,
    paletteId: m.paletteId,
    onPalette: m.setPaletteId,
    presetId: m.presetId,
    onPreset: m.applyPreset,
    prep: m.prep,
    onPrep: (patch) => m.setPrep((v) => ({ ...v, ...patch })),
    prepEnabled: m.prepEnabled,
    onPrepEnabled: m.setPrepEnabled,
    suggestPrep: m.suggestPrep,
    drawingFocus,
    onDrawingFocus: setDrawingFocus,
    hasFocus: m.options.figureBox !== null,
    background,
    onBackground: setBackground,
  }

  const canvas = (
    <MosaicCanvas
      className="h-full min-h-0"
      sizing="fit"
      background={background}
      result={m.result}
      pack={m.pack}
      source={m.source}
      status={m.status}
      figureBox={m.options.figureBox}
      onFigureBox={(figureBox) => {
        m.update({ figureBox })
        setDrawingFocus(false)
      }}
      drawing={drawingFocus}
    />
  )

  return (
    // The shell is exactly the viewport and never scrolls. Every scroll region
    // below is explicit and bounded.
    <div className="bg-background text-foreground flex h-dvh min-h-0 flex-col overflow-hidden">
      <Toaster position="top-center" />

      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[15px] font-semibold tracking-tight">Glyphtone</h1>
          <p className="text-muted-foreground hidden text-[12px] md:block">
            Images rebuilt from thousands of icons
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {m.source && (
            <Button variant="ghost" size="sm" onClick={m.reset} aria-label="New image">
              <RotateCcw className="size-3.5" />
              {/* Below sm the label is hidden, so the button needs the name on
                  the element or it is an unlabelled icon to a screen reader. */}
              <span className="hidden sm:inline">New image</span>
            </Button>
          )}
          {m.source && (
            <ExportDialog
              ctx={m.maps
                ? { maps: m.maps, pack: m.pack, palette: m.palette, options: m.options }
                : null}
              background={background}
              disabled={!m.result || m.busy}
            />
          )}
        </div>
      </header>

      {!m.source ? (
        // The landing page is a page rather than a workspace, so it gets a
        // scroll region of its own. The document still never scrolls: the shell
        // is the viewport and this scrolls inside it.
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Landing
            onLoad={m.load}
            onPreset={m.applyPreset}
            onError={(msg) => toast.error(msg)}
          />
        </main>
      ) : (
        // Desktop: a docked rail rather than a panel floating over the canvas.
        // Both were built and shot at 1440 and 390 (review/s1-option{A,B}-*);
        // the floating panel had to reserve the same 360 px of canvas anyway to
        // avoid covering the piece, so it was a docked rail wearing a shadow.
        //
        // Mobile takes the other option's answer: a segmented bar, one tap to
        // the section you want, instead of a single Adjust button that always
        // opens on Style.
        <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-5 lg:min-w-0">
            {canvas}
          </div>
          <ControlRail className="hidden border-l lg:flex" {...controlProps} />
          <div className="lg:hidden">
            <MobileControls {...controlProps} />
          </div>
        </main>
      )}
    </div>
  )
}
