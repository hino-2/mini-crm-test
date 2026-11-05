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
  TASK_HISTORY_QUERY_KEY,
  TASK_QUERY_KEY,
} from '../../shared/api/api.constants';
import { notifyError } from '../../shared/errors/errors.util';
import {
  changeTaskStatus,
  createTask,
  deleteTask,
  fetchMyTasks,
  fetchObjectTasks,
  fetchTask,
  fetchTaskHistory,
  updateTask,
} from '../tasks-api/tasks-api';
import type {
  ChangeTaskStatusVariables,
  MyTaskItem,
  TaskCreateInput,
  TaskDetails,
  TaskHistoryEntry,
  TaskListItem,
  TaskUpdateInput,
} from '../tasks.type';

export function useObjectTasks(objectId: string): UseQueryResult<TaskListItem[], Error> {
  return useQuery({
    queryKey: [OBJECT_TASKS_QUERY_KEY, objectId],
    queryFn: () => fetchObjectTasks(objectId),
  });
}

export function useTask(taskId: string): UseQueryResult<TaskDetails | null, Error> {
  return useQuery({
    queryKey: [TASK_QUERY_KEY, taskId],
    queryFn: () => fetchTask(taskId),
  });
}

export function useTaskHistory(taskId: string): UseQueryResult<TaskHistoryEntry[], Error> {
  return useQuery({
    queryKey: [TASK_HISTORY_QUERY_KEY, taskId],
    queryFn: () => fetchTaskHistory(taskId),
  });
}

export function useMyTasks(assigneeId: string): UseQueryResult<MyTaskItem[], Error> {
  return useQuery({
    queryKey: [MY_TASKS_QUERY_KEY, assigneeId],
    queryFn: () => fetchMyTasks(assigneeId),
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

export function useChangeTaskStatus(
  taskId: string,
): UseMutationResult<void, Error, ChangeTaskStatusVariables> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ChangeTaskStatusVariables>({
    mutationFn: ({ toStatus, comment }: ChangeTaskStatusVariables) =>
      changeTaskStatus(taskId, toStatus, comment),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [TASK_QUERY_KEY, taskId] }),
        queryClient.invalidateQueries({ queryKey: [TASK_HISTORY_QUERY_KEY, taskId] }),
        queryClient.invalidateQueries({ queryKey: [OBJECT_TASKS_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [MY_TASKS_QUERY_KEY] }),
      ]);
    },
    onError: notifyError,
  });
}

export function useUpdateTask(taskId: string): UseMutationResult<void, Error, TaskUpdateInput> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, TaskUpdateInput>({
    mutationFn: (input: TaskUpdateInput) => updateTask(taskId, input),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [TASK_QUERY_KEY, taskId] }),
        queryClient.invalidateQueries({ queryKey: [OBJECT_TASKS_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [OBJECT_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [OBJECTS_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [MY_TASKS_QUERY_KEY] }),
      ]);
    },
    onError: notifyError,
  });
}

export function useDeleteTask(taskId: string): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: () => deleteTask(taskId),
    onSuccess: async () => {
      const refetchType = 'none';

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [TASK_QUERY_KEY, taskId], refetchType }),
        queryClient.invalidateQueries({ queryKey: [TASK_HISTORY_QUERY_KEY, taskId], refetchType }),
        queryClient.invalidateQueries({ queryKey: [OBJECT_TASKS_QUERY_KEY], refetchType }),
        queryClient.invalidateQueries({ queryKey: [OBJECT_QUERY_KEY], refetchType }),
        queryClient.invalidateQueries({ queryKey: [OBJECTS_QUERY_KEY], refetchType }),
        queryClient.invalidateQueries({ queryKey: [MY_TASKS_QUERY_KEY], refetchType }),
      ]);
    },
    onError: notifyError,
  });
}
