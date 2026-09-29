import { useEffect, useState } from 'preact/hooks';
import { K } from '../data/kinds';
import { useRoomData } from '../data/RoomData';
import { pauseLeft } from '../features/together';

/** The partner's "I need 20 minutes" pause, shown calmly on every screen while it lasts. */
export function PartnerPause() {
  const d = useRoomData();
  const until = d.theirs<{ until: number }>(K.PAUSE, 'pause')?.data.until;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, [until]);
  const left = pauseLeft(until);
  if (!left) return null;
  return (
    <p class="pause-banner" role="status">
      ⏸️ {d.partner} needs a little time and is not going anywhere 💛 Back in about {left} min.
    </p>
  );
}
