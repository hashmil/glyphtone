import { useCallback, useMemo, useState } from 'react'
import { ArrowUpRight, ImageUp } from 'lucide-react'
import { toast, Toaster } from 'sonner'

import { type ControlsProps } from '@/components/Controls'
import { ControlRail } from '@/components/ControlRail'
import { DropOverlay, useFilePicker, useImageFile } from '@/components/Dropzone'
import { ExportDialog } from '@/components/ExportDialog'
import { Btn, Slug } from '@/components/kit'
import { Landing } from '@/components/Landing'
import { MobileControls } from '@/components/MobileControls'
import { MosaicCanvas } from '@/components/MosaicCanvas'
import { DEFAULT_BACKGROUND, type Background } from '@/engine/background'
import { loadSample } from '@/lib/sample'
import { useMosaic } from '@/lib/useMosaic'

export default function App() {
  const m = useMosaic()
  const [drawingFocus, setDrawingFocus] = useState(false)
  // Deliberately outlives a new image, like the pack, the palette and the
  // preset: those are the look you have settled on, and a new source image is
  // usually the same job. Only the focal box is cleared, because it is stored
  // in the old image's pixels.
  const [background, setBackground] = useState<Background>(DEFAULT_BACKGROUND)

  const onError = useCallback((msg: string) => toast.error(msg), [])
  const accept = useImageFile(m.load, onError)
  const onFile = useCallback((f: File | undefined) => void accept(f), [accept])
  const picker = useFilePicker(onFile)

  // Stable identity, so the export preview rebuilds only when the piece does.
  const exportCtx = useMemo(
    () => (m.maps ? { maps: m.maps, pack: m.pack, palette: m.palette, options: m.options } : null),
    [m.maps, m.pack, m.palette, m.options],
  )

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
    lift: m.lift,
    onLift: m.setLift,
    drawingFocus,
    onDrawingFocus: setDrawingFocus,
    hasFocus: m.options.figureBox !== null,
    background,
    onBackground: setBackground,
  }

  return (
    // The shell is exactly the viewport and never scrolls. Every scroll region
    // below is explicit and bounded.
    <div className="bg-ink text-fg flex h-dvh min-h-0 flex-col overflow-hidden">
      <Toaster
        position="bottom-center"
        theme="dark"
        toastOptions={{
          classNames: {
            toast: '!bg-ink !border-rule-2 !text-fg !rounded-sm !font-sans',
          },
        }}
      />
      {picker.input}
      <DropOverlay onFile={onFile} label={m.source ? 'Drop to replace the image' : 'Drop to begin'} />

      <header className="border-rule flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-5">
          <button
            type="button"
            onClick={m.source ? m.reset : undefined}
            className="font-display flex shrink-0 cursor-pointer items-center gap-2 text-[18px] leading-none"
            aria-label={m.source ? 'Glyphtone, back to the start' : 'Glyphtone'}
          >
            <Mark />
            Glyphtone
          </button>
          {m.source && (
            <Slug
              className="hidden min-w-0 md:flex"
              parts={[
                `${m.source.width.toLocaleString()} × ${m.source.height.toLocaleString()} px source`,
                m.pack.label,
                m.pack.mode === 'text' ? 'own colour' : m.palette.label,
              ]}
            />
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {m.source ? (
            <>
              <Btn tone="bare" onClick={picker.open} aria-label="Open another image">
                <ImageUp />
                <span className="hidden sm:inline">Open image</span>
              </Btn>
              <ExportDialog
                ctx={exportCtx}
                background={background}
                disabled={!m.result || m.busy}
              />
            </>
          ) : (
            <a
              href="https://github.com/hashmil/glyphtone"
              target="_blank"
              rel="noreferrer"
              className="text-fg-2 hover:text-fg inline-flex items-center gap-1 font-mono text-xs transition-colors"
            >
              GitHub <ArrowUpRight className="size-3" />
            </a>
          )}
        </div>
      </header>

      {!m.source ? (
        // The landing page is a page rather than a workspace, so it gets a
        // scroll region of its own. The document itself still never scrolls.
        <main className="scroll-quiet min-h-0 flex-1 overflow-y-auto">
          <Landing
            packId={m.packId}
            paletteId={m.paletteId}
            onPack={m.setPackId}
            onChoose={picker.open}
            onSample={() => loadSample().then(m.load, (e: Error) => onError(e.message))}
          />
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="bg-table relative flex min-h-0 flex-1 flex-col p-4 sm:p-8 lg:min-w-0">
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
          </div>
          <ControlRail className="border-rule hidden border-l lg:flex" {...controlProps} />
          <div className="lg:hidden">
            <MobileControls {...controlProps} />
          </div>
        </main>
      )}
    </div>
  )
}

/** The mark: a 2 × 2 cell of the tonal ladder, light to dark, which is the
 *  whole idea of the tool in four squares. */
function Mark() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <circle cx="4" cy="4" r="1" fill="currentColor" />
      <rect x="10.5" y="2.5" width="3" height="3" fill="currentColor" />
      <circle cx="4" cy="12" r="2.6" fill="currentColor" />
      <rect x="9" y="9" width="6" height="6" fill="var(--gt-magenta)" />
    </svg>
  )
}
