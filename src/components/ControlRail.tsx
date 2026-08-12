import { Controls, type ControlsProps } from '@/components/Controls'
import { cn } from '@/lib/utils'

/** The desktop control column.
 *
 * This is the only scroll region on desktop. Everything else, header, canvas
 * pane, is sized to the viewport and does not scroll, which is the whole point
 * of the shell: a panel scrolling inside a page that also scrolls gives two
 * scrollbars, two scroll positions and a canvas that wanders off the top.
 */
export function ControlRail({
  className, ...p
}: ControlsProps & { className?: string }) {
  return (
    <aside
      className={cn(
        'flex min-h-0 w-[330px] shrink-0 flex-col',
        className,
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
        <Controls {...p} />
      </div>
    </aside>
  )
}
