/**
 * Write to the studio on WhatsApp.
 *
 * Commissioning a piece, or asking whether a dress will be ready for a wedding
 * in February, is a conversation — and in India that conversation happens on
 * WhatsApp rather than through a contact form nobody trusts to be read. This
 * is the shortest path from looking at a garment to asking about it.
 *
 * A plain link, not a chat widget. No script, no socket, no third party
 * watching the page: `wa.me` hands off to whichever WhatsApp the visitor
 * already has — the app on a phone, WhatsApp Web on a desktop — and the thread
 * then lives in a place both sides keep.
 *
 * Renders nothing at all when no number is configured, which is the off switch.
 * A button that opens an empty chat is worse than no button.
 */

/**
 * `wa.me` wants bare digits with the country code and nothing else: no plus,
 * no spaces, no dashes. A number typed into the admin as "+91 99944 11585" is
 * perfectly reasonable and must still work, so it is reduced here rather than
 * being the operator's problem.
 *
 * A number written without a country code is left alone rather than guessed at
 * — prefixing 91 to what might be a landline would send people to a stranger.
 */
function digits(raw: string): string | null {
  const cleaned = raw.replace(/\D/g, '').replace(/^0+/, '')
  // Shorter than a full international number means the country code is missing.
  return cleaned.length >= 11 ? cleaned : null
}

export function WhatsAppButton({
  number,
  message,
}: {
  number?: string
  /** What the chat opens with. Per-page, so an enquiry arrives with context. */
  message?: string
}) {
  const to = number?.trim() ? digits(number) : null
  if (!to) return null

  const text = message?.trim() || 'Hello Prash & Ki, I had a question about'
  const href = `https://wa.me/${to}?text=${encodeURIComponent(text)}`

  return (
    <a
      href={href}
      target="_blank"
      // `noopener` because a page opened with target="_blank" can otherwise
      // reach back through window.opener.
      rel="noopener noreferrer"
      aria-label="Message us on WhatsApp"
      className={
        // Above the page but below anything modal: the size guide and the
        // showcase lightbox both sit at z-50, and a chat button floating over
        // a lightbox is in the way of the thing someone opened on purpose.
        'fixed right-4 bottom-4 z-40 flex size-13 items-center justify-center ' +
        'rounded-full bg-[#25D366] text-white shadow-lg transition ' +
        'hover:scale-105 hover:bg-[#1ebe5a] focus-visible:ring-2 focus-visible:ring-ink ' +
        'focus-visible:ring-offset-2 focus-visible:outline-none ' +
        'motion-reduce:transition-none motion-reduce:hover:scale-100 ' +
        // Clear of the thumb on a phone, where the bottom edge belongs to the
        // browser's own chrome.
        'md:right-6 md:bottom-6'
      }
    >
      {/*
        WhatsApp's own glyph, inline. Their brand green and their mark are what
        make this recognisable at this size — a generic speech bubble would
        have to be explained, and a button nobody recognises is not tapped.
        Drawn here rather than loaded so it cannot fail to arrive.
      */}
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="size-7"
        aria-hidden
        focusable="false"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.83 9.83 0 0 1 2.893 6.994c-.003 5.45-4.437 9.886-9.885 9.886m8.413-18.297A11.82 11.82 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.82 11.82 0 0 0 20.465 3.49" />
      </svg>
    </a>
  )
}
