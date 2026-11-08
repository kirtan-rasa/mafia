import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

export const isSupabaseConfigured = Boolean(url && key);

/** Publishable keys are intended for browser use with RLS enabled. Never expose a service-role key here. */
export const supabase = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

export async function callGame<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error("Игровой сервер ещё не подключён.");
  const { data, error } = await supabase.functions.invoke("game", { body: { action, ...payload } });
  if (error) {
    let message = error.message;
    try {
      const response = error.context as Response | undefined;
      if (response) {
        const body = await response.clone().json() as { error?: string };
        if (body.error) message = body.error;
      }
    } catch {
      // Keep the original SDK message if the response has no JSON body.
    }
    throw new Error(message || "Не удалось связаться с игровым сервером.");
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}
