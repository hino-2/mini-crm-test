import type {
  TaskFieldHistoryEntry,
  TaskHistoryEntry,
  TaskStatusHistoryEntry,
} from '../tasks.type';

export function mergeTaskHistory(
  statusEntries: readonly TaskStatusHistoryEntry[],
  fieldEntries: readonly TaskFieldHistoryEntry[],
): TaskHistoryEntry[] {
  const all: TaskHistoryEntry[] = [...statusEntries, ...fieldEntries];

  return all.sort(
    (a, b) =>
      Date.parse(a.changed_at) - Date.parse(b.changed_at) ||
      (a.kind === b.kind ? 0 : a.kind === 'status' ? -1 : 1) ||
      a.id - b.id,
  );
}
