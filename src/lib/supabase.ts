import { createClient, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { SaveData } from '../types/game';

const env = (
  import.meta as unknown as { env?: Record<string, string | undefined> }
).env;

const SUPABASE_URL = (env?.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (env?.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = (): boolean =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!clientInstance) {
    clientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return clientInstance;
}

export interface CloudAuthSession {
  user: User;
  accessToken: string;
}

export interface MatchResultRow {
  id: string;
  room_id: string;
  mode: 'coop' | 'competitive';
  wave_reached: number;
  winner_user_id: string | null;
  reason: string;
  players: Array<{
    playerId: string;
    userId?: string | null;
    username: string;
    kills: number;
    score: number;
    alive: boolean;
  }>;
  created_at: string;
}

export async function getCurrentSupabaseSession(): Promise<CloudAuthSession | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data, error } = await sb.auth.getSession();
  if (error || !data.session) return null;
  return {
    user: data.session.user,
    accessToken: data.session.access_token,
  };
}

export function subscribeSupabaseAuth(
  cb: (session: CloudAuthSession | null) => void
): () => void {
  const sb = getSupabaseClient();
  if (!sb) return () => {};
  const {
    data: { subscription },
  } = sb.auth.onAuthStateChange((_event, session: Session | null) => {
    if (session?.user && session.access_token) {
      cb({ user: session.user, accessToken: session.access_token });
    } else {
      cb(null);
    }
  });
  return () => subscription.unsubscribe();
}

export async function signUpWithEmail(
  email: string,
  password: string,
  username: string
): Promise<{
  ok: boolean;
  message: string;
  needsEmailConfirm?: boolean;
  session?: CloudAuthSession | null;
}> {
  const sb = getSupabaseClient();
  if (!sb) {
    return {
      ok: false,
      message: 'Supabase is not configured. Add VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY.',
    };
  }
  const cleanEmail = email.trim();
  const cleanName = username.trim().slice(0, 16) || 'Survivor';
  const { data, error } = await sb.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: { username: cleanName },
    },
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  if (data.session && data.user) {
    return {
      ok: true,
      message: 'Account created and signed in.',
      session: { user: data.user, accessToken: data.session.access_token },
    };
  }
  return {
    ok: true,
    needsEmailConfirm: true,
    message: 'Account created! Check your email to confirm, then sign in.',
    session: null,
  };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{
  ok: boolean;
  message: string;
  session?: CloudAuthSession | null;
}> {
  const sb = getSupabaseClient();
  if (!sb) {
    return {
      ok: false,
      message: 'Supabase is not configured. Add VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY.',
    };
  }
  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data.session || !data.user) {
    return { ok: false, message: 'Sign-in succeeded but no session returned.' };
  }
  return {
    ok: true,
    message: `Signed in as ${data.user.email || 'Operator'}.`,
    session: { user: data.user, accessToken: data.session.access_token },
  };
}

export async function signOutSupabase(): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  await sb.auth.signOut();
}

export async function fetchCloudSave(userId: string): Promise<unknown | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from('player_saves')
    .select('save_data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.save_data ?? null;
}

export async function upsertCloudSave(
  userId: string,
  saveData: SaveData
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: 'Supabase not configured' };

  const { error } = await sb.from('player_saves').upsert(
    {
      user_id: userId,
      username: saveData.profile.username,
      avatar_id: saveData.profile.avatarId,
      level: saveData.profile.level,
      xp: saveData.profile.xp,
      coins: saveData.coins,
      gems: saveData.gems,
      highest_wave: saveData.highestWave,
      total_kills: saveData.totalKills,
      games_played: saveData.gamesPlayed,
      best_survival_time: saveData.bestSurvivalTime,
      save_data: saveData,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function fetchRecentMatchResults(limit = 8): Promise<MatchResultRow[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from('match_results')
    .select('id, room_id, mode, wave_reached, winner_user_id, reason, players, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as MatchResultRow[];
}
