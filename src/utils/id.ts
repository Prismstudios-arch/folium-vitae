/**
 * Simple UUID v4-like ID generator
 * No external dependency needed
 */

function randomHex(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 16).toString(16);
  }
  return result;
}

export function generateId(): string {
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const part1 = randomHex(8);
  const part2 = randomHex(4);
  const part3 = `4${randomHex(3)}`; // Version 4
  const part4 = randomHex(4);
  const part5 = randomHex(12);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}
