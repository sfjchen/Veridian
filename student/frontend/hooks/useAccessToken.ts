import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

const ENV_TOKEN = process.env.EXPO_PUBLIC_SUPABASE_ACCESS_TOKEN?.trim() ?? null;

/** Returns Supabase session access token or env fallback for API auth. */
export function useAccessToken(): string | null {
  const [token, setToken] = useState<string | null>(ENV_TOKEN);

  useEffect(() => {
    if (!supabase) {
      setToken(ENV_TOKEN);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? ENV_TOKEN);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? ENV_TOKEN);
    });
    return () => subscription.unsubscribe();
  }, []);

  return token;
}
