import { useState } from 'preact/hooks';
import { Em } from './components';

/** A one-time, light hello on first entering the room. Remembered on this device only. */
export function WelcomeNote({ roomId }: { roomId: string }) {
  const key = `ok.welcomed.${roomId}`;
  const [shown, setShown] = useState(() => {
    try {
      return !localStorage.getItem(key);
    } catch {
      return true;
    }
  });
  if (!shown) return null;
  const close = () => {
    try {
      localStorage.setItem(key, '1');
    } catch {
      // Storage blocked: it simply shows again next time.
    }
    setShown(false);
  };
  return (
    <div class="panel welcome-note">
      <div class="panel-title">
        Welcome to your room <Em>💛</Em>
      </div>
      <p class="small">
        This is your little corner for play: silly questions, quick guesses and a few surprises while you get to know each
        other. From the first chat to your own story, it is just one small part of it. The real kahani happens away from the
        screen, on long walks, late-night calls and ordinary days, and the forever part is something you two build together.
        So play here, laugh a lot, and then go and live the rest.
      </p>
      <button type="button" class="btn-small" onClick={close}>
        Let’s play
      </button>
    </div>
  );
}
