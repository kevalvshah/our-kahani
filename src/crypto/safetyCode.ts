import { concat, utf8, type Bytes } from './bytes';

// Six emoji derived from a hash of the room key, shown on both phones and compared on a
// call. A swapped invite link gives a different key and so a different code.
// 64 emoji, 6 bits each, 36 bits total. Single code point each so they render the same
// everywhere. Per pack rules: no animals, meat, eggs or alcohol.
export const SAFETY_EMOJI: readonly string[] = [
  '🌞', '🌙', '⭐', '🌈', '🔥', '🌊', '🌸', '🌻', '🌵', '🌲', '🍀', '🍁', '🍄', '🌷', '🌹', '🌴',
  '🍎', '🍋', '🍇', '🍉', '🍌', '🥭', '🍍', '🥥', '🥕', '🌽', '🥔', '🍒', '🍓', '🥝', '🍑', '🍐',
  '🎈', '🎁', '🎨', '🎸', '🎺', '🎻', '🥁', '🎲', '🧩', '🪁', '⚽', '🏀', '🏏', '🎯', '🔔', '🔑',
  '🚀', '🚲', '🚂', '⛵', '🏠', '🏰', '⏰', '💡', '📚', '📷', '🎧', '👑', '💎', '🧭', '🪔', '🌂',
];

const DOMAIN = utf8('our-kahani/safety-code/v1');
export const SAFETY_CODE_LENGTH = 6;

export async function safetyCode(rawKey: Bytes): Promise<string[]> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', concat(DOMAIN, rawKey)));
  const code: string[] = [];
  for (let i = 0; i < SAFETY_CODE_LENGTH; i++) {
    const bit = i * 6;
    const byte = bit >> 3;
    const word = ((digest[byte] ?? 0) << 8) | (digest[byte + 1] ?? 0);
    const index = (word >> (10 - (bit & 7))) & 0x3f;
    code.push(SAFETY_EMOJI[index]!);
  }
  return code;
}
