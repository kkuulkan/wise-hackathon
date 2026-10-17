import styles from "./Sparkline.module.css";

type Props = {
  /** Oldest to newest. */
  series: number[];
  label: string;
};

const WIDTH = 300;
const HEIGHT = 64;
const TOP = 6;

/** Balance over time, drawn from the series with no client-side work. */
export function Sparkline({ series, label }: Props) {
  if (series.length < 2) return null;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;

  const line = series
    .map((value, index) => {
      const x = (index * WIDTH) / (series.length - 1);
      const y = HEIGHT - TOP - ((value - min) / span) * (HEIGHT - TOP * 2);
      return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--ink)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--ink)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={`${line} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`} fill="url(#sparkFill)" />
      <path
        d={line}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
