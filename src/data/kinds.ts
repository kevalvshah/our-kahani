// Every piece of room data is one encrypted record of a kind. The server enforces who can read
// each range (supabase/migrations): answers stay hidden until both have answered, shared kinds
// are visible to the partner as soon as they are sent, private kinds only ever to the author.

export const K = {
  // 1-49: answers, revealed only once both have answered the same ref
  ANSWER: 1,
  MOVIE_VOTES: 2,
  /** Shukriya jar: one thank-you a week each, opened when both have written (per week). */
  SHUKRIYA: 3,
  /** Weekly huddle: best thing, hard thing, one need; opened when both have done it. */
  HUDDLE: 4,
  // 50: time capsule line, opens 90 days after it was written
  CAPSULE: 50,
  // 100-199: shared
  PROFILE: 100,
  HASHTAG_SUGGESTION: 101,
  PING: 102,
  REACTION: 103,
  BONUS_CARD: 104,
  STORY_ASK: 105,
  STORY_TELL: 106,
  NOTICED: 107,
  BUG: 108,
  BUG_STEP: 109,
  MICRO: 110,
  ANTAKSHARI: 111,
  STORY_LINE: 112,
  MOVIE_SETUP: 113,
  WATCHED: 114,
  STORY_CHAPTER: 115,
  ANTA_SAVED: 116,
  MICRO_NOTE: 117,
  PHOTO: 120,
  PHOTO_REACTION: 121,
  /** Not a record: binds encrypted voice-note audio to its purpose (the note lives in an answer). */
  VOICE: 122,
  GENTLE_OPT: 130,
  GENTLE_NOTE: 131,
  GENTLE_RESPONSE: 132,
  GENTLE_REACT: 133,
  HASHTAG: 140,
  SEASON_NEXT: 141,
  ROOM_SETTINGS: 142,
  // Dil ki Baat: saying hard things softly, pausing, repairing; dreams together
  SOFT_NOTE: 150,
  SOFT_REPLY: 151,
  PAUSE: 152,
  REPAIR: 153,
  REPAIR_REPLY: 154,
  DREAM: 155,
  DREAM_REACT: 156,
  // 200-299: private to the author, encrypted with their own notes key
  SAVED: 200,
} as const;

export type Kind = (typeof K)[keyof typeof K];

export function isPrivateKind(kind: number): boolean {
  return kind >= 200 && kind < 300;
}

export function isAnswerKind(kind: number): boolean {
  return kind < 50;
}
