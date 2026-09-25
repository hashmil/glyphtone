import * as React from 'react'
import { Slider as SliderPrimitive, Switch as SwitchPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

/** The handful of controls the docket is built from. Written here rather than
 *  styled out of the shadcn defaults, because every one of them is a decision
 *  in DESIGN.md and the defaults carry a different set of decisions. */

type ButtonTone = 'paper' | 'line' | 'bare'

export const Btn = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> & { tone?: ButtonTone; size?: 'sm' | 'md' | 'lg' }
>(function Btn({ tone = 'line', size = 'md', className, type = 'button', ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm font-medium whitespace-nowrap select-none',
        'transition-[background-color,color,border-color] duration-150',
        'disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0',
        size === 'sm' && 'h-7 px-2.5 text-xs',
        size === 'md' && 'h-8 px-3 text-sm',
        size === 'lg' && 'h-11 px-5 text-sm',
        tone === 'paper' && 'bg-paper text-ink hover:bg-fg',
        tone === 'line' && 'border-rule-2 text-fg hover:border-fg-2 hover:bg-raise border',
        tone === 'bare' && 'text-fg-2 hover:text-fg hover:bg-raise',
        className,
      )}
      {...props}
    />
  )
})

/** A docket entry: mono label on the left, the current value on the right,
 *  the control underneath. */
export function Section({
  label, value, children, className, action,
}: {
  label: React.ReactNode
  value?: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('border-rule border-b px-5 py-5', className)}>
      <header className="mb-3 flex min-h-4 items-baseline justify-between gap-3">
        <h3 className="text-fg-2 font-mono text-xs">{label}</h3>
        {value != null && (
          <span className="text-fg truncate font-mono text-xs tabular-nums">{value}</span>
        )}
        {action}
      </header>
      {children}
    </section>
  )
}

export function Segmented<T extends string>({
  value, options, onChange, className, size = 'md',
}: {
  value: T
  options: Array<{ id: T; label: React.ReactNode; title?: string }>
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="radiogroup"
      className={cn('border-rule-2 grid rounded-sm border p-0.5', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.id)}
            className={cn(
              'cursor-pointer rounded-[1px] font-medium transition-colors duration-150',
              size === 'md' ? 'h-7 text-sm' : 'h-6 text-xs',
              on ? 'bg-paper text-ink' : 'text-fg-2 hover:text-fg',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Slider with its value written beside the label. Raw values are rarely
 *  meaningful, so each one supplies its own format. */
export function Fader({
  label, hint, value, min, max, step, format, onChange,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">{label}</span>
        <span className="text-fg font-mono text-xs tabular-nums">
          {format ? format(value) : value}
        </span>
      </div>
      <Track value={value} min={min} max={max} step={step} onChange={onChange} label={label} />
      {hint && <p className="text-fg-2 text-xs">{hint}</p>}
    </div>
  )
}

export function Track({
  value, min, max, step, onChange, label,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  label: string
}) {
  return (
    <SliderPrimitive.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([v]) => onChange(v)}
      className="group relative flex h-4 w-full cursor-pointer touch-none items-center select-none"
    >
      <SliderPrimitive.Track className="bg-rule-2 relative h-px grow">
        <SliderPrimitive.Range className="bg-fg absolute h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        className={cn(
          'bg-paper block size-2.5 rounded-[1px] transition-transform duration-100',
          'group-hover:scale-125 focus-visible:scale-125 focus-visible:outline-magenta',
          'after:absolute after:-inset-3',
        )}
      />
    </SliderPrimitive.Root>
  )
}

export function Toggle({
  checked, onChange, label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className={cn(
        'border-rule-2 relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-[2px] border transition-colors',
        'data-[state=checked]:border-paper data-[state=checked]:bg-paper',
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'bg-fg-2 block size-2.5 translate-x-[2px] rounded-[1px] transition-transform duration-150',
          'data-[state=checked]:bg-ink data-[state=checked]:translate-x-[13px]',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

/** A row with a label, an explanation and a switch. */
export function SwitchRow({
  label, hint, checked, onChange, badge,
}: {
  label: string
  hint?: React.ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  badge?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span className="flex items-center gap-2 text-sm">
          {label}
          {badge}
        </span>
        {hint && <p className="text-fg-2 mt-1 text-xs">{hint}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

/** Mono slug-line text, separated by thin rules rather than bullets. */
type SlugPart = React.ReactNode | { node: React.ReactNode; className: string }

export function Slug({ parts, className }: { parts: SlugPart[]; className?: string }) {
  const isWrapped = (p: SlugPart): p is { node: React.ReactNode; className: string } =>
    !!p && typeof p === 'object' && 'node' in p
  return (
    <p className={cn('text-fg-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs tabular-nums', className)}>
      {parts.filter(Boolean).map((p, i) => (
        <span key={i} className={cn('flex items-center gap-3', isWrapped(p) && p.className)}>
          {i > 0 && <span className="bg-fg-3 h-2.5 w-px" aria-hidden />}
          {isWrapped(p) ? p.node : p}
        </span>
      ))}
    </p>
  )
}
