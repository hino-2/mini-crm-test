import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { DELETED_OBJECTS_QUERY_KEY, DELETED_TASKS_QUERY_KEY } from '../../shared/api/api.constants';
import { notifyError } from '../../shared/errors/errors.util';
import {
  fetchDeletedObjects,
  fetchDeletedTasks,
  restoreObject,
  restoreTask,
} from '../trash-api/trash-api';
import { RESTORE_INVALIDATED_KEYS } from '../trash.constants';
import type { DeletedObject, DeletedTask } from '../trash.type';

async function invalidateAfterRestore(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    RESTORE_INVALIDATED_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  );
}

export function useDeletedObjects(): UseQueryResult<DeletedObject[], Error> {
  return useQuery({ queryKey: [DELETED_OBJECTS_QUERY_KEY], queryFn: () => fetchDeletedObjects() });
}

export function useDeletedTasks(): UseQueryResult<DeletedTask[], Error> {
  return useQuery({ queryKey: [DELETED_TASKS_QUERY_KEY], queryFn: () => fetchDeletedTasks() });
}

export function useRestoreObject(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (objectId: string) => restoreObject(objectId),
    onSuccess: () => invalidateAfterRestore(queryClient),
    onError: notifyError,
  });
}

export function useRestoreTask(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (taskId: string) => restoreTask(taskId),
    onSuccess: () => invalidateAfterRestore(queryClient),
    onError: notifyError,
  });
}
