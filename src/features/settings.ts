// Room settings both people can change. Each change is a shared record; the latest one wins.

export interface RoomSettings {
  /** The invited person answers each card first (the default). */
  inviteeFirst: boolean;
}

export const DEFAULT_SETTINGS: RoomSettings = { inviteeFirst: true };

export function currentSettings(records: { data: Partial<RoomSettings>; createdAt: number }[]): RoomSettings {
  const latest = records.reduce<(typeof records)[number] | undefined>((a, r) => (!a || r.createdAt >= a.createdAt ? r : a), undefined);
  return { ...DEFAULT_SETTINGS, ...latest?.data };
}

/** Whether this person should wait for their partner before answering a card. */
export function waitsForPartner(s: RoomSettings, role: 'creator' | 'invitee', cardType: string, answeredByMe: boolean, partnerAnswered: boolean): boolean {
  // A bet is placed before the other person picks, so the creator always goes first there.
  return s.inviteeFirst && role === 'creator' && cardType !== 'bet' && !answeredByMe && !partnerAnswered;
}
