import { useState } from 'preact/hooks';
import { TODAY_CARD } from '../../packs/official';
import { dayOfSeason } from '../../state/room';
import { useRoom } from '../../state/roomContext';
import { Em, Link } from '../components';
import { PATHS } from '../router';

// Today's card. Picking works now; sealing the answer and the reveal (gated server-side on
// both "submitted" flags) arrive with the Supabase records.
export function Card() {
  const { room } = useRoom();
  const [pick, setPick] = useState<string | null>(null);
  const day = room ? dayOfSeason(room) : 1;

  return (
    <section>
      <Link class="back" href={PATHS.today}>
        ← Today
      </Link>
      <div class="question-card">
        <div class="question-meta">
          <span class="pack-tag">
            <Em>💛</Em> Warm Words
          </span>
          <span class="small muted">Day {day}</span>
        </div>
        <h1 class="question" tabIndex={-1}>
          {TODAY_CARD.q}
        </h1>
        <p class="small muted">Pick one. It stays hidden until your person answers too.</p>
        <div class="options">
          {TODAY_CARD.options.map((o) => (
            <button
              key={o.id}
              type="button"
              class={pick === o.id ? 'option is-picked' : 'option'}
              aria-pressed={pick === o.id}
              onClick={() => setPick(o.id)}
            >
              <span class="option-emoji" aria-hidden="true">
                {o.emoji}
              </span>
              <span class="option-label">{o.label}</span>
            </button>
          ))}
        </div>
        {pick && (
          <div class="wait" role="status">
            <b>Picked.</b> Nothing is sent yet. Once your room is connected, your answer is sealed on this phone
            and opens only after your person answers too. Tap another option to change it.
          </div>
        )}
      </div>
    </section>
  );
}
