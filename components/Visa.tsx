import { IconMapPin } from "@tabler/icons-react";

import type { Category, Product } from "@/lib/types";
import { mapsUrl } from "@/lib/data";
import { formatEur, formatHuf, formatPct } from "@/lib/format";
import styles from "./Visa.module.css";

/** How this place's price reads against the local average for its category. */
function localAverage(product: Product, city: string) {
  if (product.vsLocalAvgPct >= 1) {
    return { text: `${formatPct(product.vsLocalAvgPct)} under ${city} avg`, tone: "below" as const };
  }

  if (product.vsLocalAvgPct <= -1) {
    return { text: `${formatPct(product.vsLocalAvgPct)} over ${city} avg`, tone: "above" as const };
  }

  return { text: `At ${city} avg`, tone: "level" as const };
}

type Props = {
  category: Category;
  city: string;
  homeCity: string;
  /** Drives the stamp's rotation so the page looks hand-stamped, not generated. */
  index: number;
};

const STAMP_ANGLES = [-7, 5, -4, 8, -6, 4];

export function Visa({ category, city, homeCity, index }: Props) {
  const angle = STAMP_ANGLES[index % STAMP_ANGLES.length];

  return (
    <article className={styles.visa}>
      <div
        className={styles.stamp}
        style={{ transform: `rotate(${angle}deg)` }}
        aria-hidden="true"
      >
        <span className={styles.stampTop}>cheaper</span>
        <span className={`${styles.stampFigure} tabular`}>
          {formatPct(category.savingPct)}
        </span>
        <span className={styles.stampBottom}>than {homeCity}</span>
      </div>

      <header className={styles.head}>
        <p className="fieldLabel">Category / Catégorie</p>
        <h2 className={styles.label}>{category.label}</h2>
        <p className={styles.unit}>{category.unit}</p>
      </header>

      <dl className={styles.rates}>
        <div>
          <dt className="fieldLabel">{homeCity}</dt>
          <dd className={`${styles.rateWas} tabular`}>{formatEur(category.homeAvgEur)}</dd>
        </div>
        <div>
          <dt className="fieldLabel">{city} average</dt>
          <dd className={`${styles.rateNow} tabular`}>{formatEur(category.localAvgEur)}</dd>
        </div>
        <div>
          <dt className="fieldLabel">Kept per year</dt>
          <dd className={`${styles.rateKept} tabular`}>
            {formatEur(category.annualSavingEur, true)}
          </dd>
        </div>
      </dl>

      <div className={styles.endorsements}>
        <p className="fieldLabel">Endorsements / Mentions</p>

        <ul className={styles.places}>
          {category.products.map((product) => {
            const average = localAverage(product, city);

            return (
              <li key={product.name} className={styles.place}>
                <span className={styles.placeName}>
                  {product.name}
                  {product.visited && <span className={styles.visited}>visited</span>}
                </span>

                <span className={styles.placeMeta}>
                  {product.area} ·{" "}
                  <span className={styles[average.tone]}>{average.text}</span>
                </span>

                <span className={`${styles.placePrice} tabular`}>
                  {formatEur(product.priceEur)}
                  <span className={styles.placeLocal}>{formatHuf(product.priceHuf)}</span>
                </span>

                <a
                  className={styles.placeMap}
                  href={mapsUrl(product.mapsQuery)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconMapPin size={14} stroke={2} aria-hidden="true" />
                  <span className="srOnly">
                    Open {product.mapsQuery} in Google Maps in a new tab
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <p className={styles.source}>{category.source}</p>
    </article>
  );
}
