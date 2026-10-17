/**
 * The flag for a two-letter country code, as the one emoji that stands for
 * it: each letter maps to its regional indicator symbol, and a pair of those
 * is rendered as a flag by the platform.
 *
 * No image files and nothing to keep up to date, and it is the only coloured
 * glyph on the page that is part of the content rather than the design.
 */
export function flagEmoji(code: string): string {
  const letters = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(letters)) return "";

  return String.fromCodePoint(
    ...[...letters].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
}
