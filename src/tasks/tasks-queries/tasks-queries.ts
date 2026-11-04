import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  MY_TASKS_QUERY_KEY,
  OBJECTS_QUERY_KEY,
  OBJECT_QUERY_KEY,
  OBJECT_TASKS_QUERY_KEY,
} from '../../shared/api/api.constants';
import { notifyError } from '../../shared/errors/errors.util';
import { createTask, fetchObjectTasks } from '../tasks-api/tasks-api';
import type { TaskCreateInput, TaskListItem } from '../tasks.type';

export function useObjectTasks(objectId: string): UseQueryResult<TaskListItem[], Error> {
  return useQuery({
    queryKey: [OBJECT_TASKS_QUERY_KEY, objectId],
    queryFn: () => fetchObjectTasks(objectId),
  });
}

export function useCreateTask(objectId: string): UseMutationResult<void, Error, TaskCreateInput> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, TaskCreateInput>({
    mutationFn: (input: TaskCreateInput) => createTask(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [OBJECT_TASKS_QUERY_KEY, objectId] }),
        queryClient.invalidateQueries({ queryKey: [OBJECT_QUERY_KEY, objectId] }),
        queryClient.invalidateQueries({ queryKey: [OBJECTS_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [MY_TASKS_QUERY_KEY] }),
      ]);
    },
    onError: notifyError,
  });
}
