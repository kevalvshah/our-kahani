// Seasons 2 to 5, mapped to relationship stages. Season 1 (Pehli Baat) lives in cards.ts.
// Rules (CLAUDE.md): one tap or one line, no tests or scores, no guilt; nothing about ex-partners,
// abuse or self-harm; no alcohol, meat or pets. Never-have-I-ever stays light.
// Playful first: at least two playful cards for every reflective one, never two reflective cards
// in a row. Reflective cards are the ones whose needs include 'talk'. No therapy words on screen.
// Every tick-any or this-or-that card in Season 2 has option id 'pass'.

import { NHIE_OPTS, type Card, type Opt } from './cards';

export type SeasonId = 's2' | 's3' | 's4' | 's5';
export type Need = 'spark' | 'talk' | 'fun' | 'plan' | 'thanks';
export interface SeasonCard { tag: string; card: Card; needs: Need[] }
export interface Season { id: SeasonId; n: 2 | 3 | 4 | 5; name: string; e: string; stage: string; theme: string; blurb: string; cards: SeasonCard[] }

const o = (id: string, e: string, l: string, sub?: string): Opt => (sub ? { id, e, l, sub } : { id, e, l });
const PASS = o('pass', '🤍', 'Rather not say');
const THEN_OPTS: Opt[] = [o('same', '👍', 'Still true'), o('changed', '🔄', 'It has changed'), o('both', '🤷', 'A bit of both')];

const then = (from: string, q: string, needs: Need[]): SeasonCard => ({ tag: 'Then vs Now', card: { type: 'then', q, from, opts: THEN_OPTS }, needs });
const choice = (q: string, opts: Opt[], needs: Need[], tag = 'This or that'): SeasonCard => ({ tag, card: { type: 'choice', q, opts }, needs });
const multi = (q: string, opts: Opt[], needs: Need[], tag = 'Tick any'): SeasonCard => ({ tag, card: { type: 'multi', q, opts }, needs });
const line = (q: string, banner: string, needs: Need[], ph = 'One line ✍️', tag = 'One line'): SeasonCard => ({ tag, card: { type: 'line', q, ph, banner }, needs });
const nhie = (q: string, needs: Need[]): SeasonCard => ({ tag: 'Never have I ever', card: { type: 'nhie', q, opts: NHIE_OPTS }, needs });
const pick = (q: string, opts: Opt[], needs: Need[]): SeasonCard => ({ tag: 'Pick one', card: { type: 'pick', q, opts }, needs });
const bet = (q: string, opts: Opt[], needs: Need[]): SeasonCard => ({ tag: 'I bet you would pick…', card: { type: 'bet', q, opts }, needs });

export const SEASONS: Season[] = [
  {
    id: 's2',
    n: 2,
    name: 'Asli Kahani',
    e: '🌗',
    stage: 'Power struggle',
    theme: 'Funny habits, little differences, making up fast',
    blurb: 'The real us: funny habits, little differences, and making up fast.',
    cards: [
      then('day:1', 'Chai or coffee to start the day: still the same?', ['fun']),
      then('day:2', 'Saturday nights: does your answer still hold?', ['fun']),
      then('day:4', 'City break or cottage: did I read you right back then?', ['fun', 'spark']),
      then('day:8', 'Your perfect lazy weekend: still looks like this?', ['fun']),
      then('day:11', 'Rainy days: still the same pick?', ['fun']),
      then('day:13', 'Our long calls: still how you like to spend them?', ['fun', 'plan']),
      multi('When I am stressed, the best thing you can do is…', [o('talk', '💬', 'Let me talk it out'), o('space', '🌙', 'Give me a little space'), o('help', '🛠️', 'Help with one small thing'), o('distract', '🎬', 'Distract me with something silly'), o('hug', '🫶', 'A big hug'), o('feed', '🍲', 'Feed me something warm'), PASS], ['talk'], 'Little things'),
      bet('I bet you know my hungry-and-grumpy warning sign…', [o('quiet', '🤐', 'I go very quiet'), o('drama', '🎭', 'I get very dramatic'), o('snacks', '🍪', 'I raid the snack drawer'), o('everything', '🙄', 'Suddenly everything is annoying')], ['fun']),
      choice('Who says sorry first, honestly?', [o('me', '🙋', 'Me, super fast'), o('you', '👉', 'You, obviously'), o('chai', '☕', 'Whoever makes the chai'), PASS], ['fun']),
      choice('When I go quiet, the best thing you can do is…', [o('check', '💬', 'Check in gently'), o('wait', '⏳', 'Give me a bit, I will come back'), o('meme', '😂', 'Send a silly meme'), PASS], ['talk'], 'Little things'),
      nhie('said sorry with food instead of words 🍲', ['fun']),
      pick('Our official make-up move', [o('chai', '☕', 'Chai and talk'), o('hug', '🤗', 'Hug-reset'), o('meme', '😂', 'Silly meme truce')], ['fun', 'spark']),
      multi('A sorry that really lands has…', [o('plain', '🙏', 'A plain, simple sorry'), o('next', '🗺️', 'A plan for next time'), o('hug', '🫶', 'A hug'), o('treat', '🍨', 'A small treat'), o('laugh', '😄', 'A little laugh after'), PASS], ['talk'], 'Making up'),
      multi('Little differences we can happily live with?', [o('sleep', '🦉', 'Early bird and night owl'), o('tidy', '🧹', 'Tidy and relaxed'), o('plan', '🗓️', 'Planner and go-with-the-flow'), o('spice', '🌶️', 'Extra spicy and mild please'), o('money', '🐷', 'Saver and spender'), o('social', '👯', 'Social butterfly and homebody'), PASS], ['fun']),
      bet('I bet you would say our biggest difference is…', [o('plans', '🗓️', 'How we plan'), o('sleep', '😴', 'Sleep times'), o('food', '🌶️', 'Spice levels'), o('texts', '📱', 'How we text')], ['fun']),
      multi('Little things that help me feel respected?', [o('alone', '🛋️', 'Some time to myself'), o('phone', '📱', 'My phone stays mine'), o('ask', '📅', 'Asking before family plans'), o('sleepy', '🌙', 'No big chats when I am sleepy'), o('tease', '🤐', 'Not teasing about certain things'), PASS], ['talk'], 'Little things'),
      choice('Pani puri showdown: who eats more?', [o('me', '🙋', 'Me, easily'), o('you', '👉', 'You, no contest'), o('tie', '🤝', 'A very fair tie'), PASS], ['fun']),
      nhie('pretended to love a gift from a relative 🎁', ['fun']),
      choice('When our families want different things, let us…', [o('together', '🤝', 'Decide together first, then share'), o('own', '🗣️', 'Each chat with our own family'), o('middle', '⚖️', 'Find a middle path'), PASS], ['talk', 'plan'], 'Family'),
      choice('Big family function: stick together or split up and mingle?', [o('together', '🫂', 'Stick together'), o('split', '🔀', 'Split up and mingle'), o('rescue', '🆘', 'Split up, with a rescue signal'), PASS], ['fun']),
      bet('I bet you would be the first to…', [o('sleep', '😴', 'Fall asleep on a road trip'), o('cry', '🥲', 'Cry at a film'), o('samosa', '🥟', 'Eat the last samosa'), o('dance', '💃', 'Start dancing at a wedding')], ['fun']),
      line('One small thing that helps you reset after a rough day?', 'Two ways to reset 🌿', ['talk'], 'One line ✍️', 'Little things'),
      choice('The great AC (or heating) debate: who wins?', [o('me', '🥶', 'Me'), o('you', '🥵', 'You'), o('blanket', '🛌', 'We share a blanket'), PASS], ['fun']),
      pick('This week, shall we try…', [o('checkin', '☕', 'A 10-minute chai catch-up each day'), o('nophones', '📵', 'A no-phones dinner or call'), o('notes', '💌', 'One silly note each')], ['plan', 'thanks']),
    ],
  },
  {
    id: 's3',
    n: 3,
    name: 'Sukoon',
    e: '🍃',
    stage: 'Stability',
    theme: 'Comfy, but never boring',
    blurb: 'Comfy is lovely. Now add surprises, new tries and a little mischief.',
    cards: [
      multi('Something new we could try this month?', [o('dance', '💃', 'A dance class'), o('cuisine', '🥟', 'A cuisine neither of us knows'), o('games', '🎲', 'A board game night'), o('pottery', '🏺', 'Pottery'), o('sunrise', '🌅', 'A sunrise walk'), o('museum', '🖼️', 'A museum or gallery')], ['spark', 'fun']),
      line('Something in your world I should ask more about? A hobby, a show, a friend…', 'Two worlds to explore 🌍', ['talk']),
      choice('Date night: a familiar favourite or something brand new?', [o('fav', '🛋️', 'Familiar favourite'), o('new', '🆕', 'Something brand new'), o('mix', '🎲', 'Swap each time')], ['spark']),
      bet('I bet your ideal surprise is…', [o('breakfast', '🥞', 'Breakfast made for you'), o('note', '💌', 'A hidden note'), o('day', '🗺️', 'A planned day out'), o('playlist', '🎧', 'A playlist made for you')], ['spark']),
      multi('Things you want a little time for, just for you?', [o('read', '📖', 'Reading'), o('gym', '🏃', 'Exercise'), o('friends', '👯', 'Friends'), o('hobby', '🎨', 'A hobby'), o('learn', '🎓', 'Learning something'), o('quiet', '🤫', 'Quiet time')], ['talk']),
      pick('A new little ritual for us?', [o('sunday', '☕', 'Sunday chai and plans'), o('voice', '🎙️', 'Goodnight voice notes'), o('friday', '🎬', 'Friday film night')], ['fun', 'plan']),
      nhie('planned a surprise that went hilariously wrong 🎉', ['fun']),
      choice('A free weekend: together all day, or some time apart and meet for dinner?', [o('together', '💞', 'Together all day'), o('apart', '🔀', 'Some apart, then dinner'), o('mix', '⚖️', 'Depends on the weekend')], ['talk']),
      multi('On our bucket list?', [o('lights', '🌌', 'The northern lights'), o('road', '🚗', 'A long road trip'), o('dance', '💃', 'Learning a dance together'), o('feast', '🍲', 'Cooking a festival feast together'), o('volunteer', '🤲', 'Volunteering together'), o('india', '🪔', 'A festival in India')], ['spark', 'plan']),
      choice('Surprises: love them, or like a small heads-up?', [o('love', '🎁', 'Love them'), o('headsup', '🔔', 'A small heads-up, please'), o('depends', '🎲', 'Depends on the surprise')], ['fun']),
      line('A place near you we have never been to together?', 'Two places to try 📍', ['spark', 'plan']),
      line('A small tradition from your childhood we could borrow?', 'Two borrowed traditions 🪔', ['talk', 'thanks']),
      multi('Ways to keep things fresh?', [o('swap', '🔁', 'Take turns planning dates'), o('recipe', '🍳', 'A new recipe together'), o('phonefree', '📵', 'A phone-free evening'), o('dressup', '👗', 'Dress up for no reason'), o('learn', '📚', 'Learn something together'), o('game', '🎮', 'Play a game')], ['spark', 'fun']),
      line('Something you learned recently that made you go "whoa"?', 'Two whoa moments 💡', ['fun']),
      pick('Next month, shall we try…', [o('class', '🎓', 'A class together'), o('daytrip', '🚆', 'A day trip'), o('cookoff', '🧑‍🍳', 'A friendly cook-off')], ['fun', 'plan']),
      nhie('dressed up for a date at home 👗', ['spark']),
      choice('A random free evening?', [o('pakora', '🫖', 'Chai and pakoras'), o('filmy', '🎬', 'A filmy rewatch'), o('walk', '🚶', 'A long walk'), o('out', '🌆', 'Head out somewhere')], ['fun']),
      bet('I bet you would pick this for our next adventure…', [o('mountains', '⛰️', 'Mountains'), o('beach', '🏖️', 'Beach'), o('city', '🏙️', 'A new city'), o('country', '🌿', 'Countryside')], ['fun', 'spark']),
    ],
  },
  {
    id: 's4',
    n: 4,
    name: 'Saath',
    e: '🤝',
    stage: 'Commitment',
    theme: 'Team us',
    blurb: 'Thank-yous, teamwork and tiny sparks that keep us close.',
    cards: [
      line('Something I do that you never want me to stop?', 'Two keepers 💛', ['thanks']),
      multi('Why I would choose you again…', [o('kind', '💛', 'Your kindness'), o('funny', '😂', 'Your humour'), o('patient', '🕊️', 'Your patience'), o('support', '🤲', 'How you back me up'), o('drive', '🚀', 'Your drive'), o('values', '🧭', 'What we both care about')], ['thanks', 'spark']),
      multi('Money as a team: what sounds right?', [o('bills', '🧾', 'A shared pot for bills'), o('fun', '🎉', 'Separate money for fun'), o('goal', '🎯', 'A joint savings goal'), o('chat', '☕', 'A monthly money-and-chai chat'), o('app', '📱', 'A shared budget app'), o('pass', '🤍', 'Rather not say')], ['talk', 'plan']),
      bet('I bet you would say my best teamwork skill is…', [o('planning', '🗂️', 'Planning'), o('calm', '🧘', 'Staying calm'), o('cooking', '🍳', 'Cooking'), o('jokes', '😂', 'Keeping it light')], ['fun']),
      multi('Chores you secretly do not mind?', [o('dishes', '🍽️', 'Dishes'), o('laundry', '👕', 'Laundry'), o('cooking', '🍳', 'Cooking'), o('shopping', '🛒', 'Grocery runs'), o('plants', '🪴', 'Plants'), o('bills', '🧾', 'Bills and forms')], ['fun', 'plan']),
      choice('Big purchases: when do we check with each other first?', [o('small', '🪙', 'Even small ones'), o('medium', '💳', 'Anything medium or more'), o('big', '🏠', 'Only the really big ones'), o('number', '🔢', 'Let us pick a number')], ['talk', 'plan']),
      nhie('forgotten a birthday and been saved by a reminder 📅', ['fun']),
      pick("This week's spark", [o('tiffin', '🍱', 'A surprise tiffin or lunch'), o('note', '💌', 'A note in a bag or pocket'), o('dance', '💃', 'A dance in the kitchen')], ['spark']),
      multi("Ways to show up for each other's families?", [o('birthdays', '🎂', 'Calls on birthdays'), o('festivals', '🪔', 'Festival visits'), o('words', '🗣️', 'Learning a few words of their language'), o('recipe', '🍲', 'Cooking a family recipe'), o('names', '📝', 'Remembering everyone’s names'), o('functions', '🎊', 'Helping at functions')], ['talk', 'thanks']),
      choice('Family WhatsApp group: who replies to the good-morning messages?', [o('me', '🌞', 'Me, every single one'), o('you', '👉', 'You, bless you'), o('turns', '🔁', 'We take turns'), o('mute', '🔕', 'We both have it on mute')], ['fun']),
      choice('Life admin: who does what?', [o('strengths', '💪', 'Split by strengths'), o('turns', '🔁', 'Take turns'), o('together', '☕', 'Together on Sundays, with chai')], ['plan']),
      choice('Family visits: how often feels right?', [o('weekly', '📅', 'Most weeks'), o('monthly', '🗓️', 'About once a month'), o('festivals', '🪔', 'Festivals and big days'), o('flex', '🌊', 'Whenever it works')], ['talk', 'plan']),
      line('A moment you felt we were a real team?', 'Two team moments 🤝', ['thanks']),
      multi('Life admin for a shared list?', [o('bills', '🧾', 'Bills and renewals'), o('birthdays', '🎂', 'Family birthdays'), o('travel', '✈️', 'Travel bookings'), o('home', '🏠', 'Home repairs'), o('health', '🩺', 'Health check-ups'), o('docs', '📁', 'Important documents')], ['plan']),
      choice('The first sign we are due a date night?', [o('thanks', '🙏', 'Fewer thank-yous'), o('talk', '💬', 'Less real chatting'), o('phones', '📱', 'Phones at dinner'), o('plans', '🗓️', 'No plans just for us')], ['talk', 'spark']),
      choice('Date night during busy weeks?', [o('protect', '🛡️', 'Protect one evening'), o('short', '⏱️', 'Short and sweet, 20 minutes'), o('lunch', '🥗', 'A long weekend lunch instead')], ['spark', 'plan']),
      pick('A spark for this month', [o('firstdate', '🔁', 'Recreate our first date'), o('letters', '✉️', 'Write each other a letter'), o('cuisine', '🥢', 'Try a new cuisine together')], ['spark']),
      line('One thank-you you have been meaning to say?', 'Two thank-yous 🙏', ['thanks']),
    ],
  },
  {
    id: 's5',
    n: 5,
    name: 'Virasat',
    e: '🌳',
    stage: 'Co-creation',
    theme: 'Dream big, stay sweet',
    blurb: 'Big dreams, family recipes and a romance that stays centre stage.',
    cards: [
      multi('Dreams we share?', [o('home', '🏡', 'A home of our own'), o('travel', '✈️', 'Travel'), o('business', '🧰', 'Starting something'), o('family', '👨‍👩‍👧', 'Family'), o('giving', '🤲', 'Giving back'), o('learning', '📚', 'Always learning')], ['talk', 'plan']),
      pick('Our next big trip', [o('india', '🪔', 'India, with family'), o('new', '🗺️', 'Somewhere new for both of us'), o('train', '🚆', 'A slow trip by train')], ['spark', 'plan']),
      multi('Romance anchors we never drop?', [o('date', '🕯️', 'A weekly date'), o('goodnight', '🌙', 'A goodnight message'), o('anniversary', '💐', 'Anniversaries'), o('hugs', '🫶', 'A hug every day'), o('notes', '💌', 'Love notes'), o('dance', '💃', 'Dancing at every wedding')], ['spark']),
      line('In twenty years, what do you hope people say about us?', 'Two hopes 🌳', ['talk']),
      bet('I bet your perfect anniversary is…', [o('dinner', '🍽️', 'A special dinner'), o('trip', '🧳', 'A little trip'), o('home', '🏡', 'A quiet day at home'), o('redo', '🔁', 'Redoing our first date')], ['spark', 'fun']),
      multi('Recipes for our family recipe book?', [o('dal', '🍛', 'Dal'), o('thepla', '🫓', 'Thepla'), o('sambar', '🥣', 'Sambar'), o('saag', '🌿', 'Sarson da saag'), o('payasam', '🍮', 'Payasam or kheer'), o('sweets', '🍬', 'Festival sweets')], ['fun']),
      multi('Traditions to keep just as they are?', [o('food', '🍲', 'Festival food'), o('prayers', '🙏', 'Prayers or quiet time'), o('gatherings', '👨‍👩‍👧', 'Family gatherings'), o('language', '🗣️', 'Our languages'), o('rangoli', '🎨', 'Rangoli or kolam'), o('music', '🎶', 'Festival music and dance')], ['talk', 'plan']),
      line('A tradition we could give our own fun twist?', 'Two new twists ✨', ['fun']),
      nhie('written a letter to my future self ✉️', ['fun']),
      multi('Ways to give back together?', [o('volunteer', '🤝', 'Volunteering'), o('seva', '🍲', 'Seva at a community kitchen'), o('mentor', '🎓', 'Mentoring'), o('donate', '💝', 'Giving to a cause'), o('teach', '📖', 'Teaching a skill'), o('cleanup', '🌿', 'Local clean-ups')], ['talk', 'thanks']),
      choice('Our dream home has…', [o('kitchen', '🍳', 'A big kitchen'), o('garden', '🌻', 'A garden'), o('guests', '🛏️', 'A room for guests'), o('corner', '📚', 'A quiet reading corner')], ['spark', 'plan']),
      choice('Growing old together: which couple are we?', [o('walkers', '👟', 'Morning walkers in matching tracksuits'), o('crossword', '🧩', 'The chai-and-crossword couple'), o('dancers', '💃', 'Still first on the dance floor'), o('travellers', '🧳', 'Always off on another trip')], ['fun', 'spark']),
      choice('Where would you like to grow old?', [o('family', '👨‍👩‍👧', 'Near family'), o('sea', '🌊', 'By the sea'), o('india', '🇮🇳', 'In India'), o('here', '📍', 'Wherever we are')], ['talk', 'plan']),
      pick('A romance anchor for this season', [o('monthly', '🕯️', 'A monthly date'), o('trip', '✈️', 'A yearly trip, just us'), o('letter', '💌', 'A letter every anniversary')], ['spark']),
      multi('How should we celebrate milestones?', [o('dinner', '🍽️', 'A special dinner'), o('family', '👨‍👩‍👧', 'With family'), o('friends', '👯', 'With friends'), o('trip', '🧳', 'A trip'), o('quiet', '🕯️', 'Quietly, just us'), o('give', '🤲', 'By giving back')], ['plan', 'spark']),
      line('Something you would love to pass on, in our family or beyond?', 'Two things to pass on 🌱', ['talk']),
      line('A dream of yours you want me to cheer for?', 'Two cheerleaders 📣', ['thanks', 'spark']),
      line('Our kahani so far, in one line?', 'Two versions of our story 📖', ['thanks', 'fun']),
    ],
  },
];
