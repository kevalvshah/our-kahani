// Lists for the relationship tools (feelings check-in, soft replies, repair, weekly huddle,
// dreams, shukriya, need menu, and the "hard or harmful?" guide). Ids are stable: never reuse or
// rename one, only add new ones.

export type Item = [id: string, e: string, label: string];

export const FEELINGS: Item[] = [
  ['hurt', '💔', 'Hurt'],
  ['jealous', '🫣', 'Jealous'],
  ['left-out', '🚪', 'Left out'],
  ['anxious', '😟', 'Worried'],
  ['overwhelmed', '🌀', 'A bit much today'],
  ['lonely', '🌙', 'Lonely'],
  ['unappreciated', '🥀', 'Not very appreciated'],
  ['confused', '😕', 'A bit confused'],
  ['grateful', '🙏', 'Grateful'],
  ['proud', '🌟', 'Proud'],
  ['loved', '💛', 'Loved'],
  ['hopeful', '🌱', 'Hopeful'],
  ['sorry', '🕊️', 'Sorry'],
  ['missing', '🫶', 'Missing you'],
];

export const WHEN_HINTS: string[] = [
  'when plans change last minute',
  'when I do not hear back for a while',
  'when we are both tired',
  'when family comes up',
  'when I feel rushed',
  'when something small gets missed',
];

export const NEEDS: Item[] = [
  ['hug', '🤗', 'A hug'],
  ['talk', '💬', 'Time to talk'],
  ['space', '🌙', 'Space for a bit'],
  ['reassure', '🤍', 'A little reassurance'],
  ['help', '🛠️', 'Help with something'],
  ['plan', '🗓️', 'A plan together'],
  ['listen', '🎧', 'Just listen, no fixing'],
  ['laugh', '😄', 'A laugh'],
  ['call', '📞', 'A call tonight'],
  ['apology', '🙏', 'A sorry'],
];

export const SOFT_REPLIES: Item[] = [
  ['hear', '💛', 'I hear you'],
  ['talk', '☕', 'Chai and talk tonight?'],
  ['time', '⏳', 'Need a little time. Not going anywhere 💛'],
  ['sorry', '🙏', 'I’m sorry'],
  ['hug', '🤗', 'Sending a big hug'],
];

export const REPAIRS: Item[] = [
  ['sorry', '🙏', 'Sorry, yaar'],
  ['restart', '🔁', 'Rewind and start again?'],
  ['hug', '🤗', 'Hug-reset?'],
  ['wrong', '🪞', 'Okay, I got that bit wrong'],
  ['talk', '☕', 'Chai and talk?'],
  ['love', '💛', 'Love you, even mid-argument'],
];

export const HUDDLE_BEST: Item[] = [
  ['us', '💞', 'Time with you'],
  ['work', '💼', 'A win at work'],
  ['family', '👨‍👩‍👧', 'Family time'],
  ['friends', '👯', 'Seeing friends'],
  ['rest', '😴', 'Good rest'],
  ['food', '🍲', 'A great meal'],
  ['outside', '🌳', 'Time outdoors'],
  ['learned', '💡', 'Learning something'],
];

export const HUDDLE_HARD: Item[] = [
  ['work', '💼', 'Work'],
  ['family', '👨‍👩‍👧', 'Family'],
  ['tired', '😴', 'Feeling tired'],
  ['health', '🩺', 'Health'],
  ['money', '💰', 'Money'],
  ['distance', '🌍', 'The distance'],
  ['us', '💬', 'Something between us'],
  ['nothing', '🌤️', 'Nothing hard this week'],
];

export const HUDDLE_NEED: Item[] = [
  ['time', '🕰️', 'More time together'],
  ['rest', '🛋️', 'Rest'],
  ['help', '🛠️', 'A hand with something'],
  ['fun', '🎉', 'Something fun'],
  ['talk', '💬', 'A proper talk'],
  ['space', '🌙', 'A little space'],
  ['plan', '🗓️', 'A plan for the week'],
  ['cheer', '📣', 'A cheerleader'],
];

export const DREAM_TYPES: Item[] = [
  ['home', '🏡', 'Home'],
  ['travel', '✈️', 'Travel'],
  ['family', '👨‍👩‍👧', 'Family'],
  ['career', '💼', 'Career'],
  ['giving', '🤲', 'Giving back'],
  ['learning', '📚', 'Learning'],
  ['health', '🌿', 'Health'],
  ['adventure', '🧭', 'Adventure'],
];

export const SHUKRIYA_PROMPTS: string[] = [
  'Thank you for…',
  'I noticed when you…',
  'It meant a lot when you…',
  'I love how you…',
  'You made my day easier by…',
  'I felt looked after when you…',
  'I am proud of you for…',
  'I smiled when you…',
  'Thank you for being patient when…',
  'I never said it, but thank you for…',
  'My favourite moment with you this week was…',
  'I am lucky that you…',
];

export const NEED_MENU: { id: 'spark' | 'talk' | 'fun' | 'plan' | 'thanks'; e: string; l: string; sub: string }[] = [
  { id: 'spark', e: '✨', l: 'Spark', sub: 'Something a little romantic' },
  { id: 'talk', e: '💬', l: 'Talk it through', sub: 'Get to know the real us a bit better' },
  { id: 'fun', e: '🎲', l: 'Just fun', sub: 'Light, silly, easy' },
  { id: 'plan', e: '🗓️', l: 'Plan together', sub: 'Home, money, trips and next steps' },
  { id: 'thanks', e: '🙏', l: 'Say thanks', sub: 'Notice and appreciate each other' },
];

/** Signs of harm: not a normal rough patch. The UI pairs these with the safety footer. */
export const HARMFUL_SIGNS: string[] = [
  'You feel afraid of your partner.',
  'You are being controlled, checked on or watched.',
  'You are being cut off from friends, family or your own money.',
  'You are being hurt, or threatened with harm.',
  'You are pressured into things you do not want to do.',
  'You are put down, mocked or made to feel small, again and again.',
  'You feel afraid to say no.',
];

/** Normal but hard: common in many couples, and worth talking through. */
export const HARD_SIGNS: string[] = [
  'You keep arguing about the same thing.',
  'You feel a bit distant lately.',
  'You have different habits or routines.',
  'Family expectations are putting pressure on you both.',
  'Work, study or life stress is spilling over.',
  'You show love in different ways.',
  'You are both in a busy season with little time.',
];
