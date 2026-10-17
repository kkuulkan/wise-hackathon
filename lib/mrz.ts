import type { Account } from "./types";

/** Characters per line, as a TD3 travel document uses. */
const WIDTH = 44;

const FILLER = "<";

/**
 * Three-letter codes, which is what a document of this shape would print.
 * Only the countries in the seed data need to be here.
 */
const ALPHA3: Record<string, string> = {
  IE: "IRL",
  HU: "HUN",
};

function alpha3(code: string): string {
  return ALPHA3[code] ?? code.padEnd(3, FILLER).slice(0, 3);
}

/** Anything outside the allowed set becomes filler, as the real format requires. */
function sanitise(value: string): string {
  return value
    .toUpperCase()
    .normalize("NFD")
    // Strip accents so Hungarian and Irish names transliterate rather than vanish.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, FILLER);
}

function pad(line: string): string {
  return line.slice(0, WIDTH).padEnd(WIDTH, FILLER);
}

/**
 * The weighted mod-10 check digit the format specifies: weights cycle 7, 3, 1,
 * letters count as A=10 through Z=35, filler counts as zero.
 *
 * Ours is computed rather than decorative, so the digits on screen are real.
 */
export function checkDigit(input: string): string {
  const weights = [7, 3, 1];
  let sum = 0;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    let value = 0;

    if (char >= "0" && char <= "9") {
      value = Number(char);
    } else if (char >= "A" && char <= "Z") {
      value = char.charCodeAt(0) - 55;
    }

    sum += value * weights[i % 3];
  }

  return String(sum % 10);
}

function yymmdd(date: string): string {
  const [year, month, day] = date.split("-");
  return `${year.slice(2)}${month}${day}`;
}

/**
 * Two MRZ lines for the account holder.
 *
 * The issuer is the product, not a country, and the layout deliberately differs
 * from a real travel document: this is a balance printed in a passport's visual
 * language, not an imitation of one.
 */
export function buildMrz(account: Account): [string, string] {
  const [surname, ...given] = account.holder.split(" ").reverse();

  const line1 = pad(
    `OW${FILLER}${sanitise(surname)}${FILLER}${FILLER}${sanitise(given.reverse().join(" "))}`,
  );

  const primary = account.balances.find((balance) => balance.primary);
  const amount = primary ? primary.value.toFixed(2).replace(".", FILLER) : "0";
  const currency = primary ? primary.currency : "EUR";

  const home = alpha3(account.homeCountryCode);
  const current = alpha3(account.currentCountryCode);
  const arrived = yymmdd(account.arrivedOn);

  const body =
    `${currency}${amount}${FILLER}${home}${FILLER}${current}${FILLER}${arrived}`;
  const composite = checkDigit(sanitise(body));

  const line2 = pad(`${body}${checkDigit(sanitise(amount))}${FILLER}${composite}`);

  return [line1, line2];
}
