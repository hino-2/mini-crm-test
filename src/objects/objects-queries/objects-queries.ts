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
  TASK_QUERY_KEY,
} from '../../shared/api/api.constants';
import { notifyError } from '../../shared/errors/errors.util';
import {
  createObject,
  deleteObject,
  fetchObject,
  fetchObjects,
  updateObject,
} from '../objects-api/objects-api';
import type { ObjectInput, ObjectSummary } from '../objects.type';

export function useObjects(): UseQueryResult<ObjectSummary[], Error> {
  return useQuery({ queryKey: [OBJECTS_QUERY_KEY], queryFn: () => fetchObjects() });
}

export function useObject(objectId: string): UseQueryResult<ObjectSummary | null, Error> {
  return useQuery({
    queryKey: [OBJECT_QUERY_KEY, objectId],
    queryFn: () => fetchObject(objectId),
  });
}

export function useCreateObject(): UseMutationResult<void, Error, ObjectInput> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ObjectInput>({
    mutationFn: (input: ObjectInput) => createObject(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [OBJECTS_QUERY_KEY] }),
    onError: notifyError,
  });
}

export function useUpdateObject(objectId: string): UseMutationResult<void, Error, ObjectInput> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ObjectInput>({
    mutationFn: (input: ObjectInput) => updateObject(objectId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [OBJECTS_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [OBJECT_QUERY_KEY, objectId] }),
        queryClient.invalidateQueries({ queryKey: [TASK_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [MY_TASKS_QUERY_KEY] }),
      ]);
    },
    onError: notifyError,
  });
}

export function useDeleteObject(objectId: string): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: () => deleteObject(objectId),
    onSuccess: async () => {
      const refetchType = 'none';

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [OBJECTS_QUERY_KEY], refetchType }),
        queryClient.invalidateQueries({ queryKey: [OBJECT_QUERY_KEY, objectId], refetchType }),
        queryClient.invalidateQueries({
          queryKey: [OBJECT_TASKS_QUERY_KEY, objectId],
          refetchType,
        }),
        queryClient.invalidateQueries({ queryKey: [TASK_QUERY_KEY], refetchType }),
        queryClient.invalidateQueries({ queryKey: [MY_TASKS_QUERY_KEY], refetchType }),
      ]);
    },
    onError: notifyError,
  });
}
