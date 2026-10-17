"use client";

import type { ReactNode } from "react";

type Props = {
  href: string;
  /** Catalog id, so the event says which product without saying who tapped it. */
  productId: string;
  countryCode: string;
  className?: string;
  children: ReactNode;
};

/**
 * One product row, as a link out to the catalog's own URL (US-5, FR-18) that
 * logs a `product_tapped` event on the way (FR-23).
 *
 * Only this row is a client component: the rest of the visa stays server
 * rendered. The link is a plain anchor, not a router link, because the target
 * is outside the app.
 */
export function ProductLink({ href, productId, countryCode, className, children }: Props) {
  const track = () => {
    fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // keepalive: the tab is about to lose focus to the link target.
      keepalive: true,
      body: JSON.stringify({ type: "product_tapped", country: countryCode, productId }),
    }).catch(() => {
      // Analytics must never get in the way of opening the link.
    });
  };

  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      onClick={track}
    >
      {children}
    </a>
  );
}
