/**
 * Start a film that has not fetched anything yet.
 *
 * Every film on the site carries `preload="none"` — they are the heaviest
 * things on the homepage and most visitors never scroll to them. Chrome treats
 * that as a hint: call `play()` and it quietly starts fetching and plays.
 * Safari on iOS treats it as binding. The element sits at HAVE_NOTHING with
 * its network idle, no resource has ever been selected, and `play()` rejects
 * against nothing.
 *
 * Two of these also attach `src` after mount, once the band scrolls near. React
 * patches the attribute, and Chrome re-runs resource selection off the back of
 * that where Safari does not — so on an iPhone the element had both no data and
 * no pending fetch, and every call site swallowed the rejection with
 * `.catch(() => undefined)`. Nothing played and nothing was logged.
 *
 * `load()` runs the resource selection the attribute suppressed. Guarded on
 * both states rather than readyState alone: a second caller arriving while the
 * first fetch is still in flight would otherwise restart it, and restarting a
 * load aborts the play that was waiting on it.
 */
export function playVideo(element: HTMLVideoElement | null | undefined): void {
  if (!element) return

  if (
    element.readyState === element.HAVE_NOTHING &&
    element.networkState !== element.NETWORK_LOADING
  ) {
    element.load()
  }

  // Still swallowed: autoplay is genuinely refused in low power mode and under
  // a data saver, and the poster underneath is a fine outcome. The difference
  // is that it is now refused having been asked properly.
  void element.play().catch(() => undefined)
}
