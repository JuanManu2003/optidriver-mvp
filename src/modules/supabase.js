/**
 * supabase.js — Cliente único de Supabase.
 *
 * Las credenciales vienen de variables de entorno (Vite):
 *   VITE_SUPABASE_URL       → URL del proyecto (Settings → API)
 *   VITE_SUPABASE_ANON_KEY  → clave pública "anon"
 *
 * Si no están definidas, `supabase` es null y la app usa el modo local
 * (localStorage + simulador) como respaldo, sin romperse.
 */

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export const hasSupabase = Boolean(supabase);

if (!hasSupabase) {
  console.info('[Supabase] No configurado — usando modo local (simulador + localStorage).');
}
