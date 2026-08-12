import { useCallback, useState } from 'react'
import { ImagePlus, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { loadImageFile, type SourcePixels } from '@/lib/image'
import { makeSample } from '@/lib/sample'
import { cn } from '@/lib/utils'

interface Props {
  onLoad: (px: SourcePixels) => void
  onError: (message: string) => void
}

export function Dropzone({ onLoad, onError }: Props) {
  const [over, setOver] = useState(false)

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
        'flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center transition-colors',
        over ? 'border-foreground/40 bg-accent' : 'border-border',
      )}
    >
      <ImagePlus className="text-muted-foreground mb-4 size-7" strokeWidth={1.25} />
      <p className="text-[15px] font-medium">Drop an image</p>
      <p className="text-muted-foreground mt-1 max-w-sm text-[13px] leading-relaxed">
        It is processed on your device and never uploaded. Photographs and
        high-contrast artwork both work, and photographs get an extra prep step.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
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
        <Button size="sm" variant="ghost" onClick={() => onLoad(makeSample())}>
          <Sparkles className="size-3.5" />
          Use a sample
        </Button>
      </div>
    </div>
  )
}
