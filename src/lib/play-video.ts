/**
 * Start a film, on an engine stricter than the one we develop against.
 *
 * Chrome on iOS is not Chrome. Apple requires every browser on the platform to
 * render with WebKit, so an iPhone runs Safari's engine whatever badge is on
 * the icon — which is why these films ran on Android and sat still on an
 * iPhone in both browsers.
 *
 * Two WebKit rules are at work, and the first version of this helper fixed one
 * by walking into the other:
 *
 *   - `preload="none"` is binding, not a hint. Chrome starts fetching when
 *     play() is called; WebKit leaves the element at HAVE_NOTHING with its
 *     network idle, and playing it runs against nothing. Every autoplaying
 *     film here already gates itself — the element is not mounted, or carries
 *     no src, until it is wanted — so the attribute saved no bandwidth and
 *     only cost the playback. It is gone from those three.
 *
 *   - `load()` aborts a play() issued in the same tick. So "call load(), then
 *     play()" answers the first rule and loses to the second, and since every
 *     call site swallows the rejection, it loses silently.
 *
 * Waiting for data satisfies both. The element selects its own resource as
 * soon as it has a src, and this plays it once there is a frame to show.
 */
export function playVideo(element: HTMLVideoElement | null | undefined): void {
  if (!element) return

  // Still swallowed: autoplay is genuinely refused in low power mode and under
  // a data saver, and the poster underneath is a fine outcome.
  const attempt = () => void element.play().catch(() => undefined)

  /*
   * Ask immediately. play() is itself what starts the fetch on an element that
   * has loaded nothing, so withholding it until data arrives deadlocks: with
   * `preload` at its default the element stops at HAVE_METADATA, `loadeddata`
   * never fires, and the one call that would have pulled the rest never
   * happens. A first draft of this helper did exactly that.
   */
  attempt()

  /*
   * Then ask again once there is a frame, for the engine that refused the
   * first ask because nothing was decoded yet. `once` because this is called
   * from an observer, an effect and onCanPlay, and three live listeners on one
   * element would each fire a play.
   */
  if (element.readyState === element.HAVE_NOTHING) {
    element.addEventListener('loadeddata', attempt, { once: true })
  }
}
