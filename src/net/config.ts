import { DEFAULT_SUPABASE_PUBLISHABLE_KEY, DEFAULT_SUPABASE_URL } from './defaults';

// Public connection details for the Supabase project. The publishable key is meant to be public
// (it only identifies the project); every table is protected by row level security and every
// readable value is ciphertext. CI and local runs can point at another project with the
// VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY environment variables. The build writes the
// same origin into the CSP connect-src, so the app can reach nothing else.

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;

export const SUPABASE_PUBLISHABLE_KEY: string =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
