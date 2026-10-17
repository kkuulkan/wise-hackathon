import {
  IconBottle,
  IconCup,
  IconDeviceMobile,
  IconDice,
  IconDots,
  IconExternalLink,
  IconHeadphones,
  IconHome,
  IconPill,
  IconScissors,
  IconShield,
  IconShoe,
  IconShoppingCart,
  IconTag,
  IconToolsKitchen2,
  IconTrain,
} from "@tabler/icons-react";

import type { Category } from "@/lib/types";
import { formatEur, formatMoney, formatPct } from "@/lib/format";
import { categoryInk } from "@/lib/ink";
import { ProductLink } from "./live/ProductLink";
import styles from "./Visa.module.css";

/** How many products each card lists. */
const PLACES = 3;

/**
 * The bank's taxonomy names an icon per category (US-3.2); this maps those
 * names onto glyphs. An unknown name falls back to a plain tag rather than
 * leaving the heading bare.
 */
const ICONS = {
  cart: IconShoppingCart,
  cup: IconCup,
  plate: IconToolsKitchen2,
  train: IconTrain,
  phone: IconDeviceMobile,
  bottle: IconBottle,
  shoe: IconShoe,
  headphones: IconHeadphones,
  scissors: IconScissors,
  pill: IconPill,
  dice: IconDice,
  house: IconHome,
  shield: IconShield,
  dots: IconDots,
} as const;

type Props = {
  category: Category;
  city: string;
  homeCity: string;
  /** Destination country code, for the product_tapped event. */
  countryCode: string;
  /** Drives the stamp's rotation so the page looks hand-stamped, not generated. */
  index: number;
};

const STAMP_ANGLES = [-7, 5, -4, 8, -6, 4];

export function Visa({ category, city, homeCity, countryCode, index }: Props) {
  const angle = STAMP_ANGLES[index % STAMP_ANGLES.length];
  const Icon = ICONS[category.icon as keyof typeof ICONS] ?? IconTag;

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
        <h2 className={styles.label}>
          <Icon
            size={22}
            stroke={2}
            className={styles.labelIcon}
            style={{ color: categoryInk(category.label) }}
            aria-hidden="true"
          />
          {category.label}
        </h2>
        <p className={styles.unit}>{category.unit}</p>
      </header>

      <dl className={styles.rates}>
        <div>
          <dt className="fieldLabel">{homeCity}</dt>
          <dd className={`${styles.rateWas} tabular`}>
            {formatEur(category.homeAvgEur)}
          </dd>
        </div>
        <div>
          <dt className="fieldLabel">{city} average</dt>
          <dd className={`${styles.rateNow} tabular`}>
            {formatEur(category.localAvgEur)}
          </dd>
        </div>
      </dl>

      <div className={styles.endorsements}>
        <p className="fieldLabel">Recommended Products</p>

        {/* Already ranked by saving, biggest first, by the catalog (FR-12). */}
        <ul className={styles.places}>
          {category.products.slice(0, PLACES).map((product) => (
            <li key={product.id}>
              <ProductLink
                href={product.url}
                productId={product.id}
                countryCode={countryCode}
                className={styles.place}
              >
                <span className={styles.placeName}>
                  {product.name}
                  {product.visited && <span className={styles.visited}>visited</span>}
                </span>

                <span className={styles.placeMeta}>
                  {product.area} ·{" "}
                  <span className={styles.below}>
                    {formatPct(product.savingPct)} cheaper than {homeCity}
                  </span>
                </span>

                <span className={`${styles.placePrice} tabular`}>
                  {formatEur(product.priceEur)}
                  {product.priceLocal && (
                    <span className={styles.placeLocal}>
                      {formatMoney(product.priceLocal.amount, product.priceLocal.currency)}
                    </span>
                  )}
                </span>

                <span className={styles.placeGo} aria-hidden="true">
                  <IconExternalLink size={14} stroke={2} />
                </span>

                <span className="srOnly">Opens in a new tab</span>
              </ProductLink>
            </li>
          ))}
        </ul>
      </div>

      <p className={styles.source}>{category.source}</p>
    </article>
  );
}
