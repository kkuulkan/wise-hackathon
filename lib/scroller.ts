import type Lenis from "lenis";

/**
 * The live Lenis instance, so the cover can stop and start scrolling without
 * the two components needing to know about each other.
 */
export const scroller: { current: Lenis | null } = { current: null };

/** Fired when the cover finishes opening, so the balance can count up. */
export const OPEN_EVENT = "otherwise:open";

/**
 * Whether the cover has already opened during this page load.
 *
 * The cover sits in the layout and survives navigation, but the hero does not.
 * Without this, coming back to the account would hide the balance again and
 * wait for a reveal that has already happened. Resets on a full reload, which
 * is correct: the cover is shut again then.
 */
export const cover = { opened: false };
