import { ApiError } from '../net/api';
import { SessionError } from '../net/session';

/** Plain words for anything that can go wrong. Never shows raw errors or ids. */
export function problemText(e: unknown): string {
  // Recovery-word problems already carry a plain message (loaded on demand, so match by name).
  if (e instanceof Error && e.name === 'PhraseError') return e.message;
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'offline':
        return 'You seem to be offline. Check your connection and try again.';
      case 'too-many-rooms':
        return 'You already have three open rooms on this device.';
      case 'invalid-invite':
        return 'This invite is not valid any more. Invites last 48 hours: ask for a new one.';
      case 'room-full':
        return 'This room already has two people.';
      case 'room-full-data':
        return 'This room is full. Download everything, then start a new room to keep playing.';
      case 'photo-limit':
        return 'This room already has 20 photos. Delete one to share another.';
      case 'room-ended':
        return 'This room has ended.';
      case 'not-found':
        return 'Those words do not match a room that is still open.';
      case 'paused':
        return 'New rooms are paused for a little while. Please try again in a few days.';
      case 'read-only':
        return 'Our server is read-only for now. You can still read everything and download your room data.';
      default:
        break;
    }
  }
  if (e instanceof SessionError) return 'We could not reach our server just now. Please try again in a moment.';
  return 'Something went wrong. Please try again.';
}
