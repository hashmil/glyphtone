import { useState } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Controls, SHEET_TABS, type ControlsProps, type SheetTab } from '@/components/Controls'
import { cn } from '@/lib/utils'

/** Controls on a phone.
 *
 * They are not a narrowed sidebar. A 330 px rail at 390 px wide leaves the
 * canvas 60 px, and every shipped tool with this shape, tldraw, Excalidraw,
 * Photoroom, does the same thing instead: the canvas keeps the screen and the
 * controls come up over it on demand.
 *
 * A permanent segmented bar rather than a single Adjust button. Both were
 * built and shot (review/s1-option{A,B}-390.png); the bar wins because the
 * section is chosen before the sheet opens, so reaching Tone is one tap rather
 * than two, and the bar doubles as a map of what there is to adjust.
 *
 * The sheet keeps its own tab strip as well. That is not a duplicate: the sheet
 * covers the bottom of the screen, so once it is open the bar is behind it and
 * there would otherwise be no way to change section without closing first.
 */
export function MobileControls(p: ControlsProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<SheetTab>('style')

  const openAt = (t: SheetTab) => {
    setTab(t)
    setOpen(true)
  }

  return (
    <>
      <div
        className={cn(
          'bg-background/95 shrink-0 border-t backdrop-blur',
          // The home indicator on a modern phone sits over the last ~20 px.
          'pb-[env(safe-area-inset-bottom)]',
        )}
      >
        <div className="grid grid-cols-4">
            {SHEET_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openAt(t.id)}
                className={cn(
                  'py-3 text-[12px] font-medium transition-colors',
                  'active:bg-accent',
                  open && tab === t.id ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {t.label}
              </button>
          ))}
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        {/* Fixed height rather than max-height: the tabs keep each panel short,
            and a sheet that resizes as you switch tabs is worse than one that
            stays put.

            The variant selector is required. SheetContent's own base class sets
            data-[side=bottom]:h-auto, which is a variant and therefore beats a
            plain h-[70dvh] on specificity, so the height silently came from the
            content: 43% of the viewport on Style, 79% on Image. */}
        <SheetContent
          side="bottom"
          className="flex flex-col gap-0 overflow-hidden rounded-t-xl p-0 data-[side=bottom]:h-[70dvh]"
        >
          <SheetHeader className="shrink-0 border-b px-4 py-3">
            <SheetTitle className="text-left text-[15px]">Adjust</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-8">
            <Controls
              {...p}
              layout="sheet"
              tab={tab}
              onTab={setTab}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
