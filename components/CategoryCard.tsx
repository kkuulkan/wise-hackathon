import type { Category, Product } from "@/lib/types";
import { mapsUrl } from "@/lib/data";
import { formatEur, formatHuf, formatPct } from "@/lib/format";
import styles from "./CategoryCard.module.css";

/** How the product's price reads against the local average for its category. */
function localAverageLabel(product: Product, city: string): {
  text: string;
  tone: "below" | "above" | "level";
} {
  if (product.vsLocalAvgPct >= 1) {
    return {
      text: `${formatPct(product.vsLocalAvgPct)} below the ${city} average`,
      tone: "below",
    };
  }

  if (product.vsLocalAvgPct <= -1) {
    return {
      text: `${formatPct(product.vsLocalAvgPct)} above the ${city} average`,
      tone: "above",
    };
  }

  return { text: `About the ${city} average`, tone: "level" };
}

/** Reads the yearly figure back in terms of how often they actually buy. */
function frequencyClause(purchasesPerYear: number): string {
  if (purchasesPerYear < 1) {
    return "averaged over how often you replace them";
  }

  if (purchasesPerYear === 1) {
    return "on the one you buy a year";
  }

  return `across the ${purchasesPerYear} you buy a year`;
}

type Props = {
  category: Category;
  city: string;
  homeCity: string;
};

export function CategoryCard({ category, city, homeCity }: Props) {
  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.label}>{category.label}</h2>
          <p className={styles.unit}>{category.unit}</p>
        </div>

        <p className={`${styles.badge} tabular`}>
          {formatPct(category.savingPct)} cheaper
        </p>
      </header>

      <dl className={styles.compare}>
        <div className={styles.compareItem}>
          <dt className={styles.compareLabel}>{homeCity}</dt>
          <dd className={`${styles.compareValue} ${styles.wasValue} tabular`}>
            {formatEur(category.homeAvgEur)}
          </dd>
        </div>

        <span className={styles.compareArrow} aria-hidden="true">
          &rarr;
        </span>

        <div className={styles.compareItem}>
          <dt className={styles.compareLabel}>{city} average</dt>
          <dd className={`${styles.compareValue} tabular`}>
            {formatEur(category.localAvgEur)}
          </dd>
        </div>
      </dl>

      <p className={styles.annual}>
        Keeps about{" "}
        <strong className="tabular">{formatEur(category.annualSavingEur, true)}</strong>{" "}
        a year, {frequencyClause(category.purchasesPerYear)}.
      </p>

      <ul className={styles.products}>
        {category.products.map((product) => {
          const average = localAverageLabel(product, city);

          return (
            <li key={product.name} className={styles.product}>
              <div className={styles.productMain}>
                <p className={styles.productName}>
                  {product.name}
                  {product.visited && (
                    <span className={styles.visited}>You go here</span>
                  )}
                </p>
                <p className={styles.productArea}>{product.area}</p>
                <p className={`${styles.productAverage} ${styles[average.tone]}`}>
                  {average.text}
                </p>
              </div>

              <div className={styles.productSide}>
                <p className={`${styles.productPrice} tabular`}>
                  {formatEur(product.priceEur)}
                </p>
                <p className={`${styles.productLocal} tabular`}>
                  {formatHuf(product.priceHuf)}
                </p>
                <a
                  className={styles.mapLink}
                  href={mapsUrl(product.mapsQuery)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Map
                  <span aria-hidden="true"> &#8599;</span>
                  <span className="srOnly">
                    , opens {product.mapsQuery} in Google Maps in a new tab
                  </span>
                </a>
              </div>
            </li>
          );
        })}
      </ul>

      <p className={styles.source}>{category.source}</p>
    </article>
  );
}
