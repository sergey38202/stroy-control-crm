import { createClient } from '@supabase/supabase-js';

import type { Database } from '../types/database';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

function isPublicClientKey() {
  if (key.startsWith('sb_publishable_')) return key.length > 20;
  // Configuration sanity check only, never an authorization decision.
  // This refuses legacy service_role JWTs as well as modern secret keys.

  try {
    const parts = key.split('.');
    if (parts.length !== 3) return false;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const value: unknown = JSON.parse(
      atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))
    );
    return (
      typeof value === 'object' &&
      value !== null &&
      'role' in value &&
      value.role === 'anon'
    );
  } catch {
    return false;
  }
}

function validConfiguration() {
  try {
    return (
      ['https:', 'http:'].includes(new URL(url).protocol) &&
      !url.includes('YOUR_PROJECT_REF') &&
      isPublicClientKey()
    );
  } catch {
    return false;
  }
}

export const supabase = validConfiguration()
  ? createClient<Database>(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(30000)])
              : AbortSignal.timeout(30000),
          }),
      },
    })
  : null;

export function db() {
  if (!supabase) throw new Error('CONFIG_REQUIRED');
  return supabase;
}
