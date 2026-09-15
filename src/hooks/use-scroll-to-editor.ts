'use client'

import { useEffect, useRef } from 'react'

/**
 * Brings an inline editor into view when it opens.
 *
 * Every admin list on this site puts its edit form above the list it edits.
 * That reads fine on the first screenful and badly on every one after it:
 * pressing Edit on the twentieth row changes something two thousand pixels
 * above the viewport, and the button looks broken. It was reported as exactly
 * that, twice, on two different screens.
 *
 * Attach the returned ref to the element wrapping the form:
 *
 *   const editorRef = useScrollToEditor(Boolean(editing))
 *   {editing && <div ref={editorRef} className="scroll-mt-6">…</div>}
 *
 * `scroll-mt-6` on that element keeps the form clear of the sticky header.
 *
 * Smooth rather than instant, because a page that jumps gives no sense of
 * where the form came from — the movement is what connects the button to the
 * thing it opened. Browsers honouring prefers-reduced-motion downgrade this to
 * an instant jump on their own, which is the right outcome.
 */
export function useScrollToEditor<T extends HTMLElement = HTMLDivElement>(open: boolean) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!open) return
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [open])

  return ref
}
