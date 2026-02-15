import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

const storage =
  Platform.OS === 'web'
    ? {
        getItem: (k: string) => {
          try {
            return Promise.resolve(typeof window !== 'undefined' ? window.localStorage.getItem(k) : null);
          } catch {
            return Promise.resolve(null);
          }
        },
        setItem: (k: string, v: string) => {
          try {
            if (typeof window !== 'undefined') window.localStorage.setItem(k, v);
          } catch {
            /* silent fail in private mode */
          }
          return Promise.resolve();
        },
        removeItem: (k: string) => {
          try {
            if (typeof window !== 'undefined') window.localStorage.removeItem(k);
          } catch {
            /* silent fail in private mode */
          }
          return Promise.resolve();
        },
      }
    : AsyncStorage;

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;
