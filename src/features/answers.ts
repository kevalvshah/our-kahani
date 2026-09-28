import { fromUtf8, utf8, type Bytes } from '../crypto/bytes';
import { open, seal, type EnvelopeContext } from '../crypto/envelope';

// Answers are sealed on the phone. The plaintext is padded to a fixed bucket size before
// encryption: otherwise the ciphertext length would tell the server which option was picked
// ("hugs" and "words" encrypt to different lengths).

export const KIND_CHOICE = 1;
const BUCKETS = [64, 256, 1024, 4096] as const;

export interface ChoiceAnswer {
  v: 1;
  choice: string;
}

export function pad(json: string): Bytes {
  const body = utf8(json);
  const size = BUCKETS.find((b) => b >= body.length);
  if (size === undefined) throw new Error('Answer too long');
  const out = new Uint8Array(size).fill(0x20); // trailing spaces; JSON.parse ignores them
  out.set(body);
  return out;
}

export function sealChoice(key: CryptoKey, ctx: Omit<EnvelopeContext, 'kind'>, choice: string): Promise<Bytes> {
  const answer: ChoiceAnswer = { v: 1, choice };
  return seal(key, { ...ctx, kind: KIND_CHOICE }, pad(JSON.stringify(answer)));
}

export async function openChoice(key: CryptoKey, ctx: Omit<EnvelopeContext, 'kind'>, envelope: Bytes): Promise<string> {
  const parsed = JSON.parse(fromUtf8(await open(key, { ...ctx, kind: KIND_CHOICE }, envelope))) as Partial<ChoiceAnswer>;
  if (parsed.v !== 1 || typeof parsed.choice !== 'string') throw new Error('Unknown answer format');
  return parsed.choice;
}
