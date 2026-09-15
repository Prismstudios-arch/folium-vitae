/**
 * Common names the way people expect to read them.
 *
 * The identification service passes names on as its sources wrote them —
 * mostly lower case ("majestic prayer plant"), which looks like a typo at the
 * top of a screen. Only common names come through here: a scientific name's
 * capitalisation carries meaning (Genus species) and is never changed.
 */

const JOINING_WORDS = new Set(["a", "an", "and", "de", "in", "of", "on", "or", "the", "to"]);

export function formatCommonName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && JOINING_WORDS.has(word)) return word;
      // Only the first letter: "ZZ plant" keeps its capitals, and hyphenated
      // names read "Mother-in-law's Tongue", not "Mother-In-Law's".
      return word.charAt(0).toLocaleUpperCase() + word.slice(1);
    })
    .join(" ");
}
