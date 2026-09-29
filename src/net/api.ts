import { PostgrestClient } from '@supabase/postgrest-js';
import type { Bytes } from '../crypto/bytes';
import type { SessionManager } from './session';

// The only calls the app makes to the server. Everything sent is ids, flags or ciphertext:
// no call below ever carries plaintext a person typed or picked.

/** Postgres bytea travels as "\x<hex>" in JSON. */
export function toBytea(bytes: Uint8Array): string {
  let hex = '\\x';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export function fromBytea(value: string): Bytes {
  if (!/^\\x([0-9a-f]{2})*$/i.test(value)) throw new Error('Not a bytea value');
  const hex = value.slice(2);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export interface RecordRow {
  id: string;
  room_id: string;
  author_id: string;
  kind: number;
  ref: string;
  envelope: Bytes;
  created_at: string;
}

export interface AnswerStatus {
  kind: number;
  ref: string;
  mine: boolean;
}

export interface RoomRow {
  id: string;
  created_at: string;
  ends_at: string;
  invite_expires_at: string;
  members: { user_id: string; role: 'creator' | 'invitee'; joined_at: string }[];
}

/** Maps Postgres error codes raised by the room functions to plain meanings. */
export class ApiError extends Error {
  override name = 'ApiError';
  constructor(
    message: string,
    readonly code:
      | 'invalid-invite'
      | 'room-full'
      | 'room-full-data'
      | 'photo-limit'
      | 'room-ended'
      | 'too-many-rooms'
      | 'not-found'
      | 'phrase-taken'
      | 'rescue-invalid'
      | 'no-partner'
      | 'paused'
      | 'read-only'
      | 'offline'
      | 'other',
  ) {
    super(message);
  }
}

function failWith(error: { code?: string; message?: string } | null, offline: boolean): never {
  if (offline) throw new ApiError('You seem to be offline', 'offline');
  const code = error?.code;
  if (code === 'P0002') throw new ApiError('This invite is not valid', 'invalid-invite');
  if (code === 'P0003') throw new ApiError('This room already has two people', 'room-full');
  if (code === 'P0001') throw new ApiError('Too many open rooms', 'too-many-rooms');
  if (code === 'P0004') throw new ApiError('This room is full', 'room-full-data');
  if (code === 'P0005') throw new ApiError('This room already has 20 photos', 'photo-limit');
  if (code === 'P0006') throw new ApiError('This room has ended', 'room-ended');
  if (code === 'P0007') throw new ApiError('That hashtag and phrase do not match a room', 'not-found');
  if (code === 'P0008') throw new ApiError('New rooms are paused', 'paused');
  if (code === 'P0009') throw new ApiError('That rescue code does not work', 'rescue-invalid');
  if (code === 'P0010') throw new ApiError('Nobody to rescue yet', 'no-partner');
  if (code === '25006') throw new ApiError('The server is read-only for now', 'read-only');
  throw new ApiError(error?.message || 'Something went wrong', 'other');
}

export function createApi(opts: { url: string; apiKey: string; session: SessionManager; fetch?: typeof fetch }) {
  const baseFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  // The PostgREST client turns network failures into a generic error, so remember them here.
  let networkFailed = false;
  const authedFetch: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${await opts.session.accessToken()}`);
    networkFailed = false;
    try {
      return await baseFetch(input, { ...init, headers });
    } catch (e) {
      networkFailed = true;
      throw e;
    }
  };
  const fail = (error: { code?: string; message?: string } | null): never => failWith(error, networkFailed);
  const db = new PostgrestClient(`${opts.url}/rest/v1`, { headers: { apikey: opts.apiKey }, fetch: authedFetch });

  return {
    async createRoom(verifier: Bytes): Promise<string> {
      const { data, error } = await db.rpc('create_room', { p_verifier: toBytea(verifier) });
      if (error) fail(error);
      return data as string;
    },

    async joinRoom(roomId: string, token: Bytes): Promise<'creator' | 'invitee'> {
      const { data, error } = await db.rpc('join_room', { p_room: roomId, p_token: toBytea(token) });
      if (error) fail(error);
      return data as 'creator' | 'invitee';
    },

    async getRoom(roomId: string): Promise<RoomRow | null> {
      const { data, error } = await db
        .from('rooms')
        .select('id, created_at, ends_at, invite_expires_at, members(user_id, role, joined_at)')
        .eq('id', roomId)
        .maybeSingle();
      if (error) fail(error);
      return (data as RoomRow | null) ?? null;
    },

    async answers(roomId: string): Promise<AnswerStatus[]> {
      const { data, error } = await db.rpc('room_answers', { p_room: roomId });
      if (error) fail(error);
      return (data as AnswerStatus[]) ?? [];
    },

    /** Records this person may read for one card (theirs, and the partner's once revealed). */
    async records(roomId: string, kind: number, ref: string): Promise<RecordRow[]> {
      const { data, error } = await db
        .from('records')
        .select('id, room_id, author_id, kind, ref, envelope, created_at')
        .eq('room_id', roomId)
        .eq('kind', kind)
        .eq('ref', ref);
      if (error) fail(error);
      return ((data ?? []) as (Omit<RecordRow, 'envelope'> & { envelope: string })[]).map((r) => ({
        ...r,
        envelope: fromBytea(r.envelope),
      }));
    },

    async insertRecord(rec: { id: string; roomId: string; kind: number; ref: string; envelope: Bytes }): Promise<void> {
      const { error } = await db.from('records').insert({
        id: rec.id,
        room_id: rec.roomId,
        kind: rec.kind,
        ref: rec.ref,
        envelope: toBytea(rec.envelope),
      });
      if (error) fail(error);
    },

    async updateRecord(id: string, envelope: Bytes): Promise<boolean> {
      const { data, error } = await db
        .from('records')
        .update({ envelope: toBytea(envelope) })
        .eq('id', id)
        .select('id');
      if (error) {
        if (error.code === '42501') return false; // locked: the partner has answered too
        fail(error);
      }
      return (data ?? []).length === 1;
    },

    /** Every record this person may read in the room (the server applies the reveal rules). */
    async allRecords(roomId: string): Promise<RecordRow[]> {
      const { data, error } = await db
        .from('records')
        .select('id, room_id, author_id, kind, ref, envelope, created_at')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(5000);
      if (error) fail(error);
      return ((data ?? []) as (Omit<RecordRow, 'envelope'> & { envelope: string })[]).map((r) => ({
        ...r,
        envelope: fromBytea(r.envelope),
      }));
    },

    async deleteRecord(id: string): Promise<void> {
      const { error } = await db.from('records').delete().eq('id', id);
      if (error) fail(error);
    },

    /** Votes to keep the room four more weeks. Returns true when both have voted (extended). */
    async voteKeep(roomId: string, keep: boolean): Promise<boolean> {
      const { data, error } = await db.rpc('vote_keep', { p_room: roomId, p_keep: keep });
      if (error) fail(error);
      return data === true;
    },

    /** This person's own keep vote (the partner's is never visible). */
    async myKeepVote(roomId: string): Promise<boolean> {
      const { data, error } = await db.from('keep_votes').select('cycle').eq('room_id', roomId);
      if (error) fail(error);
      return (data ?? []).length > 0;
    },

    async saveBackup(roomId: string, token: Bytes, envelope: Bytes): Promise<void> {
      const { error } = await db.rpc('save_backup', {
        p_room: roomId,
        p_token: toBytea(token),
        p_envelope: toBytea(envelope),
      });
      // Another person already uses this hashtag + phrase (same lookup): ask for another phrase.
      if (error?.code === '23505') throw new ApiError('Pick a different phrase', 'phrase-taken');
      if (error) fail(error);
    },

    async recoverRoom(token: Bytes): Promise<{ roomId: string; role: 'creator' | 'invitee'; envelope: Bytes }> {
      const { data, error } = await db.rpc('recover_room', { p_token: toBytea(token) });
      if (error) fail(error);
      const row = (data as { room_id: string; role: 'creator' | 'invitee'; envelope: string }[] | null)?.[0];
      if (!row) throw new ApiError('That hashtag and phrase do not match a room', 'not-found');
      return { roomId: row.room_id, role: row.role, envelope: fromBytea(row.envelope) };
    },

    // ---- Partner rescue ----------------------------------------------------

    /** This person's own key backup (null if hashtag + phrase do not match it). Moves nothing. */
    async readBackup(token: Bytes): Promise<Bytes | null> {
      const { data, error } = await db.rpc('read_backup', { p_token: toBytea(token) });
      if (error) fail(error);
      return typeof data === 'string' ? fromBytea(data) : null;
    },

    /** Stores the sealed room key for the partner for 24 hours; returns when it expires. */
    async createRescue(roomId: string, token: Bytes, envelope: Bytes): Promise<number> {
      const { data, error } = await db.rpc('create_rescue', { p_room: roomId, p_token: toBytea(token), p_envelope: toBytea(envelope) });
      if (error) fail(error);
      return Date.parse(data as string);
    },

    /** When this person's own rescue for the room expires, or null if none is waiting. */
    async rescueStatus(roomId: string): Promise<number | null> {
      const { data, error } = await db.rpc('rescue_status', { p_room: roomId });
      if (error) fail(error);
      return typeof data === 'string' ? Date.parse(data) : null;
    },

    async cancelRescue(roomId: string): Promise<void> {
      const { error } = await db.rpc('cancel_rescue', { p_room: roomId });
      if (error) fail(error);
    },

    async useRescue(token: Bytes): Promise<{ roomId: string; role: 'creator' | 'invitee'; envelope: Bytes }> {
      const { data, error } = await db.rpc('use_rescue', { p_token: toBytea(token) });
      if (error) fail(error);
      const row = (data as { room_id: string; role: 'creator' | 'invitee'; envelope: string }[] | null)?.[0];
      if (!row) throw new ApiError('That rescue code does not work', 'rescue-invalid');
      return { roomId: row.room_id, role: row.role, envelope: fromBytea(row.envelope) };
    },

    async eraseRoom(roomId: string): Promise<void> {
      const { error } = await db.rpc('erase_room', { p_room: roomId });
      if (error) fail(error);
    },
  };
}

export type Api = ReturnType<typeof createApi>;
