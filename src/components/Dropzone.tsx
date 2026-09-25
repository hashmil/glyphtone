import { useCallback, useEffect, useRef, useState } from 'react'

import { loadImageFile, type SourcePixels } from '@/lib/image'
import { cn } from '@/lib/utils'

/** Reads a File into source pixels, reporting anything unusable. */
export function useImageFile(
  onLoad: (px: SourcePixels) => void,
  onError: (message: string) => void,
) {
  return useCallback(
    async (file: File | undefined | null) => {
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
}

/** A hidden file input plus a function that opens it, so any button can be
 *  the "choose a file" button. */
export function useFilePicker(onFile: (file: File | undefined) => void) {
  const ref = useRef<HTMLInputElement>(null)
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        onFile(e.target.files?.[0])
        // Reset so choosing the same file twice still fires a change.
        e.target.value = ''
      }}
    />
  )
  return { input, open: () => ref.current?.click() }
}

/** The whole window is the drop target, on the landing page and in the
 *  workspace alike. A boxed drop zone asks you to aim; there is no reason to. */
export function DropOverlay({
  onFile, label,
}: {
  onFile: (file: File | undefined) => void
  label: string
}) {
  const [over, setOver] = useState(false)
  // dragenter and dragleave fire for every child crossed, so count them rather
  // than trusting the last event.
  const depth = useRef(0)

  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current++
      setOver(true)
    }
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setOver(false)
    }
    const overFn = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current = 0
      setOver(false)
      onFile(e.dataTransfer?.files?.[0])
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', overFn)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', overFn)
      window.removeEventListener('drop', drop)
    }
  }, [onFile])

  return (
    <div
      aria-hidden={!over}
      className={cn(
        'pointer-events-none fixed inset-0 z-50 transition-opacity duration-150',
        over ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div className="bg-ink/80 absolute inset-0 backdrop-blur-sm" />
      <div className="border-magenta absolute inset-4 border border-dashed sm:inset-6" />
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="font-display text-fg text-center text-[clamp(32px,5vw,64px)] leading-none">
          {label}
        </p>
      </div>
    </div>
  )
}
