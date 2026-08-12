import { useMemo, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Field } from '@/components/Field'
import { planExport, runExport, type ExportContext, type ExportFormat } from '@/lib/export'

interface Props {
  ctx: ExportContext | null
  disabled?: boolean
}

/** Print sizes rather than pixel counts, because that is the decision being
 *  made. Environmental graphics people walk past at two to three metres need
 *  roughly 100 to 200 dpi, which is far above the 15 to 30 dpi rule of thumb
 *  quoted for roadside billboards. */
const SIZES = [
  { id: 'screen', label: 'Screen', px: 2400, note: '2,400 px' },
  { id: 'a1', label: 'A1 poster at 150 dpi', px: 4961, note: '4,961 px' },
  { id: 'p1', label: '1 m panel at 150 dpi', px: 5906, note: '5,906 px' },
  { id: 'p3', label: '3 m panel at 150 dpi', px: 17717, note: '17,717 px' },
  { id: 'custom', label: 'Custom', px: 0, note: '' },
]

export function ExportDialog({ ctx, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<ExportFormat>('svg')
  const [sizeId, setSizeId] = useState('screen')
  const [custom, setCustom] = useState(6000)
  const [tiling, setTiling] = useState(false)
  const [tile, setTile] = useState(4000)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<[number, number]>([0, 0])

  const width = sizeId === 'custom' ? custom : (SIZES.find((s) => s.id === sizeId)?.px ?? 2400)

  const req = useMemo(
    () => ({
      format, width, tile: tiling ? tile : 0,
      background: '#ffffff', basename: 'glyphtone',
    }),
    [format, width, tiling, tile],
  )

  const plan = useMemo(
    () => (ctx ? planExport(req, ctx.maps.width / ctx.maps.height) : null),
    [ctx, req],
  )

  async function go() {
    if (!ctx || !plan) return
    setBusy(true)
    setProgress([0, plan.tiles])
    try {
      await runExport(req, ctx, (done, total) => setProgress([done, total]))
      toast.success(plan.tiles > 1 ? `${plan.tiles} tiles exported` : 'Exported')
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Download className="size-3.5" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            Rendered on your device at full resolution. Nothing is uploaded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label className="text-[13px] font-medium">Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="svg">
                  <span className="flex flex-col items-start">
                    <span>SVG</span>
                    <span className="text-muted-foreground text-[11px]">
                      Vector, sharp at any size. Opens in Illustrator.
                    </span>
                  </span>
                </SelectItem>
                <SelectItem value="svgz">
                  <span className="flex flex-col items-start">
                    <span>SVGZ</span>
                    <span className="text-muted-foreground text-[11px]">
                      The same file compressed, usually a fraction of the size.
                    </span>
                  </span>
                </SelectItem>
                <SelectItem value="png">
                  <span className="flex flex-col items-start">
                    <span>PNG</span>
                    <span className="text-muted-foreground text-[11px]">
                      Pixels. Simpler to hand on, but fixed at this resolution.
                    </span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-medium">Size</Label>
            <Select value={sizeId} onValueChange={setSizeId}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex flex-col items-start">
                      <span>{s.label}</span>
                      {s.note && (
                        <span className="text-muted-foreground text-[11px]">{s.note}</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sizeId === 'custom' && (
            <Field
              label="Width"
              value={custom} min={800} max={30000} step={100}
              format={(v) => `${v.toLocaleString()} px`}
              onChange={setCustom}
            />
          )}

          <div className="flex items-start justify-between gap-3">
            <div>
              <Label className="text-[13px] font-medium">Split into tiles</Label>
              <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
                Delivered as one zip. Tiles are crops of a single render, so
                tone lines up across the joins.
              </p>
            </div>
            <Switch checked={tiling} onCheckedChange={setTiling} />
          </div>

          {tiling && (
            <Field
              label="Tile size"
              value={tile} min={1000} max={16000} step={500}
              format={(v) => `${v.toLocaleString()} px`}
              onChange={setTile}
            />
          )}

          {plan && (
            <div className="bg-muted/50 space-y-1.5 rounded-md p-3">
              <p className="font-mono text-[11px] tabular-nums">
                {plan.outWidth.toLocaleString()} x {plan.outHeight.toLocaleString()} px
                {plan.tiles > 1 && ` · ${plan.cols}x${plan.rows} tiles`}
              </p>
              {plan.blocked && (
                <p className="text-destructive text-[11px] leading-snug">{plan.blocked}</p>
              )}
              {plan.warnings.map((w) => (
                <p key={w} className="text-[11px] leading-snug text-amber-700">{w}</p>
              ))}
            </div>
          )}

          {busy && progress[1] > 1 && (
            <div className="space-y-1.5">
              <Progress value={(progress[0] / progress[1]) * 100} />
              <p className="text-muted-foreground font-mono text-[11px]">
                tile {progress[0]} of {progress[1]}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={go} disabled={busy || !!plan?.blocked || !ctx}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {busy ? 'Rendering' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
