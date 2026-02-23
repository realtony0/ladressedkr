import { MIN_STAFF_PASSWORD_LENGTH } from "@/lib/helpers/constants";

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%+=!*?-_";

export function generateBrowserPassword(length = 14) {
  const safeLength = Math.max(MIN_STAFF_PASSWORD_LENGTH, length);
  const randomValues = new Uint32Array(safeLength);

  if (typeof globalThis.crypto !== "undefined") {
    globalThis.crypto.getRandomValues(randomValues);
  } else {
    for (let index = 0; index < safeLength; index += 1) {
      randomValues[index] = Math.floor(Math.random() * PASSWORD_ALPHABET.length);
    }
  }

  return Array.from(randomValues, (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join("");
}
