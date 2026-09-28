// Content for the rest of the app: micro-dates, songs and stories, Movie Night, saved-note
// labels, Gentle Corner, first-run choices and the name in ten scripts.

export const MICRO = [
  { e: '🚶', t: 'Walk-and-talk', d: 'Each of you steps outside for a walk, on a call.' },
  { e: '🍲', t: 'Same dinner, same call', d: 'Cook something simple and eat together on video.' },
  { e: '✏️', t: 'Sketch each other', d: 'Two minutes each, then hold it up to the camera.' },
  { e: '🎧', t: 'Listening party', d: 'Same playlist, same minute, react as it plays.' },
  { e: '📷', t: 'Photo swap', d: 'Take 3 photos of what you can see. Trade them.' },
  { e: '🧘', t: 'Pose swap', d: "Show one favourite yoga pose. Try each other's." },
  { e: '🍫', t: 'Taste test', d: 'Same snack, two kitchens. Rate it in emojis.' },
  { e: '🎬', t: 'Trailer reaction', d: 'Watch one trailer at the same time and text your reactions.' },
  { e: '🌇', t: 'Sunset swap', d: 'Send the sky from your window at the same time.' },
  { e: '🎲', t: 'Guess the song', d: 'Hum 5 seconds. The other guesses.' },
];

/** Song titles only (never lyrics). */
export const ANTAKSHARI_STARTERS = ['Tum Hi Ho', 'Kesariya', 'Chaiyya Chaiyya', 'Jai Ho'];

export const STORY_STARTERS = [
  'One rainy Sunday, a very confident pigeon walked into a dhokla shop and asked for the manager.',
  '{A} and {B} opened a tiny food truck that only sold chai and dance lessons.',
  'The garba circle suddenly started spinning the wrong way, and everyone looked at the DJ.',
  'A suitcase full of pickles was mistakenly delivered to a very confused astronaut.',
];

export interface Title {
  id: string;
  type: 'movie' | 'series';
  e: string;
  t: string;
  tag: string;
  hook: string;
}

// Films appear as emoji plus title only, never artwork (copyright).
export const TITLES: Title[] = [
  { id: 'ddlj', type: 'movie', e: '🚂', t: 'Dilwale Dulhania Le Jayenge', tag: 'Hindi · Romance', hook: 'The train, the mustard fields, the classic.' },
  { id: 'kkhh', type: 'movie', e: '🏀', t: 'Kuch Kuch Hota Hai', tag: 'Hindi · Romance', hook: 'Friendship, college and a lot of feelings.' },
  { id: '3i', type: 'movie', e: '🎓', t: '3 Idiots', tag: 'Hindi · Comedy drama', hook: 'College days and finding your own path.' },
  { id: 'znmd', type: 'movie', e: '🏝️', t: 'Zindagi Na Milegi Dobara', tag: 'Hindi · Road trip', hook: 'Three friends, Spain, one big trip.' },
  { id: 'lagaan', type: 'movie', e: '🏏', t: 'Lagaan', tag: 'Hindi · Cricket drama', hook: 'A village, a cricket match, everything on the line.' },
  { id: 'hellaro', type: 'movie', e: '💃', t: 'Hellaro', tag: 'Gujarati · Drama', hook: 'The women of Kutch, dhol and garba.' },
  { id: 'chhello', type: 'movie', e: '🎒', t: 'Chhello Divas', tag: 'Gujarati · Comedy', hook: 'A gang of college friends and their last days.' },
  { id: 'jwm', type: 'movie', e: '🚆', t: 'Jab We Met', tag: 'Hindi · Rom-com', hook: 'A chatty stranger and a very long train ride.' },
  { id: 'panchayat', type: 'series', e: '🌾', t: 'Panchayat', tag: 'Hindi · Comedy drama', hook: 'An engineer, a village office, gentle chaos.' },
  { id: 'gullak', type: 'series', e: '🏠', t: 'Gullak', tag: 'Hindi · Family comedy', hook: 'Small-town family life in short episodes.' },
  { id: 'scam92', type: 'series', e: '📈', t: 'Scam 1992', tag: 'Hindi · Drama', hook: 'The rise of a stock market star.' },
  { id: 'cloy', type: 'series', e: '🪂', t: 'Crash Landing on You', tag: 'Korean · K-drama', hook: 'A paraglider, a border and a big love story.' },
  { id: 'lasso', type: 'series', e: '⚽', t: 'Ted Lasso', tag: 'English · Comedy', hook: 'An optimistic coach in a new country.' },
  { id: 'b99', type: 'series', e: '🚔', t: 'Brooklyn Nine-Nine', tag: 'English · Comedy', hook: 'A goofy police squad and running jokes.' },
  { id: 'sherlock', type: 'series', e: '🔎', t: 'Sherlock', tag: 'English · Crime', hook: 'Modern-day mysteries and quick wits.' },
  { id: 'bakeoff', type: 'series', e: '🍰', t: 'The Great British Bake Off', tag: 'English · Cosy', hook: 'Baking, a big tent, very polite drama.' },
];

export const SERVICES: [string, string, string][] = [
  ['netflix', '🔴', 'Netflix'],
  ['prime', '📦', 'Prime Video'],
  ['disney', '⭐', 'Disney+ or Hotstar'],
  ['appletv', '🍎', 'Apple TV+'],
  ['yt', '📺', 'YouTube'],
  ['other', '🎞️', 'Somewhere else'],
];

export type MovieSetup = { mode: 'home' | 'apart'; dev?: 'ios' | 'android' | 'mixed'; fmt: 'movie' | 'series' | 'binge' };

export function howToWatch(mode: MovieSetup['mode'], dev: MovieSetup['dev'], svc: string | null): string[] {
  if (mode === 'home') {
    return ['Pick a snack and your spot on the sofa 🍿', 'Phones on silent, lights low', 'For a series, agree how many episodes before you press play'];
  }
  const apple = dev === 'ios';
  const tips: string[] = [];
  if (svc === 'netflix' || svc === 'prime') {
    tips.push('Screen sharing usually shows a black screen for Netflix and Prime Video because of copy protection, and SharePlay does not cover them.');
    tips.push('Best bet: a browser watch-party extension on a laptop. You each need your own subscription.');
    tips.push('Or stay on a video call on speaker and count 3-2-1 to press play together.');
  } else if (svc === 'disney' || svc === 'appletv') {
    if (apple) {
      tips.push('Start a FaceTime call, open the app and choose the title, then tap Play and choose SharePlay.');
      tips.push('You both need the subscription. If SharePlay does not appear, use the 3-2-1 countdown on a video call.');
    } else {
      tips.push('SharePlay needs Apple devices on both sides. With Android or a mix, use a watch-party extension on a laptop.');
      tips.push('Or stay on a video call on speaker and count 3-2-1 to press play together.');
    }
  } else if (svc === 'yt') {
    tips.push(`Screen sharing usually works for YouTube: ${apple ? 'FaceTime, then Share Content' : 'a video call app with screen share'}.`);
    tips.push('Or send the link and count 3-2-1 to press play together.');
  } else {
    tips.push('Start a video call on speaker, open the same title, and count 3-2-1 to press play together.');
  }
  tips.push('Apps change what they support, so check yours a day before movie night.');
  return tips;
}

export const LABELS: [string, string, string][] = [
  ['like', '👍', 'Likes'],
  ['dislike', '👎', 'Dislikes'],
  ['date', '🗓️', 'Date ideas'],
  ['important', '🎂', 'Important dates'],
  ['nhie', '🙋', 'Never have I ever'],
  ['watch', '🍿', 'Watch list'],
  ['food', '🍲', 'Food'],
  ['care', '💛', 'Care notes'],
  ['other', '✨', 'Other'],
];
export const labelOf = (id: string) => LABELS.find((x) => x[0] === id) ?? LABELS[8]!;

export const PACK_LABEL: Record<string, string> = { screen: 'watch', filmy: 'watch', emoji: 'watch', warm: 'care', fest: 'important', garba: 'date', dream: 'date' };

export const IDEAS: Record<string, string> = {
  like: 'Do something small with this today.',
  dislike: 'Steer clear of this. They will notice you remembered.',
  date: 'Turn this into a plan. Pick a day?',
  important: 'Mark it now and plan something ahead.',
  nhie: 'Bring it up with a smile next time you talk.',
  watch: 'Suggest it for your next movie night.',
  food: 'Order it, cook it, or bring it along.',
  care: 'Keep it in mind next time they have a rough day.',
  other: 'Slip it into a chat and watch them smile.',
};

export const G_TOPICS: [string, string, string][] = [
  ['loud', '🔊', 'Loud or heated arguments'],
  ['silent', '🤐', 'Silent treatment or being ignored'],
  ['rushed', '⏱️', 'Being rushed or pressured'],
  ['past', '🧳', 'Talking about parts of my past'],
  ['family', '👨‍👩‍👧', 'Family pressure or expectations'],
  ['health', '🩺', 'Health worries'],
  ['work', '💼', 'Work or money stress'],
  ['crowds', '👥', 'Crowds or lots of noise'],
  ['other', '✨', 'Something else (I will say in a line)'],
];
export const G_HELPS: [string, string, string][] = [
  ['listen', '🎧', 'Just listen, no fixing'],
  ['ask', '❓', 'Ask before giving advice'],
  ['space', '🌙', 'Give me a little space'],
  ['checkin', '💬', 'Check in later, gently'],
  ['distract', '🎬', 'Distract me with something light'],
  ['reassure', '🤗', 'Reassure me you are still here'],
  ['call', '📞', 'Call me, your voice helps'],
];
export const G_DEPTH: [string, string, string][] = [
  ['heads', '🚩', 'Just the heads-up'],
  ['bit', '🌤️', 'A little context'],
  ['talk', '📞', 'I would like to talk it through on a call'],
];
export const G_PROMISES: [string, string, string][] = [
  ['patient', '🕊️', 'I will go slowly and be patient'],
  ['ask', '❓', 'I will ask before I advise'],
  ['checkin', '💬', 'I will check in a day later'],
  ['space', '🌙', 'I will give space when you need it'],
  ['call', '📞', 'I will make time for a call'],
];
export const listLabel = (list: [string, string, string][], id: string) => {
  const x = list.find((y) => y[0] === id);
  return x ? `${x[1]} ${x[2]}` : id;
};

export const COUNTRIES: [string, string][] = [
  ['', 'Prefer not to say'],
  ['GB', 'United Kingdom'],
  ['US', 'United States'],
  ['CA', 'Canada'],
  ['AU', 'Australia'],
  ['ZA', 'South Africa'],
  ['AE', 'Dubai or UAE'],
  ['IN', 'India'],
  ['other', 'Somewhere else'],
];

export const GREETINGS: [string, string][] = [
  ['Namaste', 'Namaste 🙏'],
  ['Kem cho', 'Kem cho (Gujarati)'],
  ['Sat sri akal', 'Sat sri akal (Punjabi)'],
  ['Vanakkam', 'Vanakkam (Tamil)'],
  ['Namaskar', 'Namaskar (Marathi, Bengali)'],
  ['Hey', 'Just hey 👋'],
];

/** "Our Kahani" and the tagline in ten scripts. To be reviewed by native speakers before release. */
export const LANGS: [string, string, string, string][] = [
  ['hi', 'हिन्दी', 'हमारी कहानी', 'पहली बात से हमारी कहानी तक'],
  ['gu', 'ગુજરાતી', 'આપણી વાર્તા', 'પહેલી વાતથી આપણી વાર્તા સુધી'],
  ['pa', 'ਪੰਜਾਬੀ', 'ਸਾਡੀ ਕਹਾਣੀ', 'ਪਹਿਲੀ ਗੱਲ ਤੋਂ ਸਾਡੀ ਕਹਾਣੀ ਤੱਕ'],
  ['mr', 'मराठी', 'आपली गोष्ट', 'पहिल्या गप्पांपासून आपल्या गोष्टीपर्यंत'],
  ['bn', 'বাংলা', 'আমাদের গল্প', 'প্রথম কথা থেকে আমাদের গল্প পর্যন্ত'],
  ['ta', 'தமிழ்', 'நம் கதை', 'முதல் பேச்சிலிருந்து நம் கதை வரை'],
  ['te', 'తెలుగు', 'మన కథ', 'మొదటి మాట నుండి మన కథ వరకు'],
  ['kn', 'ಕನ್ನಡ', 'ನಮ್ಮ ಕಥೆ', 'ಮೊದಲ ಮಾತಿನಿಂದ ನಮ್ಮ ಕಥೆಯವರೆಗೆ'],
  ['ml', 'മലയാളം', 'നമ്മുടെ കഥ', 'ആദ്യ വാക്കിൽ നിന്ന് നമ്മുടെ കഥ വരെ'],
  ['ur', 'اردو', 'ہماری کہانی', 'پہلی بات سے ہماری کہانی تک'],
];

// Room hashtag suggestions from the two first names (a cosmetic nickname, never a lookup key).
const VOWELS = 'aeiouAEIOU';
const clean = (n: string) => n.replace(/[^\p{L}\p{N}]/gu, '');
const cap = (n: string) => (n ? n[0]!.toUpperCase() + n.slice(1) : n);
function head(n: string) {
  let i = 0;
  while (i < n.length && !VOWELS.includes(n[i]!)) i++;
  let j = i;
  while (j < n.length && VOWELS.includes(n[j]!)) j++;
  const k = j < n.length ? j + 1 : j;
  return n.slice(0, Math.min(Math.max(k, 2), Math.max(2, n.length - 1)));
}
function tail(n: string) {
  let i = n.length - 1;
  while (i >= 0 && !VOWELS.includes(n[i]!)) i--;
  if (i < 0) return n.slice(-2);
  let j = i;
  while (j > 0 && VOWELS.includes(n[j - 1]!)) j--;
  const k = j > 0 ? j - 1 : j;
  return n.slice(Math.max(1, k));
}
export function hashtagOptions(a: string, b: string): string[] {
  const x = cap(clean(a));
  const y = cap(clean(b));
  if (!x || !y) return ['#OurKahani'];
  const out = [`#${x}${y}`, `#${y}${x}`, `#${head(x)}${tail(y).toLowerCase()}`, `#${head(y)}${tail(x).toLowerCase()}`];
  return out.filter((v, i) => out.indexOf(v) === i);
}
export function normaliseHashtag(v: string): string {
  const t = v.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 24);
  return t ? `#${t}` : '';
}
