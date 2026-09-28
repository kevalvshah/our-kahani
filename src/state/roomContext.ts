import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Room } from './room';

export interface RoomState {
  room: Room | null;
  setRoom: (room: Room | null) => void;
}

export const RoomContext = createContext<RoomState>({ room: null, setRoom: () => {} });

export function useRoom(): RoomState {
  return useContext(RoomContext);
}
