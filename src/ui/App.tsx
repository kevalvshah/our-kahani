import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { K } from '../data/kinds';
import { RoomDataProvider, useMaybeRoomData } from '../data/RoomData';
import { firstWaiting } from '../features/progress';
import { isInAppBrowser } from '../platform/inAppBrowser';
import { controller } from '../state/controller';
import { dayOfSeason, daysLeft, SEASON_DAYS, type Room } from '../state/room';
import { RoomContext, type RoomStatus } from '../state/roomContext';
import { Em, Link } from './components';
import { cardPath, navigate, PATHS, useRoute, type Route, type RouteName } from './router';
import { Blocked } from './screens/Blocked';
import { lazy } from './lazy';
import { CardScreen } from './screens/CardScreen';
import { Invite, Join } from './screens/Invite';
import { AddCard, PackScreen, Packs } from './screens/Packs';
import { Today, Welcome } from './screens/Today';

// Everything not on the first screen loads when opened.
const MicroDates = lazy(() => import('./screens/Games').then((m) => m.MicroDates));
const Antakshari = lazy(() => import('./screens/Games').then((m) => m.Antakshari));
const StoryRelay = lazy(() => import('./screens/Games').then((m) => m.StoryRelay));
const TimeCapsule = lazy(() => import('./screens/Games').then((m) => m.TimeCapsule));
const GentleCorner = lazy(() => import('./screens/Gentle').then((m) => m.GentleCorner));
const LookScreen = lazy(() => import('./screens/Look').then((m) => m.LookScreen));
const MovieNight = lazy(() => import('./screens/Movie').then((m) => m.MovieNight));
const Photo = lazy(() => import('./screens/Photo').then((m) => m.Photo));
const Privacy = lazy(() => import('./screens/Privacy').then((m) => m.Privacy));
const RoomDataScreen = lazy(() => import('./screens/RoomData').then((m) => m.RoomDataScreen));
const RetentionModal = lazy(() => import('./screens/RoomData').then((m) => m.RetentionModal));
const Saved = lazy(() => import('./screens/Saved').then((m) => m.Saved));
const ProfileSetup = lazy(() => import('./screens/Setup').then((m) => m.ProfileSetup));
const RoomPhrase = lazy(() => import('./screens/Setup').then((m) => m.RoomPhrase));
const Recover = lazy(() => import('./screens/Setup').then((m) => m.Recover));

// One app, every browser: phones get the header and bottom tabs; at laptop width the sidebar
// takes over and the tabs and header hide (all in CSS, see app.css).

const NAV: { route: keyof typeof PATHS; label: string; emoji: string }[] = [
  { route: 'today', label: 'Today', emoji: '🏠' },
  { route: 'next', label: "Today's card", emoji: '🃏' },
  { route: 'packs', label: 'Packs', emoji: '🗂️' },
  { route: 'movie', label: 'Movie Night', emoji: '🍿' },
  { route: 'micro', label: 'Micro-Dates', emoji: '🎲' },
  { route: 'antakshari', label: 'Antakshari', emoji: '🎵' },
  { route: 'story', label: 'Story Relay', emoji: '📖' },
  { route: 'photo', label: 'Right Now', emoji: '📷' },
  { route: 'gentle', label: 'Gentle Corner', emoji: '💛' },
  { route: 'saved', label: 'Saved', emoji: '🔖' },
  { route: 'room', label: 'Room data', emoji: '🗄️' },
  { route: 'invite', label: 'Invite', emoji: '🔗' },
  { route: 'look', label: 'Make it ours', emoji: '🎨' },
];

const TABS: { route: keyof typeof PATHS; label: string; emoji: string }[] = [
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
  // The room's hashtag once both have locked it: the room's name in the header and tab title.
  const [roomName, setRoomName] = useState<string | null>(null);
  const route = useRoute();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);

  // Load this device's room (keys from IndexedDB, details from the server).
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

  // After in-app navigation, move focus to the new screen's heading.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [route]);

  function updateRoom(next: Room | null) {
    setRoom(next);
    setStatus('ready');
  }

  const kicker = room ? `Day ${dayOfSeason(room)} of ${SEASON_DAYS} · room ends in ${daysLeft(room)} days` : 'Season 1 · Pehli Baat';
  const active = (name: RouteName) =>
    name === route.name || (name === 'today' && (route.name === 'card' || route.name === 'next')) || (name === 'packs' && route.name === 'pack');

  return (
    <RoomContext.Provider value={{ room, status, offline, setRoom: updateRoom }}>
      <a class="skip" href="#main">
        Skip to content
      </a>
      <div class="shell">
        <aside class="sidebar">
          <div class="sidebar-mark">{roomName ?? 'Our Kahani'}</div>
          <div class="kicker sidebar-kicker">{kicker}</div>
          <nav aria-label="All screens">
            {NAV.map((n) => (
              <Link key={n.route} href={PATHS[n.route]} class={route.name === n.route ? 'side-link is-active' : 'side-link'} aria-current={route.name === n.route ? 'page' : undefined}>
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
              <div class="header-mark">{roomName ?? 'Our Kahani'}</div>
              <div class="kicker">{kicker}</div>
            </div>
            <Link class="e2e" href={PATHS.privacy} title="End-to-end encrypted">
              E2E<span class="sr-only"> end-to-end encrypted: how it works</span>
            </Link>
          </header>

          <main id="main" ref={main} class="scroll">
            {offline && (
              <p class="offline" role="status">
                Offline: showing what is on this phone. Changes will not send until you are back online.
              </p>
            )}
            <div class="content">
              {room ? (
                <RoomDataProvider room={room}>
                  <InRoom route={route} onName={setRoomName} />
                </RoomDataProvider>
              ) : (
                <NoRoom route={route} />
              )}
            </div>
          </main>

          <nav class="tabs" aria-label="Main">
            {TABS.map((t) => (
              <Link key={t.route} href={PATHS[t.route]} class={active(t.route) ? 'tab is-active' : 'tab'} aria-current={route.name === t.route ? 'page' : undefined}>
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

/** Screens before this device has a room. */
function NoRoom({ route }: { route: Route }) {
  switch (route.name) {
    case 'join':
      return <Join />;
    case 'recover':
      return <Recover />;
    case 'look':
      return <LookScreen />;
    case 'privacy':
      return <Privacy />;
    case 'invite':
      return <Invite />;
    default:
      return <Welcome />;
  }
}

/** Screens inside a room, after first-run setup. */
function InRoom({ route, onName }: { route: Route; onName: (name: string | null) => void }) {
  const d = useMaybeRoomData()!;
  const hashtag = d.list<{ tag: string }>(K.HASHTAG)[0]?.data.tag ?? null;
  useEffect(() => {
    onName(hashtag);
    document.title = hashtag ? `${hashtag} · Our Kahani` : 'Our Kahani';
    return () => {
      onName(null);
      document.title = 'Our Kahani';
    };
  }, [hashtag]);
  if (route.name === 'join') return <Join />;
  if (!d.loaded) {
    return (
      <p class="caption" role="status">
        Opening your room…
      </p>
    );
  }
  // First run: your name. Once you have both locked the hashtag, each picks a room phrase
  // (hashtag + phrase is the way back in on another device); nothing else opens until then.
  if (!d.myProfile) return <ProfileSetup />;
  if (!d.room.backedUp && d.list(K.HASHTAG).length > 0) return <RoomPhrase />;
  return (
    <>
      <Screen route={route} />
      {route.name === 'today' && <RetentionModal />}
    </>
  );
}

function Screen({ route }: { route: Route }): ComponentChildren {
  const d = useMaybeRoomData()!;
  switch (route.name) {
    case 'card':
      return <CardScreen key={route.ref} cardRef={route.ref} />;
    case 'next': {
      const next = firstWaiting(d);
      queueMicrotask(() => navigate(next ? cardPath(next) : PATHS.today, { replace: true }));
      return null;
    }
    case 'packs':
      return <Packs />;
    case 'pack':
      return <PackScreen id={route.id} />;
    case 'add':
      return <AddCard />;
    case 'micro':
      return <MicroDates />;
    case 'antakshari':
      return <Antakshari />;
    case 'story':
      return <StoryRelay />;
    case 'capsule':
      return <TimeCapsule />;
    case 'movie':
      return <MovieNight />;
    case 'photo':
      return <Photo />;
    case 'gentle':
      return <GentleCorner />;
    case 'saved':
      return <Saved />;
    case 'room':
      return <RoomDataScreen />;
    case 'invite':
      return <Invite />;
    case 'look':
      return <LookScreen />;
    case 'privacy':
      return <Privacy />;
    case 'recover':
      return <Recover />;
    default:
      return <Today />;
  }
}
