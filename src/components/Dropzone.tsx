import { useCallback, useState } from 'react'
import { ImagePlus, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { loadImageFile, type SourcePixels } from '@/lib/image'
import { makeSample } from '@/lib/sample'
import { cn } from '@/lib/utils'

interface Props {
  onLoad: (px: SourcePixels) => void
  onError: (message: string) => void
  /** `compact` is the landing-page form, where the drop target is one element
   *  among several rather than the entire first screen. */
  variant?: 'full' | 'compact'
  className?: string
}

export function Dropzone({ onLoad, onError, variant = 'full', className }: Props) {
  const [over, setOver] = useState(false)
  const compact = variant === 'compact'

  const accept = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      if (!file.type.startsWith('image/')) {
        onError('That is not an image file.')
        return
      }
      try {
        onLoad(await loadImageFile(file))
      } catch {
        onError('Could not read that image.')
      }
    },
    [onLoad, onError],
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        void accept(e.dataTransfer.files?.[0])
      }}
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors',
        compact ? 'gap-3 px-5 py-7 sm:flex-row sm:gap-5 sm:text-left' : 'px-6 py-16',
        over ? 'border-foreground/40 bg-accent' : 'border-border',
        className,
      )}
    >
      <ImagePlus
        className={cn('text-muted-foreground shrink-0', compact ? 'size-6' : 'mb-4 size-7')}
        strokeWidth={1.25}
      />
      <div className={cn('min-w-0', compact && 'flex-1')}>
        <p className="text-[15px] font-medium">Drop an image</p>
        <p className={cn(
          'text-muted-foreground text-[13px] leading-relaxed',
          compact ? 'mt-0.5' : 'mx-auto mt-1 max-w-sm',
        )}>
          Processed on your device and never uploaded. Photographs get an extra
          prep step automatically.
        </p>
      </div>
      <div className={cn(
        'flex flex-wrap items-center justify-center gap-2',
        compact ? 'shrink-0' : 'mt-6',
      )}>
        <Button asChild size="sm">
          <label className="cursor-pointer">
            Choose a file
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void accept(e.target.files?.[0])}
            />
          </label>
        </Button>
        {!compact && (
          <Button size="sm" variant="ghost" onClick={() => onLoad(makeSample())}>
            <Sparkles className="size-3.5" />
            Use a sample
          </Button>
        )}
      </div>
    </div>
  )
}
