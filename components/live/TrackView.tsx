"use client";

import { useEffect } from "react";

type Props = {
  type: "recommendations_viewed" | "category_viewed";
  country?: string;
  category?: string;
};

/** Sends one analytics event (FR-23) when it mounts. Renders nothing. */
export function TrackView({ type, country, category }: Props) {
  useEffect(() => {
    fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, country, category }),
    }).catch(() => {
      // Analytics must never get in the user's way.
    });
  }, [type, country, category]);

  return null;
}
