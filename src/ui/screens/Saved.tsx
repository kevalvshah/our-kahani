import { VoicePlayer } from '../Voice';
import { useState } from 'preact/hooks';
import { IDEAS, LABELS, labelOf } from '../../content/extras';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import { savedSheets } from '../../features/archive';
import { matchesSearch, untilText, type SavedItem } from '../../features/saved';
import { downloadFile, makeXlsx, slug } from '../../features/xlsx';
import type { DataRecord } from '../../state/controller';
import { Back, Chips, Done, Problem } from '../components';
import { problemText } from '../problems';
import { PATHS } from '../router';

// Private notes about your partner: encrypted with your own notes key, which your partner never
// has. Saving never sends them a notice. If they take back something they shared, your copy of
// it is deleted too.

export function Saved() {
  const d = useRoomData();
  const all = d.list<SavedItem>(K.SAVED).sort((a, b) => b.data.t - a.data.t);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [idea, setIdea] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const shown = all.filter((x) => (filter === 'all' || x.data.label === filter) && matchesSearch(x.data, q, labelOf(x.data.label)[2]));
  const ideaItem = all.find((x) => x.id === idea);

  function nextIdea() {
    const pool = all.length > 1 ? all.filter((x) => x.id !== idea) : all;
    setIdea(pool[Math.floor(Math.random() * pool.length)]?.id ?? null);
  }

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <div class="question-card">
        <span class="pack-tag">🔖 Saved</span>
        <h1 class="question" tabIndex={-1}>
          About {d.partner}
        </h1>
        <p class="small">
          Your secret notebook. Only you can see it, and {d.partner} never gets a notice when you save something, so you can surprise
          them.
        </p>
        <p class="small muted">If {d.partner} deletes something they shared, your saved copy goes too.</p>
        {msg && <Done>{msg}</Done>}

        {ideaItem ? (
          <div class="panel panel-accent">
            <div class="panel-title">🎁 Surprise idea</div>
            <p class="small">
              <b>Remember:</b> {ideaItem.data.note || (ideaItem.data.theirs ? `${d.partner}: ${ideaItem.data.theirs}` : ideaItem.data.q)}
            </p>
            <p class="small">{IDEAS[ideaItem.data.label] ?? IDEAS.other}</p>
            <div class="btn-pair">
              <button type="button" class="btn btn-primary" onClick={nextIdea}>
                Another idea
              </button>
              <button type="button" class="btn btn-secondary btn-narrow" onClick={() => setIdea(null)}>
                Done
              </button>
            </div>
          </div>
        ) : (
          all.length > 0 && (
            <button type="button" class="btn btn-primary btn-block" onClick={nextIdea}>
              🎁 Surprise idea
            </button>
          )
        )}

        {all.length > 0 && (
          <>
            <label class="field-label" for="sq">
              Search your notes
            </label>
            <input id="sq" class="field" value={q} autocomplete="off" onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
            <Chips
              label="Filter by label"
              value={filter}
              options={[
                ['all', `All (${all.length})`],
                ...LABELS.filter((l) => all.some((x) => x.data.label === l[0])).map(
                  (l) => [l[0], `${l[1]} ${l[2]} (${all.filter((x) => x.data.label === l[0]).length})`] as [string, string],
                ),
              ]}
              onPick={setFilter}
            />
          </>
        )}

        <div class="saved-list">
          {shown.length ? (
            shown.map((x) => <SavedCard key={x.id} item={x} />)
          ) : (
            <p class="small muted">{all.length ? 'Nothing matches that.' : 'Nothing saved yet. Tap 🔖 Save on an answer you want to remember.'}</p>
          )}
        </div>

        {adding ? (
          <NewNote onDone={() => setAdding(false)} />
        ) : (
          <button type="button" class="btn btn-secondary btn-block seal" onClick={() => setAdding(true)}>
            ＋ Add a note about {d.partner}
          </button>
        )}
        <button
          type="button"
          class="btn btn-primary btn-block seal"
          disabled={!all.length}
          onClick={() => {
            downloadFile(
              `notes-about-${slug(d.partner)}-${new Date().toISOString().slice(0, 10)}.xlsx`,
              makeXlsx(savedSheets(all.map((x) => x.data), d.me, d.partner)),
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            );
            setMsg('Saved to your device 📥');
          }}
        >
          📥 Export to Excel
        </button>
        <p class="small muted">The file is made on your phone and leaves the app, so keep it somewhere private.</p>
      </div>
    </section>
  );
}

function SavedCard({ item }: { item: DataRecord<SavedItem> }) {
  const d = useRoomData();
  const x = item.data;
  const L = labelOf(x.label);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ label: x.label, note: x.note, date: x.date });
  const [problem, setProblem] = useState<string | null>(null);
  const until = untilText(x.date);

  return (
    <div class="saved-item">
      <div class="saved-meta">
        <span class="pill tint-gold">
          {L[1]} {L[2]}
        </span>
        <small class="muted">{new Date(x.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small>
      </div>
      {x.kind !== 'note' && (
        <>
          <p class="saved-q">{x.q}</p>
          <p class="small">
            <b>{d.partner}:</b> {x.theirs}
            {x.voice && <VoicePlayer note={x.voice} who={d.partner} />}
          </p>
          {x.mine && (
            <p class="small muted">
              <b>You:</b> {x.mine}
            </p>
          )}
          <small class="muted">{x.src}</small>
        </>
      )}
      {x.note && (
        <p class="small">
          <i>📝 {x.note}</i>
        </p>
      )}
      {x.date && (
        <p class="small">
          <span class="pill tint-gold">
            🗓️ {x.date}
            {until ? ` · ${until}` : ''}
          </span>
        </p>
      )}
      {editing ? (
        <div class="custom-row">
          <p class="field-label">Label</p>
          <Chips label="Label" value={draft.label} options={LABELS.map((l) => [l[0], `${l[1]} ${l[2]}`] as [string, string])} onPick={(label) => setDraft({ ...draft, label })} />
          <label class="field-label" for={`n${item.id}`}>
            Your note (optional)
          </label>
          <input id={`n${item.id}`} class="field" maxLength={160} value={draft.note} autocomplete="off" onInput={(e) => setDraft({ ...draft, note: (e.target as HTMLInputElement).value })} />
          <label class="field-label" for={`d${item.id}`}>
            Date (optional)
          </label>
          <input id={`d${item.id}`} class="field" type="date" value={draft.date} onInput={(e) => setDraft({ ...draft, date: (e.target as HTMLInputElement).value })} />
          <Problem text={problem} />
          <div class="btn-pair">
            <button
              type="button"
              class="btn btn-primary"
              onClick={async () => {
                try {
                  await d.put(K.SAVED, item.ref, { ...x, label: draft.label, note: draft.note.trim(), date: draft.date });
                  setEditing(false);
                } catch (e) {
                  setProblem(problemText(e));
                }
              }}
            >
              Save changes
            </button>
            <button type="button" class="btn btn-secondary btn-narrow" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div class="btn-pair">
          <button type="button" class="btn btn-secondary" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" class="btn btn-secondary" onClick={() => void d.remove(item.id)}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function NewNote({ onDone }: { onDone: () => void }) {
  const d = useRoomData();
  const [text, setText] = useState('');
  const [label, setLabel] = useState('other');
  const [date, setDate] = useState('');
  return (
    <div class="custom-row">
      <label class="field-label" for="ntext">
        A note about {d.partner}
      </label>
      <input id="ntext" class="field" maxLength={160} value={text} placeholder="e.g. Loves sunflowers. Birthday idea." autocomplete="off" onInput={(e) => setText((e.target as HTMLInputElement).value)} />
      <Chips label="Label" value={label} options={LABELS.map((l) => [l[0], `${l[1]} ${l[2]}`] as [string, string])} onPick={setLabel} />
      <label class="field-label" for="ndate">
        Date (optional, like a birthday)
      </label>
      <input id="ndate" class="field" type="date" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
      <div class="btn-pair">
        <button
          type="button"
          class="btn btn-primary"
          disabled={!text.trim()}
          onClick={async () => {
            await d.add(K.SAVED, `note:${Date.now().toString(36)}`, {
              kind: 'note',
              src: 'My note',
              q: `Note about ${d.partner}`,
              theirs: '',
              mine: '',
              label,
              note: text.trim(),
              date,
              t: Date.now(),
            } satisfies SavedItem);
            onDone();
          }}
        >
          Save note
        </button>
        <button type="button" class="btn btn-secondary btn-narrow" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
