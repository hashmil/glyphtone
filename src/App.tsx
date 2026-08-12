import { useState } from 'react'
import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { toast, Toaster } from 'sonner'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Controls } from '@/components/Controls'
import { Dropzone } from '@/components/Dropzone'
import { ExportDialog } from '@/components/ExportDialog'
import { MosaicCanvas } from '@/components/MosaicCanvas'
import { useMosaic } from '@/lib/useMosaic'

export default function App() {
  const m = useMosaic()
  const [drawingFocus, setDrawingFocus] = useState(false)

  const controls = (
    <Controls
      options={m.options}
      onChange={m.update}
      paletteId={m.paletteId}
      onPalette={m.setPaletteId}
      presetId={m.presetId}
      onPreset={m.applyPreset}
      prep={m.prep}
      onPrep={(patch) => m.setPrep((v) => ({ ...v, ...patch }))}
      prepEnabled={m.prepEnabled}
      onPrepEnabled={m.setPrepEnabled}
      suggestPrep={m.suggestPrep}
      drawingFocus={drawingFocus}
      onDrawingFocus={setDrawingFocus}
      hasFocus={m.options.figureBox !== null}
    />
  )

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <Toaster position="top-center" />

      <header className="flex items-center justify-between gap-4 border-b px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[15px] font-semibold tracking-tight">Glyphtone</h1>
          <p className="text-muted-foreground hidden text-[12px] sm:block">
            Images rebuilt from thousands of icons
          </p>
        </div>
        <div className="flex items-center gap-2">
          {m.source && (
            <Button variant="ghost" size="sm" onClick={m.reset}>
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">New image</span>
            </Button>
          )}
          {m.source && (
            <ExportDialog
              ctx={m.maps ? { maps: m.maps, palette: m.palette, options: m.options } : null}
              disabled={!m.result}
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
              <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
                <SheetHeader className="px-0">
                  <SheetTitle className="text-[15px]">Adjust</SheetTitle>
                </SheetHeader>
                <div className="pb-8">{controls}</div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-6">
        {!m.source ? (
          <div className="mx-auto max-w-2xl pt-8">
            <Dropzone onLoad={m.load} onError={(msg) => toast.error(msg)} />
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <MosaicCanvas
              result={m.result}
              source={m.source}
              figureBox={m.options.figureBox}
              onFigureBox={(figureBox) => {
                m.update({ figureBox })
                setDrawingFocus(false)
              }}
              drawing={drawingFocus}
            />
            <aside className="hidden lg:block">
              <div className="sticky top-6">{controls}</div>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
