import { Controls, type ControlsProps } from '@/components/Controls'
import { cn } from '@/lib/utils'

/** The desktop docket.
 *
 * The only scroll region on desktop. Everything else, masthead and table, is
 * sized to the viewport and does not scroll: a panel scrolling inside a page
 * that also scrolls gives two scrollbars and a piece that wanders off the top.
 */
export function ControlRail({
  className, ...p
}: ControlsProps & { className?: string }) {
  return (
    <aside className={cn('bg-ink flex min-h-0 w-[344px] shrink-0 flex-col', className)}>
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto overscroll-contain pb-10">
        <Controls {...p} />
      </div>
    </aside>
  )
}
