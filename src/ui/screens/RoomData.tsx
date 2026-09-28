import { useEffect, useRef, useState } from 'preact/hooks';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import { buildArchive } from '../../features/archive';
import { downloadFile } from '../../features/xlsx';
import { controller } from '../../state/controller';
import { daysLeft } from '../../state/room';
import { useRoom } from '../../state/roomContext';
import { Back, Done, Problem, Wait } from '../components';
import { problemText } from '../problems';
import { navigate, PATHS } from '../router';

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** Keep-vote state and actions. The partner's vote is never visible, only the outcome. */
function useKeep() {
  const d = useRoomData();
  const { setRoom } = useRoom();
  const [voted, setVoted] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void controller().myKeepVote(d.room).then(setVoted).catch(() => setVoted(false));
  }, [d.room.id, d.room.endsAt]);

  async function vote(keep: boolean) {
    setProblem(null);
    try {
      const extended = await controller().voteKeep(d.room, keep);
      if (extended) {
        const fresh = await controller().refresh(d.room);
        if (fresh) setRoom(fresh);
        setVoted(false);
        setMsg(`You both chose to keep it 🎉 Extended to ${fresh ? fmtDate(fresh.endsAt) : 'four more weeks'}.`);
      } else {
        setVoted(keep);
        setMsg(keep ? `Saved 💛 It extends when ${d.partner} agrees too.` : null);
      }
    } catch (e) {
      setProblem(problemText(e));
    }
  }
  return { voted, vote, msg, problem };
}

export function download(d: ReturnType<typeof useRoomData>): string {
  const { bytes, name } = buildArchive(d);
  downloadFile(name, bytes, 'application/zip');
  return 'Saved to your device 📥';
}

export function RoomDataScreen() {
  const d = useRoomData();
  const { setRoom } = useRoom();
  const left = daysLeft(d.room);
  const keep = useKeep();
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const hashtag = d.list<{ tag: string }>(K.HASHTAG)[0]?.data.tag;

  async function erase() {
    setProblem(null);
    try {
      await controller().erase(d.room);
      setRoom(null);
      navigate(PATHS.today);
    } catch (e) {
      setProblem(problemText(e));
    }
  }

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <div class="question-card">
        <span class="pack-tag">🗄️ Room data</span>
        <h1 class="question" tabIndex={-1}>
          {left <= 0 ? 'Ends today' : `${left} ${left === 1 ? 'day' : 'days'} left`}
        </h1>
        <dl class="facts">
          <div>
            <dt>Room</dt>
            <dd>{hashtag ?? 'Hashtag not chosen yet'}</dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd>{fmtDate(d.room.endsAt)}</dd>
          </div>
          <div>
            <dt>Your person</dt>
            <dd>{d.room.partnerJoined ? `${d.partner} joined` : 'Not joined yet'}</dd>
          </div>
          <div>
            <dt>Encryption</dt>
            <dd>AES-256-GCM, on device</dd>
          </div>
        </dl>
        <p class="small">
          Your room is erased on <b>{fmtDate(d.room.endsAt)}</b> unless you both keep it for 4 more weeks. Everything stays locked with
          your key the whole time.
        </p>
        <p class="small muted">Downloads are put together on your phone, because the server can't read your data. Each of you can download at any time.</p>
        {(msg || keep.msg) && <Done>{msg ?? keep.msg}</Done>}
        <div class="stack">
          <button type="button" class="btn btn-primary" onClick={() => setMsg(download(d))}>
            📥 Download everything (zip)
          </button>
          {keep.voted ? (
            <button type="button" class="btn btn-secondary" onClick={() => void keep.vote(false)}>
              Change my mind
            </button>
          ) : (
            <button type="button" class="btn btn-secondary" disabled={keep.voted === null} onClick={() => void keep.vote(true)}>
              ➕ Keep it 4 more weeks
            </button>
          )}
          {keep.voted && <Wait>You chose to keep it 💛 It extends when {d.partner} agrees too. If not, it is erased on {fmtDate(d.room.endsAt)}.</Wait>}
        </div>
        <Problem text={keep.problem ?? problem} />
        {confirm ? (
          <div class="panel panel-pink">
            <div class="panel-title">Erase this room now?</div>
            <p class="small">This deletes every answer, photo and note for both of you, right away. It can't be undone.</p>
            <div class="stack">
              <button type="button" class="btn btn-secondary" onClick={() => setMsg(download(d))}>
                📥 Download first
              </button>
              <button type="button" class="btn btn-danger" onClick={() => void erase()}>
                Erase for good
              </button>
              <button type="button" class="btn btn-secondary" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" class="btn btn-secondary btn-quiet btn-block seal" onClick={() => setConfirm(true)}>
            🧹 Erase this room now
          </button>
        )}
        <p class="small muted">Erasing deletes the ciphertext and discards the keys. Nobody can bring the room back, including us.</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The last-week reminder, shown on opening the app in the final 7 days
// ---------------------------------------------------------------------------
const snoozeKey = (room: string) => `ok.remind-later.${room}`;

export function RetentionModal() {
  const d = useRoomData();
  const left = daysLeft(d.room);
  const keep = useKeep();
  const [snoozed, setSnoozed] = useState(() => {
    try {
      return localStorage.getItem(snoozeKey(d.room.id)) === new Date().toDateString();
    } catch {
      return false;
    }
  });
  const [msg, setMsg] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const show = left <= 7 && !snoozed && keep.voted === false;

  useEffect(() => {
    if (show) dialog.current?.querySelector<HTMLElement>('button')?.focus();
  }, [show]);

  if (!show) return null;
  const later = () => {
    setSnoozed(true);
    try {
      localStorage.setItem(snoozeKey(d.room.id), new Date().toDateString());
    } catch {
      // fine: it just asks again next time
    }
  };
  return (
    <div class="modal" onKeyDown={(e) => e.key === 'Escape' && later()}>
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="mtitle" ref={dialog}>
        <h2 id="mtitle" class="screen-title">
          {left <= 0 ? 'Your room ends today' : `Your room ends in ${left} ${left === 1 ? 'day' : 'days'}`} ⏳
        </h2>
        <p class="small">Welcome back. Everything is locked with your key. Before {fmtDate(d.room.endsAt)} you can:</p>
        <p class="small muted">Both of you need to keep it, or it is erased on that day. The server can't read your data, so the download is made on your phone.</p>
        <div class="stack">
          <button type="button" class="btn btn-primary" onClick={() => setMsg(download(d))}>
            📥 Download everything
          </button>
          <button type="button" class="btn btn-secondary" onClick={() => void keep.vote(true)}>
            ➕ Keep it 4 more weeks
          </button>
          <button type="button" class="btn btn-secondary" onClick={later}>
            Remind me later
          </button>
        </div>
        {(msg || keep.msg) && <Done>{msg ?? keep.msg}</Done>}
        <Problem text={keep.problem} />
      </div>
    </div>
  );
}
