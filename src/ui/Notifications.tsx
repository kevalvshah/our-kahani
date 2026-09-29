import { useEffect, useState } from 'preact/hooks';
import { useRoomData } from '../data/RoomData';
import { keyBytes } from '../net/push';
import { controller } from '../state/controller';
import { Problem } from './components';

// Optional notifications, per device. When your person sends something, this device shows
// "Your room needs attention": never a name, never what was sent. Browser glue (covered by e2e).

type State = 'checking' | 'unsupported' | 'ios-install' | 'blocked' | 'off' | 'on';

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function iosNotInstalled(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  return navigator.serviceWorker.getRegistration();
}

// Whether this device switched notifications on, kept on the device. The push API itself is only
// touched after a tap (some browsers' push support misbehaves when merely asked for its state).
const flagKey = (room: string) => `ok.push.${room}`;
function readFlag(room: string): boolean {
  try {
    return localStorage.getItem(flagKey(room)) === '1';
  } catch {
    return false;
  }
}
function writeFlag(room: string, on: boolean) {
  try {
    if (on) localStorage.setItem(flagKey(room), '1');
    else localStorage.removeItem(flagKey(room));
  } catch {
    // Storage blocked: the switch just shows off next time.
  }
}

export function NotificationSwitch() {
  const d = useRoomData();
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (iosNotInstalled()) return setState('ios-install');
    if (!supported()) return setState('unsupported');
    if (Notification.permission === 'denied') return setState('blocked');
    setState(Notification.permission === 'granted' && readFlag(d.room.id) ? 'on' : 'off');
  }, [d.room.id]);

  async function turnOn() {
    const reg = await registration();
    if (!reg) throw new Error('no-sw');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setState(permission === 'denied' ? 'blocked' : 'off');
      return;
    }
    const push = controller().push;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(await push.publicKey()) }));
    await push.subscribe(d.room.id, sub.endpoint);
    writeFlag(d.room.id, true);
    setState('on');
  }

  async function turnOff() {
    const sub = await (await registration())?.pushManager.getSubscription();
    if (sub) {
      await controller().push.unsubscribe(sub.endpoint).catch(() => undefined);
      await sub.unsubscribe();
    }
    writeFlag(d.room.id, false);
    setState('off');
  }

  async function toggle() {
    setBusy(true);
    setProblem(null);
    try {
      await (state === 'on' ? turnOff() : turnOn());
    } catch (e) {
      setProblem(
        e instanceof Error && e.message === 'no-sw'
          ? 'Notifications work once the app has finished loading. Reload and try again.'
          : 'Could not switch notifications on in this browser. Try again, or keep checking in yourself.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (state === 'checking' || state === 'unsupported') return null;
  if (state === 'ios-install') {
    return <p class="small muted">🔔 On iPhone, notifications work after you add Our Kahani to your Home Screen.</p>;
  }

  return (
    <>
      <div class="switch-row">
        <span class="row-text">
          <span class="row-title">Notifications {state === 'on' ? 'on' : 'off'} on this device</span>
          <span class="row-sub">
            {state === 'blocked'
              ? 'Blocked in this browser’s settings. Allow notifications for this site to switch them on.'
              : `When ${d.partner} sends something, this device just says “Your room needs attention”. Never what, never who.`}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={state === 'on'}
          aria-label="Notifications"
          class="switch"
          disabled={busy || state === 'blocked'}
          onClick={() => void toggle()}
        >
          <span class="switch-track">
            <span class="switch-knob" />
          </span>
        </button>
      </div>
      <Problem text={problem} />
    </>
  );
}
