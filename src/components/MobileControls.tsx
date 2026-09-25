import { useEffect, useState } from 'react'

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Controls, SHEET_TABS, type ControlsProps, type SheetTab } from '@/components/Controls'
import { cn } from '@/lib/utils'

/** Controls on a phone.
 *
 * Not a narrowed sidebar: a 344 px docket at 390 px wide leaves the piece
 * nothing. The piece keeps the screen and the docket comes up over it.
 *
 * A permanent section bar rather than a single Adjust button, so reaching Tone
 * is one tap rather than two, and the bar doubles as a map of what there is.
 * The sheet repeats the bar at its top because once open it covers this one.
 */
export function MobileControls(p: ControlsProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<SheetTab>('style')

  // Drawing a focal region needs the piece, and the sheet is modal, so it
  // steps out of the way as soon as drawing starts.
  useEffect(() => {
    if (p.drawingFocus) setOpen(false)
  }, [p.drawingFocus])

  return (
    <>
      <nav className="bg-ink border-rule shrink-0 border-t pb-[env(safe-area-inset-bottom)]">
        <Tabs value={open ? tab : null} onPick={(t) => { setTab(t); setOpen(true) }} />
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        {/* The variant selector is required: SheetContent's base class sets
            data-[side=bottom]:h-auto, which beats a plain h-[58dvh].

            No dimming overlay: the piece stays visible above the sheet, so a
            change can be judged while it is being made. */}
        <SheetContent
          side="bottom"
          showCloseButton={false}
          overlayClassName="bg-transparent backdrop-blur-none supports-backdrop-filter:backdrop-blur-none"
          className="bg-ink border-rule-2 flex flex-col gap-0 overflow-hidden p-0 shadow-[0_-12px_32px_-8px_rgb(0_0_0/0.6)] data-[side=bottom]:h-[58dvh]"
        >
          <SheetTitle className="sr-only">Adjust</SheetTitle>
          <div className="border-rule shrink-0 border-b">
            <div className="bg-rule-2 mx-auto mt-2 mb-1 h-[3px] w-9" aria-hidden />
            <Tabs value={tab} onPick={setTab} />
          </div>
          <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto overscroll-contain pb-10">
            <Controls {...p} layout="sheet" tab={tab} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function Tabs({ value, onPick }: { value: SheetTab | null; onPick: (t: SheetTab) => void }) {
  return (
    <div className="grid grid-cols-4" role="tablist">
      {SHEET_TABS.map((t) => {
        const on = value === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onPick(t.id)}
            className={cn(
              'relative h-12 cursor-pointer text-sm transition-colors',
              on ? 'text-fg' : 'text-fg-2 active:text-fg',
            )}
          >
            {t.label}
            <span
              className={cn('absolute inset-x-5 bottom-0 h-[2px] transition-colors', on ? 'bg-magenta' : 'bg-transparent')}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
}
