import { supabase } from '../../shared/api/supabase/supabase';
import type { ExecutorOption } from '../profiles.type';

export async function fetchExecutors(): Promise<ExecutorOption[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'executor')
    .order('full_name');

  if (error) {
    throw error;
  }

  return data;
}
