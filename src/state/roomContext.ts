import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Room } from './room';

export type RoomStatus = 'loading' | 'ready' | 'lost-access';

export interface RoomState {
  room: Room | null;
  status: RoomStatus;
  offline: boolean;
  setRoom: (room: Room | null) => void;
}

export const RoomContext = createContext<RoomState>({
  room: null,
  status: 'loading',
  offline: false,
  setRoom: () => {},
});

export function useRoom(): RoomState {
  return useContext(RoomContext);
}
