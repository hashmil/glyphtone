import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'

interface Props {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  /** how the number reads next to the label; raw values are rarely meaningful */
  format?: (v: number) => string
  onChange: (v: number) => void
}

export function Field({ label, hint, value, min, max, step, format, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label className="text-[13px] font-medium">{label}</Label>
        <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
          {format ? format(value) : value}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
      {hint && <p className="text-muted-foreground text-[11px] leading-snug">{hint}</p>}
    </div>
  )
}
