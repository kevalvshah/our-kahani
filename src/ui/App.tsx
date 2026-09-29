import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { K } from '../data/kinds';
import { RoomDataProvider, useMaybeRoomData } from '../data/RoomData';
import { isInAppBrowser } from '../platform/inAppBrowser';
import { controller } from '../state/controller';
import type { Room } from '../state/room';
import { RoomContext, type RoomStatus } from '../state/roomContext';
import { Em, Link } from './components';
import { AREA_PATH, Badge, Toasts, useActivity } from './Activity';
import { PartnerPause } from './PauseBanner';
import type { Area } from '../features/activity';
import { navigate, PATHS, useRoute, type Route, type RouteName } from './router';
import { Blocked } from './screens/Blocked';
import { lazy } from './lazy';
import { Invite, Join } from './screens/Invite';
import { Welcome } from './screens/Welcome';

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
const MediaReminder = lazy(() => import('./screens/RoomData').then((m) => m.MediaReminder));
const Seasons = lazy(() => import('./screens/Seasons').then((m) => m.Seasons));
const SeasonScreen = lazy(() => import('./screens/Seasons').then((m) => m.SeasonScreen));
const Recap = lazy(() => import('./screens/Seasons').then((m) => m.Recap));
const DilKiBaat = lazy(() => import('./screens/Together').then((m) => m.DilKiBaat));
const ShukriyaJar = lazy(() => import('./screens/Rituals').then((m) => m.ShukriyaJar));
const WeeklyHuddle = lazy(() => import('./screens/Rituals').then((m) => m.WeeklyHuddle));
const Today = lazy(() => import('./screens/Today').then((m) => m.Today));
const NextCard = lazy(() => import('./screens/Today').then((m) => m.NextCard));
const CardScreen = lazy(() => import('./screens/CardScreen').then((m) => m.CardScreen));
const Packs = lazy(() => import('./screens/Packs').then((m) => m.Packs));
const PackScreen = lazy(() => import('./screens/Packs').then((m) => m.PackScreen));
const AddCard = lazy(() => import('./screens/Packs').then((m) => m.AddCard));
const DreamsBoard = lazy(() => import('./screens/Rituals').then((m) => m.DreamsBoard));
const HardOrHarmful = lazy(() => import('./screens/Safety').then((m) => m.HardOrHarmful));
const KahaniBook = lazy(() => import('./screens/Book').then((m) => m.KahaniBook));
const Saved = lazy(() => import('./screens/Saved').then((m) => m.Saved));
const ProfileSetup = lazy(() => import('./screens/Setup').then((m) => m.ProfileSetup));
const RoomPhrase = lazy(() => import('./screens/Setup').then((m) => m.RoomPhrase));
const Recover = lazy(() => import('./screens/Setup').then((m) => m.Recover));

// One app, every browser: phones get the header and bottom tabs; at laptop width the sidebar
// takes over and the tabs and header hide (all in CSS, see app.css).

const NAV: { route: keyof typeof PATHS; label: string; emoji: string }[] = [
  { route: 'today', label: 'Today', emoji: '🏠' },
  { route: 'next', label: "Today's card", emoji: '🃏' },
  { route: 'seasons', label: 'Seasons', emoji: '📚' },
  { route: 'packs', label: 'Packs', emoji: '🗂️' },
  { route: 'movie', label: 'Movie Night', emoji: '🍿' },
  { route: 'micro', label: 'Micro-Dates', emoji: '🎲' },
  { route: 'antakshari', label: 'Antakshari', emoji: '🎵' },
  { route: 'story', label: 'Story Relay', emoji: '📖' },
  { route: 'photo', label: 'Right Now', emoji: '📷' },
  { route: 'thanks', label: 'Shukriya jar', emoji: '🫙' },
  { route: 'huddle', label: 'Weekly huddle', emoji: '🤝' },
  { route: 'dreams', label: 'Dreams board', emoji: '🌠' },
  { route: 'gentle', label: 'Gentle Corner', emoji: '💛' },
  { route: 'talk', label: 'Dil ki Baat', emoji: '🫶' },
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
  // Counters for the nav (new things and cards waiting), reported by the room below.
  const [counts, setCounts] = useState<Partial<Record<Area, number>>>({});
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
    // Screens that load on demand show "Loading…" first: wait for their heading to arrive.
    const root = main.current;
    if (!root) return;
    const focusHeading = () => {
      const h1 = root.querySelector<HTMLElement>('h1');
      if (h1) h1.focus();
      return !!h1;
    };
    if (focusHeading()) return;
    const watch = new MutationObserver(() => focusHeading() && watch.disconnect());
    watch.observe(root, { childList: true, subtree: true });
    const stop = setTimeout(() => watch.disconnect(), 10_000);
    return () => {
      watch.disconnect();
      clearTimeout(stop);
    };
  }, [route]);

  function updateRoom(next: Room | null) {
    setRoom(next);
    setStatus('ready');
  }

  const kicker = 'Season 1 · Pehli Baat · at your own pace';
  const active = (name: RouteName) =>
    name === route.name || (name === 'today' && (route.name === 'card' || route.name === 'next')) || (name === 'packs' && route.name === 'pack');

  return (
    <RoomContext.Provider value={{ room, status, offline, setRoom: updateRoom }}>
      <a class="skip" href="#main">
        Skip to content
      </a>
      <div class="shell">
        <aside class="sidebar">
          <div class="sidebar-mark">
            <img class="mark-icon" src="/icons/favicon.svg" alt="" width={32} height={32} />
            {roomName ?? 'Our Kahani'}
          </div>
          <div class="kicker sidebar-kicker">{kicker}</div>
          <nav aria-label="All screens">
            {NAV.map((n) => (
              <Link key={n.route} href={PATHS[n.route]} class={route.name === n.route ? 'side-link is-active' : 'side-link'} aria-current={route.name === n.route ? 'page' : undefined}>
                <Em>{n.emoji}</Em>
                <span>{n.label}</span>
                <Badge n={counts[n.route as Area]} label={n.label} />
              </Link>
            ))}
          </nav>
          <p class="sidebar-foot">Encrypted on this device. Sign-in is a link, never an email address.</p>
        </aside>

        <div class="column">
          <header class="app-header">
            <div>
              <div class="header-mark">
                <img class="mark-icon" src="/icons/favicon.svg" alt="" width={28} height={28} />
                {roomName ?? 'Our Kahani'}
              </div>
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
                  <InRoom route={route} onName={setRoomName} onCounts={setCounts} />
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
                <Badge n={t.route === 'packs' ? (counts.packs ?? 0) : t.route === 'today' ? (Object.entries(counts).filter(([a]) => a !== 'packs').reduce((x, [, n]) => x + (n ?? 0), 0)) : 0} label={t.label} />
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
    case 'safety':
      return <HardOrHarmful />;
    default:
      return <Welcome />;
  }
}

/** Screens inside a room, after first-run setup. */
function InRoom({ route, onName, onCounts }: { route: Route; onName: (name: string | null) => void; onCounts: (c: Partial<Record<Area, number>>) => void }) {
  const d = useMaybeRoomData()!;
  const activity = useActivity(d, route.name);
  const countsKey = JSON.stringify(activity.badges);
  useEffect(() => {
    onCounts(activity.badges);
    return () => onCounts({});
  }, [countsKey]);
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
  // The safety page never waits for the room: it shows at once, and does not flicker away.
  if (route.name === 'safety') return <HardOrHarmful />;
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
      <Toasts items={activity.toasts} onDismiss={activity.dismiss} onOpen={(a) => navigate(AREA_PATH[a])} />
      <PartnerPause />
      <Screen route={route} />
      {route.name === 'today' && <MediaReminder />}
    </>
  );
}

function Screen({ route }: { route: Route }): ComponentChildren {
  switch (route.name) {
    case 'card':
      return <CardScreen key={route.ref} cardRef={route.ref} />;
    case 'next':
      return <NextCard />;
    case 'seasons':
      return <Seasons />;
    case 'season':
      return <SeasonScreen id={route.id} />;
    case 'recap':
      return <Recap />;
    case 'talk':
      return <DilKiBaat />;
    case 'thanks':
      return <ShukriyaJar />;
    case 'huddle':
      return <WeeklyHuddle />;
    case 'dreams':
      return <DreamsBoard />;
    case 'safety':
      return <HardOrHarmful />;
    case 'book':
      return <KahaniBook />;
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
