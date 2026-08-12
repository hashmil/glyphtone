import { useState } from 'react'
import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { toast, Toaster } from 'sonner'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Controls, type ControlsProps } from '@/components/Controls'
import { Dropzone } from '@/components/Dropzone'
import { ExportDialog } from '@/components/ExportDialog'
import { MosaicCanvas } from '@/components/MosaicCanvas'
import { useMosaic } from '@/lib/useMosaic'

export default function App() {
  const m = useMosaic()
  const [drawingFocus, setDrawingFocus] = useState(false)

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
  }

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <Toaster position="top-center" />

      <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[15px] font-semibold tracking-tight">Glyphtone</h1>
          <p className="text-muted-foreground hidden text-[12px] md:block">
            Images rebuilt from thousands of icons
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {m.source && (
            <Button variant="ghost" size="sm" onClick={m.reset}>
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">New image</span>
            </Button>
          )}
          {m.source && (
            <ExportDialog
              ctx={m.maps
                ? { maps: m.maps, pack: m.pack, palette: m.palette, options: m.options }
                : null}
              disabled={!m.result || m.busy}
            />
          )}
          {m.source && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal className="size-3.5" />
                  Adjust
                </Button>
              </SheetTrigger>
              {/* Fixed height rather than max-height: the tabs keep each panel
                  short, and a sheet that resizes as you switch tabs is worse
                  than one that stays put. */}
              <SheetContent
                side="bottom"
                className="h-[68dvh] gap-0 overflow-hidden rounded-t-xl p-0"
              >
                <SheetHeader className="border-b px-4 py-3">
                  <SheetTitle className="text-left text-[15px]">Adjust</SheetTitle>
                </SheetHeader>
                <div className="h-full overflow-y-auto overscroll-contain px-4 pt-3 pb-24">
                  <Controls {...controlProps} layout="sheet" />
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-5 sm:py-6">
        {!m.source ? (
          <div className="mx-auto max-w-2xl pt-8">
            <Dropzone onLoad={m.load} onError={(msg) => toast.error(msg)} />
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_310px]">
            <MosaicCanvas
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
            <aside className="hidden lg:block">
              <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto pr-1">
                <Controls {...controlProps} />
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
