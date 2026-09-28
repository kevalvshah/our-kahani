import { FIND_A_HELPLINE, safetyFooter } from '../../features/safetyFooter';
import { OFFICIAL_PACKS } from '../../packs/official';
import { controller } from '../../state/controller';
import { daysLeft, ROOM_DAYS } from '../../state/room';
import { useRoom } from '../../state/roomContext';
import { useState } from 'preact/hooks';
import { Em, Note, Row, ScreenTitle, Soon } from '../components';
import { navigate, PATHS } from '../router';
import { problemText } from './Today';

// Screens whose features need the encrypted room records. They show the final design and real
// copy, with no sample people or content; actions that are not built yet say "Soon".

export function Packs() {
  return (
    <section>
      <ScreenTitle emoji="🃏" lead="Play in any order, skip freely. Sensitive packs are opt-in for both of you.">
        Card packs
      </ScreenTitle>
      <div class="rows">
        {OFFICIAL_PACKS.map((p) =>
          p.id === 'warm' ? (
            <Row key={p.id} emoji={p.emoji} tint={p.tint} title={p.name} sub={p.blurb} pill="Play" href={PATHS.card} />
          ) : (
            <Row key={p.id} emoji={p.emoji} tint={p.tint} title={p.name} sub={p.blurb} pill="Soon" />
          ),
        )}
      </div>
    </section>
  );
}

export function Movie() {
  return (
    <section>
      <ScreenTitle
        emoji="🍿"
        lead="Swipe right for yes, left for not tonight. Only the matches are shown to both of you."
      >
        Movie Night
      </ScreenTitle>
      <div class="movie-card">
        <div class="movie-emoji" aria-hidden="true">
          🎬
        </div>
        <div class="movie-title">Tonight's pile is on its way</div>
        <div class="small muted">Films show as an emoji and a title, never poster art.</div>
        <div class="btn-pair movie-actions">
          <button type="button" class="swipe" disabled aria-label="Not tonight">
            👈
          </button>
          <button type="button" class="swipe swipe-yes" disabled aria-label="Yes">
            👉
          </button>
        </div>
        <p class="small muted">
          <Soon /> Arrives in a later update.
        </p>
      </div>
      <h2 class="sub-title">Matches so far</h2>
      <p class="small muted">None yet. Films you both say yes to show up here.</p>
      <Note dashed>
        Watching apart? Screen sharing usually goes black on the big streaming apps. SharePlay works where it is
        supported, otherwise try a browser watch-party extension or just count down 3-2-1 and press play together.
      </Note>
    </section>
  );
}

export function Photo() {
  return (
    <section>
      <ScreenTitle emoji="📷" lead="A photo of whatever you are up to. No schedule, no filters, no feed to scroll.">
        Right Now
      </ScreenTitle>
      <button type="button" class="btn btn-primary btn-block btn-short" disabled>
        <Em>📷</Em> Share a photo <Soon />
      </button>
      <p class="small muted empty">No photos yet.</p>
      <Note dashed>
        Photos are shrunk and encrypted on your phone before they are sent, which also strips the location from
        them. The original never leaves the device.
      </Note>
    </section>
  );
}

export function Gentle() {
  const footer = safetyFooter(navigator.languages?.length ? navigator.languages : [navigator.language]);
  return (
    <section>
      <ScreenTitle
        emoji="💛"
        lead="A slower space for the heavier things. It only opens when you both switch it on, and you can take anything back later."
      >
        Gentle Corner
      </ScreenTitle>
      <div class="switch-row">
        <span class="row-text">
          <span class="row-title">Gentle Corner is off</span>
          <span class="row-sub">Nothing opens until you both say yes. Arrives in a later update.</span>
        </span>
        <button type="button" role="switch" aria-checked="false" aria-label="Gentle Corner" class="switch" disabled>
          <span class="switch-track">
            <span class="switch-knob" />
          </span>
        </button>
      </div>
      <div class="safety" role="note">
        <b>If things feel urgent</b>
        {footer.country && (
          <>
            <br />
            {footer.country}: {footer.lines.join(', ')}.
          </>
        )}
        <br />
        {footer.country ? 'Elsewhere' : 'Wherever you are'}: call your local emergency number or find a line at{' '}
        <a href={FIND_A_HELPLINE} rel="noopener noreferrer" target="_blank">
          findahelpline.com
        </a>
        .
      </div>
    </section>
  );
}

export function Saved() {
  return (
    <section>
      <ScreenTitle emoji="🔖" lead="Your private notes about your person. Silent, never shared, exportable to Excel.">
        Saved
      </ScreenTitle>
      <div class="panel">
        <div class="panel-title">Nothing saved yet</div>
        <p class="small muted">
          After a reveal, tap “Save this”. Saving never sends a notice, so surprises stay surprises.
        </p>
      </div>
      <button type="button" class="btn btn-secondary btn-block btn-short" disabled>
        <Em>⬇️</Em> Export to Excel <Soon />
      </button>
    </section>
  );
}

export function RoomData() {
  const { room, setRoom } = useRoom();
  const [problem, setProblem] = useState<string | null>(null);
  const [erasing, setErasing] = useState(false);

  async function erase() {
    if (!room || erasing) return;
    if (!confirm('Erase this room for both of you? The ciphertext is deleted and the key discarded. Nobody can bring it back.')) return;
    setErasing(true);
    setProblem(null);
    try {
      await controller().erase(room);
      setRoom(null);
      navigate(PATHS.today);
    } catch (e) {
      setProblem(problemText(e));
    } finally {
      setErasing(false);
    }
  }

  return (
    <section>
      <ScreenTitle
        emoji="🗄️"
        lead={`Your room lasts ${ROOM_DAYS} days. Before it ends you can download everything, keep it four more weeks, or erase it.`}
      >
        Room data
      </ScreenTitle>
      <dl class="facts">
        <div>
          <dt>Room</dt>
          <dd>{room ? 'Hashtag not chosen yet' : 'No room yet'}</dd>
        </div>
        <div>
          <dt>Your person</dt>
          <dd>{room ? (room.partnerJoined ? 'Joined' : 'Not joined yet') : '—'}</dd>
        </div>
        <div>
          <dt>Ends</dt>
          <dd>{room ? `${daysLeft(room)} days from today` : `${ROOM_DAYS} days after you start`}</dd>
        </div>
        <div>
          <dt>Encryption</dt>
          <dd>AES-256-GCM, on device</dd>
        </div>
      </dl>
      <div class="stack">
        <button type="button" class="btn btn-primary" disabled>
          <Em>⬇️</Em> Download everything <Soon />
        </button>
        <button type="button" class="btn btn-secondary" disabled>
          <Em>🗓️</Em> Keep it four more weeks <Soon />
        </button>
        <button type="button" class="btn btn-secondary btn-quiet" disabled={!room || erasing} onClick={erase}>
          <Em>🧹</Em> {erasing ? 'Erasing…' : 'Erase the room'}
        </button>
      </div>
      {problem && (
        <p class="caption error" role="alert">
          {problem}
        </p>
      )}
      <Note>Erasing deletes the ciphertext and discards the keys. Nobody can bring the room back, including us.</Note>
    </section>
  );
}
