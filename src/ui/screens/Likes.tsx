import { useState } from 'preact/hooks';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import { FOOD_STYLES, roomFood, type FoodStyle } from '../../features/food';
import { Back, ScreenTitle } from '../components';
import { PATHS } from '../router';

// Likes and dislikes: a shared cheat sheet for food, shopping, gifts and dates. One line each,
// encrypted like everything else; the partner sees it straight away (handy before a surprise).
// Your food style sets which dishes food cards show: the stricter of the two wins.

export const LIKE_TOPICS: [id: string, e: string, l: string][] = [
  ['food', '🍽️', 'Food'],
  ['shop', '🛍️', 'Shopping'],
  ['gift', '🎁', 'Gifts'],
  ['date', '🗓️', 'Dates'],
  ['little', '✨', 'Little things'],
];

const HINTS: Record<string, [string, string]> = {
  food: ['extra-spicy pani puri', 'coriander in everything'],
  shop: ['browsing bookshops for hours', 'crowded sale days'],
  gift: ['handwritten notes', 'anything that needs dusting'],
  date: ['sunset walks', 'loud restaurants'],
  little: ['a good-morning voice note', 'being rushed'],
};

interface Like {
  topic: string;
  like: boolean;
  t: string;
}

export function Likes() {
  const d = useRoomData();
  const [topic, setTopic] = useState('food');
  const [like, setLike] = useState(true);
  const [text, setText] = useState('');
  const items = d.list<Like>(K.CHEAT);
  const myFood = d.myProfile?.food;
  const shared = roomFood(myFood, d.partnerProfile?.food);

  async function add() {
    const t = text.trim().slice(0, 80);
    if (!t) return;
    setText('');
    await d.add(K.CHEAT, `cheat:${Date.now().toString(36)}`, { topic, like, t });
  }

  async function setFood(food: FoodStyle) {
    if (!d.myProfile) return;
    await d.put(K.PROFILE, 'profile', { ...d.myProfile, food });
  }

  const column = (mine: boolean) =>
    LIKE_TOPICS.map(([id, e, l]) => {
      const list = items.filter((x) => x.mine === mine && x.data.topic === id);
      if (!list.length) return null;
      return (
        <div key={id} class="like-topic">
          <p class="field-label">
            {e} {l}
          </p>
          <ul class="like-list">
            {list.map((x) => (
              <li key={x.id} class={x.data.like ? 'is-like' : 'is-dislike'}>
                <span aria-hidden="true">{x.data.like ? '💚' : '🙅'}</span>
                <span class="sr-only">{x.data.like ? 'Likes: ' : 'Not keen: '}</span>
                <span class="like-text">{x.data.t}</span>
                {mine && (
                  <button type="button" class="like-x" aria-label={`Remove ${x.data.t}`} onClick={() => void d.remove(x.id)}>
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      );
    });

  const theirs = column(false).filter(Boolean);
  const hint = HINTS[topic] ?? HINTS.food!;

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <ScreenTitle emoji="📝" lead="Food, shopping, gifts and date likes, one line each. Handy before a surprise.">
        Likes and dislikes
      </ScreenTitle>

      <div class="panel">
        <div class="panel-title">Your food style</div>
        <div class="chip-row" role="group" aria-label="Your food style">
          {FOOD_STYLES.map((f) => (
            <button key={f.id} type="button" class={myFood === f.id ? 'chip is-on' : 'chip'} aria-pressed={myFood === f.id} title={f.sub} onClick={() => void setFood(f.id)}>
              {f.e} {f.l}
            </button>
          ))}
        </div>
        <p class="small muted">
          Food cards show what you both eat: right now that is {FOOD_STYLES.find((f) => f.id === shared)?.l.toLowerCase()}. Nobody is asked
          to explain.
        </p>
      </div>

      <div class="panel">
        <div class="chip-row" role="group" aria-label="Topic">
          {LIKE_TOPICS.map(([id, e, l]) => (
            <button key={id} type="button" class={topic === id ? 'chip is-on' : 'chip'} aria-pressed={topic === id} onClick={() => setTopic(id)}>
              {e} {l}
            </button>
          ))}
        </div>
        <div class="chip-row" role="group" aria-label="Like or not">
          <button type="button" class={like ? 'chip is-on' : 'chip'} aria-pressed={like} onClick={() => setLike(true)}>
            💚 I love
          </button>
          <button type="button" class={!like ? 'chip is-on' : 'chip'} aria-pressed={!like} onClick={() => setLike(false)}>
            🙅 Not for me
          </button>
        </div>
        <label class="field-label" for="like">
          One line
        </label>
        <input
          id="like"
          class="field"
          maxLength={80}
          value={text}
          placeholder={like ? hint[0] : hint[1]}
          autocomplete="off"
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
        />
        <button type="button" class="btn btn-primary btn-block" disabled={!text.trim()} onClick={() => void add()}>
          Add to my list
        </button>
      </div>

      <div class="like-cols">
        <div>
          <h2 class="sub-title">Yours</h2>
          {column(true).some(Boolean) ? column(true) : <p class="small muted">Nothing yet. Start with one food you love.</p>}
        </div>
        <div>
          <h2 class="sub-title">{d.partner}'s</h2>
          {theirs.length ? theirs : <p class="small muted">Nothing from {d.partner} yet.</p>}
        </div>
      </div>
    </section>
  );
}
