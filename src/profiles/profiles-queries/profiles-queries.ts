import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { EXECUTORS_QUERY_KEY } from '../../shared/api/api.constants';
import { fetchExecutors } from '../profiles-api/profiles-api';
import type { ExecutorOption } from '../profiles.type';

export function useExecutors(): UseQueryResult<ExecutorOption[], Error> {
  return useQuery({ queryKey: [EXECUTORS_QUERY_KEY], queryFn: () => fetchExecutors() });
}
