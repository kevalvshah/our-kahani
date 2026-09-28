import { useEffect, useState } from 'preact/hooks';
import { Em } from './components';

// Add to Home Screen on Chrome (Android and laptops), which offers a prompt we can show on a
// tap. iPhone Safari has no prompt; the Today screen's note gives the Share steps there.

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** Call once at start-up: Chrome fires the event early, often before any screen renders. */
export function captureInstallPrompt() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

const DISMISS_KEY = 'ok.install-hint-dismissed';

export function InstallHint() {
  const [, bump] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  if (dismissed || !deferred) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Storage blocked: it just shows again next time.
    }
  }

  return (
    <div class="panel panel-gold install">
      <div class="panel-title">
        <Em>📲</Em> Keep Our Kahani on your Home Screen
      </div>
      <p class="small">It opens like an app, one tap from your Home Screen.</p>
      <div class="btn-pair">
        <button
          type="button"
          class="btn btn-primary"
          onClick={async () => {
            const e = deferred!;
            await e.prompt();
            await e.userChoice;
            deferred = null;
            bump((n) => n + 1);
          }}
        >
          Add it
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-narrow"
          onClick={dismiss}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
