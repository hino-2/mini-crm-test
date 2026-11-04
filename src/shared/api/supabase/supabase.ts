import { createClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { readSupabaseEnv } from './supabase.util';

const env = readSupabaseEnv(import.meta.env);

export const supabase = createClient<Database>(env.url, env.anonKey);
