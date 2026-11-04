import { createClient } from '@supabase/supabase-js';
import { readSupabaseEnv } from './supabase.util';

const env = readSupabaseEnv(import.meta.env);

export const supabase = createClient(env.url, env.anonKey);
