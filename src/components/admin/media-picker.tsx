'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { Upload, Trash2, Film } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { Alert, Button } from '@/components/ui'

/**
 * Upload-and-preview control for a single piece of site media.
 *
 * Accepts images and video. Video is previewed muted and looping, the way the
 * hero actually renders it, so what you see here is what the storefront does.
 */
export function MediaPicker({
  value,
  onChange,
  folder = 'home',
  label = 'Media',
  hint,
}: {
  value: string
  onChange: (url: string) => void
  folder?: 'home' | 'banners' | 'categories' | 'misc'
  label?: string
  hint?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isVideo = /\.(mp4|webm)(\?|$)/i.test(value)

  async function upload(files: FileList | null) {
    const file = files?.[0]
    if (!file) return

    setBusy(true)
    setError(null)
    try {
      const media = await adminService.uploadMedia(file, folder)
      onChange(media.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <span className="field-label">{label}</span>

      {error && <Alert>{error}</Alert>}

      <div className="flex gap-4">
        <div className="relative aspect-video w-48 shrink-0 overflow-hidden border border-rule bg-sage-50">
          {value ? (
            isVideo ? (
              <video
                src={value}
                className="size-full object-cover"
                muted
                loop
                autoPlay
                playsInline
              />
            ) : (
              <Image src={value} alt="" fill sizes="192px" className="object-cover" />
            )
          ) : (
            <div className="flex size-full items-center justify-center text-xs text-ink-soft">
              No media
            </div>
          )}

          {isVideo && value && (
            <span className="badge badge-info absolute left-2 top-2 gap-1">
              <Film className="size-3" strokeWidth={1.6} />
              video
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center gap-3">
          <input
            ref={inputRef}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml,video/mp4,video/webm"
            onChange={(e) => void upload(e.target.files)}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={busy}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-3.5" strokeWidth={1.6} />
              {value ? 'Replace' : 'Upload'}
            </Button>

            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
                <Trash2 className="size-3.5" strokeWidth={1.6} />
                Clear
              </Button>
            )}
          </div>

          {/* The path is editable so existing assets can be reused without re-uploading. */}
          <input
            className="field text-xs"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/home/hero.jpg"
            aria-label={`${label} path`}
          />

          <p className="field-hint">
            {hint ?? 'JPEG, PNG, WebP, AVIF, GIF, SVG, MP4 or WebM. Up to 40 MB.'}
          </p>
        </div>
      </div>
    </div>
  )
}
