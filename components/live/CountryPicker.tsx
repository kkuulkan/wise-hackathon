"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconArrowRight } from "@tabler/icons-react";

import styles from "./CountryPicker.module.css";

type Destination = { code: string; name: string; eligible: boolean };

type Props = {
  /** Country of the active trip, so the picker opens on where they are. */
  tripCountry: string | null;
  homeCity: string;
};

/**
 * Look up any E.U. country, without waiting to arrive there.
 *
 * The comparison itself never needed a trip — /cheaper takes a `?country=`
 * and the catalog works on any eligible pair — so this is the same screen the
 * arrival notification deep-links to, reached deliberately instead. During a
 * trip it starts on the country they are in, which keeps it doing the job of
 * the in-app entry point (FR-7) as well.
 */
export function CountryPicker({ tripCountry, homeCity }: Props) {
  const router = useRouter();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [choice, setChoice] = useState(tripCountry ?? "");

  useEffect(() => {
    let live = true;

    fetch("/api/destinations")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { destinations: Destination[] } | null) => {
        if (!live || !data) return;
        // Only places the comparison can actually run: the rest would land on
        // an explanation of why there is nothing to show.
        const eligible = data.destinations.filter((country) => country.eligible);
        setDestinations(eligible);
        setChoice((current) => current || eligible[0]?.code || "");
      })
      .catch(() => {
        // Leaves the picker empty and disabled rather than breaking the page.
      });

    return () => {
      live = false;
    };
  }, []);

  const go = () => {
    if (choice) router.push(`/cheaper?country=${choice}`);
  };

  return (
    <section className={styles.picker}>
      <p className="fieldLabel">Compare prices with {homeCity}</p>

      <div className={styles.row}>
        <label className={styles.field}>
          <span className="srOnly">Country to compare</span>
          <select
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            disabled={destinations.length === 0}
          >
            {destinations.length === 0 && <option value="">Loading countries…</option>}
            {destinations.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
                {country.code === tripCountry ? " · you are here" : ""}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={styles.go}
          onClick={go}
          disabled={!choice}
        >
          See what&rsquo;s cheaper
          <IconArrowRight size={16} stroke={2} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
