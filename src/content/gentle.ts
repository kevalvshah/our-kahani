// Gentle Corner deck: opt-in by both people, with four depth levels.
// The deck shows cards up to the lower of the two people's chosen depths.
// Rules (CLAUDE.md): never graphic, never about trauma details, self-harm or ex-partners.
// Deeper cards ask "what helps you" and "what matters to you", and every tick-any or
// this-or-that card has a kind way out (option id 'pass').

import { NHIE_OPTS, type Card, type Opt } from './cards';

export type GentleDepth = 'light' | 'personal' | 'emotional' | 'deep';

export const GENTLE_DEPTHS: { id: GentleDepth; e: string; l: string; sub: string }[] = [
  { id: 'light', e: '🌤️', l: 'Light', sub: 'Easy, feel-good sharing' },
  { id: 'personal', e: '🌱', l: 'Personal', sub: 'Habits, wishes and what matters to you' },
  { id: 'emotional', e: '🤍', l: 'Emotional', sub: 'Feelings, worries and what comforts you' },
  { id: 'deep', e: '🌊', l: 'Deep', sub: 'Values, family, the future, and past hurts, handled gently' },
];

const o = (id: string, e: string, l: string, sub?: string): Opt => (sub ? { id, e, l, sub } : { id, e, l });
const PASS = o('pass', '🤍', 'Rather not say');
const LATER = o('pass', '🤍', 'Pass for now');

const multi = (q: string, opts: Opt[], pass: Opt = PASS): Card => ({ type: 'multi', q, opts: [...opts, pass] });
const choice = (q: string, opts: Opt[], pass: Opt = PASS): Card => ({ type: 'choice', q, opts: [...opts, pass] });
const line = (q: string, banner: string, ph = 'One line, or skip 🤍'): Card => ({ type: 'line', q, ph, banner });
const nhie = (q: string): Card => ({ type: 'nhie', q, opts: NHIE_OPTS });

const RAW: Record<GentleDepth, Card[]> = {
  light: [
    multi('Little things that lift your mood straight away?', [o('sun', '☀️', 'A bit of sunshine'), o('music', '🎶', 'A favourite song'), o('chai', '☕', 'A really good chai'), o('friend', '📞', 'A call with a friend'), o('walk', '🚶', 'A long walk'), o('tidy', '🧺', 'A tidy room')], LATER),
    choice('The perfect start to a day off?', [o('breakfast', '🥞', 'A slow breakfast'), o('early', '🌅', 'An early walk'), o('sleep', '😴', 'Sleeping in')], LATER),
    line('Something that made you laugh properly this week?', 'Two good laughs 😄'),
    multi('Which of these feel like a real treat?', [o('flowers', '💐', 'Fresh flowers'), o('book', '📖', 'A new book'), o('playlist', '🎧', 'A new playlist'), o('nap', '💤', 'An afternoon nap'), o('chaat', '🌶️', 'A plate of chaat'), o('bath', '🛁', 'A long bath')], LATER),
    nhie('laughed so hard I had to leave the room 😂'),
    choice('Your happy place?', [o('water', '🌊', 'By the water'), o('hills', '⛰️', 'In the hills'), o('city', '🏙️', 'A busy city'), o('home', '🏡', 'At home')], LATER),
    line('A smell that takes you straight back home?', 'Two smells of home 🏡', 'Agarbatti, rain, tadka… ✍️'),
    multi('Compliments that make you glow?', [o('kind', '💛', 'Kind'), o('funny', '😂', 'Funny'), o('clever', '🧠', 'Clever'), o('thoughtful', '🌷', 'Thoughtful'), o('style', '✨', 'Stylish'), o('hard', '💪', 'Hardworking')]),
    choice('Weekend energy right now?', [o('adventure', '🧭', 'Up for an adventure'), o('cosy', '🛋️', 'Cosy and slow'), o('social', '👯', 'Seeing people')], LATER),
    nhie('kept a birthday card for years 💌'),
    line('A small thing you are proud of this month?', 'Two little wins 🌱'),
    multi('Sounds that calm you down?', [o('rain', '🌧️', 'Rain on a window'), o('birds', '🐦', 'Birdsong'), o('old', '📻', 'Old film songs'), o('devotional', '🙏', 'A bhajan, kirtan, qawwali or hymn'), o('waves', '🌊', 'Waves'), o('quiet', '🤫', 'Proper silence')], LATER),
    choice('Good news: tell everyone, tell one person, or keep it cosy for a bit?', [o('all', '📣', 'Tell everyone'), o('one', '💬', 'Tell one person'), o('cosy', '🤫', 'Keep it cosy for a bit')], LATER),
  ],
  personal: [
    multi('How do you most like to be shown care?', [o('words', '💬', 'Kind words'), o('time', '🕰️', 'Time together'), o('gifts', '🎁', 'Small gifts'), o('help', '🛠️', 'Help with things'), o('touch', '🤗', 'Hugs, in person')]),
    choice('When you have news, who hears it first?', [o('family', '👨‍👩‍👧', 'Family'), o('friend', '👯', 'A close friend'), o('sibling', '🧑‍🤝‍🧑', 'A sibling or cousin'), o('self', '🌙', 'I keep it to myself a while')]),
    line('A dream you have not told many people?', 'Two quiet dreams ✨', 'Small or big, or skip 🤍'),
    multi('What matters most in a normal week?', [o('family', '🏠', 'Time with family'), o('fit', '🏃', 'Keeping active'), o('quiet', '🙏', 'Prayer or quiet time'), o('learn', '📚', 'Learning something'), o('friends', '👯', 'Friends'), o('rest', '😴', 'Proper rest')]),
    nhie('changed a big plan at the last minute and been glad I did 🔀'),
    choice('How much alone time do you need?', [o('lots', '🛋️', 'Quite a lot'), o('daily', '⏳', 'A little every day'), o('rarely', '👯', 'Hardly any')]),
    multi('Habits you are building right now?', [o('early', '🌅', 'Earlier mornings'), o('read', '📖', 'Reading more'), o('move', '🚶', 'Moving more'), o('scroll', '📵', 'Less scrolling'), o('save', '💰', 'Saving'), o('cook', '🍲', 'Cooking more')], LATER),
    line('Someone who shaped how you see the world?', 'Two people who shaped us 🌿', 'A teacher, a grandparent… ✍️'),
    choice('Money style?', [o('saver', '🐷', 'Saver'), o('spender', '🛍️', 'Enjoy it now'), o('planner', '🗂️', 'Planner, with room for treats')]),
    multi('What would make work feel meaningful?', [o('help', '🤝', 'Helping people'), o('create', '🎨', 'Making things'), o('stable', '🧱', 'Stability'), o('grow', '📈', 'Growing'), o('free', '🕊️', 'Independence'), o('team', '👥', 'A good team')]),
    nhie('written down a goal and actually done it ✅'),
    choice('A good weekday evening?', [o('cook', '🍲', 'Cook and unwind'), o('move', '🏃', 'A walk or the gym'), o('friends', '👯', 'Seeing friends'), o('project', '🧰', 'A side project')], LATER),
    line('Something you wish more people asked you about?', 'Two things to ask about 💬'),
    choice('Faith or spirituality in your daily life?', [o('daily', '🪔', 'A daily practice'), o('festivals', '🎉', 'Festivals and family'), o('personal', '🌿', 'A quiet, personal belief'), o('exploring', '🧭', 'Still exploring')]),
  ],
  emotional: [
    multi('When you are stressed, what helps most?', [o('talk', '💬', 'Talking it through'), o('distract', '🎬', 'A distraction'), o('space', '🌙', 'Space and quiet'), o('walk', '🚶', 'A walk'), o('practical', '🛠️', 'Practical help'), o('hug', '🫶', 'A hug')]),
    choice('When you are upset, what do you want most?', [o('listen', '🎧', 'To be listened to'), o('solve', '🧩', 'Help solving it'), o('space', '🌙', 'A little space first')]),
    multi('Signs you are having a hard day?', [o('quiet', '🤫', 'I go quiet'), o('busy', '🌀', 'I get very busy'), o('short', '💬', 'Short replies'), o('snacky', '🍪', 'I get snacky'), o('jokes', '😅', 'Extra jokes')]),
    line('One thing that always comforts you?', 'Two comforts 🤍'),
    choice('After a disagreement, what helps you reconnect?', [o('sorry', '🤗', 'A sorry and a hug'), o('talk', '💬', 'A proper talk'), o('gesture', '🎁', 'Time, then a small gesture'), o('laugh', '😄', 'A shared laugh')]),
    multi('What helps you feel safe to open up?', [o('nojudge', '🕊️', 'No judgement'), o('private', '🔒', 'Knowing it stays between us'), o('time', '⏳', 'Taking my time'), o('asked', '🌷', 'Being asked gently'), o('first', '🤝', 'The other person going first')]),
    choice('When I go quiet, the kindest thing is…', [o('check', '💬', 'A gentle check-in'), o('space', '🌙', 'Space until I come back'), o('light', '🌼', 'Something light, no pressure')]),
    line('Something on your mind lately, only if you want to share?', 'Two things on our minds 🤍'),
    multi('What makes you feel appreciated after a long day?', [o('asked', '💬', 'Being asked about my day'), o('meal', '🍲', 'A meal made for me'), o('laugh', '😄', 'A laugh'), o('company', '🛋️', 'Quiet company'), o('thanks', '🙏', 'A thank you')]),
    choice('How do you like reassurance?', [o('say', '💬', 'Say it out loud'), o('show', '🤲', 'Show me in small actions'), o('rarely', '🙂', 'I rarely need it')]),
    multi('Feelings you find hardest to say out loud?', [o('hurt', '💔', '"That hurt"'), o('help', '🆘', '"I need help"'), o('proud', '🌟', '"I am proud of myself"'), o('miss', '🫶', '"I miss you"'), o('unsure', '🌫️', '"I am not sure"')]),
    line('What does a good apology sound like to you?', 'Two kinds of sorry 🕊️'),
    choice('When plans change at the last minute, you feel…', [o('fine', '😌', 'Fine, roll with it'), o('thrown', '🌀', 'A bit thrown, then okay'), o('moment', '⏳', 'I need a moment')]),
  ],
  deep: [
    multi('Values you want at the heart of your home?', [o('honest', '🪞', 'Honesty'), o('kind', '💛', 'Kindness'), o('faith', '🪔', 'Faith'), o('humour', '😄', 'Humour'), o('ambition', '🚀', 'Ambition'), o('generous', '🤲', 'Generosity'), o('elders', '🙏', 'Respect for elders')]),
    choice('How involved should families be in big decisions?', [o('very', '👨‍👩‍👧', 'Very involved'), o('advise', '💬', 'They advise, we decide'), o('us', '🏡', 'Mostly just us')]),
    multi('Where could you see yourself living one day?', [o('here', '📍', 'Where I am now'), o('near', '🏠', 'Near family'), o('abroad', '✈️', 'A new country'), o('india', '🇮🇳', 'In India for a while'), o('work', '💼', 'Wherever work takes us'), o('unsure', '🧭', 'Not sure yet')]),
    choice('Thinking about children someday, where are you right now?', [o('yes', '🌱', 'I would love to'), o('open', '🤲', 'Open to it'), o('no', '🌿', 'Not for me'), o('unsure', '🧭', 'Not sure yet')], o('pass', '🤍', 'Rather not say yet')),
    line('What does a good life look like to you in ten years?', 'Two pictures of a good life 🌅'),
    multi('Traditions you want to carry forward?', [o('festivals', '🎉', 'Festivals'), o('worship', '🙏', 'Prayer or visits to a place of worship'), o('language', '🗣️', 'Our language'), o('food', '🍲', 'Family recipes'), o('gatherings', '👨‍👩‍👧', 'Big family gatherings'), o('new', '✨', 'Making new ones of our own')]),
    choice('Faith in a shared home?', [o('shared', '🪔', 'A shared practice'), o('each', '🤝', 'Each our own, with respect'), o('cultural', '🌿', 'More cultural than religious'), o('working', '🧭', 'Still working it out')]),
    line('Something hard you have grown through? A word or two is plenty.', 'Two quiet strengths 🌱', 'Only what feels okay 🤍'),
    multi('When old hurts come up, what helps you?', [o('heard', '🎧', 'Being heard, no questions'), o('reassure', '🤍', 'Reassurance'), o('space', '🌙', 'Space to feel it'), o('light', '😄', 'Something to lighten it'), o('stop', '✋', 'Knowing I can stop anytime')]),
    choice('Caring for parents as they get older: how do you picture it?', [o('with', '🏠', 'Living with us'), o('near', '📍', 'Living nearby'), o('far', '📞', 'Support from afar'), o('together', '🤝', 'We work it out together')]),
    multi('Money matters that feel important to you?', [o('home', '🏡', 'Saving for a home'), o('family', '👨‍👩‍👧', 'Helping family'), o('give', '🤲', 'Giving to causes'), o('travel', '✈️', 'Travel'), o('security', '🧱', 'A safety net'), o('freedom', '🕊️', 'Freedom to change paths')]),
    line('What do you most want the person you are with to understand about you?', 'Two things to understand 🤍'),
    choice('Careers and home life: how do you picture the balance?', [o('equal', '⚖️', 'Shared equally'), o('turns', '🔁', 'Whoever needs it more at the time'), o('seasons', '🍂', 'It will change with the seasons of life')]),
    multi('What helps you trust someone?', [o('steady', '🧱', 'Being consistent'), o('honest', '🪞', 'Honesty, even when it is hard'), o('promises', '🤝', 'Keeping small promises'), o('real', '🙂', 'Being themselves'), o('time', '⏳', 'Time')]),
  ],
};

export const GENTLE_CARDS: { id: string; depth: GentleDepth; card: Card }[] = GENTLE_DEPTHS.flatMap(({ id: depth }) =>
  RAW[depth].map((card, i) => ({ id: `g-${depth}-${i + 1}`, depth, card })),
);

/** Plain-English notes on what each depth draws on (for our docs). */
export const GENTLE_RESEARCH_NOTES: string[] = [
  "The deck climbs slowly, like Arthur Aron's escalating self-disclosure questions: small, easy shares first, deeper ones only once both people have chosen to go there.",
  "Light and Personal draw on John Gottman's love maps: open questions about everyday likes, habits, hopes and the people who matter, so each person builds a picture of the other's world.",
  'Personal includes the idea behind love languages: people feel cared for in different ways (words, time, gifts, help, touch), and it helps to know which ones land.',
  'Emotional draws on attachment-aware ideas about comfort and soothing: what helps when you are stressed, upset or quiet, and whether you want listening, solving or space.',
  "Emotional also covers repair after a disagreement, following Gottman's work on repair attempts: what a good apology looks like and what helps you reconnect.",
  'Deep covers values, family expectations common in diaspora families, faith and traditions, money, where to live and caring for parents, asked as open preferences with no right answer.',
  'Children are asked about once, neutrally, with "not sure yet" and "rather not say yet" as equal answers.',
  'Past hurts are only ever asked as "what helps you", never "what happened". No trauma details, no graphic content, and every tick-any or this-or-that card has a pass option.',
];
