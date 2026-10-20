/** Small text helpers shared by the generator and the cleaning step. */

/** "José Ñúñez" -> "Jose Nunez". */
export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Collapse runs of whitespace and trim. */
export function squish(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** "Río Claro Logística" -> "rio-claro-logistica". */
export function slugify(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Title case for person names that keeps lowercase particles and handles apostrophes and
 * hyphens: "ANA DE LA ROSA" -> "Ana de la Rosa", "o'brien-smith" -> "O'Brien-Smith".
 */
const NAME_PARTICLES = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "van",
  "von",
  "den",
  "der",
  "da",
  "das",
  "do",
  "dos",
  "e",
  "y",
]);

export function titleCaseName(value: string): string {
  return squish(value)
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (index > 0 && NAME_PARTICLES.has(word)) return word;
      return word.replace(
        /(^|['’-])(\p{L})/gu,
        (_match, sep: string, letter: string) => sep + letter.toUpperCase(),
      );
    })
    .join(" ");
}

/** Jaro-Winkler similarity in [0, 1]. 1 means identical. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}
