import { IconPlane } from "@tabler/icons-react";

import styles from "./FlightSpinner.module.css";

type Props = {
  /** What is being waited for. */
  label?: string;
  className?: string;
};

/**
 * A plane circling a dashed flight path: the one waiting state, used both by
 * the scrim over the account and by the comparison page while its own
 * content streams in, so a journey between the two reads as one wait.
 *
 * Deliberately not a client component. It is a Suspense fallback on the
 * comparison page, which has to render on the server; everything that moves
 * here moves in CSS.
 */
export function FlightSpinner({ label = "Checking prices…", className }: Props) {
  return (
    <div className={`${styles.spinner} ${className ?? ""}`} role="status" aria-live="polite">
      <span className={styles.dial} aria-hidden="true">
        <span className={styles.orbit}>
          <IconPlane size={26} stroke={1.9} />
        </span>
      </span>

      <p className={styles.label}>{label}</p>
    </div>
  );
}
