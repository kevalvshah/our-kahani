import { useEffect, useRef, useState } from 'preact/hooks';
import { isInAppBrowser } from '../platform/inAppBrowser';
import { controller } from '../state/controller';
import { dayOfSeason, daysLeft, SEASON_DAYS, type Room } from '../state/room';
import { RoomContext, type RoomStatus } from '../state/roomContext';
import { Em, Link } from './components';
import { PATHS, useRoute, type Route } from './router';
import { Blocked } from './screens/Blocked';
import { Card } from './screens/Card';
import { Gentle, Movie, Packs, Photo, RoomData, Saved } from './screens/Features';
import { Invite, Join } from './screens/Invite';
import { LookScreen } from './screens/Look';
import { Today } from './screens/Today';

// One app, every browser: phones get the header and bottom tabs; at laptop width the sidebar
// takes over and the tabs and header hide (all in CSS, see app.css).

const NAV: { route: Exclude<Route, 'join'>; label: string; emoji: string }[] = [
  { route: 'today', label: 'Today', emoji: '🏠' },
  { route: 'card', label: 'Card', emoji: '🃏' },
  { route: 'packs', label: 'Packs', emoji: '🗂️' },
  { route: 'movie', label: 'Movie Night', emoji: '🍿' },
  { route: 'photo', label: 'Right Now', emoji: '📷' },
  { route: 'gentle', label: 'Gentle Corner', emoji: '💛' },
  { route: 'saved', label: 'Saved', emoji: '🔖' },
  { route: 'room', label: 'Room data', emoji: '🗄️' },
  { route: 'invite', label: 'Invite', emoji: '🔗' },
  { route: 'look', label: 'Make it ours', emoji: '🎨' },
];

const TABS: { route: Exclude<Route, 'join'>; label: string; emoji: string }[] = [
  { route: 'today', label: 'Today', emoji: '🏠' },
  { route: 'packs', label: 'Packs', emoji: '🃏' },
  { route: 'saved', label: 'Saved', emoji: '🔖' },
  { route: 'room', label: 'Room', emoji: '🗄️' },
];

export function App() {
  // Checked before anything touches the invite key.
  if (isInAppBrowser(navigator.userAgent)) return <Blocked />;
  return <Shell />;
}

function Shell() {
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<RoomStatus>('loading');
  const [offline, setOffline] = useState(false);
  const route = useRoute();

  // Load this device's room (key from IndexedDB, details from the server).
  useEffect(() => {
    let live = true;
    void controller()
      .load()
      .then((r) => {
        if (!live) return;
        setRoom(r.state === 'ready' ? r.room : null);
        setOffline(r.state === 'ready' && !!r.offline);
        setStatus(r.state === 'lost-access' ? 'lost-access' : 'ready');
      })
      .catch(() => live && setStatus('ready'));
    return () => {
      live = false;
    };
  }, []);

  function updateRoom(next: Room | null) {
    setRoom(next);
    setStatus('ready');
  }
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);

  // After in-app navigation, move focus to the new screen's heading for keyboard and
  // screen reader users.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [route]);

  const active = (r: Route) => r === route || (r === 'today' && route === 'card');
  const kicker = room
    ? `Day ${dayOfSeason(room)} of ${SEASON_DAYS} · room ends in ${daysLeft(room)} days`
    : 'Season 1 · Pehli Baat';

  return (
    <RoomContext.Provider value={{ room, status, offline, setRoom: updateRoom }}>
      <a class="skip" href="#main">Skip to content</a>
      <div class="shell">
        <aside class="sidebar">
          <div class="sidebar-mark">Our Kahani</div>
          <div class="kicker sidebar-kicker">{kicker}</div>
          <nav aria-label="All screens">
            {NAV.map((n) => (
              <Link
                key={n.route}
                href={PATHS[n.route]}
                class={route === n.route ? 'side-link is-active' : 'side-link'}
                aria-current={route === n.route ? 'page' : undefined}
              >
                <Em>{n.emoji}</Em>
                <span>{n.label}</span>
              </Link>
            ))}
          </nav>
          <p class="sidebar-foot">Encrypted on this device. Sign-in is a link, never an email address.</p>
        </aside>

        <div class="column">
          <header class="app-header">
            <div>
              <div class="header-mark">Our Kahani</div>
              <div class="kicker">{kicker}</div>
            </div>
            <span class="e2e" title="End-to-end encrypted">
              E2E<span class="sr-only"> end-to-end encrypted</span>
            </span>
          </header>

          <main id="main" ref={main} class="scroll">
            <div class="content">
              {route === 'today' && <Today />}
              {route === 'card' && <Card />}
              {route === 'packs' && <Packs />}
              {route === 'movie' && <Movie />}
              {route === 'photo' && <Photo />}
              {route === 'gentle' && <Gentle />}
              {route === 'saved' && <Saved />}
              {route === 'room' && <RoomData />}
              {route === 'invite' && <Invite />}
              {route === 'look' && <LookScreen />}
              {route === 'join' && <Join />}
            </div>
          </main>

          <nav class="tabs" aria-label="Main">
            {TABS.map((t) => (
              <Link
                key={t.route}
                href={PATHS[t.route]}
                class={active(t.route) ? 'tab is-active' : 'tab'}
                aria-current={route === t.route ? 'page' : undefined}
              >
                <Em>{t.emoji}</Em>
                <span class="tab-label">{t.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </RoomContext.Provider>
  );
}
