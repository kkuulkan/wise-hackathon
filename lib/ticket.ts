/** Asks a mounted arrival ticket to leave. */
export const DISMISS_TICKET = "otherwise:dismiss-ticket";

/**
 * How long the full dismissal takes: the ticket sliding off to the right, then
 * the account growing back behind it. Callers wait this out before changing the
 * data underneath, or the remount would cut the animation short.
 */
export const TICKET_DISMISS_MS = 1250;

/**
 * Plays the ticket's exit, resolving once it has finished.
 *
 * The ticket calls `preventDefault()` to claim the event, so when none is
 * mounted this resolves straight away rather than stalling the caller.
 */
export function dismissTicket(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  const claimed = !window.dispatchEvent(
    new CustomEvent(DISMISS_TICKET, { cancelable: true }),
  );

  if (!claimed) return Promise.resolve();

  return new Promise((resolve) => {
    window.setTimeout(resolve, TICKET_DISMISS_MS);
  });
}
