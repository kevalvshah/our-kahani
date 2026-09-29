// Card content: the Pehli Baat season (14 days) and the official packs.
// Rules (CLAUDE.md): no alcohol, non-vegetarian food, pets, ex-partners or heavy topics; films
// appear as emoji plus title only; no lyrics or dialogue; inclusive of every region and faith.

import type { Diet, RawCard } from './packTypes';
import { MORE_PACKS } from './morePacks';

/** `diet` marks a food option that not every couple eats: shown only when both people's food choice allows it. */
export type Opt = { id: string; e: string; l: string; sub?: string; diet?: Diet };

export type Card =
  | { type: 'choice' | 'pick' | 'nhie' | 'guess'; q: string; opts: Opt[]; ans?: string; cheer?: boolean }
  | { type: 'multi'; q: string; opts: Opt[]; cheer?: boolean }
  | { type: 'line' | 'recall'; q: string; ph: string; banner?: string; cheer?: boolean }
  | { type: 'bet'; q: string; opts: Opt[] }
  | { type: 'noticed' }
  | { type: 'bug' }
  | { type: 'try'; q: string; items: Opt[] }
  | { type: 'then'; q: string; from: string; opts: Opt[] };

export interface CardEntry {
  id: string;
  tag: string;
  card: Card;
  pack?: string;
  day?: number;
}

const o = (id: string, e: string, l: string, sub?: string): Opt => (sub ? { id, e, l, sub } : { id, e, l });
export const NHIE_OPTS: Opt[] = [o('have', '🙋', 'I have'), o('never', '🙅', 'Never')];

// ---------------------------------------------------------------------------
// Season 1 · Pehli Baat
// ---------------------------------------------------------------------------
export const SEASON: Record<number, { tag: string; card: Card }> = {
  1: { tag: 'This or that', card: { type: 'choice', q: 'Chai or coffee to start the day?', opts: [o('chai', '☕', 'Chai'), o('coffee', '🫘', 'Coffee')] } },
  2: { tag: 'This or that', card: { type: 'choice', q: 'Saturday night: garba floor or sofa and snacks?', opts: [o('garba', '💃', 'Garba floor'), o('sofa', '🛋️', 'Sofa + snacks')] } },
  3: { tag: 'One line', card: { type: 'line', q: 'Best thing you ate this week?', ph: 'One line is plenty ✍️', banner: 'Two plates, two stories 🍽️' } },
  4: { tag: 'I bet you would pick…', card: { type: 'bet', q: 'City break or countryside cottage?', opts: [o('city', '🏙️', 'City break'), o('cottage', '🏡', 'Countryside cottage')] } },
  5: { tag: 'Things I noticed', card: { type: 'noticed' } },
  6: { tag: 'Sunday pick', card: { type: 'pick', q: 'What are we watching this Sunday?', opts: [o('in', '🇮🇳', 'Indian series', 'Something warm and desi'), o('west', '🌍', 'Western series', 'Something bingeable')] } },
  7: { tag: 'Bug report', card: { type: 'bug' } },
  8: {
    tag: 'Tick any',
    card: {
      type: 'multi',
      q: 'A perfect lazy weekend has…',
      opts: [o('lie', '😴', 'A long lie-in'), o('brunch', '🥞', 'A slow brunch'), o('walk', '🚶', 'A long walk'), o('film', '🎬', 'A film marathon'), o('call', '📞', 'A call with family'), o('cook', '🍲', 'Cooking something new')],
    },
  },
  9: { tag: 'Never have I ever', card: { type: 'nhie', q: 'burned the chai 🫖', opts: NHIE_OPTS } },
  10: { tag: 'One line', card: { type: 'line', q: 'A small thing that made you smile today?', ph: 'One line ✍️', banner: 'Two small smiles 😊' } },
  11: { tag: 'This or that', card: { type: 'choice', q: 'Rainy day: chai and pakoras indoors, or a walk in the rain?', opts: [o('indoors', '🫖', 'Chai and pakoras'), o('rain', '🌧️', 'Walk in the rain')] } },
  12: { tag: 'Never have I ever', card: { type: 'nhie', q: 'sent a message to the wrong group chat 📱', opts: NHIE_OPTS } },
  13: {
    tag: 'Sunday pick',
    card: {
      type: 'pick',
      q: 'Next long call: what are we doing?',
      opts: [o('cook', '🍳', 'Cook-along', 'Same recipe, two kitchens'), o('watch', '📺', 'Watch-along', 'Same show, press play together'), o('walk', '🚶', 'Walk-and-talk', 'Both outside, on the phone')],
    },
  },
  14: {
    tag: 'Halfway Date',
    card: {
      type: 'try',
      q: 'Which of these should we try first?',
      items: [o('pottery', '🏺', 'Pottery class'), o('yoga', '🧘', 'A yoga workshop'), o('garba', '💃', 'Garba or dance class'), o('photo', '📷', 'Photo walk'), o('cook', '🍲', 'Cook something together'), o('city', '🚆', 'City break')],
    },
  },
};

export const TRY_LABELS: Record<string, string> = { keen: 'Keen 🙌', maybe: 'Maybe 🤔', no: 'Not for me' };

// ---------------------------------------------------------------------------
// Packs
// ---------------------------------------------------------------------------
export interface Pack {
  id: string;
  name: string;
  e: string;
  blurb: string;
  cards: Card[];
}

function pack(id: string, name: string, e: string, blurb: string, raw: RawCard[]): Pack {
  const cards = raw.map((c): Card => {
    if (c.t === 'nhie') return { type: 'nhie', q: c.q, opts: NHIE_OPTS };
    if (!('o' in c)) return { type: c.t, q: c.q, ph: c.ph, banner: c.banner, cheer: c.cheer };
    const opts = c.o.map(([oid, oe, ol, diet]) => (diet ? { ...o(oid, oe, ol), diet } : o(oid, oe, ol)));
    if (c.t === 'multi') return { type: 'multi', q: c.q, opts, cheer: c.cheer };
    return { type: c.t, q: c.q, opts, ans: 'ans' in c ? c.ans : undefined, cheer: c.cheer };
  });
  return { id, name, e, blurb, cards };
}

const RECALL_PH = 'One line ✍️';

export const PACKS: Pack[] = [
  pack('garba', 'Garba Season', '💃', 'Navratri nights, dandiya and dabeli', [
    { t: 'choice', q: 'Garba floor or dandiya sticks?', o: [['garba', '💃', 'Garba floor'], ['dandiya', '🥢', 'Dandiya sticks']] },
    { t: 'choice', q: 'Garba outfit vibe: bright and bold or soft and classic?', o: [['bold', '🌈', 'Bright and bold'], ['classic', '🌸', 'Soft and classic']] },
    { t: 'nhie', q: 'danced garba until my feet gave up 🦶' },
    { t: 'multi', q: 'Best part of Navratri?', o: [['dance', '💃', 'The dancing'], ['food', '🍲', 'The food'], ['outfits', '👗', 'The outfits'], ['music', '🎶', 'The live music'], ['people', '👯', 'The company']] },
    { t: 'choice', q: 'Garba night snack: chaat or dabeli?', o: [['chaat', '🌶️', 'Chaat'], ['dabeli', '🥪', 'Dabeli']] },
    { t: 'choice', q: 'At a garba night: straight into the circle or cheer from the side first?', o: [['circle', '💃', 'Straight into the circle'], ['side', '📷', 'Cheer from the side first']] },
    { t: 'choice', q: 'Garba night together this Navratri?', o: [['yes', '🙌', "Yes, let's plan it"], ['maybe', '🤔', 'Maybe, tell me more'], ['virtual', '🎧', 'Virtual garba: same playlist, video call']] },
    { t: 'multi', q: 'On your Navratri outfit list?', o: [['choli', '👗', 'Chaniya choli'], ['kediyu', '🕺', 'Kediyu and dhoti'], ['kurta', '👕', 'A bright kurta'], ['bandhani', '🧣', 'A bandhani dupatta'], ['mirror', '🪞', 'Mirror work everywhere'], ['jewel', '💍', 'Oxidised jewellery'], ['trainers', '👟', 'Comfy trainers underneath']] },
    { t: 'choice', q: 'Garba steps: know them all, still learning, or copy whoever is in front?', o: [['pro', '🌟', 'I know them all'], ['learning', '📚', 'Still learning'], ['copy', '👀', 'Copy whoever is in front']] },
    { t: 'multi', q: 'Pandal and stall food you would queue for?', o: [['dabeli', '🥪', 'Dabeli'], ['fafda', '🥨', 'Fafda and jalebi'], ['dhokla', '🟨', 'Khaman dhokla'], ['sabudana', '🍚', 'Sabudana khichdi'], ['panipuri', '🫧', 'Pani puri'], ['chai', '☕', 'Masala chai'], ['kulfi', '🍦', 'Kulfi']] },
    { t: 'choice', q: 'The music for the night: live dhol and singers, or a DJ mix?', o: [['live', '🥁', 'Live dhol and singers'], ['dj', '🎧', 'A DJ mix'], ['both', '🎶', 'Live first, DJ late']] },
    { t: 'line', q: 'One song title that has to be on the garba playlist?', ph: 'Just the title ✍️', banner: 'Two playlist picks 🎶' },
    { t: 'choice', q: 'The ninth night: last one in the circle, or home before the rush?', o: [['last', '💫', 'Last one in the circle'], ['early', '🏠', 'Home before the rush'], ['depends', '🎲', 'Depends on my feet']] },
    { t: 'nhie', q: 'learned a new garba step from a video at midnight 📱' },
    { t: 'choice', q: 'Garba with family: dance with everyone, or find your friends in the circle?', o: [['family', '👨‍👩‍👧', 'Dance with the whole family'], ['friends', '👯', 'Find my friends'], ['both', '🔁', 'A round with each']] },
    { t: 'multi', q: 'Navratri far from home looks like…', o: [['hall', '🏫', 'Garba in a school or community hall'], ['call', '📱', 'A video call with family in India'], ['farsan', '🍘', 'Homemade farsan'], ['work', '💼', 'Dressing up straight after work'], ['puja', '🪷', 'Durga Puja pandal hopping too'], ['teach', '🙌', 'Teaching friends their first steps']] },
  ]),
  pack('warm', 'Warm Words', '💛', 'Affection, compliments, small kindnesses', [
    { t: 'multi', q: 'How does affection land best for you?', o: [['hugs', '🤗', 'Hugs'], ['words', '💬', 'Kind words'], ['gifts', '🎁', 'Little gifts'], ['time', '🕰️', 'Time together'], ['help', '🛠️', 'Someone helping out'], ['calls', '📞', 'A surprise call']] },
    { t: 'choice', q: 'A first hello in person: hug, handshake, or wave and a grin?', o: [['hug', '🤗', 'A hug'], ['shake', '🤝', 'A handshake'], ['wave', '😄', 'A wave and a grin']] },
    { t: 'line', q: 'One thing you appreciated this week?', ph: 'Big or small, one line ✍️', banner: 'Two small thank-yous 💛' },
    { t: 'choice', q: 'A compliment you would love to get: your smile, your mind, or your humour?', o: [['smile', '😊', 'My smile'], ['mind', '🧠', 'My mind'], ['humour', '😂', 'My humour']] },
    { t: 'choice', q: 'On a rough day: a call, a silly meme, or space and a text later?', o: [['call', '📞', 'A call'], ['meme', '😂', 'A silly meme'], ['space', '🌙', 'Space, text me later']] },
    { t: 'choice', q: 'Nickname vibe?', o: [['sweet', '🍯', 'Something sweet'], ['silly', '🤪', 'Something silly'], ['name', '🙂', 'Just my name, thanks']] },
    { t: 'choice', q: 'Thinking-of-you style?', o: [['morning', '🌅', 'A good-morning text'], ['meme', '🖼️', 'A random midday meme'], ['night', '🌙', 'A goodnight note']] },
    { t: 'line', q: 'A compliment you got once and still remember?', ph: 'One line ✍️', banner: 'Two kind words, kept 💛' },
    { t: 'choice', q: 'Saying sorry: the words, a small gesture, or a hug and move on?', o: [['words', '💬', 'The words'], ['gesture', '🎁', 'A small gesture'], ['hug', '🤗', 'A hug and move on']] },
    { t: 'multi', q: 'Small kindnesses that make your day?', o: [['chai', '☕', 'Someone making me chai'], ['voice', '🎙️', 'A voice note'], ['detail', '🧠', 'Remembering a small detail'], ['note', '📝', 'A handwritten note'], ['last', '🥟', 'Being offered the last samosa'], ['door', '🚪', 'A door held open']] },
    { t: 'choice', q: 'Celebrating a small win: a treat, a call, or a quiet well done?', o: [['treat', '🍨', 'A treat'], ['call', '📞', 'A call'], ['quiet', '🙂', 'A quiet well done']] },
    { t: 'choice', q: 'Something sweet to say: text or voice note?', o: [['text', '💬', 'Text, so I can reread it'], ['voice', '🎙️', 'Voice note, so I hear it'], ['both', '💞', 'Surprise me']] },
    { t: 'line', q: 'A small kindness from a stranger you still remember?', ph: 'One line ✍️', banner: 'Two kind strangers 🌼' },
  ]),
  pack('recall', 'Remember When', '🧠', 'Sixty seconds to remember something we talked about', [
    { t: 'recall', q: 'Tell me one random thing we talked about last week or the week before.', ph: RECALL_PH },
    { t: 'recall', q: 'What is a small thing I said two weeks ago that stuck with you?', ph: RECALL_PH },
    { t: 'recall', q: 'Something that made you laugh on a call recently, but not this week.', ph: RECALL_PH },
    { t: 'recall', q: 'What did we talk about the first time we spoke?', ph: RECALL_PH },
    { t: 'recall', q: 'A plan we mentioned once and never followed up on?', ph: RECALL_PH },
    { t: 'recall', q: 'Something I told you that you want to ask more about?', ph: RECALL_PH },
    { t: 'recall', q: 'A snack or dish I mentioned that you would like to try?', ph: RECALL_PH },
    { t: 'recall', q: 'Something I was looking forward to, a little while ago?', ph: RECALL_PH },
    { t: 'recall', q: 'A place I have mentioned: a city, a café, a street?', ph: RECALL_PH },
    { t: 'recall', q: 'A song or show I recommended to you?', ph: RECALL_PH },
    { t: 'recall', q: 'Something about my friends or family I told you once?', ph: RECALL_PH },
    { t: 'recall', q: 'A tiny detail from one of my days that you remember?', ph: RECALL_PH },
  ]),
  pack('fair', 'Fair Warning', '🚩', "What you're signing up for, kindly", [
    { t: 'multi', q: 'Fair warnings about me?', o: [['hum', '🎶', 'I hum songs mid-conversation'], ['photos', '📸', 'I take 40 photos of one plate'], ['quiet', '🤫', 'I go quiet when I am tired'], ['planner', '🗂️', 'I plan trips in spreadsheets'], ['late', '⏰', 'I am always 5 minutes late'], ['snack', '🍿', 'I steal food off your plate'], ['sports', '🏏', 'I pause everything for a match']] },
    { t: 'choice', q: 'How do you recharge after a long week?', o: [['alone', '🛋️', 'Alone time'], ['people', '👯', 'People and plans'], ['both', '⚖️', 'A bit of both']] },
    { t: 'choice', q: 'Messaging style?', o: [['quick', '⚡', 'Quick replies'], ['batch', '📦', 'Replies in batches'], ['call', '📞', 'I would rather call']] },
    { t: 'choice', q: 'Planning style?', o: [['plan', '🗓️', 'Plan everything'], ['flow', '🎲', 'Go with the flow'], ['rough', '🧭', 'A rough plan']] },
    { t: 'multi', q: 'On a trip, I am the one who…', o: [['nav', '🧭', 'Navigates'], ['snacks', '🍿', 'Packs the snacks'], ['food', '🍜', 'Finds the best food'], ['photos', '📸', 'Takes the photos'], ['book', '🧾', 'Books everything'], ['playlist', '🎧', 'Makes the playlist']] },
    { t: 'line', q: 'One thing you are working on about yourself?', ph: 'Big or small, one line ✍️', banner: 'Two works in progress 🌱' },
    { t: 'choice', q: 'When we disagree: talk it out now, or cool off first?', o: [['now', '💬', 'Talk it out now'], ['cool', '🌙', 'Cool off, then talk'], ['write', '✍️', 'Write it down first']] },
    { t: 'choice', q: 'Morning person or night owl?', o: [['morning', '🌅', 'Morning person'], ['night', '🦉', 'Night owl'], ['chai', '☕', 'Depends on the chai']] },
    { t: 'multi', q: 'Things I am oddly particular about?', o: [['chai', '🫖', 'How my chai is made'], ['temp', '🌡️', 'The heating or AC setting'], ['dishes', '🍽️', 'Loading the dishwasher'], ['fold', '👕', 'Folding clothes'], ['spice', '🌶️', 'Spice level'], ['time', '⏰', 'Being on time'], ['queue', '🎧', 'The song queue']] },
    { t: 'choice', q: 'When hungry and grumpy: feed me fast, leave me be, or extra chatty?', o: [['feed', '🍛', 'Feed me fast'], ['leave', '🌙', 'Leave me be'], ['chatty', '🗣️', 'Weirdly extra chatty']] },
    { t: 'choice', q: 'Tidy style?', o: [['place', '🗂️', 'Everything has a place'], ['chaos', '🌀', 'Organised chaos'], ['guests', '🧹', 'Tidy when guests are coming']] },
    { t: 'line', q: 'A small habit of yours that people find funny?', ph: 'One line ✍️', banner: 'Two quirks, fairly warned 😄' },
    { t: 'choice', q: 'Phones at mealtimes?', o: [['away', '📵', 'Face down, away'], ['table', '📱', 'On the table is fine'], ['depends', '🎲', 'Depends who is eating']] },
  ]),
  pack('screen', 'Screen Time', '📺', 'Series, genres, K-drama and Netflix nights', [
    { t: 'multi', q: 'Genres you keep coming back to?', o: [['romcom', '💕', 'Rom-com'], ['thriller', '🕵️', 'Thriller'], ['comedy', '😂', 'Comedy'], ['crime', '🔎', 'Crime and mystery'], ['family', '👨‍👩‍👧', 'Family drama'], ['scifi', '🚀', 'Sci-fi'], ['docs', '🎥', 'Documentaries'], ['anime', '🍥', 'Anime']] },
    { t: 'multi', q: 'Whose shows have you enjoyed?', o: [['in', '🇮🇳', 'Hindi or regional'], ['kr', '🇰🇷', 'Korean dramas (K-drama)'], ['uk', '🇬🇧', 'British'], ['us', '🇺🇸', 'American'], ['jp', '🇯🇵', 'Anime and Japanese'], ['es', '🇪🇸', 'Spanish'], ['tr', '🇹🇷', 'Turkish']] },
    { t: 'choice', q: 'K-drama night: yes please, one to try, or not my thing?', o: [['yes', '🇰🇷', 'Yes please'], ['try', '🤔', 'One to try'], ['no', '🙅', 'Not my thing yet']] },
    { t: 'choice', q: 'Subtitles or dubbed?', o: [['subs', '📝', 'Subtitles'], ['dub', '🎙️', 'Dubbed'], ['any', '🤷', 'Whichever']] },
    { t: 'choice', q: 'Watching style?', o: [['binge', '🍿', 'Binge in one go'], ['night', '🌙', 'One episode a night'], ['depends', '🎲', 'Depends on the show']] },
    { t: 'choice', q: 'Which platform feels like home?', o: [['netflix', '🔴', 'Netflix'], ['prime', '📦', 'Prime Video'], ['disney', '⭐', 'Disney+ or Hotstar'], ['yt', '📺', 'YouTube']] },
    { t: 'choice', q: 'Movie night: comfort rewatch or something new?', o: [['comfort', '🛋️', 'Comfort rewatch'], ['new', '🆕', 'Something brand new']] },
    { t: 'choice', q: 'Scrolling for something to watch: 5 minutes or 45?', o: [['quick', '⚡', 'Five minutes, then press play'], ['long', '🌀', 'Forty-five, easily'], ['rewatch', '🔁', 'We give up and rewatch']] },
    { t: 'multi', q: 'Snacks for a series night?', o: [['popcorn', '🍿', 'Popcorn'], ['peanuts', '🥜', 'Masala peanuts'], ['murukku', '🌀', 'Chakli or murukku'], ['bhel', '🥗', 'Bhel'], ['choc', '🍫', 'Chocolate'], ['chai', '☕', 'Chai'], ['nachos', '🌮', 'Nachos']] },
    { t: 'choice', q: 'Spoilers?', o: [['hate', '🙉', 'Never, ever'], ['fine', '🤷', 'I do not mind'], ['ending', '📖', 'I read the ending first']] },
    { t: 'choice', q: 'Watch-along on a call: chat through it or quiet watching?', o: [['chat', '💬', 'Chat all the way through'], ['quiet', '🤫', 'Quiet, talk after'], ['pause', '⏸️', 'Pause for the big moments']] },
    { t: 'choice', q: 'Big screen or sofa?', o: [['cinema', '🎟️', 'Cinema, always'], ['sofa', '🛋️', 'Sofa, blanket, done'], ['both', '⚖️', 'Cinema for the big ones']] },
    { t: 'choice', q: 'Tearing up during a show: often, rarely, or never admitting it?', o: [['often', '🥲', 'Often'], ['rarely', '🙂', 'Rarely'], ['never', '😎', 'Never admitting it']] },
  ]),
  pack('culture', 'Desi Abroad', '🌍', 'Growing up desi far from home, playfully', [
    { t: 'choice', q: 'Where do you call home right now?', o: [['uk', '🇬🇧', 'UK'], ['us', '🇺🇸', 'USA'], ['ca', '🇨🇦', 'Canada'], ['au', '🇦🇺', 'Australia'], ['za', '🇿🇦', 'South Africa'], ['ae', '🇦🇪', 'Dubai or UAE']] },
    { t: 'multi', q: 'Where is your family from in India?', o: [['gujarat', '🌾', 'Gujarat'], ['punjab', '🥭', 'Punjab'], ['maha', '🏙️', 'Maharashtra'], ['north', '🏰', 'Delhi, UP or Rajasthan'], ['east', '🪷', 'Bengal or Odisha'], ['tamil', '🌴', 'Tamil Nadu'], ['kerala', '🥥', 'Kerala'], ['south', '🌶️', 'Andhra, Telangana or Karnataka']] },
    { t: 'multi', q: 'Things you did as a desi kid abroad?', o: [['dabba', '🍱', 'Carried a dabba to school and got curious looks'], ['translate', '🗣️', 'Translated for elders at the bank or doctor'], ['sleepover', '🛏️', 'Negotiated a sleepover like a lawyer'], ['oil', '💆', 'Got the Sunday head-oil treatment'], ['suitcase', '🧳', 'Flew with 23 kg of pickle and snacks'], ['aunties', '📼', 'Watched a Bollywood film with all the aunties'], ['accent', '🎭', 'Switched accents between home and school']] },
    { t: 'choice', q: 'When you are excited, which language comes out?', o: [['eng', '🇬🇧', 'English'], ['mother', '🗣️', 'My mother tongue'], ['mix', '🔀', 'A full mix']] },
    { t: 'choice', q: 'Faith and rituals at home?', o: [['regular', '🪔', 'Regular prayers or visits'], ['festivals', '🎉', 'Festivals only'], ['cultural', '🌿', 'More cultural than religious'], ['chat', '💬', 'Rather chat about it']] },
    { t: 'choice', q: 'Visiting India: your mode?', o: [['food', '🥭', 'Food tour'], ['family', '👨‍👩‍👧', 'Family-time overload'], ['shop', '🛍️', 'Shopping haul'], ['heat', '🥵', 'Weather survival']] },
    { t: 'choice', q: 'Family functions abroad: love them or endure them?', o: [['love', '🎉', 'Love them'], ['endure', '😅', 'Endure them'], ['depends', '🍲', 'Depends who is cooking']] },
    { t: 'choice', q: 'The aunty network: how fast does news travel?', o: [['fast', '⚡', 'Faster than the internet'], ['slow', '🕰️', 'Slowly, thankfully'], ['avoid', '🕵️', 'I avoid the group chat']] },
    { t: 'multi', q: 'Traditions worth keeping alive abroad?', o: [['recipes', '🍲', 'Festival recipes'], ['music', '🎶', 'Folk music and dance'], ['prayers', '🙏', 'Prayers or visits'], ['outfits', '👗', 'Traditional outfits'], ['language', '🗣️', 'Speaking the mother tongue at home'], ['lights', '🪔', 'Festival lights and rituals']] },
    { t: 'line', q: 'A family tradition you are proud of?', ph: 'One line ✍️', banner: 'Two traditions 🪔' },
    { t: 'multi', q: 'Comfort food from home?', o: [['dal', '🍛', 'Dal chawal'], ['rajma', '🫘', 'Rajma chawal'], ['idli', '🍘', 'Idli sambar'], ['thepla', '🫓', 'Thepla'], ['poha', '🍚', 'Poha'], ['khichdi', '🥣', 'Khichdi'], ['paratha', '🥙', 'Aloo paratha'], ['curd', '🥛', 'Curd rice']] },
    { t: 'choice', q: 'Chai at home is…', o: [['masala', '🫚', 'Masala chai'], ['elaichi', '🌿', 'Elaichi chai'], ['filter', '☕', 'Filter coffee, actually'], ['bag', '🫖', 'A tea bag (do not tell anyone)']] },
    { t: 'multi', q: 'Community meals you have loved being part of?', o: [['langar', '🙏', 'Langar at a gurdwara'], ['prasad', '🪔', 'Prasad at a mandir'], ['iftar', '🌙', 'An iftar with friends'], ['church', '⛪', 'A church lunch'], ['jain', '🧘', 'A Jain community meal'], ['hall', '🏫', 'A community hall dinner'], ['notyet', '✨', 'Not yet, would love to']] },
    { t: 'line', q: 'A word from your home language you wish English had?', ph: 'The word and what it means ✍️', banner: 'Two favourite words 🗣️' },
    { t: 'choice', q: 'Explaining your name to new people?', o: [['easy', '😌', 'Easy, they get it'], ['tutorial', '📚', 'A full pronunciation tutorial'], ['short', '✂️', 'I have a short version ready']] },
  ]),
  pack('fest', 'Festival Season', '🎆', 'Celebrating far from home, playfully', [
    { t: 'multi', q: 'Festivals your family celebrates?', o: [['diwali', '🪔', 'Diwali'], ['holi', '🎨', 'Holi'], ['navratri', '💃', 'Navratri, Garba or Durga Puja'], ['harvest', '🌾', 'Pongal, Onam, Vishu or Ugadi'], ['lohri', '🔥', 'Lohri or Baisakhi'], ['eid', '🌙', 'Eid'], ['xmas', '🎄', 'Christmas'], ['kites', '🪁', 'Uttarayan or Makar Sankranti'], ['jain', '🧘', 'Paryushan or Mahavir Jayanti'], ['ganesh', '🌺', 'Ganesh Chaturthi'], ['gurpurab', '🙏', 'Gurpurab']] },
    { t: 'multi', q: 'Diwali abroad: the best part?', o: [['lights', '🪔', 'Lights and diyas'], ['sweets', '🍬', 'The mithai'], ['fireworks', '🎆', 'Fireworks (if the rules allow 😄)'], ['clean', '🧹', 'The big clean'], ['family', '👨‍👩‍👧', 'Family visits'], ['calls', '📱', 'Video calls with everyone'], ['gifts', '🎁', 'Gifts']] },
    { t: 'line', q: 'How does your family celebrate Diwali where you live?', ph: 'One line ✍️', banner: 'Two Diwalis 🪔' },
    { t: 'choice', q: 'Where do festivals happen for you?', o: [['home', '🏠', 'At home'], ['hall', '🛕', 'Community hall or temple'], ['school', '🏫', 'A rented school hall'], ['park', '🌳', 'A park or a car park'], ['video', '📱', 'On a video call']] },
    { t: 'choice', q: 'Holi abroad: all in, layers and colour, or watch from the window?', o: [['all', '🎨', 'All in'], ['layers', '🧣', 'Layers and colour'], ['window', '📸', 'Watch from the window']] },
    { t: 'choice', q: 'Kites and sweets abroad: kites, snacks, or both?', o: [['kite', '🪁', 'Kites'], ['snacks', '🍯', 'Snacks (chikki, jalebi)'], ['both', '🎉', 'Both']] },
    { t: 'choice', q: 'How do festival sweets reach you?', o: [['home', '🍬', 'Homemade by family'], ['shop', '📦', 'From the local sweet shop'], ['suitcase', '✈️', 'Carried in a suitcase'], ['diy', '🧑‍🍳', 'I make my own']] },
    { t: 'choice', q: 'Different countries, different time zones: whose time do festival calls use?', o: [['mine', '🕒', 'Mine'], ['yours', '🕓', 'Yours'], ['middle', '⚖️', 'Somewhere in the middle']] },
    { t: 'choice', q: 'Celebrating together this year?', o: [['inperson', '🪔', 'In person if we can'], ['virtual', '📱', 'Virtually, on a video call'], ['see', '🤔', "Let's see"]] },
    { t: 'multi', q: 'Festival sweets you look forward to?', o: [['modak', '🥟', 'Modak'], ['payasam', '🥣', 'Payasam or kheer'], ['gujiya', '🥠', 'Gujiya'], ['sandesh', '🍥', 'Sandesh'], ['pinni', '🟤', 'Pinni'], ['seviyan', '🍜', 'Sheer khurma or seviyan'], ['puran', '🫓', 'Puran poli'], ['xmas', '🎄', 'A Christmas sweets platter']] },
    { t: 'line', q: 'A festival from another tradition you would love to join?', ph: 'One line ✍️', banner: 'Two new festivals to try 🎉' },
    { t: 'choice', q: 'Festival outfit: planned weeks ahead or decided that morning?', o: [['weeks', '🗓️', 'Planned weeks ahead'], ['morning', '⏰', 'Decided that morning'], ['borrow', '👗', 'Borrowed from a cousin']] },
    { t: 'choice', q: 'Rangoli or kolam: artist, helper, or admirer?', o: [['artist', '🎨', 'The artist'], ['helper', '🤲', 'The helper'], ['admirer', '📸', 'The admirer with the camera']] },
  ]),
  pack('college', 'College Days', '🎓', 'Campus canteen, bunking, notes, cultural nights', [
    { t: 'choice', q: 'Campus canteen or the coffee and chai cart outside?', o: [['canteen', '🍽️', 'Campus canteen'], ['cart', '☕', 'Coffee or chai cart']] },
    { t: 'nhie', q: 'bunked a lecture for a movie 🎬' },
    { t: 'choice', q: 'Night before the exam: cram all night or sleep and pray?', o: [['cram', '📚', 'Cram all night'], ['pray', '😴', 'Sleep and pray']] },
    { t: 'nhie', q: "borrowed a friend's notes and never returned them 📓" },
    { t: 'choice', q: 'Which row were you in?', o: [['back', '🪑', 'Back row'], ['front', '🎯', 'Front row']] },
    { t: 'nhie', q: 'danced at a uni cultural night or society event 💃' },
    { t: 'choice', q: 'Group project role?', o: [['lead', '🧭', 'The organiser'], ['research', '🔎', 'The researcher'], ['slides', '🎨', 'The slides designer'], ['present', '🎤', 'The one who presents']] },
    { t: 'nhie', q: 'fallen asleep in the library 📚' },
    { t: 'choice', q: 'Late-night study fuel?', o: [['maggi', '🍜', 'Maggi'], ['chai', '☕', 'Chai'], ['biscuits', '🍪', 'Biscuits'], ['toast', '🍞', 'Toast']] },
    { t: 'nhie', q: 'joined a society just for the free snacks 🍩' },
    { t: 'choice', q: 'Cultural night: on stage, backstage, or front row cheering?', o: [['stage', '🎭', 'On stage'], ['back', '🎛️', 'Backstage'], ['front', '📣', 'Front row cheering']] },
    { t: 'nhie', q: 'called home to ask how to make dal 📞' },
  ]),
  pack('filmy', 'Filmy Fun', '🎬', 'Dilwale, 90s romance, garba', [
    { t: 'choice', q: 'Best SRK–Kajol comfort watch?', o: [['ddlj', '🚂', 'Dilwale Dulhania Le Jayenge'], ['kkhh', '🏀', 'Kuch Kuch Hota Hai'], ['dilwale', '🎢', 'Dilwale (2015)']] },
    { t: 'nhie', q: 'cried during a Bollywood climax 😭' },
    { t: 'choice', q: 'Which era wins?', o: [['nineties', '🌹', '90s romance'], ['noughties', '🕶️', '2000s masala']] },
    { t: 'choice', q: 'Filmy proposal: mustard-field dance or quiet rooftop?', o: [['field', '🌾', 'Mustard-field dance'], ['roof', '🌆', 'Quiet rooftop']] },
    { t: 'nhie', q: 'danced to a Bollywood song alone in the kitchen 🍳' },
    { t: 'choice', q: 'Garba playlist: Gujarati classics or Bollywood garba hits?', o: [['classic', '🎶', 'Gujarati classics'], ['bolly', '🎬', 'Bollywood garba hits']] },
    { t: 'choice', q: 'Best filmy friendship?', o: [['dch', '🚗', 'Dil Chahta Hai'], ['znmd', '🏝️', 'Zindagi Na Milegi Dobara'], ['3i', '🎓', '3 Idiots']] },
    { t: 'nhie', q: 'watched the same film more than five times 🔁' },
    { t: 'choice', q: 'Which film industry are we exploring next?', o: [['hindi', '🎬', 'Hindi'], ['tamil', '🌴', 'Tamil'], ['telugu', '🌶️', 'Telugu'], ['malayalam', '🥥', 'Malayalam'], ['bengali', '🪷', 'Bengali'], ['marathi', '🏙️', 'Marathi'], ['punjabi', '🌾', 'Punjabi'], ['gujarati', '💃', 'Gujarati']] },
    { t: 'nhie', q: 'sung a film song loudly in the car 🚗' },
    { t: 'choice', q: 'Interval snack?', o: [['samosa', '🥟', 'Samosa'], ['popcorn', '🍿', 'Popcorn'], ['nachos', '🌮', 'Nachos'], ['none', '🙅', 'No interval, no snack']] },
    { t: 'nhie', q: 'rewound a dance number to learn the steps 💃' },
  ]),
  pack('family', 'Family Tamasha', '👨‍👩‍👧', 'Group chats, festivals, "eat more"', [
    { t: 'choice', q: 'Family WhatsApp group: mute it or reply to every Good Morning?', o: [['mute', '🔕', 'Mute it'], ['reply', '🌞', 'Reply to all']] },
    { t: 'nhie', q: 'hidden in the kitchen to escape a long family group photo 📸' },
    { t: 'choice', q: 'Festival lunch: help cook or supervise from the sofa?', o: [['cook', '🍳', 'Help cook'], ['sofa', '🛋️', 'Supervise']] },
    { t: 'nhie', q: 'been told "eat a little more" after a full plate 🍛' },
    { t: 'choice', q: 'Family road trip: window seat and playlist or snack-bag captain?', o: [['window', '🪟', 'Window + playlist'], ['snacks', '🍿', 'Snack-bag captain']] },
    { t: 'choice', q: 'Who would you trust with a secret?', o: [['fun', '🤫', 'The fun mama or masi'], ['wise', '🧓', 'Wise dada or dadi']] },
    { t: 'nhie', q: 'been introduced as "the one who lives abroad" at a function 🌍' },
    { t: 'choice', q: 'At family functions you are the…', o: [['dj', '🎧', 'Unofficial DJ'], ['photo', '📸', 'Photographer'], ['kids', '🧸', 'One playing with the little cousins'], ['kitchen', '🍲', 'One helping in the kitchen']] },
    { t: 'nhie', q: 'been handed a phone to "just say hi" to a relative I barely remember 📱' },
    { t: 'choice', q: 'Big family debate at dinner: jump in or refill the chai?', o: [['jump', '🗣️', 'Jump right in'], ['chai', '🫖', 'Quietly refill the chai'], ['referee', '⚖️', 'Referee']] },
    { t: 'choice', q: 'Best cook in your family?', o: [['mum', '👩‍🍳', 'Mum'], ['dad', '👨‍🍳', 'Dad'], ['grand', '🧓', 'A grandparent'], ['aunty', '🍲', 'An aunty or uncle'], ['me', '😎', 'Me, obviously']] },
    { t: 'nhie', q: 'been sent home with three boxes of leftovers 🍱' },
  ]),
  pack('dream', 'Dream & Cherish', '🌷', 'Flowers, escapes, goals, little cares', [
    { t: 'multi', q: 'Flowers that make you smile?', o: [['rose', '🌹', 'Roses'], ['sunflower', '🌻', 'Sunflowers'], ['marigold', '🌼', 'Marigold (genda)'], ['lotus', '🪷', 'Lotus'], ['mogra', '🌸', 'Mogra / jasmine'], ['mixed', '💐', 'A mixed bouquet'], ['food', '🍫', 'No flowers, snacks please']] },
    { t: 'multi', q: 'Escape holiday: beach, skyline, mountain, or all of the above?', o: [['beach', '🏖️', 'Beach'], ['sky', '🌆', 'Skyline city'], ['mount', '🏔️', 'Mountains'], ['country', '🌿', 'Countryside'], ['road', '🚗', 'A road trip'], ['all', '🎒', 'All of the above']] },
    { t: 'choice', q: 'Bonus: who comes on the escape?', o: [['solo', '🎧', 'Just me, a reset'], ['someone', '💞', 'Someone to cherish 😏'], ['friends', '👯', 'Friends'], ['family', '👨‍👩‍👧', 'Family']] },
    { t: 'multi', q: 'What would make the next 6 months feel like progress?', cheer: true, o: [['raise', '📈', 'A promotion or raise'], ['skill', '🎓', 'A new skill or course'], ['side', '🧰', 'A side project'], ['save', '💰', 'A saving goal'], ['switch', '🔄', 'A career switch'], ['balance', '🧘', 'Better work-life balance']] },
    { t: 'line', q: 'One goal you are building from zero in the next 6 months?', ph: 'One line is plenty ✍️', banner: 'Two goals, two cheerleaders 📣', cheer: true },
    { t: 'multi', q: 'Little things that make you feel looked after?', o: [['gm', '☀️', 'A good-morning message'], ['cook', '🍲', 'Cooking for me sometimes'], ['surprise', '🎁', 'Small surprises'], ['help', '🤝', 'Help when I am stressed'], ['time', '⏳', 'Undivided time'], ['checkin', '💬', 'Checking in when I go quiet'], ['listen', '🎧', 'Listening without fixing'], ['hug', '🫶', 'Hugs, in person']] },
    { t: 'choice', q: 'Dream home: city flat, house with a garden, or somewhere by the sea?', o: [['city', '🏙️', 'City flat'], ['garden', '🏡', 'House with a garden'], ['sea', '🌊', 'Somewhere by the sea'], ['hills', '⛰️', 'Up in the hills']] },
    { t: 'multi', q: 'On your someday list?', cheer: true, o: [['music', '🎸', 'Learn an instrument'], ['lights', '🌌', 'See the northern lights'], ['run', '🏃', 'Run a 10k'], ['lang', '🗣️', 'Learn a new language'], ['india', '🗺️', 'Explore a new part of India'], ['write', '📖', 'Write something of my own'], ['swim', '🏊', 'Learn to swim']] },
    { t: 'line', q: 'A small thing you are looking forward to this month?', ph: 'One line ✍️', banner: 'Two things to look forward to 🌷', cheer: true },
    { t: 'choice', q: 'Birthday style?', o: [['party', '🎉', 'Big party'], ['dinner', '🍽️', 'Small dinner'], ['quiet', '🕯️', 'A quiet day'], ['trip', '🧳', 'A little trip']] },
    { t: 'multi', q: 'Where would you love to travel next?', o: [['japan', '🗾', 'Japan'], ['italy', '🍝', 'Italy'], ['kerala', '🛶', 'Kerala backwaters'], ['iceland', '🧊', 'Iceland'], ['rajasthan', '🏜️', 'Rajasthan'], ['nz', '🥝', 'New Zealand'], ['bali', '🌺', 'Bali']] },
    { t: 'line', q: 'Something you want to learn this year?', ph: 'One line is plenty ✍️', banner: 'Two things to learn 📚', cheer: true },
  ]),
  pack('emoji', 'Emoji Filmy Guess', '🎬', 'Guess the film from emojis', [
    { t: 'guess', q: '🚂🌾💃', ans: 'ddlj', o: [['ddlj', '🚂', 'Dilwale Dulhania Le Jayenge'], ['kkhh', '🏀', 'Kuch Kuch Hota Hai'], ['jwm', '🚆', 'Jab We Met'], ['dtpd', '🎭', 'Dil Toh Pagal Hai']] },
    { t: 'guess', q: '3️⃣🤪🎓', ans: '3i', o: [['3i', '🎓', '3 Idiots'], ['mb', '🩺', 'Munna Bhai M.B.B.S.'], ['chh', '🎒', 'Chhichhore'], ['rdb', '🎨', 'Rang De Basanti']] },
    { t: 'guess', q: '🇪🇸🤿🎉', ans: 'znmd', o: [['znmd', '🏝️', 'Zindagi Na Milegi Dobara'], ['dch', '🚤', 'Dil Chahta Hai'], ['yjhd', '🏔️', 'Yeh Jawaani Hai Deewani'], ['queen', '👑', 'Queen']] },
    { t: 'guess', q: '🏏🌾🇮🇳', ans: 'lagaan', o: [['lagaan', '🏏', 'Lagaan'], ['cdi', '🏑', 'Chak De! India'], ['dangal', '🤼', 'Dangal'], ['swades', '🛰️', 'Swades']] },
    { t: 'guess', q: '🏀🎓💛', ans: 'kkhh', o: [['kkhh', '🏀', 'Kuch Kuch Hota Hai'], ['dilwale', '🎢', 'Dilwale (2015)'], ['soty', '🎓', 'Student of the Year'], ['khnh', '🌇', 'Kal Ho Naa Ho']] },
    { t: 'guess', q: '👑🧳🇫🇷', ans: 'queen', o: [['queen', '👑', 'Queen'], ['jwm', '🚆', 'Jab We Met'], ['ev', '🗽', 'English Vinglish'], ['piku', '🚕', 'Piku']] },
    { t: 'guess', q: '🚆🗣️🏔️', ans: 'jwm', o: [['jwm', '🚆', 'Jab We Met'], ['ddlj', '🚂', 'Dilwale Dulhania Le Jayenge'], ['yjhd', '🏔️', 'Yeh Jawaani Hai Deewani'], ['queen', '👑', 'Queen']] },
    { t: 'guess', q: '🤼‍♀️👧👧🥇', ans: 'dangal', o: [['dangal', '🤼', 'Dangal'], ['cdi', '🏑', 'Chak De! India'], ['bmb', '🏃', 'Bhaag Milkha Bhaag'], ['lagaan', '🏏', 'Lagaan']] },
    { t: 'guess', q: '🏑🇮🇳👩‍👩‍👧‍👧', ans: 'cdi', o: [['cdi', '🏑', 'Chak De! India'], ['dangal', '🤼', 'Dangal'], ['lagaan', '🏏', 'Lagaan'], ['bmb', '🏃', 'Bhaag Milkha Bhaag']] },
    { t: 'guess', q: '🏔️🎒🎉', ans: 'yjhd', o: [['yjhd', '🏔️', 'Yeh Jawaani Hai Deewani'], ['znmd', '🏝️', 'Zindagi Na Milegi Dobara'], ['dch', '🚗', 'Dil Chahta Hai'], ['jwm', '🚆', 'Jab We Met']] },
    { t: 'guess', q: '🍱✉️🚂', ans: 'lunchbox', o: [['lunchbox', '🍱', 'The Lunchbox'], ['piku', '🚕', 'Piku'], ['ev', '🗽', 'English Vinglish'], ['swades', '🛰️', 'Swades']] },
    { t: 'guess', q: '🗽🗣️🍬', ans: 'ev', o: [['ev', '🗽', 'English Vinglish'], ['queen', '👑', 'Queen'], ['lunchbox', '🍱', 'The Lunchbox'], ['khnh', '🌇', 'Kal Ho Naa Ho']] },
    { t: 'guess', q: '🔥🌊🤝', ans: 'rrr', o: [['rrr', '🔥', 'RRR'], ['bahu', '🏰', 'Baahubali'], ['lagaan', '🏏', 'Lagaan'], ['swades', '🛰️', 'Swades']] },
  ]),  ...MORE_PACKS.map(([id, name, e, blurb, raw]) => pack(id, name, e, blurb, raw)),
];

export const TYPE_LABEL: Record<string, string> = {
  recall: '60-second recall',
  choice: 'This or that',
  pick: 'This or that',
  nhie: 'Never have I ever',
  multi: 'Tick any',
  guess: 'Guess the film',
  line: 'One line',
  bet: 'I bet you would pick',
  noticed: 'Things I noticed',
  bug: 'Bug report',
  try: 'Halfway Date',
  then: 'Then vs Now',
};

/** Card refs are stable ids used as the (opaque) `ref` of answer records. */
export const dayRef = (day: number) => `day:${day}`;
export const packRef = (packId: string, index: number) => `pack:${packId}:${index + 1}`;
export const bonusRef = (id: string) => `bonus:${id}`;

export function seasonEntry(day: number): CardEntry | null {
  const s = SEASON[day];
  return s ? { id: dayRef(day), tag: s.tag, card: s.card, day } : null;
}

export function packEntry(packId: string, index: number): CardEntry | null {
  const p = PACKS.find((x) => x.id === packId);
  const card = p?.cards[index];
  return p && card ? { id: packRef(packId, index), tag: p.name, card, pack: packId } : null;
}

/** Looks up a season or pack card by its ref. Bonus cards live in room data instead. */
export function entryForRef(ref: string): CardEntry | null {
  const day = /^day:(\d+)$/.exec(ref);
  if (day) return seasonEntry(Number(day[1]));
  const pk = /^pack:([a-z]+):(\d+)$/.exec(ref);
  if (pk) return packEntry(pk[1]!, Number(pk[2]) - 1);
  return null;
}
