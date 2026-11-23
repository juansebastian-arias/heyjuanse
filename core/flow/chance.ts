/**
 * Chance, decided in advance. Every customer request carries one 32-bit key, and everything luck
 * decides about that customer is a fixed function of the key and of which question is asked:
 * how long they will wait for a reply, how long their quote takes to write, whether their invoice
 * will have a mistake. Nothing is drawn while the simulation runs.
 *
 * That is what makes two versions of the company comparable. They meet the same customers with
 * the same luck, so a difference between them was caused by how they work. It also means a
 * question that is never asked costs nothing, and asking a new one never changes the answer to
 * an old one.
 */

/** A well-mixed 32-bit hash of a 32-bit integer (Chris Wellons's "lowbias32"). */
function mix(value: number): number {
  let x = value >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}

/** The answer to `question` for the request with this key: a number from 0 up to, not including, 1. */
export function chance(key: number, question: number): number {
  // Two rounds, with the question folded in between, so answers to neighboring questions, and
  // answers for neighboring keys, share nothing.
  return mix(mix(key) ^ Math.imul(question + 1, 0x9e3779b1)) / 4294967296;
}

/** A key for item `index` of a group, such as the n-th request of a day. */
export function keyOf(group: number, index: number): number {
  return mix(mix(group) ^ Math.imul(index + 1, 0x85ebca6b));
}
