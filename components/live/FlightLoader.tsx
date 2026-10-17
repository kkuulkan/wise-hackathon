"use client";

import { useLinkStatus } from "next/link";

import { FlightScrim } from "./FlightScrim";

/**
 * The scrim, driven by the pending state of the <Link> it sits inside.
 *
 * `useLinkStatus` has to be called from a descendant of that Link, which is
 * why this is its own component rather than part of the ticket. The Link also
 * needs `prefetch={false}`: a prefetched route commits straight away and the
 * pending state is skipped, so there would be nothing to show.
 */
export function FlightLoader() {
  const { pending } = useLinkStatus();

  return <FlightScrim show={pending} />;
}
